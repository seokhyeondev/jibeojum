import { describe, expect, it } from "vitest";
import { anchorQuerySchema } from "../src/anchors/anchors.service.js";
import { FallbackGeocoder, parseNaverResponse, parseVworldResponse, type Geocoder, type GeocodeResult } from "../src/residential/geocoder.js";
import { MockTransitProvider } from "../src/transit/mock-transit.provider.js";
import { routeCacheKey, searchDateTimeFor } from "../src/transit/route-cache.js";
import { parseTmapResponse } from "../src/transit/tmap-transit.provider.js";
import { summarizeItineraries, TransitProviderError } from "../src/transit/transit.types.js";

describe("지오코딩 응답", () => {
  it("브이월드 성공·없음·수도권 밖 좌표", () => {
    expect(parseVworldResponse({ response: { status: "OK", result: { point: { x: "126.9238", y: "37.4853" } } } })).toMatchObject({ status: "ok", latitude: 37.4853 });
    expect(parseVworldResponse({ response: { status: "NOT_FOUND" } }).status).toBe("not_found");
    expect(parseVworldResponse({ response: { status: "OK", result: { point: { x: "129.0", y: "35.1" } } } }).status).toBe("not_found");
    expect(parseVworldResponse({ response: { status: "ERROR", error: { text: "quota" } } })).toMatchObject({ status: "error", message: "quota" });
  });

  it("네이버는 요청한 번지가 그대로 있는 결과만 받는다 (건물명이 붙어도 됨)", () => {
    const address = "서울특별시 관악구 신림동 1465-1";
    const ok = parseNaverResponse({ status: "OK", addresses: [{ jibunAddress: "서울특별시 관악구 신림동 1465-1 신사타운빌", x: "126.9238", y: "37.4853" }] }, address);
    expect(ok).toMatchObject({ status: "ok", longitude: 126.9238 });
    const near = parseNaverResponse({ status: "OK", addresses: [{ jibunAddress: "서울특별시 관악구 신림동 1465-12", x: "1", y: "1" }] }, address);
    expect(near.status).toBe("not_found");
  });

  it("앞 제공자가 실패하면 다음 제공자를 쓰고, 오류가 섞이면 재시도 대상으로 남긴다", async () => {
    const fake = (provider: string, result: GeocodeResult): Geocoder => ({ provider, geocodeParcel: async () => result });
    const ok: GeocodeResult = { status: "ok", latitude: 37.5, longitude: 127 };
    expect(await new FallbackGeocoder([fake("a", { status: "not_found" }), fake("b", ok)]).geocodeWithProvider("x")).toMatchObject({ status: "ok", provider: "b" });
    expect((await new FallbackGeocoder([fake("a", { status: "error" }), fake("b", { status: "not_found" })]).geocodeWithProvider("x")).status).toBe("error");
    expect((await new FallbackGeocoder([fake("a", { status: "not_found" }), fake("b", { status: "not_found" })]).geocodeWithProvider("x")).status).toBe("not_found");
  });
});

describe("대중교통 경로", () => {
  const tmapBody = {
    metaData: {
      plan: {
        itineraries: [
          { totalTime: 1260, transferCount: 0, totalWalkTime: 180, pathType: 1, totalDistance: 9000, fare: { regular: { totalFare: 1550 } } },
          { totalTime: 1560, transferCount: 1, totalWalkTime: 420, pathType: 3, fare: { regular: { totalFare: 3200 } } },
        ],
      },
    },
  };

  it("TMAP 응답에서 최단과 무환승 경로를 고른다", () => {
    const result = summarizeItineraries("tmap", parseTmapResponse(tmapBody));
    expect(result.best).toMatchObject({ totalMinutes: 21, transferCount: 0, fare: 1550 });
    expect(result.bestNoTransfer?.totalMinutes).toBe(21);
  });

  it("경로 없음은 빈 목록, 오류 응답은 예외", () => {
    expect(parseTmapResponse({ result: { status: 11, message: "출발지/도착지 간 거리가 가까워서 탐색된 경로 없음" } })).toEqual([]);
    expect(() => parseTmapResponse({ error: { code: "INVALID_API_KEY", message: "bad key" } })).toThrow(TransitProviderError);
  });

  it("키가 없을 때 쓰는 mock 제공자는 외부 호출 없이 값을 만든다", async () => {
    const result = await new MockTransitProvider().getRoutes({ startX: 126.9297, startY: 37.4842, endX: 127.0276, endY: 37.4979 });
    expect(result.provider).toBe("mock");
    expect(result.best?.totalMinutes).toBeGreaterThan(10);
  });

  it("캐시 키는 제공자·출발 격자·반올림한 도착 좌표·시간대·기준일로 만든다", () => {
    const base = { provider: "tmap", originKey: "8830e1d8c3fffff", originLat: 37.48, originLng: 126.92, destLat: 37.49791, destLng: 127.02762, timeSlot: "weekday-0800", dataDate: "2026-09-30" };
    expect(routeCacheKey(base)).toBe("tmap|8830e1d8c3fffff|37.498,127.028|weekday-0800|2026-09-30");
    expect(routeCacheKey({ ...base, destLat: 37.49794 })).toBe(routeCacheKey(base));
    expect(routeCacheKey({ ...base, originKey: null })).toContain("37.48,126.92");
  });

  it("출근 시간대는 다음 평일 오전 8시로 바꾼다 (한국 시간)", () => {
    // 2026-10-09(금) 23:00 KST → 다음 평일은 10-12(월)
    expect(searchDateTimeFor("weekday-0800", new Date("2026-10-09T14:00:00Z"))).toBe("202610120800");
    expect(searchDateTimeFor("weekday-0830", new Date("2026-10-05T01:00:00Z"))).toBe("202610060830");
  });
});

describe("앵커 목록 쿼리", () => {
  it("기본값과 유형 필터를 해석한다", () => {
    const q = anchorQuerySchema.parse({ latitude: "37.4979", longitude: "127.0276", housingTypes: "officetel,multifamily" });
    expect(q).toMatchObject({ radiusKm: 15, limit: 50, minScore: 0, housingTypes: ["officetel", "multifamily"] });
  });

  it("위도만 있거나 모르는 유형이면 거부한다", () => {
    expect(anchorQuerySchema.safeParse({ latitude: "37.5" }).success).toBe(false);
    expect(anchorQuerySchema.safeParse({ housingTypes: "castle" }).success).toBe(false);
  });
});

describe("TMAP 한도 초과", () => {
  it("QUOTA_EXCEEDED는 재시도하지 않고 바로 한도 오류로 던진다", async () => {
    const { TmapTransitProvider } = await import("../src/transit/tmap-transit.provider.js");
    const { TransitQuotaError } = await import("../src/transit/transit.types.js");
    let calls = 0;
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      calls++;
      return new Response(JSON.stringify({ error: { id: "429", code: "QUOTA_EXCEEDED", message: "Limit Exceeded" } }), { status: 429 });
    }) as typeof fetch;
    try {
      const provider = new TmapTransitProvider("key", undefined, { minIntervalMs: 0 });
      await expect(provider.getRoutes({ startX: 127, startY: 37.5, endX: 127.03, endY: 37.5 })).rejects.toBeInstanceOf(TransitQuotaError);
      expect(calls).toBe(1);
    } finally {
      globalThis.fetch = original;
    }
  });
});
