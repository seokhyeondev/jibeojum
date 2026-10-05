export type HousingType = "studio" | "officetel" | "two_room" | "apartment";

/** 120은 예전에 저장된 요청 호환용 (지금은 고를 수 없다) */
export type MaxCommuteMinutes = 20 | 30 | 45 | 60 | 90 | 120;

/** 환승 없이 갈 수 있으면 허용 통근시간에 더해 줄 여유 시간 */
export type NoTransferExtraMinutes = 0 | 10 | 20;

export type MoveInFlexibility = "fixed" | "within_7_days" | "negotiable";

/** 찾는 거래 유형. both면 월세와 전세 예산을 모두 받는다. */
export type TransactionPreference = "rent" | "jeonse" | "both";

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
/** 집이 바라보는 방향 */
export type Direction = "south" | "east" | "west" | "north";
/** 최소 넓이(평). 0이면 상관없음 */
export type MinPyeong = 0 | 5 | 7 | 10 | 15;

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

/** 출근지. 검색 목록에서 고르면 주소와 좌표가 함께 온다 (직접 입력이면 label만) */
export interface Place {
  label: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/** 5단계 입력 흐름 전체를 담는 작성 중 요청 */
export interface RequestDraft {
  commuteDestination: Place;
  maxCommuteMinutes: MaxCommuteMinutes;
  noTransferExtraMinutes: NoTransferExtraMinutes;
  transactionPreference: TransactionPreference;
  /** 월세 예산. 만원 단위, 입력 전이거나 전세만 찾으면 null */
  depositMax: number | null;
  monthlyRentMax: number | null;
  /** 전세 예산. 만원 단위, 입력 전이거나 월세만 찾으면 null */
  jeonseMax: number | null;
  budgetFlexibility: BudgetFlexibility;
  housingTypes: HousingType[];
  moveInDate: string;
  moveInFlexibility: MoveInFlexibility;
  requiredOptions: RequiredOptionId[];
  floorPreference: FloorPreference;
  floorExclusions: FloorExclusion[];
  buildingAge: BuildingAgePreference;
  minPyeong: MinPyeong;
  safetyOptions: SafetyOptionId[];
  /** 선호 방향 (비우면 상관없음) */
  directions: Direction[];
  infrastructure: InfraId[];
  privacyAgreed: boolean;
}

export type RequestStatus = "submitted" | "matching" | "proposed" | "closed";

/** 제출된 요청. 서버 도입 전에는 로컬에만 저장된다. */
export interface HousingRequest extends Omit<RequestDraft, "privacyAgreed"> {
  id: string;
  status: RequestStatus;
  submittedAt: string;
}
