import { describe, expect, it } from "vitest";
import { summaryOfRoute } from "../src/listings/listing-route.service.js";
import { lineName, parseTmapRouteDetail } from "../src/transit/tmap-route-detail.js";

const walk = (sec: number, from: string, to: string) => ({ mode: "WALK", sectionTime: sec, distance: sec, start: { name: from }, end: { name: to } });
const body = {
  metaData: {
    plan: {
      itineraries: [
        { totalTime: 1331, transferCount: 0, totalWalkTime: 600, legs: [walk(600, "출발지", "선정릉")] },
        {
          totalTime: 1090,
          transferCount: 1,
          totalWalkTime: 500,
          fare: { regular: { totalFare: 1500 } },
          legs: [
            walk(300, "출발지", "선정릉"),
            { mode: "SUBWAY", sectionTime: 181, distance: 1694, route: "수도권9호선(급행)", routeColor: "BDB092", start: { name: "선정릉" }, end: { name: "신논현" }, passStopList: { stations: [{}, {}] } },
            { mode: "BUS", sectionTime: 420, distance: 2000, route: "지선:3412", routeColor: "53B332", start: { name: "신논현역" }, end: { name: "강남역" }, passStopList: { stations: [{}, {}, {}, {}] } },
            walk(200, "강남역", "도착지"),
          ],
        },
      ],
    },
  },
};

describe("TMAP 상세 경로", () => {
  it("가장 빠른 경로를 구간으로 바꾼다", () => {
    const route = parseTmapRouteDetail(body, new Date("2026-10-05T00:00:00Z"));
    expect(route?.totalMinutes).toBe(18);
    expect(route?.fare).toBe(1500);
    expect(route?.legs.map((l) => [l.mode, l.line, l.from, l.to, l.stops, l.color])).toEqual([
      ["walk", null, null, "선정릉", null, null],
      ["subway", "9호선(급행)", "선정릉", "신논현", 1, "#BDB092"],
      ["bus", "3412", "신논현역", "강남역", 3, "#53B332"],
      ["walk", null, "강남역", null, null, null],
    ]);
  });

  it("경로가 없으면 null", () => {
    expect(parseTmapRouteDetail({ metaData: { plan: { itineraries: [] } } })).toBeNull();
    expect(lineName(undefined)).toBeNull();
  });

  it("카드용 요약은 노선 순서와 환승을 보여준다", () => {
    const summary = summaryOfRoute(parseTmapRouteDetail(body)!);
    expect(summary.routeSummary).toBe("9호선(급행) → 3412번 · 환승 1회 · 도보 8분");
    expect([summary.subwayMinutes, summary.busMinutes, summary.provider]).toEqual([3, 7, "tmap"]);
  });
});
