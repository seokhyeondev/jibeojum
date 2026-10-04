import { describe, expect, it } from "vitest";
import type { AreaCriteria, AreaRecommendation, ZoneTypeStats } from "@zipazum/shared";
import { budgetFitOf, candidateRadiusKm, classifyMinutes, estimateCutoff, matchTypes, rankAreas } from "../src/areas/area-recommend.js";
import { mergePlaces, parseNaverAddresses, parseNaverLocal, parseVworldPlaces } from "../src/places/place-search.js";

const stats = (count: number, dep: number | null, rent: number | null, jeonse: number | null): ZoneTypeStats => ({
  count,
  monthlyDepositMedian: dep,
  monthlyRentMedian: rent,
  jeonseDepositMedian: jeonse,
});

const criteria = (patch: Partial<AreaCriteria> = {}): AreaCriteria => ({
  housingTypes: ["studio", "officetel"],
  transactionPreference: "rent",
  depositMax: 1000,
  monthlyRentMax: 60,
  jeonseMax: null,
  budgetFlexibility: "fixed",
  ...patch,
});

describe("유형·예산 조건", () => {
  it("월세는 보증금과 월세 중위값이 모두 상한 안이어야 한다", () => {
    expect(budgetFitOf(stats(10, 1000, 55, null), criteria())).toBe("fits");
    expect(budgetFitOf(stats(10, 1000, 65, null), criteria())).toBe("over");
    expect(budgetFitOf(stats(10, null, null, 20000), criteria())).toBe("unknown");
  });

  it("월세는 보증금 1,000만원당 월세 5만원으로 환산해 본다", () => {
    const c = criteria({ depositMax: 3000, monthlyRentMax: 50 });
    expect(budgetFitOf(stats(10, 1000, 60, null), c)).toBe("fits");
    expect(budgetFitOf(stats(10, 1000, 61, null), c)).toBe("over");
    expect(budgetFitOf(stats(10, 4000, 30, null), c)).toBe("over");
  });

  it("예산 조정 가능이면 상한을 10~20% 늘려 본다", () => {
    expect(budgetFitOf(stats(10, 1000, 65, null), criteria({ budgetFlexibility: "negotiable" }))).toBe("fits");
    expect(budgetFitOf(stats(10, 1000, 70, null), criteria({ budgetFlexibility: "negotiable" }))).toBe("over");
    expect(budgetFitOf(stats(10, 1000, 70, null), criteria({ budgetFlexibility: "consultation" }))).toBe("fits");
  });

  it("둘 다 찾으면 월세·전세 중 하나만 맞아도 된다", () => {
    const both = criteria({ transactionPreference: "both", jeonseMax: 20000 });
    expect(budgetFitOf(stats(10, 1000, 90, 18000), both)).toBe("fits");
    expect(budgetFitOf(stats(10, 1000, 90, 25000), both)).toBe("over");
  });

  it("고른 유형 중 거래가 충분하고 예산 안인 유형만 남긴다", () => {
    const byType = { studio: stats(20, 500, 50, null), officetel: stats(15, 1000, 80, null), two_room: stats(30, 1000, 50, null), apartment: stats(2, 100, 10, null) };
    expect(matchTypes(byType, criteria()).map((m) => m.type)).toEqual(["studio"]);
    expect(matchTypes(byType, criteria({ housingTypes: ["apartment"] }))).toEqual([]);
    expect(matchTypes({ studio: stats(2, 500, 50, null) }, criteria())).toEqual([]);
    expect(matchTypes(byType, null).map((m) => m.type).sort()).toEqual(["officetel", "studio", "two_room"]);
  });
});

describe("통근 분류와 후보 범위", () => {
  it("대표값(도보 + 대중교통) 기준 시간 내 / 환승 없는 여유 / 초과 / 경로 없음", () => {
    expect(classifyMinutes(35, 40, 40, 10)).toBe("within");
    expect(classifyMinutes(42, 48, 40, 10)).toBe("no_transfer_extra");
    expect(classifyMinutes(42, 55, 40, 10)).toBe("over");
    expect(classifyMinutes(42, null, 40, 10)).toBe("over");
    expect(classifyMinutes(null, null, 40, 10)).toBe("no_route");
  });

  it("후보 반경과 추정 컷은 허용 시간에 비례한다", () => {
    expect(candidateRadiusKm(60, 10)).toBeCloseTo(31.5);
    expect(candidateRadiusKm(5, 0)).toBe(5);
    expect(candidateRadiusKm(120, 20)).toBe(45);
    expect(estimateCutoff(60, 10)).toBeCloseTo(96);
  });

  it("시간 내가 먼저, 같은 그룹은 짧은 순", () => {
    const area = (id: string, fit: AreaRecommendation["commute"]["fit"], best: number, noTransfer: number | null) =>
      ({ zoneId: id, residentialScore: 1, commute: { fit, bestMinutes: best, noTransferMinutes: noTransfer } }) as AreaRecommendation;
    const ranked = rankAreas([area("nt", "no_transfer_extra", 45, 48), area("w2", "within", 40, null), area("w1", "within", 25, null)]);
    expect(ranked.map((a) => a.zoneId)).toEqual(["w1", "w2", "nt"]);
  });
});

describe("출근지 검색 응답", () => {
  it("브이월드 장소와 네이버 주소를 합치고 중복을 없앤다", () => {
    const places = parseVworldPlaces({
      response: {
        status: "OK",
        result: {
          items: [
            { title: "강남역", category: "지하철역", address: { parcel: "서울 강남구 역삼동 858" }, point: { x: "127.0277", y: "37.4977" } },
            { title: "강남역", category: "지하철역", address: { road: "강남대로 396" }, point: { x: "127.02772", y: "37.49772" } },
          ],
        },
      },
    });
    const addresses = parseNaverAddresses({ status: "OK", addresses: [{ roadAddress: "서울특별시 중구 세종대로 110", jibunAddress: "태평로1가 31", x: "126.97", y: "37.56" }] });
    const merged = mergePlaces(addresses, places, 10);
    expect(merged.map((p) => p.label)).toEqual(["서울특별시 중구 세종대로 110", "강남역"]);
    expect(parseVworldPlaces({ response: { status: "NOT_FOUND" } })).toEqual([]);
  });

  it("네이버 지역 검색: <b> 태그를 지우고 10^7배 정수 좌표를 위경도로 바꾼다", () => {
    const [place] = parseNaverLocal({
      items: [{ title: "<b>강남</b>143빌딩", category: "부동산>빌딩", roadAddress: "서울 강남구 테헤란로77길 11-8", mapx: "1270538380", mapy: "375071485" }],
    });
    expect(place).toMatchObject({ label: "강남143빌딩", source: "naver" });
    expect(place.longitude).toBeCloseTo(127.053838, 6);
    expect(place.latitude).toBeCloseTo(37.5071485, 6);
    expect(parseNaverLocal({ items: [{ title: "A", mapx: "127.03", mapy: "37.49" }] })[0].latitude).toBe(37.49);
  });
});
