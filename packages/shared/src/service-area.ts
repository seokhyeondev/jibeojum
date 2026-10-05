import type { Place } from "./types/request";

/**
 * 지금 서비스하는 지역: 서울·경기·인천 (실거래·생활권 데이터가 여기만 있다).
 * 주소가 있으면 시·도 이름으로, 없으면 좌표 범위로 판단한다.
 */
export const SERVICE_AREA_MESSAGE = "지금은 서울·경기·인천 출근지만 찾아드려요.";

const CAPITAL_PREFIX = /^(서울|경기|인천)/;
/** 주소가 없을 때만 쓰는 대략의 수도권 범위 (천안·춘천 같은 경계 바깥 일부가 섞일 수 있다) */
const CAPITAL_BOX = { minLat: 36.9, maxLat: 38.3, minLng: 126.0, maxLng: 127.85 };

export function isInServiceArea(place: Pick<Place, "address" | "latitude" | "longitude">): boolean {
  const address = place.address?.trim();
  if (address) return CAPITAL_PREFIX.test(address);
  const { latitude, longitude } = place;
  if (latitude == null || longitude == null) return true;
  return latitude >= CAPITAL_BOX.minLat && latitude <= CAPITAL_BOX.maxLat && longitude >= CAPITAL_BOX.minLng && longitude <= CAPITAL_BOX.maxLng;
}
