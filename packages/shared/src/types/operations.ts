import type { AreaRecommendationResult } from "./area";
import type { ProposedListing } from "./listing";
import type { HousingRequest } from "./request";

// 내부 운영 웹(/admin)과 중개사 웹(/agent)이 쓰는 계약

export interface AgentSummary {
  id: string;
  loginId: string;
  name: string;
  phone: string | null;
  /** 사무소 주소 */
  address: string | null;
  photoUrl: string | null;
  status: "active" | "inactive";
  /** self: 직접 가입, admin: 운영자가 만듦 */
  createdBy: "self" | "admin";
  assignmentCount: number;
  createdAt: string;
  /** 런칭 파트너로 등록한 시각 (유료화 후 평생 할인 대상). null이면 일반 */
  launchPartnerAt: string | null;
  stats: AgentStats;
  /** 등록증 확인: 승인 전에는 매물을 올릴 수 없다 */
  verificationStatus: AgentVerificationStatus;
  registrationNo: string | null;
  hasLicenseImage: boolean;
  rejectReason: string | null;
}

export type AgentVerificationStatus = "pending" | "verified" | "rejected";

/** 공인중개사 실적 (유료화 단가·플랜 판단에 쓴다) */
export interface AgentStats {
  /** 올린 제안 수 */
  proposals: number;
  /** 사용자가 연 제안 수 */
  viewed: number;
  favorited: number;
  inquired: number;
  /** 사용자 신고: 확인 전 / 확인됨(허위·거래완료) */
  reportsOpen: number;
  reportsConfirmed: number;
}

export type ListingReportReason = "gone" | "wrong_info" | "fake";
export type ListingReportStatus = "open" | "confirmed" | "rejected";

/** 운영자가 보는 매물 신고 */
export interface ListingReportView {
  id: string;
  listingId: string;
  listingTitle: string;
  agent: { id: string; name: string };
  reason: ListingReportReason;
  note: string | null;
  status: ListingReportStatus;
  createdAt: string;
  /** 이 공인중개사가 확인된 신고를 받은 횟수 (3회면 정지 검토) */
  agentConfirmedCount: number;
}

export interface AssignmentSummary {
  id: string;
  requestId: string;
  agent: { id: string; name: string; officeName: string };
  zoneKeys: string[];
  note: string | null;
  status: "assigned" | "proposed" | "closed";
  proposalCount: number;
  createdAt: string;
}

export interface AdminRequestSummary {
  id: string;
  destinationLabel: string;
  maxCommuteMinutes: number;
  summary: string;
  submittedAt: string;
  status: HousingRequest["status"];
  areaStatus: "none" | "pending" | "running" | "done" | "failed";
  fitZoneCount: number | null;
  assignmentCount: number;
  /** 실제 중개사 제안 수 (샘플 제외) */
  proposalCount: number;
  /** 운영팀이 이 요청으로 연락한 부동산 수 */
  contactCount: number;
}

export interface AdminRequestDetail {
  request: HousingRequest;
  area: { status: AdminRequestSummary["areaStatus"]; error: string | null; result: AreaRecommendationResult | null };
  assignments: AssignmentSummary[];
  proposals: ProposedListing[];
  contacts: BrokerContactView[];
}

/** 운영팀이 부동산에 연락한 결과. joined·has_listing은 초대 링크·매물 등록으로 자동으로 바뀐다 */
export type BrokerContactStatus = "contacted" | "no_answer" | "interested" | "no_listing" | "declined" | "joined" | "has_listing";

/** 부동산별 지난 연락 결과 (모든 요청 합계) */
export interface BrokerHistory {
  contacts: number;
  /** 매물을 올려준 횟수 */
  listings: number;
  lastStatus: BrokerContactStatus | null;
  lastContactedAt: string | null;
}

/** 생활권 근처 부동산 한 곳. 네이버 검색 결과와 우리 목록(연락했던 곳)을 합친다 */
export interface BrokerOfficeView {
  /** 우리 목록에 있으면 id, 처음 보는 곳이면 null (연락 기록을 남기면 생긴다) */
  officeId: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  link: string | null;
  category: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceM: number | null;
  /** 어떤 검색어로 찾았는지 (우리 목록에서 온 곳은 null) */
  keyword: string | null;
  history: BrokerHistory;
  /** 가입한 공인중개사가 이 사무소 소속이면 */
  agent: { id: string; name: string } | null;
  /** 이 요청에서의 연락 기록 */
  contactId: string | null;
  contactStatus: BrokerContactStatus | null;
}

/** 생활권 근처 부동산 찾기: 검색어와 부동산 목록 */
export interface BrokerSearch {
  zoneKey: string;
  keywords: { label: string; query: string; reason: string }[];
  offices: BrokerOfficeView[];
}

export interface BrokerContactView {
  id: string;
  requestId: string;
  officeId: string;
  officeName: string;
  officeAddress: string | null;
  phone: string | null;
  zoneKey: string | null;
  status: BrokerContactStatus;
  note: string | null;
  contactedAt: string;
  updatedAt: string;
  /** 초대 링크를 만든 적이 있으면 마지막 링크 정보 */
  invite: { createdAt: string; expiresAt: string; acceptedAt: string | null; agentName: string | null } | null;
}

/** 초대 링크와 함께 보낼 문구 */
export interface AgentInviteLink {
  url: string;
  message: string;
  expiresAt: string;
}

/** 초대 링크를 연 공인중개사가 보는 요청 (사용자 개인정보 없음) */
export interface AgentInvitePreview {
  destinationLabel: string;
  summary: string;
  conditions: string[];
  zoneNames: string[];
  officeName: string | null;
  officeAddress: string | null;
  expired: boolean;
  /** 이미 다른 계정이 받은 링크인지 */
  accepted: boolean;
  /** 요청이 취소됐는지 */
  closed: boolean;
}

/** 중개사가 보는 배정 요청. 사용자 개인정보는 없다 */
export interface AgentAssignmentSummary {
  id: string;
  requestId: string;
  destinationLabel: string;
  summary: string;
  conditions: string[];
  zoneNames: string[];
  status: AssignmentSummary["status"];
  proposalCount: number;
  createdAt: string;
}

export interface AgentAssignmentDetail extends AgentAssignmentSummary {
  request: Pick<
    HousingRequest,
    | "commuteDestination"
    | "maxCommuteMinutes"
    | "noTransferExtraMinutes"
    | "transactionPreference"
    | "depositMax"
    | "monthlyRentMax"
    | "jeonseMax"
    | "budgetFlexibility"
    | "housingTypes"
    | "moveInDate"
    | "moveInFlexibility"
    | "requiredOptions"
    | "floorPreference"
    | "floorExclusions"
    | "buildingAge"
    | "safetyOptions"
    | "infrastructure"
  >;
  zones: { zoneKey: string; name: string; latitude: number; longitude: number; stationName: string | null }[];
  note: string | null;
  myListings: ProposedListing[];
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}
