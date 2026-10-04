import {
  BUILDING_AGE_CHOICES,
  FLOOR_EXCLUSION_CHOICES,
  FLOOR_PREFERENCE_CHOICES,
  HOUSING_TYPE_CHOICES,
  INFRA_CHOICES,
  REQUIRED_OPTION_CHOICES,
  SAFETY_CHOICES,
  choiceLabel,
} from "./options";
import type { RequestDraft } from "./types/request";
import { formatManwon } from "./format";
import { wantsJeonse, wantsRent } from "./request-schema";

type SummarySource = Pick<
  RequestDraft,
  | "commuteDestination"
  | "maxCommuteMinutes"
  | "transactionPreference"
  | "depositMax"
  | "monthlyRentMax"
  | "jeonseMax"
>;

const manwonText = (value: number | null) => (value === null ? "-" : `${formatManwon(value)}원`);

/** "강남역 · 60분 이내 · 보증금 5,000만원 · 월세 130만원 · 전세 2억원" */
export function summarizeRequest(request: SummarySource): string {
  const parts = [request.commuteDestination.label.trim() || "출근지 미입력", `${request.maxCommuteMinutes}분 이내`];
  if (wantsRent(request.transactionPreference)) {
    parts.push(`보증금 ${manwonText(request.depositMax)}`, `월세 ${manwonText(request.monthlyRentMax)}`);
  }
  if (wantsJeonse(request.transactionPreference)) {
    parts.push(`전세 ${manwonText(request.jeonseMax)}`);
  }
  return parts.join(" · ");
}

/** 요청 요약 아래에 칩으로 보여줄 세부 조건 */
export function requestConditionLabels(request: RequestDraft | Omit<RequestDraft, "privacyAgreed">): string[] {
  const labels: string[] = request.housingTypes.map((type) => choiceLabel(HOUSING_TYPE_CHOICES, type));
  if (request.noTransferExtraMinutes > 0) {
    labels.push(`환승 없으면 +${request.noTransferExtraMinutes}분`);
  }
  labels.push(...request.requiredOptions.map((option) => choiceLabel(REQUIRED_OPTION_CHOICES, option)));
  if (request.floorPreference !== "any") {
    labels.push(choiceLabel(FLOOR_PREFERENCE_CHOICES, request.floorPreference));
  }
  labels.push(...request.floorExclusions.map((value) => choiceLabel(FLOOR_EXCLUSION_CHOICES, value)));
  if (request.buildingAge !== "any") {
    labels.push(choiceLabel(BUILDING_AGE_CHOICES, request.buildingAge));
  }
  labels.push(...request.safetyOptions.map((option) => choiceLabel(SAFETY_CHOICES, option)));
  labels.push(...request.infrastructure.map((type) => `${choiceLabel(INFRA_CHOICES, type)} 가까이`));
  return labels;
}
