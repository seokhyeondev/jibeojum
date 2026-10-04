import type {
  AdminCreateAgentInput,
  AdminRequestDetail,
  AdminRequestSummary,
  AgentAssignmentDetail,
  AgentAssignmentSummary,
  AgentInviteLink,
  AgentInvitePreview,
  BrokerContactCreateInput,
  BrokerContactUpdateInput,
  BrokerContactView,
  ListingReportView,
  AgentListingInput,
  AgentSignupInput,
  AgentSummary,
  AssignmentSummary,
  BrokerSearch,
  ProposedListing,
} from "@zipazum/shared";
import { apiRequest } from "./client";

// 내부 운영 웹(/admin)과 공인중개사 웹(/agent) API

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
  /** 런칭 파트너 지정·해제 (유료화 후 평생 할인 대상) */
  setLaunchPartner: (agentId: string, on: boolean) => post<{ ok: true }>(`/api/admin/agents/${agentId}/launch-partner`, { on }),
  reports: (status: "open" | "all") => apiRequest<{ reports: ListingReportView[] }>(`/api/admin/reports?status=${status}`).then((b) => b.reports),
  reviewReport: (reportId: string, status: "confirmed" | "rejected") => post<{ ok: true }>(`/api/admin/reports/${reportId}/review`, { status }),
};

export const agentApi = {
  signup: (body: AgentSignupInput) => post<{ agent: AgentSummary }>("/api/agent/signup", body),
  login: (loginId: string, password: string) => post<{ agent: AgentSummary }>("/api/agent/session", { loginId, password }),
  logout: () => del<{ ok: true }>("/api/agent/session"),
  me: () => apiRequest<{ agent: AgentSummary }>("/api/agent/me").then((b) => b.agent),
  assignments: () => apiRequest<{ assignments: AgentAssignmentSummary[] }>("/api/agent/assignments").then((b) => b.assignments),
  assignment: (id: string) => apiRequest<{ assignment: AgentAssignmentDetail }>(`/api/agent/assignments/${id}`).then((b) => b.assignment),
  invite: (token: string) => apiRequest<{ invite: AgentInvitePreview }>(`/api/agent/invites/${encodeURIComponent(token)}`).then((b) => b.invite),
  acceptInvite: (token: string) => post<{ assignmentId: string }>(`/api/agent/invites/${encodeURIComponent(token)}/accept`),
  registerListing: (assignmentId: string, body: AgentListingInput) =>
    post<{ listing: ProposedListing }>(`/api/agent/assignments/${assignmentId}/listings`, body).then((b) => b.listing),
};

/** 네이버 통합검색·지도 검색 링크 */
export const naverSearchUrl = (query: string) => `https://search.naver.com/search.naver?${new URLSearchParams({ where: "nexearch", query })}`;
export const naverMapUrl = (query: string) => `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
