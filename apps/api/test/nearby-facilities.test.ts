import { describe, expect, it } from "vitest";
import { nearestPlace, walkMinutesTo } from "../src/places/nearby-facilities.js";

describe("주변 시설", () => {
  it("반경 안에서 가장 가까운 곳을 고르고, 키워드 검색은 카테고리로 거른다", () => {
    const places = [
      { place_name: "공원카페", distance: "50", category_name: "음식점 > 카페" },
      { place_name: "학동어린이공원", distance: "112", category_name: "여행 > 공원 > 어린이공원", x: "127.04", y: "37.51" },
      { place_name: "먼공원", distance: "1500", category_name: "여행 > 공원" },
    ];
    expect(nearestPlace(places, ["공원"])).toEqual({ name: "학동어린이공원", meters: 112, latitude: 37.51, longitude: 127.04 });
    expect(nearestPlace(places)?.name).toBe("공원카페");
    expect(nearestPlace([{ place_name: "먼공원", distance: "1500" }])).toBeNull();
    const cafes = [
      { place_name: "플레이방방", distance: "20", category_name: "가정,생활 > 유아 > 놀이시설 > 키즈카페" },
      { place_name: "보드게임카페", distance: "30", category_name: "음식점 > 카페 > 테마카페 > 보드카페" },
      { place_name: "바나프레소", distance: "40", category_name: "음식점 > 카페 > 커피전문점" },
    ];
    expect(nearestPlace(cafes, ["음식점 > 카페"], ["테마카페"])?.name).toBe("바나프레소");
  });

  it("도보 시간은 걷는 길을 감안해 1분 이상", () => {
    expect(walkMinutesTo(10)).toBe(1);
    expect(walkMinutesTo(500)).toBe(10);
  });
});
