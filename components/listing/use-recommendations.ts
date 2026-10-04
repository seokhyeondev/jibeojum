"use client";

import { useMemo, useState } from "react";
import { getProposedListings } from "@/lib/api/listings";
import { rankListings, type RecommendCriteria, type Recommendation } from "@/lib/recommend";
import { useDraft, useSubmittedRequest } from "@/lib/store/app-store";

/** 제출된 요청이 있으면 그 조건을, 없으면 작성 중 초안을 기준으로 삼는다. */
export function useCriteria(): RecommendCriteria {
  const [request] = useSubmittedRequest();
  const { draft } = useDraft();
  return request ?? draft;
}

/** 화면이 열린 시점. 렌더마다 바뀌지 않게 고정한다. */
export function useNow(): Date {
  const [now] = useState(() => new Date());
  return now;
}

export function useRecommendations(): Recommendation[] {
  const criteria = useCriteria();
  const now = useNow();
  return useMemo(() => rankListings(getProposedListings(), criteria, now), [criteria, now]);
}
