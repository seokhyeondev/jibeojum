import type { RequestInput } from "@zipazum/shared";
import type { ListingReaction, ListingReportInput, NotificationItem, PlaceCandidate, ProposedListing, UploadRequest, UploadTicket } from "@zipazum/shared";
import type { HousingRequest } from "@zipazum/shared";

// 브라우저에서 쓰는 API 클라이언트. 화면은 이 함수들로만 서버 데이터를 읽고 쓴다.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "network", "인터넷 연결을 확인해주세요.");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(response.status, error?.code ?? "unknown", error?.message ?? "잠시 후 다시 시도해주세요.");
  }
  return body as T;
}

export async function createRequest(input: RequestInput, clientKey: string): Promise<HousingRequest> {
  const body = await apiRequest<{ request: HousingRequest }>("/api/requests", {
    method: "POST",
    body: JSON.stringify({ ...input, clientKey }),
  });
  return body.request;
}

export async function updateRequest(id: string, input: RequestInput): Promise<HousingRequest> {
  const body = await apiRequest<{ request: HousingRequest }>(`/api/requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return body.request;
}

export async function fetchProposals(requestId: string): Promise<ProposedListing[]> {
  const body = await apiRequest<{ proposals: ProposedListing[] }>(`/api/requests/${requestId}/proposals`);
  return body.proposals;
}

export async function fetchListing(id: string): Promise<ProposedListing> {
  const body = await apiRequest<{ listing: ProposedListing }>(`/api/listings/${id}`);
  return body.listing;
}

export async function fetchMyRequests(): Promise<HousingRequest[]> {
  const body = await apiRequest<{ requests: HousingRequest[] }>("/api/requests");
  return body.requests;
}

export async function fetchPlaces(query: string): Promise<PlaceCandidate[]> {
  const body = await apiRequest<{ places: PlaceCandidate[] }>(`/api/places?${new URLSearchParams({ query })}`);
  return body.places;
}

export function fetchNotifications(): Promise<{ items: NotificationItem[]; unreadCount: number }> {
  return apiRequest("/api/notifications");
}

export function readAllNotifications(): Promise<{ ok: true }> {
  return apiRequest("/api/notifications/read-all", { method: "POST" });
}

/** 사진 업로드용 서명 주소 */
export function requestUpload(body: UploadRequest): Promise<UploadTicket> {
  return apiRequest<{ ticket: UploadTicket }>("/api/uploads", { method: "POST", body: JSON.stringify(body) }).then((b) => b.ticket);
}

export interface MeResponse {
  /** 카카오로 로그인했으면 프로필, 아니면 null */
  user: { nickname: string | null; profileImageUrl: string | null } | null;
  /** 서버에 카카오 키가 설정돼 있는지 */
  kakaoEnabled: boolean;
}

export function fetchMe(): Promise<MeResponse> {
  return apiRequest("/api/auth/me");
}

export function logout(): Promise<{ ok: true }> {
  return apiRequest("/api/auth/logout", { method: "POST" });
}

/** 카카오 로그인 시작 주소. 로그인 후 returnTo(사이트 안 경로)로 돌아온다 */
export const kakaoLoginHref = (returnTo: string) => `/api/auth/kakao?${new URLSearchParams({ returnTo })}`;

/** 요청 취소 */
export function cancelRequest(id: string): Promise<HousingRequest> {
  return apiRequest<{ request: HousingRequest }>(`/api/requests/${id}/cancel`, { method: "POST" }).then((b) => b.request);
}

/** 찜·문의 같은 반응을 서버에 남긴다 (처음 한 번만 기록된다). 실패해도 화면은 그대로 둔다 */
export function reactToListing(listingId: string, type: ListingReaction): void {
  void apiRequest(`/api/listings/${listingId}/reactions`, { method: "POST", body: JSON.stringify({ type }) }).catch(() => undefined);
}

/** 매물 신고 */
export function reportListing(listingId: string, body: ListingReportInput): Promise<{ ok: true }> {
  return apiRequest(`/api/listings/${listingId}/report`, { method: "POST", body: JSON.stringify(body) });
}
