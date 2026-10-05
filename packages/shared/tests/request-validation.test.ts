import { describe, expect, it } from "vitest";
import { DEFAULT_DRAFT } from "../src/defaults";
import {
  firstInvalidStep,
  moveInDateWarning,
  requestDraftSchema,
  toRequestInput,
  validateStep,
} from "../src/request-schema";
import type { RequestDraft } from "../src/types/request";

// 기본 예산이 바뀌어도 샘플 매물(월세 130만원까지) 기준 테스트가 흔들리지 않게 고정한다
const TEST_BUDGET = { depositMax: 5000, monthlyRentMax: 130 };
const GANGNAM = { label: "강남역", address: "서울 강남구 강남대로 396", latitude: 37.4979, longitude: 127.0276 };
const draft = (patch: Partial<RequestDraft> = {}): RequestDraft => ({ ...DEFAULT_DRAFT, ...TEST_BUDGET, commuteDestination: GANGNAM, ...patch });

describe("단계별 검증", () => {
  it("출근지는 2자 이상이어야 한다 (A01)", () => {
    expect(validateStep(draft({ commuteDestination: { label: "강" } }), 1)).not.toBeNull();
    expect(validateStep(draft({ commuteDestination: { label: "  " } }), 1)).not.toBeNull();
    // 글자만 넣고 목록에서 고르지 않으면 다음으로 갈 수 없다
    expect(validateStep(draft({ commuteDestination: { label: "강남" } }), 1)).toBe("검색 목록에서 출근지를 골라주세요.");
    expect(validateStep(draft({ commuteDestination: GANGNAM }), 1)).toBeNull();
    // 수도권 밖 출근지는 아직 찾을 동네 데이터가 없다
    const busan = { label: "롯데백화점 부산본점", address: "부산광역시 부산진구 가야대로 772", latitude: 35.1568, longitude: 129.0564 };
    expect(validateStep(draft({ commuteDestination: busan }), 1)).toBe("지금은 서울·경기·인천 출근지만 찾아드려요.");
    // 좌표 범위 안이어도 주소가 충남이면 막는다 (천안)
    expect(validateStep(draft({ commuteDestination: { ...busan, address: "충청남도 천안시 동남구 대흥로 255", latitude: 36.81, longitude: 127.15 } }), 1)).not.toBeNull();
    expect(validateStep(draft({ commuteDestination: { ...GANGNAM, address: "인천광역시 남동구 구월동" } }), 1)).toBeNull();
  });

  it("예산이 비어 있으면 넘어갈 수 없다", () => {
    expect(validateStep(draft({ depositMax: null }), 2)).not.toBeNull();
    expect(validateStep(draft({ monthlyRentMax: null }), 2)).not.toBeNull();
    expect(validateStep(draft({ depositMax: 0, monthlyRentMax: 0 }), 2)).toBeNull();
  });

  it("전세만 찾으면 월세 예산 없이 전세금만 있으면 된다", () => {
    const jeonseOnly = draft({ transactionPreference: "jeonse", depositMax: null, monthlyRentMax: null });
    expect(validateStep({ ...jeonseOnly, jeonseMax: null }, 2)).toContain("전세금");
    expect(validateStep({ ...jeonseOnly, jeonseMax: 20000 }, 2)).toBeNull();
  });

  it("둘 다 찾으면 월세와 전세 예산이 모두 필요하다", () => {
    expect(validateStep(draft({ transactionPreference: "both", jeonseMax: null }), 2)).toContain("전세금");
    expect(validateStep(draft({ transactionPreference: "both", monthlyRentMax: null }), 2)).toContain("월세");
    expect(validateStep(draft({ transactionPreference: "both" }), 2)).toBeNull();
  });

  it("주택 유형을 모두 해제하면 막힌다 (A02)", () => {
    expect(validateStep(draft({ housingTypes: [] }), 3)).not.toBeNull();
  });

  it("세부 조건은 선택이라 비어 있어도 입주 조건 단계를 통과한다", () => {
    expect(validateStep(draft({ safetyOptions: [], infrastructure: [] }), 4)).toBeNull();
  });

  it("아파트도 고를 수 있다", () => {
    expect(validateStep(draft({ housingTypes: ["apartment"] }), 3)).toBeNull();
    expect(requestDraftSchema.safeParse(draft({ housingTypes: ["apartment"] })).success).toBe(true);
  });

  it("동의해야 제출할 수 있다 (로그인은 서버가 확인한다)", () => {
    expect(validateStep(draft(), 5)).not.toBeNull();
    expect(validateStep(draft({ privacyAgreed: true }), 5)).toBeNull();
  });

  it("가장 앞의 미완료 단계를 찾는다", () => {
    expect(firstInvalidStep(draft({ housingTypes: [] }))).toBe(3);
    expect(firstInvalidStep(draft())).toBe(5);
    expect(firstInvalidStep(draft({ privacyAgreed: true }))).toBeNull();
  });

  it("지난 입주일은 경고만 한다", () => {
    expect(moveInDateWarning("2026-10-01", "2026-10-05")).not.toBeNull();
    expect(moveInDateWarning("2026-10-05", "2026-10-05")).toBeNull();
  });
});

describe("요청 입력", () => {
  const ready = (patch: Partial<RequestDraft> = {}) => draft({ privacyAgreed: true, ...patch });

  it("동의 전에는 만들지 않는다", () => {
    expect(toRequestInput(draft({}))).toBeNull();
    expect(toRequestInput(draft({ privacyAgreed: true }))).not.toBeNull();
  });

  it("완료된 초안으로 API 입력을 만든다 (A04)", () => {
    const input = toRequestInput(ready({ safetyOptions: ["women_only"], commuteDestination: { label: "  강남역 " } }));
    expect(input).toMatchObject({ depositMax: 5000, safetyOptions: ["women_only"], commuteDestination: { label: "강남역" } });
  });

  it("고르지 않은 거래 유형의 예산은 저장하지 않는다", () => {
    expect(toRequestInput(ready({ transactionPreference: "rent", jeonseMax: 30000 }))?.jeonseMax).toBeNull();
    const jeonse = toRequestInput(ready({ transactionPreference: "jeonse", depositMax: null, monthlyRentMax: null }));
    expect(jeonse).toMatchObject({ depositMax: null, monthlyRentMax: null, jeonseMax: 20000 });
    expect(toRequestInput(ready({ transactionPreference: "jeonse", jeonseMax: null }))).toBeNull();
  });

  it("중복 선택은 한 번만 남긴다", () => {
    expect(toRequestInput(ready({ housingTypes: ["studio", "studio"] }))?.housingTypes).toEqual(["studio"]);
  });

  it("비정상 금액과 날짜를 거부한다", () => {
    expect(toRequestInput(ready({ monthlyRentMax: 999_999 }))).toBeNull();
    expect(toRequestInput(ready({ depositMax: null }))).toBeNull();
    expect(toRequestInput(ready({ moveInDate: "내일" }))).toBeNull();
    expect(toRequestInput(ready({ housingTypes: [] }))).toBeNull();
  });

  it("저장된 초안 형태가 바뀌면 거부한다", () => {
    expect(requestDraftSchema.safeParse(DEFAULT_DRAFT).success).toBe(true);
    expect(requestDraftSchema.safeParse({ ...DEFAULT_DRAFT, housingTypes: ["원룸"] }).success).toBe(false);
  });
});
