import type { AreaRecommendationResult } from "./types/area";
import type { RequestMatching } from "./types/request";

/** "두 곳 모두 45분" / "각각 45분·60분" */
const limitText = (mine: number, partner: number) => (mine === partner ? `두 곳 모두 ${mine}분` : `각각 ${mine}분·${partner}분`);

/**
 * 추천 동네 계산 결과 → 사용자에게 보여줄 상태.
 * 못 찾았으면 어느 단계에서 걸렸는지에 따라 무엇을 바꾸면 되는지 알려준다.
 */
export function requestMatchingOf(area: { status: string; result: AreaRecommendationResult | null } | null): RequestMatching {
  if (!area || area.status === "pending" || area.status === "running") return { state: "checking", reason: null };
  if (area.status === "failed" || !area.result) {
    return { state: "none", reason: "출근 위치를 확인하지 못했어요. 출근지를 검색 목록에서 다시 골라주세요." };
  }
  const { funnel, partner, maxCommuteMinutes } = area.result;
  if (funnel.fit > 0) return { state: "found", reason: null };
  if (funnel.zonesInRadius === 0) {
    return {
      state: "none",
      reason: partner
        ? `출근지와 ${partner.name} 위치가 멀어서 ${limitText(maxCommuteMinutes, partner.maxCommuteMinutes)} 안에 갈 수 있는 동네가 없어요. 최대 시간을 늘려보세요.`
        : "출근지 근처에서 찾을 수 있는 동네가 없어요.",
    };
  }
  if (funnel.matchedConditions === 0) {
    return { state: "none", reason: "출근 가능한 동네 중 예산·집 유형에 맞는 곳이 없어요. 예산을 올리거나 집 유형을 넓혀보세요." };
  }
  return {
    state: "none",
    reason: partner
      ? `출근지와 ${partner.name} 모두 최대 시간 안에 갈 수 있는 동네가 없어요. 최대 시간을 늘려보세요.`
      : `${maxCommuteMinutes}분 안에 갈 수 있는 동네가 없어요. 최대 통근시간을 늘려보세요.`,
  };
}
