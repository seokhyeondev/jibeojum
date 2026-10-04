import { describe, expect, it } from "vitest";
import { formatBuilding, formatFloor, formatManwon, formatMoveIn, formatNumber, parseManwon } from "../src/format";

describe("parseManwon", () => {
  it("숫자와 콤마를 허용한다", () => {
    expect(parseManwon("5,000")).toBe(5000);
    expect(parseManwon(" 130 ")).toBe(130);
    expect(parseManwon("0")).toBe(0);
  });

  it("빈 값이나 숫자가 아닌 값은 null", () => {
    expect(parseManwon("")).toBeNull();
    expect(parseManwon("abc")).toBeNull();
    expect(parseManwon("-10")).toBeNull();
    expect(parseManwon("1.5")).toBeNull();
  });
});

describe("금액 표시", () => {
  it("콤마를 붙인다", () => {
    expect(formatNumber(5000)).toBe("5,000");
    expect(formatNumber(null)).toBe("");
  });

  it("억 단위를 나눈다", () => {
    expect(formatManwon(2000)).toBe("2,000만");
    expect(formatManwon(10000)).toBe("1억");
    expect(formatManwon(12500)).toBe("1억 2,500만");
  });
});

describe("매물 표시", () => {
  it("옥탑과 반지하를 구분한다", () => {
    expect(formatFloor({ floor: 8, totalFloors: 12, floorType: "normal" })).toBe("8층 / 12층");
    expect(formatFloor({ floor: 10, totalFloors: 10, floorType: "rooftop" })).toBe("옥탑 (10층 건물)");
    expect(formatFloor({ floor: 0, totalFloors: 4, floorType: "semi_basement" })).toBe("반지하");
  });

  it("준공연도로 신축·구축을 표시한다", () => {
    const now = new Date("2026-10-05T00:00:00+09:00");
    expect(formatBuilding(2024, now)).toBe("신축 · 2024년 준공");
    expect(formatBuilding(2018, now)).toBe("준신축 · 2018년 준공");
    expect(formatBuilding(2009, now)).toBe("구축 · 2009년 준공");
  });

  it("입주 가능일을 표시한다", () => {
    expect(formatMoveIn({ availableFrom: null })).toBe("즉시 입주");
    expect(formatMoveIn({ availableFrom: "2026-10-20" })).toBe("10월 20일");
    expect(formatMoveIn({ availableFrom: null, moveInNote: "협의 가능" })).toBe("협의 가능");
  });
});

describe("요청 요약", () => {
  it("거래 유형에 맞는 예산만 보여준다", async () => {
    const { summarizeRequest } = await import("../src/request-summary");
    const base = { commuteDestination: { label: "강남역" }, maxCommuteMinutes: 60 as const, depositMax: 5000, monthlyRentMax: 130, jeonseMax: 25000 };
    expect(summarizeRequest({ ...base, transactionPreference: "rent" })).toBe("강남역 · 60분 이내 · 보증금 5,000만원 · 월세 130만원");
    expect(summarizeRequest({ ...base, transactionPreference: "jeonse" })).toBe("강남역 · 60분 이내 · 전세 2억 5,000만원");
    expect(summarizeRequest({ ...base, transactionPreference: "both" })).toContain("월세 130만원 · 전세 2억 5,000만원");
  });
});
