import { describe, expect, it } from "vitest";
import { requestMatchingOf } from "../src/request-matching";
import type { AreaRecommendationResult } from "../src/types/area";

const result = (funnel: Partial<AreaRecommendationResult["funnel"]>, partner = false) =>
  ({
    maxCommuteMinutes: 45,
    partner: partner ? { destination: { label: "계양구청", latitude: 37.5, longitude: 126.7 }, maxCommuteMinutes: 45 } : null,
    funnel: { zonesInRadius: 10, matchedConditions: 5, afterEstimate: 5, measured: 5, estimated: 0, fit: 0, ...funnel },
  }) as AreaRecommendationResult;

describe("요청 매칭 상태", () => {
  it("계산 중·찾음·못 찾음", () => {
    expect(requestMatchingOf(null).state).toBe("checking");
    expect(requestMatchingOf({ status: "running", result: null }).state).toBe("checking");
    expect(requestMatchingOf({ status: "done", result: result({ fit: 3 }) })).toEqual({ state: "found", reason: null });
    expect(requestMatchingOf({ status: "failed", result: null }).state).toBe("none");
  });

  it("어디서 걸렸는지에 따라 이유가 다르다", () => {
    expect(requestMatchingOf({ status: "done", result: result({ zonesInRadius: 0 }, true) }).reason).toContain("두 분 출근지가 멀어서");
    expect(requestMatchingOf({ status: "done", result: result({ matchedConditions: 0 }) }).reason).toContain("예산");
    expect(requestMatchingOf({ status: "done", result: result({}) }).reason).toContain("45분 안에");
  });
});
