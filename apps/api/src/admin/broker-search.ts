import type { BrokerSearch } from "@zipazum/shared";
import { haversineMeters } from "../residential/anchor-builder.js";

export interface BrokerZone {
  kind: "station" | "bus";
  stationName: string | null;
  admName: string | null;
  sigungu: string;
}

/** 실거래 건물명 정리: "(891-6)" 같은 지번과 "신동아아파트1"·"한양2"의 동·차수 숫자를 뗀다 */
export function cleanBuildingName(name: string): string {
  return name
    .replace(/\(.*?\)/g, "")
    .replace(/(\D)\d+(차|단지)?$/, "$1")
    .trim();
}

/**
 * 생활권 근처 부동산을 찾을 검색어. 앞에 둘수록 결과가 좁고 정확하다.
 * - 오피스텔·아파트 단지명: 그 건물을 다루는 중개사무소가 바로 나온다.
 *   "신동아아파트"처럼 전국에 흔한 이름이 많아 동 이름을 앞에 붙인다
 * - 역 이름: 역세권 중개사무소
 * - 시군구 + 법정동: 중개사무소 주소는 법정동으로 등록돼 있어 버스권에도 맞는다
 * - 행정동: 사람들이 부르는 동네 이름
 */
export function brokerKeywords(zone: BrokerZone, legalDong: string | null, buildings: string[]): BrokerSearch["keywords"] {
  const keywords: BrokerSearch["keywords"] = [];
  const add = (label: string, query: string, reason: string) => {
    if (!keywords.some((k) => k.query === query)) keywords.push({ label, query, reason });
  };
  const names = [...new Set(buildings.map(cleanBuildingName).filter((b) => b.length >= 2))];
  const area = legalDong ?? zone.admName ?? zone.sigungu;
  for (const name of names.slice(0, 2)) add(name, `${area} ${name} 부동산`, "이 생활권에서 전월세 거래가 많은 건물");
  if (zone.stationName) add(zone.stationName, `${zone.stationName} 부동산`, "역 주변 중개사무소");
  if (legalDong) add(`${zone.sigungu} ${legalDong}`, `${zone.sigungu} ${legalDong} 부동산`, "중개사무소 주소 기준(법정동)");
  if (zone.admName && zone.admName !== legalDong) add(zone.admName, `${zone.sigungu} ${zone.admName} 부동산`, "행정동 이름");
  return keywords;
}

interface NaverLocalItem {
  title?: string;
  category?: string;
  address?: string;
  roadAddress?: string;
  link?: string;
  mapx?: string;
  mapy?: string;
}

/** 생활권 대표 좌표에서 이 거리 안의 중개사무소만 보여준다 */
export const BROKER_RADIUS_M = 1500;

/** 네이버 지역 검색 좌표는 WGS84 값을 10^7배 한 정수로 온다 ("1270276123") */
const naverCoord = (value: string | undefined) => {
  const n = Number(value);
  if (!value || !Number.isFinite(n) || n === 0) return null;
  return Math.abs(n) > 1000 ? n / 1e7 : n;
};

/** 중개사무소만 남긴다. "부동산"이 들어간 법률사무소·개발회사·편의점 본사 등은 뺀다 */
export function isBrokerOffice(name: string, category: string): boolean {
  if (/법률|변호|세무|건설|개발|시행|편의점|은행|금융/.test(category)) return false;
  return /^부동산.*중개/.test(category) || /공인중개|부동산(중개)?(사무소)?$/.test(name);
}

/**
 * 네이버 지역 검색 결과에서 생활권 근처 중개사무소만 남긴다.
 * 검색어가 같아도 전국 결과가 섞여 오므로(다른 도시의 "신동아아파트" 등) 좌표로 거른다.
 */
export function parseBrokerOffices(
  items: NaverLocalItem[],
  keyword: string,
  origin: { latitude: number; longitude: number; sigungu: string },
): BrokerSearch["offices"] {
  return items.flatMap((item) => {
    const name = (item.title ?? "").replace(/<[^>]+>/g, "").trim();
    if (!name || !isBrokerOffice(name, item.category ?? "")) return [];
    const address = item.roadAddress || item.address || null;
    const lat = naverCoord(item.mapy);
    const lng = naverCoord(item.mapx);
    const distanceM = lat !== null && lng !== null ? Math.round(haversineMeters(origin.latitude, origin.longitude, lat, lng)) : null;
    if (distanceM === null ? !address?.includes(origin.sigungu) : distanceM > BROKER_RADIUS_M) return [];
    return [{ name, address, category: item.category ?? null, link: item.link || null, keyword, distanceM }];
  });
}
