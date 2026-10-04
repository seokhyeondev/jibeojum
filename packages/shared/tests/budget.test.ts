import { describe, expect, it } from "vitest";
import { allowedMonthlyRent, fitsMonthlyBudget } from "../src/budget";

describe("전월세 전환 (보증금 1,000만원당 월세 5만원)", () => {
  it("보증금을 덜 내면 그만큼 월세 상한이 늘어난다", () => {
    // 상한 보증금 3,000 / 월세 50 → 보증금 1,000이면 월세 60까지
    expect(allowedMonthlyRent(3000, 50, 1000)).toBe(60);
    expect(allowedMonthlyRent(3000, 50, 3000)).toBe(50);
    expect(fitsMonthlyBudget(1000, 60, 3000, 50)).toBe(true);
    expect(fitsMonthlyBudget(1000, 61, 3000, 50)).toBe(false);
    expect(fitsMonthlyBudget(500, 62, 3000, 50)).toBe(true);
  });

  it("보증금이 상한을 넘으면 월세가 싸도 맞지 않는다", () => {
    expect(allowedMonthlyRent(3000, 50, 4000)).toBeNull();
    expect(fitsMonthlyBudget(4000, 30, 3000, 50)).toBe(false);
  });

  it("예산 조정 배수는 두 상한에 먼저 곱한다", () => {
    // 1.1배 → 보증금 3,300 / 월세 55, 보증금 1,000이면 55 + 2,300 × 0.005 = 66.5
    expect(fitsMonthlyBudget(1000, 66, 3000, 50, 1.1)).toBe(true);
    expect(fitsMonthlyBudget(1000, 67, 3000, 50, 1.1)).toBe(false);
  });
});
