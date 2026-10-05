import type { CommuteRoute, RouteLeg } from "@zipazum/shared";
import { TransitProviderError, TransitQuotaError, type TransitRouteInput } from "./transit.types.js";

/** 상세 경로 API (구간별 노선·정류장). 요약 API와 달리 상세 화면에서만 부른다 */
export const TMAP_ROUTE_DETAIL_URL = "https://apis.openapi.sk.com/transit/routes";

interface TmapLeg {
  mode?: string;
  sectionTime?: number;
  distance?: number;
  route?: string;
  routeColor?: string;
  start?: { name?: string };
  end?: { name?: string };
  passStopList?: { stations?: unknown[] };
}

interface TmapDetailItinerary {
  totalTime?: number;
  transferCount?: number;
  totalWalkTime?: number;
  fare?: { regular?: { totalFare?: number } };
  legs?: TmapLeg[];
}

interface TmapDetailResponse {
  metaData?: { plan?: { itineraries?: TmapDetailItinerary[] } };
  error?: { code?: string; message?: string };
}

const MODE: Record<string, RouteLeg["mode"]> = { WALK: "walk", BUS: "bus", SUBWAY: "subway", TRAIN: "train", EXPRESSBUS: "bus" };

/** "수도권9호선(급행)" → "9호선(급행)", "지선:3412" → "3412" */
export function lineName(route: string | undefined): string | null {
  if (!route) return null;
  const name = route.includes(":") ? route.slice(route.indexOf(":") + 1) : route;
  return name.replace(/^수도권/, "").trim() || null;
}

/** 가장 빠른 경로를 구간 목록으로 바꾼다. 경로가 없으면 null (걸어갈 거리 등) */
export function parseTmapRouteDetail(body: TmapDetailResponse, now = new Date()): CommuteRoute | null {
  const itineraries = (body.metaData?.plan?.itineraries ?? []).filter((it) => typeof it.totalTime === "number" && it.legs?.length);
  const best = itineraries.reduce<TmapDetailItinerary | null>((a, it) => (!a || (it.totalTime ?? 0) < (a.totalTime ?? 0) ? it : a), null);
  if (!best) return null;
  const legs: RouteLeg[] = (best.legs ?? []).map((leg) => {
    const mode = MODE[leg.mode ?? ""] ?? "etc";
    const stations = leg.passStopList?.stations?.length ?? 0;
    return {
      mode,
      minutes: Math.max(1, Math.round((leg.sectionTime ?? 0) / 60)),
      distanceM: Math.round(leg.distance ?? 0),
      line: mode === "walk" ? null : lineName(leg.route),
      color: leg.routeColor && /^[0-9a-f]{6}$/i.test(leg.routeColor) ? `#${leg.routeColor}` : null,
      from: leg.start?.name && leg.start.name !== "출발지" ? leg.start.name : null,
      to: leg.end?.name && leg.end.name !== "도착지" ? leg.end.name : null,
      stops: mode === "walk" || stations < 2 ? null : stations - 1,
    };
  });
  return {
    totalMinutes: Math.round((best.totalTime ?? 0) / 60),
    walkMinutes: Math.round((best.totalWalkTime ?? 0) / 60),
    transferCount: best.transferCount ?? 0,
    fare: best.fare?.regular?.totalFare ?? null,
    legs,
    calculatedAt: now.toISOString(),
  };
}

export async function fetchTmapRouteDetail(appKey: string, input: TransitRouteInput, url = TMAP_ROUTE_DETAIL_URL): Promise<CommuteRoute | null> {
  const response = await fetch(url, {
    method: "POST",
    headers: { appKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      startX: String(input.startX),
      startY: String(input.startY),
      endX: String(input.endX),
      endY: String(input.endY),
      count: 5,
      lang: 0,
      format: "json",
      ...(input.searchDateTime ? { searchDttm: input.searchDateTime } : {}),
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = (await response.json().catch(() => ({}))) as TmapDetailResponse;
  if (body.error?.code === "QUOTA_EXCEEDED" || (response.status === 429 && /limit exceeded/i.test(body.error?.message ?? ""))) {
    throw new TransitQuotaError("tmap detail: 호출 한도 초과");
  }
  if (!response.ok) throw new TransitProviderError(`tmap detail: HTTP ${response.status} ${body.error?.message ?? ""}`.trim());
  return parseTmapRouteDetail(body);
}
