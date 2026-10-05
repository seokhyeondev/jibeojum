import { describe, expect, it } from "vitest";
import { mockListings } from "../src/mock-listings";
import { commuteFitOf, rankListings, recommend, type RecommendCriteria } from "../src/recommend";
import { DEFAULT_DRAFT } from "../src/defaults";

// 기본 예산이 바뀌어도 샘플 매물(월세 130만원까지) 기준 테스트가 흔들리지 않게 고정한다
const TEST_BUDGET = { depositMax: 5000, monthlyRentMax: 130 };
const now = new Date("2026-10-05T09:00:00+09:00");
const criteria = (patch: Partial<RecommendCriteria> = {}): RecommendCriteria => ({ ...DEFAULT_DRAFT, ...TEST_BUDGET, ...patch });
const byId = (id: string) => {
  const listing = mockListings.find((item) => item.id === id);
  if (!listing) throw new Error(`no listing ${id}`);
  return listing;
};

describe("환승 없는 지역 추천", () => {
  // 장지역 원룸: 46분, 버스 직행
  const directBus = byId("3");

  it("허용시간을 넘어도 환승이 없고 여유 범위 안이면 추천한다", () => {
    const c = criteria({ maxCommuteMinutes: 30, noTransferExtraMinutes: 20 });
    expect(commuteFitOf(directBus, c)).toBe("no_transfer_extra");
    expect(recommend(directBus, c, now).reasons).toContain("환승 없이 46분");
  });

  it("여유를 허용하지 않으면 초과로 본다", () => {
    expect(commuteFitOf(directBus, criteria({ maxCommuteMinutes: 30, noTransferExtraMinutes: 0 }))).toBe("over");
  });

  it("환승이 있는 매물은 여유 시간을 받지 못한다", () => {
    expect(commuteFitOf(byId("1"), criteria({ maxCommuteMinutes: 30, noTransferExtraMinutes: 20 }))).toBe("over");
  });
});

describe("세부 조건 반영", () => {
  it("여성 전용 건물을 원하면 해당 매물을 앞에 둔다", () => {
    const ranked = rankListings(mockListings, criteria({ safetyOptions: ["women_only", "secure_entrance"] }), now);
    expect(ranked[0].listing.id).toBe("2");
    expect(ranked[0].reasons).toContain("여성 전용 건물");
  });

  it("옥탑 제외를 고르면 옥탑 매물에 경고를 단다", () => {
    expect(recommend(byId("4"), criteria({ floorExclusions: ["rooftop"] }), now).warnings).toContain("옥탑 구조");
  });

  it("신축 위주를 고르면 준공 5년 초과 매물에 경고를 단다", () => {
    expect(recommend(byId("1"), criteria({ buildingAge: "new" }), now).reasons).toContain("신축");
    expect(recommend(byId("3"), criteria({ buildingAge: "new" }), now).warnings).toContain("신축 아님");
  });

  it("도보 10분 밖의 시설은 충족으로 보지 않는다", () => {
    expect(recommend(byId("4"), criteria({ infrastructure: ["gym"] }), now).warnings).toContain("헬스장 멀어요");
    expect(recommend(byId("2"), criteria({ infrastructure: ["gym"] }), now).warnings).not.toContain("헬스장 멀어요");
  });

  it("희망하지 않은 주택 유형은 통근이 맞아도 뒤로 간다", () => {
    const ranked = rankListings(
      mockListings,
      criteria({
        maxCommuteMinutes: 30,
        noTransferExtraMinutes: 20,
        housingTypes: ["officetel"],
        safetyOptions: ["women_only"],
      }),
      now,
    );
    expect(ranked[0].listing.housingType).toBe("officetel");
    expect(ranked.find((item) => item.listing.id === "3")?.warnings).toContain("희망 주택 유형 아님");
  });

  it("전세만 찾으면 전세 매물을 예산과 비교하고 월세 매물은 뒤로 보낸다", () => {
    const jeonseCriteria = criteria({
      transactionPreference: "jeonse",
      jeonseMax: 35000,
      depositMax: null,
      monthlyRentMax: null,
      housingTypes: ["studio", "officetel", "two_room", "apartment"],
    });
    const ranked = rankListings(mockListings, jeonseCriteria, now);
    expect(ranked[0].listing.transactionType).toBe("jeonse");
    expect(ranked[0].reasons).toContain("예산 내");
    expect(ranked[1].warnings).toContain("월세 매물");
    expect(recommend(byId("5"), { ...jeonseCriteria, jeonseMax: 30000 }, now).warnings).toContain("예산 초과");
  });

  it("월세만 찾으면 전세 매물에 경고를 단다", () => {
    expect(recommend(byId("5"), criteria({ transactionPreference: "rent" }), now).warnings).toContain("전세 매물");
  });

  it("예산을 넘으면 경고한다", () => {
    // 가락동 오피스텔: 보증금 3,000 / 월세 110
    expect(recommend(byId("2"), criteria({ depositMax: 3000, monthlyRentMax: 100 }), now).warnings).toContain("예산 초과");
    expect(recommend(byId("2"), criteria({ depositMax: 2000, monthlyRentMax: 200 }), now).warnings).toContain("예산 초과");
  });

  it("보증금 여유가 있으면 월세 상한이 늘어난다 (1,000만원당 5만원)", () => {
    // 상한 보증금 5,000 / 월세 100 → 보증금 3,000이면 월세 110까지
    expect(recommend(byId("2"), criteria({ depositMax: 5000, monthlyRentMax: 100 }), now).reasons).toContain("예산 내");
  });

  it("점수는 0~100 사이다", () => {
    for (const item of rankListings(mockListings, criteria(), now)) {
      expect(item.score).toBeGreaterThanOrEqual(0);
      expect(item.score).toBeLessThanOrEqual(100);
    }
  });
});
