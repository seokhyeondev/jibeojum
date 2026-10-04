import type { HousingRequest, RequestDraft } from "./types/request";

/** 입력 흐름을 처음 열었을 때의 초안 */
export const DEFAULT_DRAFT: RequestDraft = {
  commuteDestination: { label: "강남역" },
  maxCommuteMinutes: 60,
  noTransferExtraMinutes: 10,
  transactionPreference: "rent",
  depositMax: 5000,
  monthlyRentMax: 130,
  jeonseMax: 20000,
  budgetFlexibility: "fixed",
  housingTypes: ["studio", "officetel", "two_room"],
  moveInDate: "2026-10-25",
  moveInFlexibility: "within_7_days",
  requiredOptions: ["station", "elevator"],
  floorPreference: "any",
  floorExclusions: [],
  buildingAge: "any",
  safetyOptions: [],
  infrastructure: [],
  privacyAgreed: false,
};

/** 보낸 요청을 고치려고 다시 열 때의 초안. 이미 동의했으므로 동의는 유지한다 */
export function draftFromRequest(request: HousingRequest): RequestDraft {
  const { id: _id, status: _status, submittedAt: _submittedAt, ...fields } = request;
  return { ...fields, privacyAgreed: true };
}
