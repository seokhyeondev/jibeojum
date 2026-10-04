import type { AreaCriteria, AreaRecommendationResult, PlaceCandidate, RequestAreaRecommendation } from "@zipazum/shared";
import { ApiError } from "./client";

// 디버그 화면 전용 API. 서버에서 DEBUG_TOOLS가 꺼져 있으면 404가 난다.

export interface DebugRequestRow {
  requestId: string;
  destinationLabel: string;
  maxCommuteMinutes: number;
  submittedAt: string;
  recommendation: RequestAreaRecommendation | null;
}

const TOKEN_KEY = "zipazum:debug-token";

export function getDebugToken(): string {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setDebugToken(token: string) {
  try {
    window.sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // 저장이 막혀 있으면 이번 화면에서만 쓴다
  }
}

async function debugRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getDebugToken();
  let response: Response;
  try {
    response = await fetch(`/api/debug${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(token ? { "x-debug-token": token } : {}), ...init?.headers },
    });
  } catch {
    throw new ApiError(0, "network", "API 서버에 연결할 수 없어요.");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    const message = response.status === 404 && error?.code === "not_found" ? "디버그 API가 꺼져 있거나 토큰이 틀렸어요 (API의 DEBUG_TOOLS)." : error?.message;
    const fallback =
      response.status >= 500 && !error
        ? "API 응답이 끊겼어요. 계산은 서버에서 계속되니 잠시 뒤 다시 누르면 캐시로 빨리 나와요."
        : "요청에 실패했어요.";
    throw new ApiError(response.status, error?.code ?? "unknown", message ?? fallback);
  }
  return body as T;
}

export const searchPlaces = (query: string) =>
  debugRequest<{ places: PlaceCandidate[] }>(`/places?${new URLSearchParams({ query })}`).then((b) => b.places);

export const computeAreas = (input: {
  label: string;
  latitude: number;
  longitude: number;
  maxCommuteMinutes: number;
  noTransferExtraMinutes: number;
  criteria: AreaCriteria | null;
}) =>
  debugRequest<{ result: AreaRecommendationResult }>("/area-recommendations", { method: "POST", body: JSON.stringify(input) }).then((b) => b.result);

export const fetchDebugRequests = () => debugRequest<{ requests: DebugRequestRow[] }>("/requests").then((b) => b.requests);

export const recomputeRequestAreas = (requestId: string) => debugRequest<{ ok: true }>(`/requests/${requestId}/areas/recompute`, { method: "POST" });
