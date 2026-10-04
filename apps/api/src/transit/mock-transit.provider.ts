import { haversineMeters } from "../residential/anchor-builder.js";
import { summarizeItineraries, type TransitRouteInput, type TransitRouteProvider, type TransitRouteResult } from "./transit.types.js";

/**
 * TMAP 키가 없을 때 쓰는 가짜 제공자. 외부 호출 없이 직선거리로 대략적인 값을 만든다.
 * 개발·테스트용이며 실제 통근시간으로 쓰면 안 된다.
 */
export class MockTransitProvider implements TransitRouteProvider {
  readonly name = "mock";

  async getRoutes(input: TransitRouteInput): Promise<TransitRouteResult> {
    const km = haversineMeters(input.startY, input.startX, input.endY, input.endX) / 1000;
    const base = Math.round(8 + km * 2.6);
    return summarizeItineraries(this.name, [
      { totalMinutes: base, transferCount: km > 6 ? 1 : 0, walkMinutes: 8, fare: 1550, pathType: 1, totalDistanceM: Math.round(km * 1300) },
      { totalMinutes: Math.round(base * 1.25), transferCount: 0, walkMinutes: 6, fare: 1500, pathType: 2, totalDistanceM: Math.round(km * 1250) },
    ]);
  }
}
