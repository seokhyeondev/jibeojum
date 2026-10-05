import type {
  BudgetFlexibility,
  BuildingAgePreference,
  FloorExclusion,
  FloorPreference,
  HousingType,
  InfraId,
  MaxCommuteMinutes,
  MoveInFlexibility,
  TransactionPreference,
  NoTransferExtraMinutes,
  RequiredOptionId,
  SafetyOptionId, MinPyeong,
  Direction,
} from "./types/request";

export interface Choice<T extends string | number> {
  value: T;
  label: string;
  description?: string;
}

export const COMMUTE_CHOICES: Choice<MaxCommuteMinutes>[] = [
  { value: 30, label: "30분" },
  { value: 60, label: "60분" },
  { value: 90, label: "90분" },
  { value: 120, label: "120분" },
];

export const NO_TRANSFER_EXTRA_CHOICES: Choice<NoTransferExtraMinutes>[] = [
  { value: 0, label: "아니요" },
  { value: 10, label: "+10분까지" },
  { value: 20, label: "+20분까지" },
];

export const TRANSACTION_CHOICES: Choice<TransactionPreference>[] = [
  { value: "rent", label: "월세" },
  { value: "jeonse", label: "전세" },
  { value: "both", label: "둘 다" },
];

export const BUDGET_FLEXIBILITY_CHOICES: Choice<BudgetFlexibility>[] = [
  { value: "fixed", label: "조정 불가" },
  { value: "negotiable", label: "조금 가능" },
  { value: "consultation", label: "상담 후 결정" },
];

export const HOUSING_TYPE_CHOICES: Choice<HousingType>[] = [
  { value: "studio", label: "원룸", description: "생활시설이 한 공간에 있어요" },
  { value: "officetel", label: "오피스텔", description: "보안과 관리가 편리해요" },
  { value: "two_room", label: "투룸", description: "침실과 거실이 분리되어 있어요" },
  { value: "apartment", label: "아파트", description: "단지 관리와 생활 편의시설이 좋아요" },
];

export const MOVE_IN_FLEXIBILITY_CHOICES: Choice<MoveInFlexibility>[] = [
  { value: "fixed", label: "이 날짜에 꼭" },
  { value: "within_7_days", label: "앞뒤 일주일" },
  { value: "negotiable", label: "협의 가능" },
];

export const REQUIRED_OPTION_CHOICES: Choice<RequiredOptionId>[] = [
  { value: "station", label: "역세권" },
  { value: "elevator", label: "엘리베이터" },
  { value: "parking", label: "주차 가능" },
  { value: "pet", label: "반려동물 가능" },
  { value: "jeonse_loan", label: "전세대출 가능" },
  { value: "full_option", label: "풀옵션" },
];

export const FLOOR_PREFERENCE_CHOICES: Choice<FloorPreference>[] = [
  { value: "any", label: "상관없어요" },
  { value: "2_plus", label: "2층 이상" },
  { value: "5_plus", label: "5층 이상" },
];

export const FLOOR_EXCLUSION_CHOICES: Choice<FloorExclusion>[] = [
  { value: "semi_basement", label: "반지하 제외" },
  { value: "rooftop", label: "옥탑 제외" },
];

export const BUILDING_AGE_CHOICES: Choice<BuildingAgePreference>[] = [
  { value: "any", label: "상관없어요" },
  { value: "new", label: "신축 위주", description: "준공 5년 이내" },
  { value: "value", label: "구축 위주", description: "구축이라도 넓고 저렴한 집 우선" },
];

/** 1평 = 3.3058㎡ */
export const PYEONG_M2 = 3.3058;
export const pyeongToM2 = (pyeong: number) => Math.round(pyeong * PYEONG_M2);

export const MIN_PYEONG_CHOICES: Choice<MinPyeong>[] = [
  { value: 0, label: "상관없어요" },
  ...([5, 7, 10, 15] as const).map((p) => ({ value: p, label: `${p}평 이상`, description: `전용 ${pyeongToM2(p)}㎡ 이상` })),
];

export const DIRECTION_CHOICES: Choice<Direction>[] = [
  { value: "south", label: "남향" },
  { value: "east", label: "동향" },
  { value: "west", label: "서향" },
  { value: "north", label: "북향" },
];

export const SAFETY_CHOICES: Choice<SafetyOptionId>[] = [
  { value: "women_only", label: "여성 전용 건물", description: "여성 전용 오피스텔·원룸" },
  { value: "secure_entrance", label: "공동현관 보안" },
  { value: "cctv", label: "CCTV" },
  { value: "window_guard", label: "방범창" },
  { value: "main_road", label: "밝은 대로변" },
  { value: "parcel_locker", label: "무인택배함" },
];

export const INFRA_CHOICES: Choice<InfraId>[] = [
  { value: "convenience_store", label: "편의점" },
  { value: "mart", label: "마트" },
  { value: "hospital", label: "병원·약국" },
  { value: "park", label: "공원·산책로" },
  { value: "gym", label: "헬스장" },
  { value: "laundry", label: "빨래방" },
  { value: "cafe", label: "카페" },
];

export function choiceLabel<T extends string | number>(
  choices: Choice<T>[],
  value: T,
): string {
  return choices.find((choice) => choice.value === value)?.label ?? String(value);
}
