import type { PlaceCandidate, UploadRequest, UploadTicket } from "@zipazum/shared";

/** 운영·중개사 웹의 API 호출. /api는 Next가 NestJS로 넘긴다 (사용자 웹 client.ts와 같은 규칙) */
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

export function requestUpload(body: UploadRequest): Promise<UploadTicket> {
  return apiRequest<{ ticket: UploadTicket }>("/api/uploads", { method: "POST", body: JSON.stringify(body) }).then((b) => b.ticket);
}

/** 주소·장소 검색 (매물 주소 입력) */
export async function fetchPlaces(query: string): Promise<PlaceCandidate[]> {
  const body = await apiRequest<{ places: PlaceCandidate[] }>(`/api/places?${new URLSearchParams({ query })}`);
  return body.places;
}
