import type { Agent } from "./agent";
import type { CommuteSummary } from "./commute";
import type {
  Direction,
  FloorExclusion,
  HousingType,
  InfraId,
  RequiredOptionId,
  SafetyOptionId,
} from "./request";

export interface ListingImage {
  src: string;
  alt: string;
}

export interface NearbyFacility {
  type: InfraId;
  name: string;
  walkMinutes: number;
  /** 지도 표시용 좌표 (예전에 저장된 값에는 없다) */
  latitude?: number;
  longitude?: number;
}

export interface Listing {
  id: string;
  agentId: string;
  title: string;
  housingType: HousingType;
  transactionType: "rent" | "jeonse";
  /** 만원 단위 */
  deposit: number;
  monthlyRent: number;
  maintenanceFee: number;
  address: string;
  /** 지도 표시용 좌표 (모르면 null) */
  latitude?: number | null;
  longitude?: number | null;
  station: { name: string; walkMinutes: number };
  exclusiveAreaM2: number;
  floor: number;
  totalFloors: number;
  floorType: "normal" | FloorExclusion;
  /** 향 (모르면 null) */
  direction?: Direction | null;
  /** 시범 운영용 예시 매물 (실거래를 바탕으로 만든 것. 문의·신고 불가) */
  sample?: boolean;
  builtYear: number;
  /** null이면 즉시 입주 */
  availableFrom: string | null;
  moveInNote?: string;
  options: RequiredOptionId[];
  security: SafetyOptionId[];
  nearby: NearbyFacility[];
  tags: string[];
  description: string;
  images: ListingImage[];
  /** 샘플 단계에서는 출근지와 무관한 고정 값 */
  commute: CommuteSummary;
  verifiedAt: string;
  status: "available" | "expired";
}

/** 요청에 제안된 매물. 통근 정보와 담당 중개사가 함께 온다. */
export interface ProposedListing extends Listing {
  proposalId: string;
  agent: Agent;
}
