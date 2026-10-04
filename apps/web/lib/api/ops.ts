import type {
  AdminCreateAgentInput,
  AdminRequestDetail,
  AdminRequestSummary,
  AgentAssignmentDetail,
  AgentAssignmentSummary,
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
  brokers: (zoneKey: string) => apiRequest<BrokerSearch>(`/api/admin/brokers?${new URLSearchParams({ zoneKey })}`),
  agents: () => apiRequest<{ agents: AgentSummary[] }>("/api/admin/agents").then((b) => b.agents),
  createAgent: (body: AdminCreateAgentInput) => post<{ agent: AgentSummary; temporaryPassword: string | null }>("/api/admin/agents", body),
  resetPassword: (agentId: string) => post<{ temporaryPassword: string }>(`/api/admin/agents/${agentId}/password-reset`),
  setStatus: (agentId: string, status: AgentSummary["status"]) => post<{ ok: true }>(`/api/admin/agents/${agentId}/status`, { status }),
};

export const agentApi = {
  signup: (body: AgentSignupInput) => post<{ agent: AgentSummary }>("/api/agent/signup", body),
  login: (loginId: string, password: string) => post<{ agent: AgentSummary }>("/api/agent/session", { loginId, password }),
  logout: () => del<{ ok: true }>("/api/agent/session"),
  me: () => apiRequest<{ agent: AgentSummary }>("/api/agent/me").then((b) => b.agent),
  assignments: () => apiRequest<{ assignments: AgentAssignmentSummary[] }>("/api/agent/assignments").then((b) => b.assignments),
  assignment: (id: string) => apiRequest<{ assignment: AgentAssignmentDetail }>(`/api/agent/assignments/${id}`).then((b) => b.assignment),
  registerListing: (assignmentId: string, body: AgentListingInput) =>
    post<{ listing: ProposedListing }>(`/api/agent/assignments/${assignmentId}/listings`, body).then((b) => b.listing),
};

/** 네이버 통합검색·지도 검색 링크 */
export const naverSearchUrl = (query: string) => `https://search.naver.com/search.naver?${new URLSearchParams({ where: "nexearch", query })}`;
export const naverMapUrl = (query: string) => `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
