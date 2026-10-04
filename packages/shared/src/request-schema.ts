import { z } from "zod";
import type { HousingRequest, RequestDraft, TransactionPreference } from "./types/request";

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

/** 검색에서 고른 출근지의 주소·좌표 (수도권 근처만). 직접 입력이면 없음 */
const placeExtras = {
  address: z.string().max(200).nullable().optional(),
  latitude: z.number().min(33).max(39).nullable().optional(),
  longitude: z.number().min(124).max(132).nullable().optional(),
};

const draftShape = {
  commuteDestination: z.object({ label: z.string(), ...placeExtras }),
  maxCommuteMinutes: z.union([z.literal(30), z.literal(60), z.literal(90), z.literal(120)]),
  noTransferExtraMinutes: z.union([z.literal(0), z.literal(10), z.literal(20)]),
  transactionPreference: z.enum(["rent", "jeonse", "both"]),
  budgetFlexibility: z.enum(["fixed", "negotiable", "consultation"]),
  housingTypes: z.array(housingType),
  moveInDate: z.string(),
  moveInFlexibility: z.enum(["fixed", "within_7_days", "negotiable"]),
  requiredOptions: z.array(requiredOption),
  floorPreference: z.enum(["any", "2_plus", "5_plus"]),
  floorExclusions: z.array(z.enum(["semi_basement", "rooftop"])),
  buildingAge: z.enum(["any", "new", "value"]),
  // 예전에 저장된 초안에는 없으므로 기본값을 둔다
  minPyeong: z.union([z.literal(0), z.literal(5), z.literal(7), z.literal(10), z.literal(15)]).default(0),
  safetyOptions: z.array(safetyOption),
  infrastructure: z.array(infra),
};

/** localStorage에 남은 초안이 현재 형태와 맞는지 확인한다. */
const manwon = z.number().int().nonnegative().nullable();

export const requestDraftSchema: z.ZodType<RequestDraft, z.ZodTypeDef, unknown> = z.object({
  ...draftShape,
  depositMax: manwon,
  monthlyRentMax: manwon,
  jeonseMax: manwon,
  privacyAgreed: z.boolean(),
});

export const wantsRent = (preference: TransactionPreference) => preference !== "jeonse";
export const wantsJeonse = (preference: TransactionPreference) => preference !== "rent";

/** 제출 시점 검증. 서버 도입 후 API에서도 같은 스키마를 다시 적용한다. */
export const housingRequestSchema: z.ZodType<HousingRequest, z.ZodTypeDef, unknown> = z.object({
  ...draftShape,
  id: z.string().min(1),
  commuteDestination: z.object({ label: z.string().trim().min(2), ...placeExtras }),
  depositMax: manwon,
  monthlyRentMax: manwon,
  jeonseMax: manwon,
  housingTypes: z.array(housingType).min(1),
  moveInDate: isoDate,
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
      if (wantsRent(draft.transactionPreference)) {
        if (draft.depositMax === null) return "최대 보증금을 숫자로 입력해주세요.";
        if (draft.monthlyRentMax === null) return "최대 월세를 숫자로 입력해주세요.";
      }
      if (wantsJeonse(draft.transactionPreference) && draft.jeonseMax === null) {
        return "최대 전세금을 숫자로 입력해주세요.";
      }
      return null;
    case 3:
      return draft.housingTypes.length > 0 ? null : "원하는 주택 유형을 1개 이상 선택해주세요.";
    case 4:
      return isoDate.safeParse(draft.moveInDate).success ? null : "희망 입주일을 선택해주세요.";
    case 5:
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

const unique = <T extends z.ZodTypeAny>(item: T, max: number) =>
  z
    .array(item)
    .max(max)
    .transform((values) => [...new Set(values)] as z.infer<T>[]);

/** 만원 단위 상한. 입력 실수로 터무니없는 값이 저장되지 않게 막는다. */
const MAX_DEPOSIT = 1_000_000;
const MAX_RENT = 10_000;
const optionalManwon = (max: number) => z.number().int().min(0).max(max).nullable();

/** 요청 제출 입력. 브라우저와 API가 같은 규칙으로 검증한다. */
const requestInputShape = z.object({
  commuteDestination: z.object({ label: z.string().trim().min(2).max(100), ...placeExtras }),
  maxCommuteMinutes: draftShape.maxCommuteMinutes,
  noTransferExtraMinutes: draftShape.noTransferExtraMinutes,
  transactionPreference: draftShape.transactionPreference,
  depositMax: optionalManwon(MAX_DEPOSIT),
  monthlyRentMax: optionalManwon(MAX_RENT),
  jeonseMax: optionalManwon(MAX_DEPOSIT),
  budgetFlexibility: draftShape.budgetFlexibility,
  housingTypes: unique(housingType, 4).refine((values) => values.length > 0),
  moveInDate: isoDate,
  moveInFlexibility: draftShape.moveInFlexibility,
  requiredOptions: unique(requiredOption, 6),
  floorPreference: draftShape.floorPreference,
  floorExclusions: unique(z.enum(["semi_basement", "rooftop"]), 2),
  buildingAge: draftShape.buildingAge,
  minPyeong: draftShape.minPyeong,
  safetyOptions: unique(safetyOption, 6),
  infrastructure: unique(infra, 7),
  privacyAgreed: z.literal(true),
});

type BudgetFields = Pick<RequestDraft, "transactionPreference" | "depositMax" | "monthlyRentMax" | "jeonseMax">;

/** 고른 거래 유형의 예산만 남기고, 필요한 예산이 비어 있으면 오류로 본다. */
function normalizeBudget<T extends BudgetFields>(value: T, ctx: z.RefinementCtx): T {
  const rent = wantsRent(value.transactionPreference);
  const jeonse = wantsJeonse(value.transactionPreference);
  if (rent && value.depositMax === null) ctx.addIssue({ code: "custom", path: ["depositMax"] });
  if (rent && value.monthlyRentMax === null) ctx.addIssue({ code: "custom", path: ["monthlyRentMax"] });
  if (jeonse && value.jeonseMax === null) ctx.addIssue({ code: "custom", path: ["jeonseMax"] });
  return {
    ...value,
    depositMax: rent ? value.depositMax : null,
    monthlyRentMax: rent ? value.monthlyRentMax : null,
    jeonseMax: jeonse ? value.jeonseMax : null,
  };
}

export const requestInputSchema = requestInputShape.transform(normalizeBudget);

export type RequestInput = z.infer<typeof requestInputSchema>;

export const createRequestBodySchema = requestInputShape
  .extend({ clientKey: z.string().min(8).max(100) })
  .transform(normalizeBudget);

/** 제출 직전 초안을 API 입력으로 바꾼다. 조건을 만족하지 않으면 null. */
export function toRequestInput(draft: RequestDraft): RequestInput | null {
  const parsed = requestInputSchema.safeParse(draft);
  return parsed.success ? parsed.data : null;
}
