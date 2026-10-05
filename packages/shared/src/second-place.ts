import type { Choice } from "./options";
import type { PartnerCommute, SecondPlaceKind } from "./types/request";

/**
 * 두 번째 장소 (선택). 같이 사는 분 직장·학교·학원·자주 가는 곳 중 하나.
 * 계산은 출근지와 같고(두 곳 모두 최대 시간 안), 문구와 공개 범위만 다르다.
 */
export const SECOND_PLACE_CHOICES: Choice<SecondPlaceKind>[] = [
  { value: "partner_work", label: "같이 사는 분 직장" },
  { value: "frequent", label: "자주 가는 곳" },
  { value: "school", label: "학교·학원" },
];

interface SecondPlaceText {
  /** 카드·탭·요약에 쓰는 짧은 이름 */
  name: string;
  /** 위치 입력칸 이름 */
  placeLabel: string;
  placeholder: string;
  /** 최대 시간 입력칸 이름 */
  maxLabel: string;
}

const TEXT: Record<SecondPlaceKind, SecondPlaceText> = {
  partner_work: { name: "같이 사는 분", placeLabel: "출근지", placeholder: "같이 사는 분의 회사·역·주소", maxLabel: "최대 통근시간" },
  school: { name: "학교·학원", placeLabel: "위치", placeholder: "학교·학원 이름이나 주소", maxLabel: "최대 이동시간" },
  frequent: { name: "자주 가는 곳", placeLabel: "위치", placeholder: "자주 가는 곳의 역·건물·주소", maxLabel: "최대 이동시간" },
};

export const secondPlaceText = (kind: SecondPlaceKind): SecondPlaceText => TEXT[kind];

/** "인천광역시 계양구 계산새로 88" → "계양구" */
function districtOf(address: string | null | undefined): string | null {
  const parts = (address ?? "").split(/\s+/);
  return parts.find((p, i) => i > 0 && /(구|군|시)$/.test(p)) ?? null;
}

/**
 * 중개사에게 보여줄 두 번째 장소 이름.
 * 자주 가는 곳은 개인 생활 반경이라 구 단위까지만 보여준다 (같이 사는 분 직장·학교는 그대로).
 */
export function secondPlacePublicLabel(partner: PartnerCommute): string {
  if (partner.kind !== "frequent") return partner.destination.label.trim();
  return districtOf(partner.destination.address) ?? "위치 비공개";
}
