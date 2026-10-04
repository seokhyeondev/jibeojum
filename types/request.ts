export type HousingType = "studio" | "officetel" | "two_room" | "apartment";

export type MaxCommuteMinutes = 20 | 30 | 40 | 60;

/** 환승 없이 갈 수 있으면 허용 통근시간에 더해 줄 여유 시간 */
export type NoTransferExtraMinutes = 0 | 10 | 20;

export type MoveInFlexibility = "fixed" | "within_7_days" | "negotiable";

export type BudgetFlexibility = "fixed" | "negotiable" | "consultation";

export type RequiredOptionId =
  | "station"
  | "elevator"
  | "parking"
  | "pet"
  | "jeonse_loan"
  | "full_option";

export type FloorPreference = "any" | "2_plus" | "5_plus";

export type FloorExclusion = "semi_basement" | "rooftop";

export type BuildingAgePreference = "any" | "new" | "value";

export type SafetyOptionId =
  | "women_only"
  | "secure_entrance"
  | "cctv"
  | "window_guard"
  | "main_road"
  | "parcel_locker";

export type InfraId =
  | "convenience_store"
  | "mart"
  | "hospital"
  | "park"
  | "gym"
  | "laundry"
  | "cafe";

export interface Place {
  label: string;
}

/** 5단계 입력 흐름 전체를 담는 작성 중 요청 */
export interface RequestDraft {
  commuteDestination: Place;
  maxCommuteMinutes: MaxCommuteMinutes;
  noTransferExtraMinutes: NoTransferExtraMinutes;
  /** 만원 단위, 입력 전이면 null */
  depositMax: number | null;
  monthlyRentMax: number | null;
  budgetFlexibility: BudgetFlexibility;
  housingTypes: HousingType[];
  moveInDate: string;
  moveInFlexibility: MoveInFlexibility;
  requiredOptions: RequiredOptionId[];
  floorPreference: FloorPreference;
  floorExclusions: FloorExclusion[];
  buildingAge: BuildingAgePreference;
  safetyOptions: SafetyOptionId[];
  infrastructure: InfraId[];
  verificationStatus: "pending" | "verified";
  privacyAgreed: boolean;
}

export type RequestStatus = "submitted" | "matching" | "proposed" | "closed";

/** 제출된 요청. 서버 도입 전에는 로컬에만 저장된다. */
export interface HousingRequest
  extends Omit<RequestDraft, "depositMax" | "monthlyRentMax" | "privacyAgreed"> {
  id: string;
  depositMax: number;
  monthlyRentMax: number;
  status: RequestStatus;
  submittedAt: string;
}
