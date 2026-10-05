import type {
  AdminCreateAgentInput,
  AdminRequestDetail,
  AdminRequestSummary,
  AgentInviteLink,
  BrokerContactCreateInput,
  BrokerContactUpdateInput,
  BrokerContactView,
  ListingReportView,
  AgentSummary,
  AssignmentSummary,
  BrokerSearch,
} from "@zipazum/shared";
import { apiRequest } from "./client";

// 내부 운영 웹(/admin) API

const post = <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const del = <T>(path: string) => apiRequest<T>(path, { method: "DELETE" });

export const adminApi = {
  login: (password: string) => post<{ ok: true }>("/api/admin/session", { password }),
  logout: () => del<{ ok: true }>("/api/admin/session"),
  requests: () => apiRequest<{ requests: AdminRequestSummary[] }>("/api/admin/requests").then((b) => b.requests),
  request: (id: string) => apiRequest<AdminRequestDetail>(`/api/admin/requests/${id}`),
  recompute: (id: string) => post<{ ok: true }>(`/api/admin/requests/${id}/areas/recompute`),
  /** 한 생활권에 여러 공인중개사 배정 */
  assign: (id: string, body: { zoneKey: string; agentIds: string[]; note: string | null }) =>
    post<{ assignments: AssignmentSummary[] }>(`/api/admin/requests/${id}/assignments`, body).then((b) => b.assignments),
  /** zoneKey를 주면 그 생활권에서만 뺀다 */
  unassign: (assignmentId: string, zoneKey?: string) =>
    del<{ assignments: AssignmentSummary[] }>(`/api/admin/assignments/${assignmentId}${zoneKey ? `?${new URLSearchParams({ zoneKey })}` : ""}`).then((b) => b.assignments),
  brokers: (zoneKey: string, requestId: string) => apiRequest<BrokerSearch>(`/api/admin/brokers?${new URLSearchParams({ zoneKey, requestId })}`),
  /** 부동산 연락 기록 (처음 보는 곳이면 우리 목록에도 들어간다) */
  recordContact: (requestId: string, body: Partial<BrokerContactCreateInput>) =>
    post<{ contacts: BrokerContactView[] }>(`/api/admin/requests/${requestId}/contacts`, body).then((b) => b.contacts),
  updateContact: (contactId: string, body: BrokerContactUpdateInput) =>
    apiRequest<{ contacts: BrokerContactView[] }>(`/api/admin/contacts/${contactId}`, { method: "PATCH", body: JSON.stringify(body) }).then((b) => b.contacts),
  removeContact: (contactId: string) => del<{ contacts: BrokerContactView[] }>(`/api/admin/contacts/${contactId}`).then((b) => b.contacts),
  /** 초대 링크와 보낼 문구 */
  invite: (contactId: string) => post<{ invite: AgentInviteLink }>(`/api/admin/contacts/${contactId}/invite`).then((b) => b.invite),
  agents: () => apiRequest<{ agents: AgentSummary[] }>("/api/admin/agents").then((b) => b.agents),
  createAgent: (body: AdminCreateAgentInput) => post<{ agent: AgentSummary; temporaryPassword: string | null }>("/api/admin/agents", body),
  resetPassword: (agentId: string) => post<{ temporaryPassword: string }>(`/api/admin/agents/${agentId}/password-reset`),
  setStatus: (agentId: string, status: AgentSummary["status"]) => post<{ ok: true }>(`/api/admin/agents/${agentId}/status`, { status }),
  /** 등록증 확인: 승인 또는 반려(사유) */
  verifyAgent: (agentId: string, status: "verified" | "rejected", reason: string | null = null) =>
    post<{ ok: true }>(`/api/admin/agents/${agentId}/verify`, { status, reason }),
  /** 등록증 사진을 5분 동안 볼 수 있는 주소 */
  licenseUrl: (agentId: string) => apiRequest<{ url: string }>(`/api/admin/agents/${agentId}/license`).then((b) => b.url),
  /** 런칭 파트너 지정·해제 (유료화 후 평생 할인 대상) */
  setLaunchPartner: (agentId: string, on: boolean) => post<{ ok: true }>(`/api/admin/agents/${agentId}/launch-partner`, { on }),
  reports: (status: "open" | "all") => apiRequest<{ reports: ListingReportView[] }>(`/api/admin/reports?status=${status}`).then((b) => b.reports),
  reviewReport: (reportId: string, status: "confirmed" | "rejected") => post<{ ok: true }>(`/api/admin/reports/${reportId}/review`, { status }),
};

export const naverSearchUrl = (query: string) => `https://search.naver.com/search.naver?${new URLSearchParams({ where: "nexearch", query })}`;
export const naverMapUrl = (query: string) => `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
