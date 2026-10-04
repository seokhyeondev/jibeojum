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
}

export interface AdminRequestDetail {
  request: HousingRequest;
  area: { status: AdminRequestSummary["areaStatus"]; error: string | null; result: AreaRecommendationResult | null };
  assignments: AssignmentSummary[];
  proposals: ProposedListing[];
}

/** 생활권 근처 부동산 찾기: 검색어와 네이버 지역 검색 결과 */
export interface BrokerSearch {
  zoneKey: string;
  keywords: { label: string; query: string; reason: string }[];
  /** 생활권 대표 좌표에서 1.5km 안, 가까운 순 */
  offices: { name: string; address: string | null; category: string | null; link: string | null; keyword: string; distanceM: number | null }[];
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
