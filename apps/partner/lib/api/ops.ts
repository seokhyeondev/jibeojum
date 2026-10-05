import type {
  AgentAssignmentDetail,
  AgentAssignmentSummary,
  AgentChat,
  ChatThreadSummary,
  AgentLicenseInput,
  AgentInvitePreview,
  AgentListingInput,
  AgentSignupInput,
  AgentSummary,
  ProposedListing,
} from "@zipazum/shared";
import { apiRequest } from "./client";

// 공인중개사 웹(/agent) API

const post = <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const del = <T>(path: string) => apiRequest<T>(path, { method: "DELETE" });

export const agentApi = {
  signup: (body: AgentSignupInput) => post<{ agent: AgentSummary }>("/api/agent/signup", body),
  login: (loginId: string, password: string) => post<{ agent: AgentSummary }>("/api/agent/session", { loginId, password }),
  logout: () => del<{ ok: true }>("/api/agent/session"),
  me: () => apiRequest<{ agent: AgentSummary }>("/api/agent/me").then((b) => b.agent),
  assignments: () => apiRequest<{ assignments: AgentAssignmentSummary[] }>("/api/agent/assignments").then((b) => b.assignments),
  assignment: (id: string) => apiRequest<{ assignment: AgentAssignmentDetail }>(`/api/agent/assignments/${id}`).then((b) => b.assignment),
  chats: () => apiRequest<{ threads: ChatThreadSummary[] }>("/api/agent/chats").then((b) => b.threads),
  chat: (id: string) => apiRequest<{ chat: AgentChat }>(`/api/agent/chats/${id}`).then((b) => b.chat),
  sendChat: (id: string, body: string) => post<{ chat: AgentChat }>(`/api/agent/chats/${id}/messages`, { body }).then((b) => b.chat),
  chatUnread: () => apiRequest<{ unread: number }>("/api/agent/chats/unread").then((b) => b.unread),
  /** 반려된 뒤 등록증 다시 내기 */
  resubmitLicense: (body: AgentLicenseInput) => post<{ agent: AgentSummary }>("/api/agent/license", body).then((b) => b.agent),
  invite: (token: string) => apiRequest<{ invite: AgentInvitePreview }>(`/api/agent/invites/${encodeURIComponent(token)}`).then((b) => b.invite),
  acceptInvite: (token: string) => post<{ assignmentId: string }>(`/api/agent/invites/${encodeURIComponent(token)}/accept`),
  registerListing: (assignmentId: string, body: AgentListingInput) =>
    post<{ listing: ProposedListing }>(`/api/agent/assignments/${assignmentId}/listings`, body).then((b) => b.listing),
};

/** 네이버 지도 검색 링크 */
export const naverMapUrl = (query: string) => `https://map.naver.com/p/search/${encodeURIComponent(query)}`;
