import { describe, expect, it } from "vitest";
import { DEFAULT_DRAFT } from "@/lib/store/app-store";
import {
  firstInvalidStep,
  moveInDateWarning,
  requestDraftSchema,
  toHousingRequest,
  validateStep,
} from "@/lib/schema/request";
import type { RequestDraft } from "@/types/request";

const draft = (patch: Partial<RequestDraft> = {}): RequestDraft => ({ ...DEFAULT_DRAFT, ...patch });

describe("단계별 검증", () => {
  it("출근지는 2자 이상이어야 한다 (A01)", () => {
    expect(validateStep(draft({ commuteDestination: { label: "강" } }), 1)).not.toBeNull();
    expect(validateStep(draft({ commuteDestination: { label: "  " } }), 1)).not.toBeNull();
    expect(validateStep(draft({ commuteDestination: { label: "강남" } }), 1)).toBeNull();
  });

  it("예산이 비어 있으면 넘어갈 수 없다", () => {
    expect(validateStep(draft({ depositMax: null }), 2)).not.toBeNull();
    expect(validateStep(draft({ monthlyRentMax: null }), 2)).not.toBeNull();
    expect(validateStep(draft({ depositMax: 0, monthlyRentMax: 0 }), 2)).toBeNull();
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

  it("인증과 동의가 모두 있어야 제출할 수 있다 (A03)", () => {
    expect(validateStep(draft(), 5)).not.toBeNull();
    expect(validateStep(draft({ verificationStatus: "verified" }), 5)).not.toBeNull();
    expect(validateStep(draft({ verificationStatus: "verified", privacyAgreed: true }), 5)).toBeNull();
  });

  it("가장 앞의 미완료 단계를 찾는다", () => {
    expect(firstInvalidStep(draft({ housingTypes: [] }))).toBe(3);
    expect(firstInvalidStep(draft())).toBe(5);
    expect(firstInvalidStep(draft({ verificationStatus: "verified", privacyAgreed: true }))).toBeNull();
  });

  it("지난 입주일은 경고만 한다", () => {
    expect(moveInDateWarning("2026-10-01", "2026-10-05")).not.toBeNull();
    expect(moveInDateWarning("2026-10-05", "2026-10-05")).toBeNull();
  });
});

describe("요청 생성", () => {
  it("동의 전에는 만들지 않는다", () => {
    expect(toHousingRequest(draft({ verificationStatus: "verified" }), "req_1", "2026-10-05T00:00:00Z")).toBeNull();
  });

  it("완료된 초안으로 요청을 만든다 (A04)", () => {
    const request = toHousingRequest(
      draft({ verificationStatus: "verified", privacyAgreed: true, safetyOptions: ["women_only"] }),
      "req_1",
      "2026-10-05T00:00:00Z",
    );
    expect(request).toMatchObject({ id: "req_1", status: "matching", depositMax: 5000, safetyOptions: ["women_only"] });
    expect(request).not.toHaveProperty("privacyAgreed");
  });

  it("저장된 초안 형태가 바뀌면 거부한다", () => {
    expect(requestDraftSchema.safeParse(DEFAULT_DRAFT).success).toBe(true);
    expect(requestDraftSchema.safeParse({ ...DEFAULT_DRAFT, housingTypes: ["원룸"] }).success).toBe(false);
  });
});
