"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchMyRequests } from "@/lib/api/client";
import { useSubmittedRequest } from "@/lib/store/app-store";
import { useHydrated } from "@/lib/store/persistent-store";

/** 브라우저에 저장된 요청이 없으면 서버에서 가장 최근 요청을 가져와 이어서 보여준다. */
export function RequestSync() {
  const hydrated = useHydrated();
  const [request, setRequest] = useSubmittedRequest();
  const { data } = useQuery({
    queryKey: ["my-requests"],
    queryFn: fetchMyRequests,
    enabled: hydrated && !request,
    retry: false,
  });
  const latest = data?.[0];
  useEffect(() => {
    if (!request && latest) setRequest(latest);
  }, [request, latest, setRequest]);
  return null;
}
