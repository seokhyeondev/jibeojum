"use client";

import { useQuery } from "@tanstack/react-query";
import type { HousingRequest } from "@zipazum/shared";
import { MATCHING_POLL_MS, fetchMyRequests } from "@/lib/api/client";

const checking = (requests: HousingRequest[] | undefined) =>
  Boolean(requests?.some((r) => r.status !== "closed" && r.matching?.state === "checking"));

/** 내 요청 목록. 동네를 계산 중인 요청이 있으면 끝날 때까지 몇 초마다 다시 받는다 */
export function useMyRequests(enabled = true) {
  return useQuery({
    queryKey: ["my-requests"],
    queryFn: fetchMyRequests,
    retry: false,
    enabled,
    refetchInterval: (query) => (checking(query.state.data) ? MATCHING_POLL_MS : false),
  });
}
