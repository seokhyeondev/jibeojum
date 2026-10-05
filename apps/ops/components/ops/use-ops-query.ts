"use client";

import { useQuery, type QueryKey } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ApiError } from "@/lib/api/client";
import type { OpsKind } from "./ops-shell";

/** 로그인이 풀려 401이 오면 그 웹의 로그인 화면으로 보낸다 */
export function useOpsQuery<T>(kind: OpsKind, queryKey: QueryKey, queryFn: () => Promise<T>, options: { refetchInterval?: number } = {}) {
  const router = useRouter();
  const query = useQuery({
    queryKey: [kind, ...queryKey],
    queryFn,
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    refetchInterval: options.refetchInterval,
  });
  const unauthorized = query.error instanceof ApiError && query.error.status === 401;
  useEffect(() => {
    if (unauthorized) router.replace(`/${kind}/login`);
  }, [unauthorized, kind, router]);
  return query;
}

export const errorText = (error: unknown) => (error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.");
