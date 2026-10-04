import { haversineMeters } from "../residential/anchor-builder.js";

/** 수도권 범위 (경도 최소, 위도 최소, 경도 최대, 위도 최대) */
export const CAPITAL_AREA_BBOX = { minLng: 126.35, minLat: 36.95, maxLng: 127.85, maxLat: 38.25 } as const;

export interface RawStationPlace {
  title: string;
  category: string;
  latitude: number;
  longitude: number;
}

export interface StationRecord {
  id: string;
  name: string;
  kind: "subway" | "rail";
  latitude: number;
  longitude: number;
  sourceCount: number;
}

const STATION_CATEGORIES = ["지하철역", "일반철도역", "기타철도역", "철도/지하철 공용"];

/**
 * 브이월드에 역으로 등록되지 않은 역 (버스정류장·기관으로만 나옴).
 * 네이버 지역 검색으로 좌표를 받아 보충한다. 빠진 역이 보이면 여기에 더한다.
 */
export const SUPPLEMENT_STATIONS = ["동탄역"];

/** 같은 이름이라도 이 거리 밖이면 다른 역 (서울 양평역 vs 경기 양평역) */
const SAME_STATION_METERS = 600;

/** "신림역(2호선)", "신림역 2호선" → "신림역". 역으로 끝나지 않으면 null */
export function normalizeStationName(title: string): string | null {
  const base = title.replace(/\(.*?\)/g, "").replace(/\s+\d+호선.*$/, "").trim();
  return /역$/.test(base) && base.length >= 2 ? base : null;
}

export function isStationCategory(category: string): boolean {
  return STATION_CATEGORIES.some((c) => category.endsWith(c));
}

/**
 * 장소 검색 결과를 역 목록으로 합친다.
 * 같은 이름이 600m 안에 여럿이면(노선별 승강장·출구) 하나로, 좌표는 평균.
 */
export function mergeStations(places: RawStationPlace[]): StationRecord[] {
  const byName = new Map<string, { place: RawStationPlace; subway: boolean }[]>();
  for (const place of places) {
    if (!isStationCategory(place.category)) continue;
    const name = normalizeStationName(place.title);
    if (!name) continue;
    const list = byName.get(name) ?? [];
    list.push({ place, subway: place.category.endsWith("지하철역") });
    byName.set(name, list);
  }

  const stations: StationRecord[] = [];
  for (const [name, list] of byName) {
    const clusters: (typeof list)[] = [];
    for (const item of list) {
      const home = clusters.find((cluster) =>
        cluster.some((c) => haversineMeters(c.place.latitude, c.place.longitude, item.place.latitude, item.place.longitude) <= SAME_STATION_METERS),
      );
      if (home) home.push(item);
      else clusters.push([item]);
    }
    for (const cluster of clusters) {
      const latitude = cluster.reduce((s, c) => s + c.place.latitude, 0) / cluster.length;
      const longitude = cluster.reduce((s, c) => s + c.place.longitude, 0) / cluster.length;
      stations.push({
        id: `${name}@${latitude.toFixed(3)},${longitude.toFixed(3)}`,
        name,
        kind: cluster.some((c) => c.subway) ? "subway" : "rail",
        latitude,
        longitude,
        sourceCount: cluster.length,
      });
    }
  }
  return stations.sort((a, b) => a.id.localeCompare(b.id));
}

interface NaverLocalPage {
  items?: { title?: string; category?: string; mapx?: string; mapy?: string }[];
}

/** 네이버 지역 검색 결과에서 그 이름의 역(지하철·철도 분류)만 골라 장소로 바꾼다 */
export function parseSupplementStation(name: string, body: NaverLocalPage): RawStationPlace[] {
  const coord = (v: string | undefined) => (Math.abs(Number(v)) > 1000 ? Number(v) / 1e7 : Number(v));
  return (body.items ?? []).flatMap((item) => {
    const title = (item.title ?? "").replace(/<[^>]+>/g, "").trim();
    const isStation = /지하철|철도|KTX/.test(item.category ?? "");
    if (!isStation || !title.startsWith(name)) return [];
    return [{ title: name, category: "지하철역", latitude: coord(item.mapy), longitude: coord(item.mapx) }];
  });
}

export async function fetchSupplementStations(keyId: string, key: string, names = SUPPLEMENT_STATIONS): Promise<RawStationPlace[]> {
  const places: RawStationPlace[] = [];
  for (const name of names) {
    const response = await fetch(`https://naverapihub.apigw.ntruss.com/search/v1/local?${new URLSearchParams({ query: name, display: "5", format: "json" })}`, {
      headers: { "X-NCP-APIGW-API-KEY-ID": keyId, "X-NCP-APIGW-API-KEY": key },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) places.push(...parseSupplementStation(name, (await response.json()) as NaverLocalPage));
  }
  return places;
}

interface VworldSearchPage {
  response?: {
    status?: string;
    record?: { total?: string };
    result?: { items?: { title?: string; category?: string; point?: { x?: string; y?: string } }[] };
  };
}

/** 브이월드 장소 검색으로 범위 안 역 후보를 모두 받는다 */
export async function fetchStationPlaces(apiKey: string, query: string, bbox = CAPITAL_AREA_BBOX): Promise<RawStationPlace[]> {
  const places: RawStationPlace[] = [];
  for (let page = 1; page <= 20; page++) {
    const params = new URLSearchParams({
      service: "search",
      request: "search",
      version: "2.0",
      crs: "EPSG:4326",
      size: "1000",
      page: String(page),
      query,
      type: "place",
      bbox: `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`,
      format: "json",
      errorformat: "json",
      key: apiKey,
    });
    const body = (await (await fetch(`https://api.vworld.kr/req/search?${params}`, { signal: AbortSignal.timeout(30_000) })).json()) as VworldSearchPage;
    if (body.response?.status === "NOT_FOUND") break;
    if (body.response?.status !== "OK") throw new Error(`vworld search: ${body.response?.status ?? "no response"}`);
    const items = body.response.result?.items ?? [];
    for (const item of items) {
      const latitude = Number(item.point?.y);
      const longitude = Number(item.point?.x);
      if (item.title && item.category && Number.isFinite(latitude) && Number.isFinite(longitude)) {
        places.push({ title: item.title, category: item.category, latitude, longitude });
      }
    }
    const total = Number(body.response.record?.total ?? 0);
    if (items.length === 0 || page * 1000 >= total) break;
  }
  return places;
}
