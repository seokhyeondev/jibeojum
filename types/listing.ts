import type { CommuteSummary } from "./commute";
import type {
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
  station: { name: string; walkMinutes: number };
  exclusiveAreaM2: number;
  floor: number;
  totalFloors: number;
  floorType: "normal" | FloorExclusion;
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
