import { latLngToCell } from "h3-js";
import type { RentSource } from "./rent-normalize.js";
import { SCORING } from "./scoring.config.js";

export interface BuildingTransaction {
  source: RentSource;
  deposit: number;
  monthlyRent: number;
  areaM2: number | null;
  contractDate: string;
}

/** 좌표를 찾은 실제 거래 건물 하나 */
export interface GeocodedBuilding {
  addressKey: string;
  latitude: number;
  longitude: number;
  sggCd: string;
  umdNm: string;
  transactions: BuildingTransaction[];
}

export interface AnchorDraft {
  gridId: string;
  latitude: number;
  longitude: number;
  sggCd: string;
  legalDong: string;
  buildingCount: number;
  transactionCount: number;
  officetelCount: number;
  multifamilyCount: number;
  apartmentCount: number;
  dongDetachedCount: number;
  monthlyDepositMedian: number | null;
  monthlyRentMedian: number | null;
  jeonseDepositMedian: number | null;
  smallUnitShare: number;
  residentialScore: number;
  latestContractDate: string;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

const EARTH_RADIUS_M = 6_371_000;

/** 두 좌표 사이 거리(m) */
export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

interface WeightedPoint {
  latitude: number;
  longitude: number;
  weight: number;
}

/**
 * TMAP 출발 좌표. 항상 입력 건물 중 하나를 고르므로 산·하천·도로 위에 찍히지 않는다.
 * 건물이 적으면 거래 수 가중 medoid(가중 거리 합이 가장 작은 건물),
 * 많으면 가중 중심에 가장 가까운 건물로 근사한다.
 */
export function representativePoint<T extends WeightedPoint>(points: T[], exactMax = SCORING.exactMedoidMaxBuildings): T {
  if (points.length === 0) throw new Error("representativePoint: no points");
  if (points.length <= exactMax) {
    let best = points[0];
    let bestCost = Infinity;
    for (const candidate of points) {
      let cost = 0;
      for (const other of points) {
        cost += other.weight * haversineMeters(candidate.latitude, candidate.longitude, other.latitude, other.longitude);
        if (cost >= bestCost) break;
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = candidate;
      }
    }
    return best;
  }
  const total = points.reduce((sum, p) => sum + p.weight, 0);
  const lat = points.reduce((sum, p) => sum + p.latitude * p.weight, 0) / total;
  const lng = points.reduce((sum, p) => sum + p.longitude * p.weight, 0) / total;
  return points.reduce((best, p) =>
    haversineMeters(lat, lng, p.latitude, p.longitude) < haversineMeters(lat, lng, best.latitude, best.longitude) ? p : best,
  );
}

function mostFrequent<T>(values: T[]): T {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export const dongKey = (sggCd: string, umdNm: string) => `${sggCd}|${umdNm}`;

/** 점수 = Σ(유형 가중치 × 거래 수) + 소형 거래 가산 + log(동 단위 단독다가구 거래) × 가중치 */
export function scoreAnchor(input: {
  countsBySource: Record<RentSource, number>;
  smallUnitCount: number;
  dongDetachedCount: number;
}): number {
  const { transactionWeight, smallUnitBonus, dongDetachedWeight } = SCORING;
  const byType = (Object.keys(transactionWeight) as RentSource[]).reduce(
    (sum, source) => sum + transactionWeight[source] * input.countsBySource[source],
    0,
  );
  const score = byType + smallUnitBonus * input.smallUnitCount + dongDetachedWeight * Math.log1p(input.dongDetachedCount);
  return Math.round(score * 10) / 10;
}

/**
 * 좌표를 찾은 거래 건물들을 H3 셀로 묶어 앵커를 만든다.
 * dongDetachedCounts: 법정동별 단독다가구 거래 수 (위치가 없어 동 단위로만 반영)
 */
export function buildAnchors(
  buildings: GeocodedBuilding[],
  dongDetachedCounts: Map<string, number>,
): AnchorDraft[] {
  const cells = new Map<string, GeocodedBuilding[]>();
  for (const building of buildings) {
    if (building.transactions.length === 0) continue;
    const cell = latLngToCell(building.latitude, building.longitude, SCORING.h3Resolution);
    const members = cells.get(cell);
    if (members) members.push(building);
    else cells.set(cell, [building]);
  }

  const anchors: AnchorDraft[] = [];
  for (const [gridId, members] of cells) {
    const transactions = members.flatMap((b) => b.transactions);
    if (members.length < SCORING.minBuildings || transactions.length < SCORING.minTransactions) continue;

    const point = representativePoint(members.map((b) => ({ ...b, weight: b.transactions.length })));
    // 거래가 가장 많은 법정동을 앵커의 동 이름으로 쓴다
    const legal = mostFrequent(members.flatMap((b) => b.transactions.map(() => dongKey(b.sggCd, b.umdNm))));
    const [sggCd, legalDong] = legal.split("|");

    const countsBySource: Record<RentSource, number> = { apt: 0, rh: 0, sh: 0, offi: 0 };
    for (const t of transactions) countsBySource[t.source]++;
    const monthly = transactions.filter((t) => t.monthlyRent > 0);
    const jeonse = transactions.filter((t) => t.monthlyRent === 0);
    const smallUnitCount = transactions.filter((t) => t.areaM2 !== null && t.areaM2 <= SCORING.smallUnitMaxAreaM2).length;
    const dongDetachedCount = dongDetachedCounts.get(legal) ?? 0;

    anchors.push({
      gridId,
      latitude: point.latitude,
      longitude: point.longitude,
      sggCd,
      legalDong,
      buildingCount: members.length,
      transactionCount: transactions.length,
      officetelCount: countsBySource.offi,
      multifamilyCount: countsBySource.rh,
      apartmentCount: countsBySource.apt,
      dongDetachedCount,
      monthlyDepositMedian: median(monthly.map((t) => t.deposit)),
      monthlyRentMedian: median(monthly.map((t) => t.monthlyRent)),
      jeonseDepositMedian: median(jeonse.map((t) => t.deposit)),
      smallUnitShare: Math.round((smallUnitCount / transactions.length) * 100) / 100,
      residentialScore: scoreAnchor({ countsBySource, smallUnitCount, dongDetachedCount }),
      latestContractDate: transactions.map((t) => t.contractDate).sort().at(-1) ?? "",
    });
  }
  return anchors.sort((a, b) => b.residentialScore - a.residentialScore);
}
