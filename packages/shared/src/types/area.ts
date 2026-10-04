import type { BudgetFlexibility, HousingType, TransactionPreference } from "./request";

/** 출근지 검색 후보 */
export interface PlaceCandidate {
  label: string;
  address: string | null;
  latitude: number;
  longitude: number;
  category: string | null;
  source: "vworld" | "naver";
}

/** within: 허용 시간 안 / no_transfer_extra: 환승 없이 여유 시간 안 / over: 초과 / no_route: 경로 없음 */
export type AreaCommuteFit = "within" | "no_transfer_extra" | "over" | "no_route";

export type AreaBudgetFit = "fits" | "over" | "unknown";

/** 추천 동네를 거르는 입력 조건 (요청 스텝 2·3) */
export interface AreaCriteria {
  housingTypes: HousingType[];
  transactionPreference: TransactionPreference;
  /** 만원 */
  depositMax: number | null;
  monthlyRentMax: number | null;
  jeonseMax: number | null;
  budgetFlexibility: BudgetFlexibility;
}

/** 생활권의 유형별 거래 수와 시세 중위값 (만원) */
export interface ZoneTypeStats {
  count: number;
  monthlyDepositMedian: number | null;
  monthlyRentMedian: number | null;
  jeonseDepositMedian: number | null;
}

/** 추천 생활권 (역세권 도보 15분 또는 행정동 버스권) */
export interface AreaRecommendation {
  zoneId: string;
  zoneKey: string;
  kind: "station" | "bus";
  /** "서원동 · 신림역권", "난곡동 · 버스권" */
  name: string;
  stationName: string | null;
  admName: string | null;
  sido: string;
  sigungu: string;
  /** 생활권 대표 좌표 (실제 거래 건물) */
  latitude: number;
  longitude: number;
  distanceKm: number;
  residentialScore: number;
  commute: {
    /** 대표값 = 도보(대표 좌표→역) + 대중교통 */
    bestMinutes: number | null;
    walkMinutes: number | null;
    transitMinutes: number | null;
    bestTransferCount: number | null;
    noTransferMinutes: number | null;
    fit: AreaCommuteFit;
    provider: string;
    /** 경로 API를 쓰지 않고 직선거리로 추정한 값 */
    estimated: boolean;
  };
  /** 조건에 맞은 유형과 그 시세 */
  matchedTypes: { type: HousingType; stats: ZoneTypeStats; budgetFit: AreaBudgetFit }[];
}

/** 후보가 어디서 걸러졌는지 */
export interface AreaFunnel {
  zonesInRadius: number;
  matchedConditions: number;
  afterEstimate: number;
  measured: number;
  estimated: number;
  fit: number;
}

export interface AreaRecommendationResult {
  destination: { label: string; latitude: number; longitude: number };
  maxCommuteMinutes: number;
  noTransferExtraMinutes: number;
  criteria: AreaCriteria | null;
  provider: string;
  computedAt: string;
  funnel: AreaFunnel;
  /** 경로 API 한도 초과 등 결과를 읽을 때 알아야 할 점 */
  warnings: string[];
  /** 조건과 통근시간을 모두 만족한 생활권만 */
  areas: AreaRecommendation[];
}

export type AreaRecommendationStatus = "pending" | "running" | "done" | "failed";

/** 요청별로 저장된 추천 생활권 (디버그·운영용. 사용자에게는 보여주지 않는다) */
export interface RequestAreaRecommendation {
  requestId: string;
  status: AreaRecommendationStatus;
  destinationQuery: string;
  error: string | null;
  result: AreaRecommendationResult | null;
  updatedAt: string;
}
