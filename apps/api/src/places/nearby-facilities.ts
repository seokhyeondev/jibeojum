import { Logger } from "@nestjs/common";
import type { InfraId, NearbyFacility } from "@zipazum/shared";

/**
 * 매물 주변 시설 (카카오 로컬 검색). 시설 종류마다 반경 안에서 가장 가까운 한 곳과 도보 시간을 고른다.
 * 중개사가 입력하지 않아도 매물 등록 때 서버가 채운다.
 */

const RADIUS_M = 1000;
/** 직선거리 → 걷는 길 보정과 걷는 속도 (분당 67m ≈ 시속 4km) */
const PATH_FACTOR = 1.3;
const WALK_M_PER_MIN = 67;

interface KakaoPlace {
  place_name?: string;
  distance?: string;
  category_name?: string;
  /** 경도·위도 (문자열) */
  x?: string;
  y?: string;
}

interface Found {
  name: string;
  meters: number;
  latitude?: number;
  longitude?: number;
}

type Query =
  /** 카테고리 그룹 코드. excludes: 카테고리 이름에 들어가면 뺀다 */
  | { code: string; includes?: string[]; excludes?: string[] }
  /** 키워드 검색 + 카테고리 이름으로 거른다 (공원·헬스장·빨래방은 카테고리 코드가 없다) */
  | { keyword: string; categoryIncludes: string[] };

const QUERIES: { type: InfraId; queries: Query[] }[] = [
  { type: "convenience_store", queries: [{ code: "CS2" }] },
  { type: "mart", queries: [{ code: "MT1" }] },
  { type: "hospital", queries: [{ code: "HP8" }, { code: "PM9" }] },
  { type: "park", queries: [{ keyword: "공원", categoryIncludes: ["공원"] }] },
  { type: "gym", queries: [{ keyword: "헬스장", categoryIncludes: ["헬스"] }] },
  { type: "laundry", queries: [{ keyword: "빨래방", categoryIncludes: ["세탁", "빨래방"] }] },
  // 키즈카페(가정,생활 > 유아)·보드게임카페 같은 테마카페는 뺀다
  { type: "cafe", queries: [{ code: "CE7", includes: ["음식점 > 카페"], excludes: ["테마카페"] }] },
];

export const walkMinutesTo = (meters: number) => Math.max(1, Math.round((meters * PATH_FACTOR) / WALK_M_PER_MIN));

/** 검색 결과 중 조건에 맞는 가장 가까운 곳 */
export function nearestPlace(places: KakaoPlace[], categoryIncludes?: string[], categoryExcludes: string[] = []): Found | null {
  const ok = places.filter(
    (p) =>
      p.place_name &&
      p.distance &&
      (!categoryIncludes || categoryIncludes.some((c) => p.category_name?.includes(c))) &&
      !categoryExcludes.some((c) => p.category_name?.includes(c)),
  );
  const best = ok
    .map((p): Found => {
      const lat = Number(p.y);
      const lng = Number(p.x);
      return { name: p.place_name as string, meters: Number(p.distance), ...(p.x && p.y && Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : {}) };
    })
    .sort((a, b) => a.meters - b.meters)[0];
  return best && Number.isFinite(best.meters) && best.meters <= RADIUS_M ? best : null;
}

export class NearbyFacilitiesFinder {
  private readonly logger = new Logger("Nearby");

  constructor(private readonly apiKey: string | undefined = process.env.KAKAO_REST_API_KEY) {}

  get enabled() {
    return Boolean(this.apiKey);
  }

  /** 실패한 종류는 빼고 돌려준다. 키가 없거나 모두 실패하면 빈 목록 */
  async find(latitude: number, longitude: number): Promise<NearbyFacility[]> {
    if (!this.apiKey) return [];
    const found = await Promise.all(
      QUERIES.map(async ({ type, queries }) => {
        const candidates = await Promise.all(queries.map((q) => this.search(q, latitude, longitude)));
        const best = candidates.filter((c): c is Found => c !== null).sort((a, b) => a.meters - b.meters)[0];
        if (!best) return null;
        const facility: NearbyFacility = { type, name: best.name, walkMinutes: walkMinutesTo(best.meters) };
        if (best.latitude !== undefined && best.longitude !== undefined) Object.assign(facility, { latitude: best.latitude, longitude: best.longitude });
        return facility;
      }),
    );
    return found.filter((f): f is NearbyFacility => f !== null);
  }

  private async search(query: Query, latitude: number, longitude: number) {
    const base = "code" in query ? "https://dapi.kakao.com/v2/local/search/category.json" : "https://dapi.kakao.com/v2/local/search/keyword.json";
    const url = new URL(base);
    if ("code" in query) url.searchParams.set("category_group_code", query.code);
    else url.searchParams.set("query", query.keyword);
    url.searchParams.set("x", String(longitude));
    url.searchParams.set("y", String(latitude));
    url.searchParams.set("radius", String(RADIUS_M));
    url.searchParams.set("sort", "distance");
    url.searchParams.set("size", "10");
    try {
      const response = await fetch(url, { headers: { Authorization: `KakaoAK ${this.apiKey}` }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) {
        this.logger.warn(`kakao local ${response.status}`);
        return null;
      }
      const body = (await response.json()) as { documents?: KakaoPlace[] };
      return "keyword" in query ? nearestPlace(body.documents ?? [], query.categoryIncludes) : nearestPlace(body.documents ?? [], query.includes, query.excludes);
    } catch (error) {
      this.logger.warn(`kakao local failed: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }
}
