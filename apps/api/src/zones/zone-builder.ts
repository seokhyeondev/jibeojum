import type { HousingType } from "@zipazum/shared";
import { haversineMeters, median, representativePoint } from "../residential/anchor-builder.js";
import type { RentSource } from "../residential/rent-normalize.js";

/** 역세권 기준: 도보 15분 ≈ 직선 1km (4km/h) */
export const ZONE_SETTINGS = {
  stationRadiusM: 1000,
  walkMetersPerMinute: 4000 / 60,
} as const;

export const walkMinutes = (meters: number) => Math.max(1, Math.round(meters / ZONE_SETTINGS.walkMetersPerMinute));

export interface ZoneStation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface ZoneAnchor {
  gridId: string;
  latitude: number;
  longitude: number;
  sido: string;
  sigungu: string;
  buildingCount: number;
  transactionCount: number;
  residentialScore: number;
  admCode: string | null;
  admName: string | null;
}

export interface Assignment {
  gridId: string;
  zoneKey: string;
  stationId: string | null;
  stationDistanceM: number | null;
}

/** 도보 15분 안의 가장 가까운 역에 붙이고, 없으면 행정동 버스권(행정동도 없으면 시군구)으로 */
export function assignAnchor(anchor: ZoneAnchor, stations: ZoneStation[], radiusM = ZONE_SETTINGS.stationRadiusM): Assignment {
  let nearest: ZoneStation | null = null;
  let nearestM = Infinity;
  for (const station of stations) {
    // 위도 0.01° ≈ 1.1km: 먼 역은 거리 계산 전에 건너뛴다
    if (Math.abs(station.latitude - anchor.latitude) > 0.012 || Math.abs(station.longitude - anchor.longitude) > 0.015) continue;
    const m = haversineMeters(anchor.latitude, anchor.longitude, station.latitude, station.longitude);
    if (m < nearestM) {
      nearestM = m;
      nearest = station;
    }
  }
  if (nearest && nearestM <= radiusM) {
    return { gridId: anchor.gridId, zoneKey: `station:${nearest.id}`, stationId: nearest.id, stationDistanceM: Math.round(nearestM) };
  }
  const bus = anchor.admCode ?? `${anchor.sido}|${anchor.sigungu}`;
  return { gridId: anchor.gridId, zoneKey: `bus:${bus}`, stationId: null, stationDistanceM: null };
}

export interface ZoneDraft {
  zoneKey: string;
  kind: "station" | "bus";
  name: string;
  stationId: string | null;
  stationName: string | null;
  admCode: string | null;
  admName: string | null;
  sido: string;
  sigungu: string;
  latitude: number;
  longitude: number;
  repGridId: string;
  stationWalkMinutes: number | null;
  anchorCount: number;
  buildingCount: number;
  transactionCount: number;
  residentialScore: number;
}

/** 점수 합이 가장 큰 값 (생활권에 걸친 행정동 중 대표 이름) */
function topByScore<T>(anchors: ZoneAnchor[], key: (a: ZoneAnchor) => T | null): T | null {
  const sums = new Map<T, number>();
  for (const a of anchors) {
    const k = key(a);
    if (k !== null) sums.set(k, (sums.get(k) ?? 0) + a.residentialScore);
  }
  return [...sums.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** 배정 결과로 생활권을 만든다. 대표 좌표는 거래 수 가중 medoid(실제 거래 건물) */
export function buildZones(anchors: ZoneAnchor[], assignments: Assignment[], stations: ZoneStation[]): ZoneDraft[] {
  const anchorById = new Map(anchors.map((a) => [a.gridId, a]));
  const stationById = new Map(stations.map((s) => [s.id, s]));
  const members = new Map<string, ZoneAnchor[]>();
  for (const a of assignments) {
    const anchor = anchorById.get(a.gridId);
    if (!anchor) continue;
    const list = members.get(a.zoneKey) ?? [];
    list.push(anchor);
    members.set(a.zoneKey, list);
  }

  const zones: ZoneDraft[] = [];
  for (const [zoneKey, list] of members) {
    const rep = representativePoint(list.map((a) => ({ ...a, weight: a.transactionCount })));
    const station = zoneKey.startsWith("station:") ? (stationById.get(zoneKey.slice("station:".length)) ?? null) : null;
    const admName = topByScore(list, (a) => a.admName);
    const admCode = topByScore(list, (a) => a.admCode);
    const sigungu = topByScore(list, (a) => a.sigungu) ?? rep.sigungu;
    const place = admName ?? sigungu;
    zones.push({
      zoneKey,
      kind: station ? "station" : "bus",
      name: station ? `${place} · ${station.name}권` : `${place} · 버스권`,
      stationId: station?.id ?? null,
      stationName: station?.name ?? null,
      admCode,
      admName,
      sido: rep.sido,
      sigungu,
      latitude: rep.latitude,
      longitude: rep.longitude,
      repGridId: rep.gridId,
      stationWalkMinutes: station ? walkMinutes(haversineMeters(rep.latitude, rep.longitude, station.latitude, station.longitude)) : null,
      anchorCount: list.length,
      buildingCount: list.reduce((s, a) => s + a.buildingCount, 0),
      transactionCount: list.reduce((s, a) => s + a.transactionCount, 0),
      residentialScore: Math.round(list.reduce((s, a) => s + a.residentialScore, 0) * 10) / 10,
    });
  }
  return zones.sort((a, b) => b.residentialScore - a.residentialScore);
}

// ───── 유형별 시세 ─────

export interface TypeStats {
  count: number;
  monthlyDepositMedian: number | null;
  monthlyRentMedian: number | null;
  jeonseDepositMedian: number | null;
}

export type StatsByType = Partial<Record<HousingType, TypeStats>>;

/** 원룸 ≤ 33㎡(약 10평), 투룸 33~60㎡ (연립다세대 전용면적 기준) */
export const UNIT_AREA = { studioMax: 33, twoRoomMax: 60 } as const;

export function housingTypeOf(source: RentSource, areaM2: number | null): HousingType | null {
  if (source === "offi") return "officetel";
  if (source === "apt") return "apartment";
  if (source === "rh" && areaM2 !== null) {
    if (areaM2 <= UNIT_AREA.studioMax) return "studio";
    if (areaM2 <= UNIT_AREA.twoRoomMax) return "two_room";
  }
  return null;
}

export interface ZoneTransaction {
  source: RentSource;
  areaM2: number | null;
  deposit: number;
  monthlyRent: number;
}

export function statsByType(transactions: ZoneTransaction[]): StatsByType {
  const groups = new Map<HousingType, ZoneTransaction[]>();
  for (const t of transactions) {
    const type = housingTypeOf(t.source, t.areaM2);
    if (!type) continue;
    const list = groups.get(type) ?? [];
    list.push(t);
    groups.set(type, list);
  }
  const stats: StatsByType = {};
  for (const [type, list] of groups) {
    const monthly = list.filter((t) => t.monthlyRent > 0);
    const jeonse = list.filter((t) => t.monthlyRent === 0);
    stats[type] = {
      count: list.length,
      monthlyDepositMedian: median(monthly.map((t) => t.deposit)),
      monthlyRentMedian: median(monthly.map((t) => t.monthlyRent)),
      jeonseDepositMedian: median(jeonse.map((t) => t.deposit)),
    };
  }
  return stats;
}
