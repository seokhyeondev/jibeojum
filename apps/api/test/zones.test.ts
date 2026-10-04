import { describe, expect, it } from "vitest";
import { parseNaverAdmin } from "../src/zones/admin-area.js";
import { mergeStations, normalizeStationName, parseSupplementStation } from "../src/zones/stations.js";
import { assignAnchor, buildZones, housingTypeOf, statsByType, walkMinutes, type ZoneAnchor } from "../src/zones/zone-builder.js";

const sillim = { id: "신림역@37.484,126.929", name: "신림역", latitude: 37.4843, longitude: 126.9294 };
const seowon = { id: "서원역@37.478,126.933", name: "서원역", latitude: 37.4782, longitude: 126.9331 };

const anchor = (gridId: string, latitude: number, longitude: number, admName: string | null, tx = 10): ZoneAnchor => ({
  gridId,
  latitude,
  longitude,
  sido: "서울특별시",
  sigungu: "관악구",
  buildingCount: 3,
  transactionCount: tx,
  residentialScore: tx * 2,
  admCode: admName ? `code-${admName}` : null,
  admName,
});

describe("isBrokerOffice", () => {
  it("중개사무소만 남긴다", async () => {
    const { isBrokerOffice } = await import("../src/admin/broker-search.js");
    expect(isBrokerOffice("허니부동산공인중개사사무소", "부동산>부동산중개")).toBe(true);
    expect(isBrokerOffice("삼성역 래미안부동산", "부동산")).toBe(true);
    expect(isBrokerOffice("법무법인 영웅 서울 형사 도산 상속 부동산 전문변호사", "법률,법무>변호사")).toBe(false);
    expect(isBrokerOffice("BGF", "기업,빌딩>부동산개발")).toBe(false);
    expect(isBrokerOffice("kt estate", "부동산>부동산임대")).toBe(false);
    expect(isBrokerOffice("야놀자에프앤지", "전문,기술서비스>무형재산권중개")).toBe(false);
  });
});

describe("역 목록", () => {
  it("역 이름을 정리하고 역이 아닌 이름은 버린다", () => {
    expect(normalizeStationName("신림역(2호선)")).toBe("신림역");
    expect(normalizeStationName("신림역 2호선")).toBe("신림역");
    expect(normalizeStationName("신림사거리")).toBeNull();
  });

  it("같은 이름이 600m 안이면 하나로, 멀면 다른 역으로 (서울 양평역 vs 경기 양평역)", () => {
    const stations = mergeStations([
      { title: "양평역", category: "철도시설 > 철도/지하철 > 지하철역", latitude: 37.5256, longitude: 126.8862 },
      { title: "양평역", category: "철도시설 > 철도/지하철 > 지하철역", latitude: 37.5258, longitude: 126.8865 },
      { title: "양평역", category: "철도시설 > 철도/지하철 > 일반철도역", latitude: 37.4938, longitude: 127.4918 },
      { title: "양평역", category: "도로시설 > 버스터미널/정류장", latitude: 37.5, longitude: 127 },
    ]);
    expect(stations).toHaveLength(2);
    expect(stations.find((s) => s.longitude < 127)?.sourceCount).toBe(2);
  });

  it("네이버 지역 검색으로 빠진 역을 보충한다 (지하철·철도 분류만)", () => {
    const places = parseSupplementStation("동탄역", {
      items: [
        { title: "동탄역 (고속철도)", category: "기차,철도>KTX정차역", mapx: "1270954914", mapy: "371998621" },
        { title: "하얀풍차제과점 동탄역점", category: "카페,디저트>베이커리", mapx: "1270983991", mapy: "371977171" },
      ],
    });
    expect(places).toHaveLength(1);
    expect(places[0].latitude).toBeCloseTo(37.1998621, 6);
  });
});

describe("생활권 만들기", () => {
  it("도보 15분(직선 1km) 안 가장 가까운 역에 붙이고, 없으면 행정동 버스권", () => {
    expect(assignAnchor(anchor("a", 37.4850, 126.9290, "신사동"), [sillim, seowon]).zoneKey).toBe(`station:${sillim.id}`);
    expect(assignAnchor(anchor("b", 37.4790, 126.9330, "서원동"), [sillim, seowon]).zoneKey).toBe(`station:${seowon.id}`);
    const far = assignAnchor(anchor("c", 37.4650, 126.9200, "난곡동"), [sillim, seowon]);
    expect(far).toMatchObject({ zoneKey: "bus:code-난곡동", stationId: null });
  });

  it("이름은 점수가 큰 행정동 + 역, 대표 좌표는 실제 앵커 중 하나", () => {
    const anchors = [anchor("a", 37.485, 126.929, "신사동", 30), anchor("b", 37.4845, 126.9285, "신림동", 5), anchor("c", 37.465, 126.92, "난곡동", 8)];
    const assignments = anchors.map((a) => assignAnchor(a, [sillim, seowon]));
    const zones = buildZones(anchors, assignments, [sillim, seowon]);
    const station = zones.find((z) => z.kind === "station");
    expect(station).toMatchObject({ name: "신사동 · 신림역권", anchorCount: 2, transactionCount: 35, stationName: "신림역" });
    expect(["a", "b"]).toContain(station?.repGridId);
    expect(station?.stationWalkMinutes).toBeGreaterThan(0);
    expect(zones.find((z) => z.kind === "bus")?.name).toBe("난곡동 · 버스권");
  });

  it("도보 분 = 직선 거리 / 분당 약 67m", () => {
    expect(walkMinutes(1000)).toBe(15);
    expect(walkMinutes(10)).toBe(1);
  });
});

describe("유형별 시세", () => {
  it("연립다세대는 면적으로 원룸·투룸을 나누고 오피스텔·아파트는 그대로", () => {
    expect(housingTypeOf("rh", 25)).toBe("studio");
    expect(housingTypeOf("rh", 45)).toBe("two_room");
    expect(housingTypeOf("rh", 85)).toBeNull();
    expect(housingTypeOf("offi", 20)).toBe("officetel");
    expect(housingTypeOf("apt", 59)).toBe("apartment");
    expect(housingTypeOf("sh", 20)).toBeNull();
  });

  it("유형별 거래 수와 월세·전세 중위값", () => {
    const result = statsByType([
      { source: "rh", areaM2: 20, deposit: 500, monthlyRent: 50 },
      { source: "rh", areaM2: 25, deposit: 1000, monthlyRent: 60 },
      { source: "rh", areaM2: 30, deposit: 15000, monthlyRent: 0 },
      { source: "offi", areaM2: 20, deposit: 1000, monthlyRent: 70 },
    ]);
    expect(result.studio).toEqual({ count: 3, monthlyDepositMedian: 750, monthlyRentMedian: 55, jeonseDepositMedian: 15000 });
    expect(result.officetel?.count).toBe(1);
    expect(result.two_room).toBeUndefined();
  });
});

describe("행정동 역지오코딩", () => {
  it("admcode 결과에서 시도·시군구·행정동을 읽는다", () => {
    const area = parseNaverAdmin({
      status: { code: 0 },
      results: [{ name: "admcode", code: { id: "1162068500" }, region: { area1: { name: "서울특별시" }, area2: { name: "관악구" }, area3: { name: "신사동" } } }],
    });
    expect(area).toEqual({ admCode: "1162068500", admName: "신사동", sido: "서울특별시", sigungu: "관악구" });
    expect(parseNaverAdmin({ status: { code: 3 }, results: [] }).admName).toBeNull();
  });
});

describe("출근지 검색 호출 제한", () => {
  it("창 안에서 max번까지만 허용하고, 시간이 지나면 다시 허용한다", async () => {
    const { RateLimiter } = await import("../src/places/rate-limit.js");
    const limiter = new RateLimiter(2, 1000);
    expect(limiter.allow("ip", 0)).toBe(true);
    expect(limiter.allow("ip", 10)).toBe(true);
    expect(limiter.allow("ip", 20)).toBe(false);
    expect(limiter.allow("other", 20)).toBe(true);
    expect(limiter.allow("ip", 1500)).toBe(true);
  });
});

describe("부동산 검색어", () => {
  it("단지명 → 역 → 시군구+법정동 → 행정동 순, 건물명의 지번 괄호는 지운다", async () => {
    const { brokerKeywords, parseBrokerOffices } = await import("../src/admin/broker-search.js");
    const keywords = brokerKeywords({ kind: "station", stationName: "삼성역", admName: "대치2동", sigungu: "강남구" }, "대치동", ["테헤란로대우아이빌(891-6)", "대치푸르지오써밋"]);
    expect(keywords.map((k) => k.query)).toEqual(["대치동 테헤란로대우아이빌 부동산", "대치동 대치푸르지오써밋 부동산", "삼성역 부동산", "강남구 대치동 부동산", "강남구 대치2동 부동산"]);
    const bus = brokerKeywords({ kind: "bus", stationName: null, admName: "난곡동", sigungu: "관악구" }, "신림동", []);
    expect(bus.map((k) => k.query)).toEqual(["관악구 신림동 부동산", "관악구 난곡동 부동산"]);
    const { cleanBuildingName } = await import("../src/admin/broker-search.js");
    expect(["신동아아파트1", "한양2", "대치푸르지오써밋", "래미안(891-6)", "e-편한세상3차"].map(cleanBuildingName)).toEqual(["신동아아파트", "한양", "대치푸르지오써밋", "래미안", "e-편한세상"]);
    // 방학3동 생활권(도봉구) 기준: 근처만 남기고 다른 도시의 같은 이름은 뺀다
    const origin = { latitude: 37.6640, longitude: 127.0370, sigungu: "도봉구" };
    const items = [
      { title: "<b>허니</b>부동산", category: "부동산>부동산중개", mapx: "1270400000", mapy: "376650000", roadAddress: "서울특별시 도봉구 시루봉로 1" },
      { title: "신동아공인중개사사무소", category: "부동산>중개업", mapx: "1267660000", mapy: "375040000", roadAddress: "경기도 부천시 원미구 중동로 296" },
      { title: "좌표없는부동산", category: "부동산>중개업", roadAddress: "서울특별시 도봉구 방학로 2" },
      { title: "카페", category: "카페" },
    ];
    const offices = parseBrokerOffices(items, "q", origin);
    expect(offices.map((o) => o.name)).toEqual(["허니부동산", "좌표없는부동산"]);
    expect(offices[0]?.distanceM).toBeLessThan(500);
  });
});

describe("매물 통근 요약", () => {
  it("경로 종류에 따라 버스·지하철 시간을 나눈다", async () => {
    const { toCommuteSummary, listingTags } = await import("../src/agent/listing-builder.js");
    const route = { provider: "tmap", itineraries: [], best: { totalMinutes: 30, transferCount: 1, walkMinutes: 8, fare: 1550, pathType: 2, totalDistanceM: null }, bestNoTransfer: null };
    expect(toCommuteSummary(route, false)).toMatchObject({ totalMinutes: 30, busMinutes: 22, subwayMinutes: 0, provider: "tmap" });
    expect(toCommuteSummary({ ...route, best: null }, false)).toBeNull();
    const { walkingCommute } = await import("../src/agent/listing-builder.js");
    const { commuteSourceNote } = await import("@zipazum/shared");
    const walk = walkingCommute(3);
    expect(walk).toMatchObject({ totalMinutes: 3, walkMinutes: 3, busMinutes: 0, subwayMinutes: 0, routeSummary: "걸어서 출근 · 도보 3분" });
    expect(commuteSourceNote(walk)).toContain("걸어서");
    expect(commuteSourceNote(toCommuteSummary(route, false)!)).toContain("평일 오전 8시");
    expect(commuteSourceNote(toCommuteSummary(route, true)!)).toContain("직선거리");
    expect(listingTags({ transactionType: "rent", security: ["women_only"], options: ["elevator", "parking"] })).toEqual(["여성 전용 건물", "엘리베이터", "주차 가능"]);
  });
});

describe("부동산 연락 목록", () => {
  it("네이버 결과와 우리 목록을 합치고, 가입·매물 준 곳을 먼저, 거절한 곳을 마지막에 둔다", async () => {
    const { mergeOffices } = await import("../src/admin/broker-search.js");
    const origin = { latitude: 37.5, longitude: 127.0 };
    const naver = [
      { name: "가까운부동산", address: "서울 A로 1", category: "부동산>중개업", link: null, phone: null, keyword: "q", distanceM: 100, latitude: 37.5009, longitude: 127.0 },
      { name: "거절한부동산", address: "서울 B로 2", category: "부동산>중개업", link: null, phone: null, keyword: "q", distanceM: 50, latitude: 37.5004, longitude: 127.0 },
    ];
    const at = new Date("2026-10-01T00:00:00Z");
    const saved = [
      { id: "o-declined", name: "거절한부동산", address: "서울 B로 2", phone: "02-1", link: null, latitude: 37.5004, longitude: 127.0, contacts: [{ id: "c1", requestId: "r-old", status: "declined", contactedAt: at }], agents: [] },
      { id: "o-good", name: "단골부동산", address: "서울 C로 3", phone: null, link: null, latitude: 37.505, longitude: 127.0, contacts: [{ id: "c2", requestId: "r-now", status: "has_listing", contactedAt: at }], agents: [] },
      { id: "o-far", name: "먼부동산", address: "서울 D로 4", phone: null, link: null, latitude: 37.6, longitude: 127.0, contacts: [], agents: [] },
    ];
    const views = mergeOffices(naver, saved, "r-now", origin);
    expect(views.map((v) => v.name)).toEqual(["단골부동산", "가까운부동산", "거절한부동산"]);
    expect(views[0]).toMatchObject({ officeId: "o-good", keyword: null, contactStatus: "has_listing", history: { contacts: 1, listings: 1 } });
    expect(views[2]).toMatchObject({ officeId: "o-declined", phone: "02-1", contactStatus: null, history: { lastStatus: "declined" } });
  });

  it("초대 문구에는 조건과 링크만 넣는다", async () => {
    const { inviteMessage } = await import("../src/admin/outreach.service.js");
    const request = {
      id: "r", status: "matching" as const, submittedAt: "2026-10-05T00:00:00Z",
      commuteDestination: { label: "강남역" }, maxCommuteMinutes: 60 as const, noTransferExtraMinutes: 10 as const, transactionPreference: "rent" as const,
      depositMax: 1000, monthlyRentMax: 60, jeonseMax: null, budgetFlexibility: "fixed" as const, housingTypes: ["studio" as const],
      moveInDate: "2026-11-01", moveInFlexibility: "negotiable" as const, requiredOptions: [], floorPreference: "any" as const, floorExclusions: [],
      buildingAge: "any" as const, safetyOptions: [], infrastructure: [],
    };
    const text = inviteMessage(request, "서원동 · 신림역권", "https://x/agent/invite/t");
    expect(text).toContain("강남역 출근하시는 분이 서원동 근처에서 원룸 매물을 찾고 있어요.");
    expect(text).toContain("보증금 1,000만 · 월세 60만 이하");
    expect(text.endsWith("https://x/agent/invite/t")).toBe(true);
  });
});
