import type { AgentListingInput, CommuteSummary } from "@zipazum/shared";
import { REQUIRED_OPTION_CHOICES, SAFETY_CHOICES, choiceLabel } from "@zipazum/shared";
import type { TransitRouteResult } from "../transit/transit.types.js";

const PATH_LABEL: Record<number, string> = { 1: "지하철", 2: "버스", 3: "버스+지하철", 4: "고속·시외버스", 5: "기차" };

/**
 * 경로 결과 → 매물 통근 요약. 요약 API는 버스·지하철 시간을 나눠 주지 않아서
 * 걷는 시간을 뺀 나머지를 경로 종류에 따라 버스 또는 지하철로 둔다.
 */
export function toCommuteSummary(route: TransitRouteResult, estimated: boolean, now = new Date()): CommuteSummary | null {
  const best = route.best;
  if (!best) return null;
  const ride = Math.max(0, best.totalMinutes - best.walkMinutes);
  const isBus = best.pathType === 2 || best.pathType === 4;
  const transfers = best.transferCount === 0 ? "환승 없음" : `환승 ${best.transferCount}회`;
  return {
    totalMinutes: best.totalMinutes,
    walkMinutes: best.walkMinutes,
    busMinutes: isBus ? ride : 0,
    subwayMinutes: isBus ? 0 : ride,
    transferCount: best.transferCount,
    fare: best.fare ?? undefined,
    routeSummary: `${PATH_LABEL[best.pathType] ?? "대중교통"} · ${transfers} · 도보 ${best.walkMinutes}분${estimated ? " (직선거리 추정)" : ""}`,
    calculatedAt: now.toISOString(),
    provider: estimated ? "internal" : "tmap",
  };
}

/** 출근지가 걸어갈 거리면 TMAP이 경로를 주지 않는다. 그때는 걷는 시간으로 둔다 */
export const WALK_COMMUTE_MAX_M = 1200;

export function walkingCommute(minutes: number, now = new Date()): CommuteSummary {
  return {
    totalMinutes: minutes,
    walkMinutes: minutes,
    busMinutes: 0,
    subwayMinutes: 0,
    transferCount: 0,
    routeSummary: `걸어서 출근 · 도보 ${minutes}분`,
    calculatedAt: now.toISOString(),
    provider: "internal",
  };
}

/** 카드에 보일 태그: 옵션·보안에서 앞의 3개 */
export function listingTags(input: Pick<AgentListingInput, "options" | "security" | "transactionType">): string[] {
  const tags = [
    input.transactionType === "jeonse" ? "전세" : null,
    ...input.security.map((s) => choiceLabel(SAFETY_CHOICES, s)),
    ...input.options.map((o) => choiceLabel(REQUIRED_OPTION_CHOICES, o)),
  ].filter((t): t is string => Boolean(t));
  return [...new Set(tags)].slice(0, 3);
}
