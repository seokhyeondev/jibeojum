import { latLngToCell } from "h3-js";
import { describe, expect, it } from "vitest";
import { buildAnchors, haversineMeters, median, representativePoint, scoreAnchor, type GeocodedBuilding } from "../src/residential/anchor-builder.js";
import type { RentSource } from "../src/residential/rent-normalize.js";

const tx = (source: RentSource, monthlyRent = 50, areaM2: number | null = 25, deposit = 1000) => ({
  source,
  deposit,
  monthlyRent,
  areaM2,
  contractDate: "2026-08-01",
});

const building = (addressKey: string, latitude: number, longitude: number, transactions: GeocodedBuilding["transactions"]): GeocodedBuilding => ({
  addressKey,
  latitude,
  longitude,
  sggCd: "11620",
  umdNm: "신림동",
  transactions,
});

// 신림역 근처의 가까운 건물들 (같은 H3 해상도 8 셀)
const sillim = [
  building("a", 37.4846, 126.9295, [tx("offi"), tx("offi"), tx("offi")]),
  building("b", 37.4849, 126.929, [tx("rh"), tx("rh")]),
  building("c", 37.4843, 126.9301, [tx("rh", 0, 45, 20000)]),
  building("d", 37.4851, 126.9298, [tx("apt", 120, 59, 5000)]),
];

describe("대표 좌표", () => {
  it("항상 입력 건물 중 하나를 고른다", () => {
    const points = sillim.map((b) => ({ ...b, weight: b.transactions.length }));
    const exact = representativePoint(points);
    const approx = representativePoint(points, 1);
    expect(points).toContain(exact);
    expect(points).toContain(approx);
  });

  it("가중치가 큰 건물 쪽으로 기운다", () => {
    const points = [
      { latitude: 37.48, longitude: 126.92, weight: 10 },
      { latitude: 37.4801, longitude: 126.9201, weight: 10 },
      { latitude: 37.49, longitude: 126.93, weight: 1 },
    ];
    expect(representativePoint(points).latitude).toBeLessThan(37.485);
  });
});

describe("앵커 생성", () => {
  it("같은 셀의 건물을 묶고 유형별 개수와 시세를 계산한다", () => {
    const anchors = buildAnchors(sillim, new Map([["11620|신림동", 30]]));
    expect(anchors).toHaveLength(1);
    const [anchor] = anchors;
    expect(anchor.gridId).toBe(latLngToCell(37.4846, 126.9295, 8));
    expect(anchor).toMatchObject({
      buildingCount: 4,
      transactionCount: 7,
      officetelCount: 3,
      multifamilyCount: 3,
      apartmentCount: 1,
      dongDetachedCount: 30,
      legalDong: "신림동",
      jeonseDepositMedian: 20000,
    });
    expect(sillim.some((b) => b.latitude === anchor.latitude && b.longitude === anchor.longitude)).toBe(true);
  });

  it("건물이나 거래가 너무 적은 셀은 버린다", () => {
    expect(buildAnchors([sillim[0]], new Map())).toHaveLength(0);
    expect(buildAnchors([sillim[2], sillim[3]], new Map())).toHaveLength(0);
  });

  it("점수는 유형 가중치와 소형 가산, 동 단위 단독다가구로 설명된다", () => {
    const score = scoreAnchor({ countsBySource: { offi: 2, rh: 1, apt: 1, sh: 0 }, smallUnitCount: 2, dongDetachedCount: 0 });
    expect(score).toBe(2 * 3 + 1 * 2 + 1 * 1 + 2);
    expect(scoreAnchor({ countsBySource: { offi: 0, rh: 0, apt: 0, sh: 0 }, smallUnitCount: 0, dongDetachedCount: 100 })).toBeGreaterThan(0);
  });
});

describe("도우미", () => {
  it("중위값", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3);
  });

  it("신림역~강남역 직선거리는 약 8.8km", () => {
    expect(haversineMeters(37.4842, 126.9297, 37.4979, 127.0276) / 1000).toBeCloseTo(8.75, 0);
  });
});
