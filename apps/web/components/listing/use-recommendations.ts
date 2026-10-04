"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ApiError, fetchListing, fetchProposals } from "@/lib/api/client";
import { rankListings, type RecommendCriteria, type Recommendation } from "@zipazum/shared";
import { useDraft, useSubmittedRequest } from "@/lib/store/app-store";
import type { ProposedListing } from "@zipazum/shared";

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

const retry = (count: number, error: Error) =>
  !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2;

export function useProposals() {
  const [request] = useSubmittedRequest();
  const query = useQuery({
    queryKey: ["proposals", request?.id],
    queryFn: () => fetchProposals(request!.id),
    enabled: Boolean(request),
    retry,
  });
  return { request, ...query };
}

export interface RecommendationsState {
  hasRequest: boolean;
  isPending: boolean;
  error: Error | null;
  refetch: () => void;
  recommendations: Recommendation<ProposedListing>[];
}

export function useRecommendations(): RecommendationsState {
  const criteria = useCriteria();
  const now = useNow();
  const { request, data, isPending, error, refetch } = useProposals();
  const recommendations = useMemo(() => (data ? rankListings(data, criteria, now) : []), [data, criteria, now]);
  return {
    hasRequest: Boolean(request),
    isPending: Boolean(request) && isPending,
    error,
    refetch: () => void refetch(),
    recommendations,
  };
}

export function useListing(id: string | null) {
  return useQuery({
    queryKey: ["listing", id],
    queryFn: () => fetchListing(id!),
    enabled: Boolean(id),
    retry,
  });
}
