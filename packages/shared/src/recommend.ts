import { INFRA_CHOICES, REQUIRED_OPTION_CHOICES, SAFETY_CHOICES, choiceLabel } from "./options";
import type { Listing } from "./types/listing";
import type { RequestDraft } from "./types/request";
import { fitsMonthlyBudget } from "./budget";
import { buildingAge } from "./format";
import { DIRECTION_CHOICES, PYEONG_M2 } from "./options";
import { wantsJeonse, wantsRent } from "./request-schema";

export type RecommendCriteria = Pick<
  RequestDraft,
  | "commuteDestination"
  | "maxCommuteMinutes"
  | "noTransferExtraMinutes"
  | "transactionPreference"
  | "depositMax"
  | "monthlyRentMax"
  | "jeonseMax"
  | "housingTypes"
  | "requiredOptions"
  | "floorPreference"
  | "floorExclusions"
  | "buildingAge"
  | "minPyeong"
  | "safetyOptions"
  | "directions"
  | "infrastructure"
> &
  Partial<Pick<RequestDraft, "partner">>;

export type CommuteFit = "within" | "no_transfer_extra" | "over";

export interface Recommendation<L extends Listing = Listing> {
  listing: L;
  /** 정렬용 내부 점수(0~100). 화면에 정확도처럼 노출하지 않는다. */
  score: number;
  commuteFit: CommuteFit;
  /** "강남역 37분", "예산 내"처럼 이해할 수 있는 추천 근거 */
  reasons: string[];
  /** 요청 조건과 어긋나는 점 */
  warnings: string[];
}

const WEIGHTS = { commute: 40, budget: 30, conditions: 20, freshness: 10 } as const;

/** 인프라는 도보 10분 이내일 때만 충족으로 본다. */
const INFRA_WALK_LIMIT = 10;

function fitOf(totalMinutes: number, transferCount: number, maxMinutes: number, extraMinutes: number): CommuteFit {
  if (totalMinutes <= maxMinutes) return "within";
  if (transferCount === 0 && totalMinutes <= maxMinutes + extraMinutes) return "no_transfer_extra";
  return "over";
}

const FIT_RANK: Record<CommuteFit, number> = { within: 0, no_transfer_extra: 1, over: 2 };

/** 같이 사는 사람이 있으면 두 사람 중 더 나쁜 쪽 */
export function commuteFitOf(listing: Listing, criteria: RecommendCriteria): CommuteFit {
  const mine = fitOf(listing.commute.totalMinutes, listing.commute.transferCount, criteria.maxCommuteMinutes, criteria.noTransferExtraMinutes);
  const p = criteria.partner && listing.partnerCommute;
  if (!p) return mine;
  const theirs = fitOf(p.totalMinutes, p.transferCount, criteria.partner!.maxCommuteMinutes, criteria.noTransferExtraMinutes);
  return FIT_RANK[theirs] > FIT_RANK[mine] ? theirs : mine;
}

export function recommend<L extends Listing>(listing: L, criteria: RecommendCriteria, now: Date): Recommendation<L> {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const destination = criteria.commuteDestination.label.trim() || "출근지";
  const { totalMinutes, transferCount } = listing.commute;

  // 통근 적합도: 허용시간 대비 짧을수록 가점, 환승 없는 여유 구간은 부분 점수
  const commuteFit = commuteFitOf(listing, criteria);
  const mineFit = fitOf(totalMinutes, transferCount, criteria.maxCommuteMinutes, criteria.noTransferExtraMinutes);
  let commuteScore = 0;
  if (mineFit === "within") {
    commuteScore = WEIGHTS.commute * (0.6 + 0.4 * (1 - totalMinutes / criteria.maxCommuteMinutes));
    reasons.push(`${destination} ${totalMinutes}분`);
  } else if (mineFit === "no_transfer_extra") {
    commuteScore = WEIGHTS.commute * 0.5;
    reasons.push(`환승 없이 ${totalMinutes}분`);
  } else {
    warnings.push(`통근 ${totalMinutes}분으로 희망 시간 초과`);
  }
  if (mineFit === "within" && transferCount === 0) reasons.push("환승 없음");

  // 같이 사는 사람 출근: 두 사람 점수의 평균 (한 사람이라도 초과면 크게 깎인다)
  const partner = criteria.partner;
  const pc = listing.partnerCommute;
  if (partner && pc) {
    const label = partner.destination.label.trim() || "같이 사는 분 출근지";
    const theirFit = fitOf(pc.totalMinutes, pc.transferCount, partner.maxCommuteMinutes, criteria.noTransferExtraMinutes);
    let theirScore = 0;
    if (theirFit === "within") {
      theirScore = WEIGHTS.commute * (0.6 + 0.4 * (1 - pc.totalMinutes / partner.maxCommuteMinutes));
      reasons.push(`${label} ${pc.totalMinutes}분`);
    } else if (theirFit === "no_transfer_extra") {
      theirScore = WEIGHTS.commute * 0.5;
      reasons.push(`${label} 환승 없이 ${pc.totalMinutes}분`);
    } else {
      warnings.push(`같이 사는 분 통근 ${pc.totalMinutes}분으로 희망 시간 초과`);
    }
    commuteScore = (commuteScore + theirScore) / 2;
  }

  // 예산 적합도: 매물의 거래 유형에 맞는 예산과 비교하고, 상한보다 여유가 있을수록 가점
  let budgetScore = 0;
  const budget = budgetFit(listing, criteria);
  if (budget.kind === "fits") {
    budgetScore = WEIGHTS.budget * (0.6 + 0.4 * Math.min(1, budget.slack * 2));
    reasons.push("예산 내");
  } else if (budget.kind === "over") {
    warnings.push("예산 초과");
  } else if (budget.kind === "other_type") {
    warnings.push(listing.transactionType === "jeonse" ? "전세 매물" : "월세 매물");
  }

  // 조건 일치율: 필수 조건, 안심 조건, 인프라, 층·건물 선호
  let wanted = 0;
  let matched = 0;
  const check = (ok: boolean, okReason: string | null, missWarning: string | null) => {
    wanted++;
    if (ok) {
      matched++;
      if (okReason) reasons.push(okReason);
    } else if (missWarning) {
      warnings.push(missWarning);
    }
  };

  if (!criteria.housingTypes.includes(listing.housingType)) {
    warnings.push("희망 주택 유형 아님");
  }
  for (const option of criteria.requiredOptions) {
    const label = choiceLabel(REQUIRED_OPTION_CHOICES, option);
    check(listing.options.includes(option), label, `${label} 아님`);
  }
  for (const option of criteria.safetyOptions) {
    const label = choiceLabel(SAFETY_CHOICES, option);
    check(listing.security.includes(option), label, `${label} 없음`);
  }
  for (const type of criteria.infrastructure) {
    const label = choiceLabel(INFRA_CHOICES, type);
    const near = listing.nearby.some((f) => f.type === type && f.walkMinutes <= INFRA_WALK_LIMIT);
    check(near, null, `${label} 멀어요`);
  }
  if (criteria.floorPreference !== "any") {
    const minFloor = criteria.floorPreference === "5_plus" ? 5 : 2;
    const ok = listing.floorType === "normal" && listing.floor >= minFloor;
    check(ok, null, `${minFloor}층 미만`);
  }
  for (const excluded of criteria.floorExclusions) {
    check(
      listing.floorType !== excluded,
      null,
      excluded === "rooftop" ? "옥탑 구조" : "반지하",
    );
  }
  if (criteria.buildingAge === "new") {
    check(buildingAge(listing.builtYear, now) <= 5, "신축", "신축 아님");
  }
  // 향을 모르는 매물은 따지지 않는다
  if (criteria.directions.length && listing.direction) {
    const label = choiceLabel(DIRECTION_CHOICES, listing.direction);
    check(criteria.directions.includes(listing.direction), label, `${label}이에요`);
  }
  if (criteria.minPyeong > 0) {
    check(listing.exclusiveAreaM2 >= criteria.minPyeong * PYEONG_M2, `${criteria.minPyeong}평 이상`, `${criteria.minPyeong}평보다 좁아요`);
  }
  const conditionScore = wanted === 0 ? WEIGHTS.conditions : (WEIGHTS.conditions * matched) / wanted;

  // 신선도: 최근 확인일수록 가점
  const hours = (now.getTime() - new Date(listing.verifiedAt).getTime()) / 3_600_000;
  const freshnessScore = WEIGHTS.freshness * (hours <= 24 ? 1 : hours <= 72 ? 0.6 : 0.3);

  // 희망하지 않은 주택·거래 유형과 거래 완료 매물은 뒤로 보낸다
  const typePenalty =
    (criteria.housingTypes.includes(listing.housingType) ? 1 : 0.6) * (budget.kind === "other_type" ? 0.6 : 1);
  const expiredPenalty = listing.status === "expired" ? 0.3 : 1;
  const score = Math.round(
    (commuteScore + budgetScore + conditionScore + freshnessScore) * typePenalty * expiredPenalty,
  );

  return { listing, score, commuteFit, reasons: unique(reasons), warnings: unique(warnings) };
}

type BudgetFit = { kind: "fits"; slack: number } | { kind: "over" } | { kind: "other_type" } | { kind: "unknown" };

function budgetFit(listing: Listing, criteria: RecommendCriteria): BudgetFit {
  const slackOf = (max: number, value: number) => (max === 0 ? 0 : Math.max(0, (max - value) / max));
  if (listing.transactionType === "jeonse") {
    if (!wantsJeonse(criteria.transactionPreference)) return { kind: "other_type" };
    if (criteria.jeonseMax === null) return { kind: "unknown" };
    return listing.deposit <= criteria.jeonseMax
      ? { kind: "fits", slack: slackOf(criteria.jeonseMax, listing.deposit) }
      : { kind: "over" };
  }
  if (!wantsRent(criteria.transactionPreference)) return { kind: "other_type" };
  const { depositMax, monthlyRentMax } = criteria;
  if (depositMax === null || monthlyRentMax === null) return { kind: "unknown" };
  // 보증금을 덜 내면 그만큼 월세 상한이 늘어난다 (전월세 전환)
  return fitsMonthlyBudget(listing.deposit, listing.monthlyRent, depositMax, monthlyRentMax)
    ? { kind: "fits", slack: slackOf(monthlyRentMax, listing.monthlyRent) }
    : { kind: "over" };
}

export function rankListings<L extends Listing>(listings: L[], criteria: RecommendCriteria, now: Date): Recommendation<L>[] {
  return listings
    .map((listing) => recommend(listing, criteria, now))
    .sort((a, b) => b.score - a.score || a.listing.commute.totalMinutes - b.listing.commute.totalMinutes);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
