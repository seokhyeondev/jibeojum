import { fitsMonthlyBudget, type AreaBudgetFit, type AreaCommute, type AreaCommuteFit, type AreaCriteria, type AreaRecommendation, type BudgetFlexibility, type HousingType, type ZoneTypeStats } from "@zipazum/shared";

/** 추천 계산 설정. measureLimit이 요청당 최대 TMAP 호출 수다. */
export const AREA_SETTINGS = {
  /** 점수 상위 몇 곳을 경로 API로 실측할지 */
  measureLimit: 40,
  /** 같이 사는 사람 출근지가 있으면 생활권마다 두 번 재므로 곳 수를 줄인다 (30곳 × 2명) */
  pairMeasureLimit: 30,
  /** 두 출근지가 이 거리 안이면 같은 곳으로 보고 한 번만 잰다 */
  samePlaceKm: 1,
  /** 대중교통 직선 환산 속도(km/분). 허용 시간 × 이 값이 후보 반경 */
  straightKmPerMinute: 0.45,
  minRadiusKm: 5,
  maxRadiusKm: 45,
  /** 직선 추정이 허용 시간 × 이 배수 + 여유분을 넘으면 실측하지 않고 뺀다 (추정이 거칠어 넉넉하게) */
  estimateSlackRatio: 1.3,
  estimateSlackMinutes: 5,
  /** 유형별 거래가 이보다 적으면 그 유형이 있는 동네로 보지 않는다 */
  minTypeTransactions: 3,
} as const;

/** 예산 조정 가능 여부만큼 상한을 늘려 본다 */
export const BUDGET_FLEX: Record<BudgetFlexibility, number> = { fixed: 1, negotiable: 1.1, consultation: 1.2 };

export function candidateRadiusKm(maxCommuteMinutes: number, noTransferExtraMinutes: number): number {
  const km = (maxCommuteMinutes + noTransferExtraMinutes) * AREA_SETTINGS.straightKmPerMinute;
  return Math.min(AREA_SETTINGS.maxRadiusKm, Math.max(AREA_SETTINGS.minRadiusKm, km));
}

/**
 * 유형 하나의 시세가 예산 안인지. 고른 거래 방식(월세/전세) 중 하나라도 맞으면 fits.
 * 월세는 전월세 전환(보증금 1,000만원당 월세 5만원)을 적용한다.
 */
export function budgetFitOf(stats: ZoneTypeStats, criteria: AreaCriteria): AreaBudgetFit {
  const flex = BUDGET_FLEX[criteria.budgetFlexibility];
  const checks: boolean[] = [];
  const { monthlyDepositMedian: dep, monthlyRentMedian: rent, jeonseDepositMedian: jeonse } = stats;
  if (criteria.transactionPreference !== "jeonse" && dep !== null && rent !== null && criteria.depositMax !== null && criteria.monthlyRentMax !== null) {
    checks.push(fitsMonthlyBudget(dep, rent, criteria.depositMax, criteria.monthlyRentMax, flex));
  }
  if (criteria.transactionPreference !== "rent" && jeonse !== null && criteria.jeonseMax !== null) {
    checks.push(jeonse <= criteria.jeonseMax * flex);
  }
  if (checks.length === 0) return "unknown";
  return checks.some(Boolean) ? "fits" : "over";
}

/**
 * 고른 유형 중 거래가 충분하고 시세가 예산 안인 유형만 남긴다. 하나도 없으면 빈 배열(조건 불일치).
 * 조건이 없으면(디버그에서 비움) 거래가 있는 유형을 그대로 돌려준다.
 */
export function matchTypes(
  statsByType: Partial<Record<HousingType, ZoneTypeStats>>,
  criteria: AreaCriteria | null,
): AreaRecommendation["matchedTypes"] {
  const types = criteria?.housingTypes.length ? criteria.housingTypes : (Object.keys(statsByType) as HousingType[]);
  return types.flatMap((type) => {
    const stats = statsByType[type];
    if (!stats || stats.count < AREA_SETTINGS.minTypeTransactions) return [];
    const budgetFit = criteria ? budgetFitOf(stats, criteria) : "unknown";
    if (criteria && budgetFit !== "fits") return [];
    return [{ type, stats, budgetFit }];
  });
}

/** 대표값(도보 + 대중교통) 기준 분류 */
export function classifyMinutes(
  bestMinutes: number | null,
  noTransferMinutes: number | null,
  maxCommuteMinutes: number,
  noTransferExtraMinutes: number,
): AreaCommuteFit {
  if (bestMinutes === null) return "no_route";
  if (bestMinutes <= maxCommuteMinutes) return "within";
  if (noTransferMinutes !== null && noTransferMinutes <= maxCommuteMinutes + noTransferExtraMinutes) return "no_transfer_extra";
  return "over";
}

/** 직선 추정이 이 값을 넘으면 실측할 가치가 없다 */
export function estimateCutoff(maxCommuteMinutes: number, noTransferExtraMinutes: number): number {
  return (maxCommuteMinutes + noTransferExtraMinutes) * AREA_SETTINGS.estimateSlackRatio + AREA_SETTINGS.estimateSlackMinutes;
}

const FIT_ORDER: Record<AreaCommuteFit, number> = { within: 0, no_transfer_extra: 1, over: 2, no_route: 3 };

/** 시간 안 → 환승 없는 여유 → 그 밖, 같은 그룹 안에서는 통근시간이 짧은 순 */
export function rankAreas(areas: AreaRecommendation[]): AreaRecommendation[] {
  const minutes = (a: AreaRecommendation) =>
    a.commute.fit === "no_transfer_extra" ? (a.commute.noTransferMinutes ?? Infinity) : (a.commute.bestMinutes ?? Infinity);
  return [...areas].sort(
    (a, b) => FIT_ORDER[a.commute.fit] - FIT_ORDER[b.commute.fit] || minutes(a) - minutes(b) || b.residentialScore - a.residentialScore,
  );
}

export const isFit = (fit: AreaCommuteFit) => fit === "within" || fit === "no_transfer_extra";

/** 판정에 쓰는 시간: 환승 없는 여유로 통과했으면 환승 없는 경로 시간 */
export const effectiveMinutes = (c: AreaCommute) => (c.fit === "no_transfer_extra" ? (c.noTransferMinutes ?? Infinity) : (c.bestMinutes ?? Infinity));

/**
 * 같이 사는 사람이 있을 때: 둘 중 더 오래 걸리는 사람 기준으로 짧은 순 → 두 사람 합계 → 주거 점수.
 * 합계로만 줄 세우면 한 사람만 오래 걸리는 동네가 앞에 오기 때문이다.
 */
export function rankPairAreas(areas: AreaRecommendation[]): AreaRecommendation[] {
  const pair = (a: AreaRecommendation) => [a.commute, a.partnerCommute ?? a.commute];
  const worstFit = (a: AreaRecommendation) => Math.max(...pair(a).map((c) => FIT_ORDER[c.fit]));
  const worst = (a: AreaRecommendation) => Math.max(...pair(a).map(effectiveMinutes));
  const sum = (a: AreaRecommendation) => pair(a).reduce((n, c) => n + effectiveMinutes(c), 0);
  return [...areas].sort((a, b) => worstFit(a) - worstFit(b) || worst(a) - worst(b) || sum(a) - sum(b) || b.residentialScore - a.residentialScore);
}
