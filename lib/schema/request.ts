import { z } from "zod";
import type { HousingRequest, RequestDraft } from "@/types/request";

const housingType = z.enum(["studio", "officetel", "two_room", "apartment"]);
const requiredOption = z.enum(["station", "elevator", "parking", "pet", "jeonse_loan", "full_option"]);
const safetyOption = z.enum([
  "women_only",
  "secure_entrance",
  "cctv",
  "window_guard",
  "main_road",
  "parcel_locker",
]);
const infra = z.enum(["convenience_store", "mart", "hospital", "park", "gym", "laundry", "cafe"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const draftShape = {
  commuteDestination: z.object({ label: z.string() }),
  maxCommuteMinutes: z.union([z.literal(20), z.literal(30), z.literal(40), z.literal(60)]),
  noTransferExtraMinutes: z.union([z.literal(0), z.literal(10), z.literal(20)]),
  budgetFlexibility: z.enum(["fixed", "negotiable", "consultation"]),
  housingTypes: z.array(housingType),
  moveInDate: z.string(),
  moveInFlexibility: z.enum(["fixed", "within_7_days", "negotiable"]),
  requiredOptions: z.array(requiredOption),
  floorPreference: z.enum(["any", "2_plus", "5_plus"]),
  floorExclusions: z.array(z.enum(["semi_basement", "rooftop"])),
  buildingAge: z.enum(["any", "new", "value"]),
  safetyOptions: z.array(safetyOption),
  infrastructure: z.array(infra),
  verificationStatus: z.enum(["pending", "verified"]),
};

/** localStorage에 남은 초안이 현재 형태와 맞는지 확인한다. */
export const requestDraftSchema: z.ZodType<RequestDraft> = z.object({
  ...draftShape,
  depositMax: z.number().int().nonnegative().nullable(),
  monthlyRentMax: z.number().int().nonnegative().nullable(),
  privacyAgreed: z.boolean(),
});

/** 제출 시점 검증. 서버 도입 후 API에서도 같은 스키마를 다시 적용한다. */
export const housingRequestSchema: z.ZodType<HousingRequest> = z.object({
  ...draftShape,
  id: z.string().min(1),
  commuteDestination: z.object({ label: z.string().trim().min(2) }),
  depositMax: z.number().int().nonnegative(),
  monthlyRentMax: z.number().int().nonnegative(),
  housingTypes: z.array(housingType).min(1),
  moveInDate: isoDate,
  verificationStatus: z.literal("verified"),
  status: z.enum(["submitted", "matching", "proposed", "closed"]),
  submittedAt: z.string(),
});

export const REQUEST_STEP_COUNT = 5;

/** 단계별 다음 버튼 조건. 통과하면 null, 아니면 안내 문구. */
export function validateStep(draft: RequestDraft, step: number): string | null {
  switch (step) {
    case 1:
      return draft.commuteDestination.label.trim().length >= 2
        ? null
        : "출근지를 2자 이상 입력해주세요.";
    case 2:
      if (draft.depositMax === null) return "최대 보증금을 숫자로 입력해주세요.";
      if (draft.monthlyRentMax === null) return "최대 월세를 숫자로 입력해주세요.";
      return null;
    case 3:
      return draft.housingTypes.length > 0 ? null : "원하는 주택 유형을 1개 이상 선택해주세요.";
    case 4:
      return isoDate.safeParse(draft.moveInDate).success ? null : "희망 입주일을 선택해주세요.";
    case 5:
      if (draft.verificationStatus !== "verified") return "휴대폰 인증을 완료해주세요.";
      if (!draft.privacyAgreed) return "개인정보 수집 및 제안 전달에 동의해주세요.";
      return null;
    default:
      return null;
  }
}

/** 아직 통과하지 못한 가장 앞 단계. 모두 통과하면 null. */
export function firstInvalidStep(draft: RequestDraft): number | null {
  for (let step = 1; step <= REQUEST_STEP_COUNT; step++) {
    if (validateStep(draft, step)) return step;
  }
  return null;
}

/** 오늘 이전 입주일은 막지 않고 안내만 한다. */
export function moveInDateWarning(moveInDate: string, today: string): string | null {
  return moveInDate && moveInDate < today ? "지난 날짜예요. 오늘 이후 날짜를 권장해요." : null;
}

export function toHousingRequest(
  draft: RequestDraft,
  id: string,
  submittedAt: string,
): HousingRequest | null {
  const { privacyAgreed, ...rest } = draft;
  if (!privacyAgreed) return null;
  const parsed = housingRequestSchema.safeParse({
    ...rest,
    id,
    status: "matching",
    submittedAt,
  });
  return parsed.success ? parsed.data : null;
}
