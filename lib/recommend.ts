import { INFRA_CHOICES, REQUIRED_OPTION_CHOICES, SAFETY_CHOICES, choiceLabel } from "@/data/options";
import type { Listing } from "@/types/listing";
import type { RequestDraft } from "@/types/request";
import { buildingAge } from "./format";

export type RecommendCriteria = Pick<
  RequestDraft,
  | "commuteDestination"
  | "maxCommuteMinutes"
  | "noTransferExtraMinutes"
  | "depositMax"
  | "monthlyRentMax"
  | "housingTypes"
  | "requiredOptions"
  | "floorPreference"
  | "floorExclusions"
  | "buildingAge"
  | "safetyOptions"
  | "infrastructure"
>;

export type CommuteFit = "within" | "no_transfer_extra" | "over";

export interface Recommendation {
  listing: Listing;
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

export function commuteFitOf(listing: Listing, criteria: RecommendCriteria): CommuteFit {
  const { totalMinutes, transferCount } = listing.commute;
  if (totalMinutes <= criteria.maxCommuteMinutes) return "within";
  if (
    transferCount === 0 &&
    totalMinutes <= criteria.maxCommuteMinutes + criteria.noTransferExtraMinutes
  ) {
    return "no_transfer_extra";
  }
  return "over";
}

export function recommend(listing: Listing, criteria: RecommendCriteria, now: Date): Recommendation {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const destination = criteria.commuteDestination.label.trim() || "출근지";
  const { totalMinutes, transferCount } = listing.commute;

  // 통근 적합도: 허용시간 대비 짧을수록 가점, 환승 없는 여유 구간은 부분 점수
  const commuteFit = commuteFitOf(listing, criteria);
  let commuteScore = 0;
  if (commuteFit === "within") {
    commuteScore = WEIGHTS.commute * (0.6 + 0.4 * (1 - totalMinutes / criteria.maxCommuteMinutes));
    reasons.push(`${destination} ${totalMinutes}분`);
  } else if (commuteFit === "no_transfer_extra") {
    commuteScore = WEIGHTS.commute * 0.5;
    reasons.push(`환승 없이 ${totalMinutes}분`);
  } else {
    warnings.push(`통근 ${totalMinutes}분으로 희망 시간 초과`);
  }
  if (commuteFit === "within" && transferCount === 0) reasons.push("환승 없음");

  // 예산 적합도: 상한보다 여유가 있을수록 가점
  let budgetScore = 0;
  const { depositMax, monthlyRentMax } = criteria;
  if (depositMax !== null && monthlyRentMax !== null) {
    const fits = listing.deposit <= depositMax && listing.monthlyRent <= monthlyRentMax;
    if (fits) {
      const rentSlack = monthlyRentMax === 0 ? 0 : (monthlyRentMax - listing.monthlyRent) / monthlyRentMax;
      budgetScore = WEIGHTS.budget * (0.6 + 0.4 * Math.min(1, rentSlack * 2));
      reasons.push("예산 내");
    } else {
      warnings.push("예산 초과");
    }
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
  const conditionScore = wanted === 0 ? WEIGHTS.conditions : (WEIGHTS.conditions * matched) / wanted;

  // 신선도: 최근 확인일수록 가점
  const hours = (now.getTime() - new Date(listing.verifiedAt).getTime()) / 3_600_000;
  const freshnessScore = WEIGHTS.freshness * (hours <= 24 ? 1 : hours <= 72 ? 0.6 : 0.3);

  // 희망하지 않은 주택 유형과 거래 완료 매물은 뒤로 보낸다
  const typePenalty = criteria.housingTypes.includes(listing.housingType) ? 1 : 0.6;
  const expiredPenalty = listing.status === "expired" ? 0.3 : 1;
  const score = Math.round(
    (commuteScore + budgetScore + conditionScore + freshnessScore) * typePenalty * expiredPenalty,
  );

  return { listing, score, commuteFit, reasons: unique(reasons), warnings: unique(warnings) };
}

export function rankListings(listings: Listing[], criteria: RecommendCriteria, now: Date): Recommendation[] {
  return listings
    .map((listing) => recommend(listing, criteria, now))
    .sort((a, b) => b.score - a.score || a.listing.commute.totalMinutes - b.listing.commute.totalMinutes);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
