import type { PlaceCandidate } from "@zipazum/shared";

interface VworldSearchResponse {
  response?: {
    status?: string;
    result?: {
      items?: { title?: string; category?: string; address?: { road?: string; parcel?: string }; point?: { x?: string; y?: string } }[];
    };
  };
}

interface NaverGeocodeResponse {
  status?: string;
  addresses?: { roadAddress?: string; jibunAddress?: string; x?: string; y?: string }[];
}

interface NaverLocalResponse {
  items?: { title?: string; category?: string; address?: string; roadAddress?: string; mapx?: string; mapy?: string }[];
}

const finite = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng);

/** 검색어 강조용 <b> 태그와 HTML 엔티티를 지운다 */
const stripTags = (text: string) =>
  text
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

/** 네이버 지역 검색 좌표는 WGS84 값을 10^7배 한 정수로 오기도 한다 ("1270276123") */
const naverCoord = (value: string | undefined) => {
  const n = Number(value);
  return Math.abs(n) > 1000 ? n / 1e7 : n;
};

/** 네이버 지역 검색(업체·기관·건물명) 결과 */
export function parseNaverLocal(body: NaverLocalResponse): PlaceCandidate[] {
  return (body.items ?? []).flatMap((item) => {
    const latitude = naverCoord(item.mapy);
    const longitude = naverCoord(item.mapx);
    const label = item.title ? stripTags(item.title) : "";
    if (!label || !finite(latitude, longitude) || latitude < 33 || latitude > 39) return [];
    return [
      {
        label,
        address: item.roadAddress || item.address || null,
        latitude,
        longitude,
        category: item.category ?? null,
        source: "naver" as const,
      },
    ];
  });
}

/** 브이월드 장소 검색(역·회사·건물명) 결과 */
export function parseVworldPlaces(body: VworldSearchResponse): PlaceCandidate[] {
  if (body.response?.status !== "OK") return [];
  return (body.response.result?.items ?? []).flatMap((item) => {
    const latitude = Number(item.point?.y);
    const longitude = Number(item.point?.x);
    if (!item.title || !finite(latitude, longitude)) return [];
    return [
      {
        label: item.title,
        address: item.address?.road || item.address?.parcel || null,
        latitude,
        longitude,
        category: item.category ?? null,
        source: "vworld" as const,
      },
    ];
  });
}

/** 네이버 주소 검색(도로명·지번 주소) 결과 */
export function parseNaverAddresses(body: NaverGeocodeResponse): PlaceCandidate[] {
  if (body.status !== "OK") return [];
  return (body.addresses ?? []).flatMap((a) => {
    const latitude = Number(a.y);
    const longitude = Number(a.x);
    const label = a.roadAddress || a.jibunAddress;
    if (!label || !finite(latitude, longitude)) return [];
    return [{ label, address: a.jibunAddress || null, latitude, longitude, category: "주소", source: "naver" as const }];
  });
}

/** 주소 검색 결과를 앞에 두고, 같은 위치(약 50m 이내)·같은 이름은 하나만 남긴다 */
export function mergePlaces(addresses: PlaceCandidate[], places: PlaceCandidate[], limit: number): PlaceCandidate[] {
  const merged: PlaceCandidate[] = [];
  for (const candidate of [...addresses, ...places]) {
    const duplicate = merged.some(
      (m) => m.label === candidate.label && Math.abs(m.latitude - candidate.latitude) < 0.0005 && Math.abs(m.longitude - candidate.longitude) < 0.0005,
    );
    if (!duplicate) merged.push(candidate);
    if (merged.length >= limit) break;
  }
  return merged;
}

/**
 * 출근지 검색. 키가 있는 것만 쓰고, 결과는 이 순서로 합친다.
 * 1) 네이버 지역 검색: 회사·빌딩·업체명 (NAVER API HUB 검색, NAVER_API_HUB_CLIENT_ID/SECRET)
 * 2) 네이버 주소 검색: 도로명·지번 주소
 * 3) 브이월드 장소 검색: 역·시설
 */
export class PlaceSearch {
  constructor(private readonly env: NodeJS.ProcessEnv) {}

  async search(query: string, limit = 8): Promise<PlaceCandidate[]> {
    const [local, addresses, places] = await Promise.all([
      this.naverLocal(query),
      this.naverAddresses(query),
      this.vworldPlaces(query, limit),
    ]);
    return mergePlaces([...local, ...addresses], places, limit);
  }

  /** NAVER API HUB 검색은 Maps와 다른 키를 쓴다 (NAVER_API_HUB_CLIENT_ID/SECRET) */
  private async naverLocal(query: string): Promise<PlaceCandidate[]> {
    const { NAVER_API_HUB_CLIENT_ID: id, NAVER_API_HUB_CLIENT_SECRET: secret } = this.env;
    if (!id || !secret) return [];
    try {
      const response = await fetch(
        `https://naverapihub.apigw.ntruss.com/search/v1/local?${new URLSearchParams({ query, display: "5", format: "json" })}`,
        { headers: { "X-NCP-APIGW-API-KEY-ID": id, "X-NCP-APIGW-API-KEY": secret }, signal: AbortSignal.timeout(10_000) },
      );
      // 구독 전(401)이나 한도 초과면 다른 검색 결과만 쓴다
      return response.ok ? parseNaverLocal((await response.json()) as NaverLocalResponse) : [];
    } catch {
      return [];
    }
  }

  private async vworldPlaces(query: string, size: number): Promise<PlaceCandidate[]> {
    if (!this.env.VWORLD_API_KEY) return [];
    const params = new URLSearchParams({
      service: "search",
      request: "search",
      version: "2.0",
      crs: "EPSG:4326",
      size: String(size),
      page: "1",
      query,
      type: "place",
      format: "json",
      errorformat: "json",
      key: this.env.VWORLD_API_KEY,
    });
    try {
      const response = await fetch(`https://api.vworld.kr/req/search?${params}`, { signal: AbortSignal.timeout(10_000) });
      return response.ok ? parseVworldPlaces((await response.json()) as VworldSearchResponse) : [];
    } catch {
      return [];
    }
  }

  private async naverAddresses(query: string): Promise<PlaceCandidate[]> {
    const { NAVER_MAP_CLIENT_ID: id, NAVER_MAP_CLIENT_SECRET: secret } = this.env;
    if (!id || !secret) return [];
    try {
      const response = await fetch(`https://maps.apigw.ntruss.com/map-geocode/v2/geocode?${new URLSearchParams({ query, count: "3" })}`, {
        headers: { "x-ncp-apigw-api-key-id": id, "x-ncp-apigw-api-key": secret, Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });
      return response.ok ? parseNaverAddresses((await response.json()) as NaverGeocodeResponse) : [];
    } catch {
      return [];
    }
  }
}
