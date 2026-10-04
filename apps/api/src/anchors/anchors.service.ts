import { Injectable } from "@nestjs/common";
import { cellToBoundary } from "h3-js";
import { z } from "zod";
import { Prisma, type ResidentialAnchor } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { fromDateColumn } from "../requests/request-mapper.js";

export const ANCHOR_HOUSING_TYPES = ["officetel", "multifamily", "apartment", "detached"] as const;
export type AnchorHousingType = (typeof ANCHOR_HOUSING_TYPES)[number];

const csv = z
  .string()
  .optional()
  .transform((value) => value?.split(",").map((s) => s.trim()).filter(Boolean) ?? []);

export const anchorQuerySchema = z
  .object({
    latitude: z.coerce.number().min(33).max(39).optional(),
    longitude: z.coerce.number().min(124).max(132).optional(),
    radiusKm: z.coerce.number().positive().max(60).default(15),
    limit: z.coerce.number().int().min(1).max(500).default(50),
    minScore: z.coerce.number().min(0).default(0),
    housingTypes: csv.pipe(z.array(z.enum(ANCHOR_HOUSING_TYPES))),
  })
  .refine((q) => (q.latitude === undefined) === (q.longitude === undefined), {
    message: "latitude와 longitude는 함께 보내야 합니다",
    path: ["latitude", "longitude"],
  });

export type AnchorQuery = z.infer<typeof anchorQuerySchema>;

const TYPE_COLUMN: Record<AnchorHousingType, Prisma.Sql> = {
  officetel: Prisma.sql`officetel_count`,
  multifamily: Prisma.sql`multifamily_count`,
  apartment: Prisma.sql`apartment_count`,
  detached: Prisma.sql`dong_detached_count`,
};

function toSummary(row: ResidentialAnchor, distanceKm: number | null) {
  return {
    id: row.id,
    gridId: row.gridId,
    latitude: row.latitude,
    longitude: row.longitude,
    sido: row.sido,
    sigungu: row.sigungu,
    legalDong: row.legalDong,
    residentialScore: row.residentialScore,
    buildingCount: row.buildingCount,
    transactionCount: row.transactionCount,
    counts: {
      officetel: row.officetelCount,
      multifamily: row.multifamilyCount,
      apartment: row.apartmentCount,
      dongDetached: row.dongDetachedCount,
    },
    rent: {
      monthlyDepositMedian: row.monthlyDepositMedian,
      monthlyRentMedian: row.monthlyRentMedian,
      jeonseDepositMedian: row.jeonseDepositMedian,
    },
    smallUnitShare: row.smallUnitShare,
    distanceKm: distanceKm === null ? null : Math.round(distanceKm * 100) / 100,
  };
}

/** 위도 1도 ≈ 111km. 거리 계산 전에 사각형 범위로 먼저 거른다 */
const KM_PER_DEG_LAT = 111.32;

@Injectable()
export class AnchorsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AnchorQuery) {
    const typeFilter = query.housingTypes.length
      ? Prisma.sql`AND (${Prisma.join(query.housingTypes.map((t) => Prisma.sql`${TYPE_COLUMN[t]} > 0`), " OR ")})`
      : Prisma.empty;

    if (query.latitude === undefined || query.longitude === undefined) {
      const rows = await this.prisma.$queryRaw<ResidentialAnchorRow[]>`
        SELECT * FROM residential_anchors
        WHERE residential_score >= ${query.minScore} ${typeFilter}
        ORDER BY residential_score DESC LIMIT ${query.limit}`;
      return rows.map((row) => toSummary(fromRow(row), null));
    }

    const { latitude: lat, longitude: lng, radiusKm } = query;
    const dLat = radiusKm / KM_PER_DEG_LAT;
    const dLng = radiusKm / (KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
    const rows = await this.prisma.$queryRaw<(ResidentialAnchorRow & { distance_km: number })[]>`
      SELECT * FROM (
        SELECT *, 6371 * 2 * asin(sqrt(
          power(sin(radians(latitude - ${lat}) / 2), 2) +
          cos(radians(${lat})) * cos(radians(latitude)) * power(sin(radians(longitude - ${lng}) / 2), 2)
        )) AS distance_km
        FROM residential_anchors
        WHERE latitude BETWEEN ${lat - dLat} AND ${lat + dLat}
          AND longitude BETWEEN ${lng - dLng} AND ${lng + dLng}
          AND residential_score >= ${query.minScore} ${typeFilter}
      ) a
      WHERE distance_km <= ${radiusKm}
      ORDER BY distance_km ASC
      LIMIT ${query.limit}`;
    return rows.map((row) => toSummary(fromRow(row), row.distance_km));
  }

  async detail(id: string) {
    const row = await this.prisma.residentialAnchor.findUnique({ where: { id } });
    if (!row) return null;
    const dongStats = await this.prisma.legalDongRentStat.findMany({
      where: { sggCd: row.sggCd, umdNm: row.legalDong },
      orderBy: { source: "asc" },
    });
    // GeoJSON은 [경도, 위도] 순서
    const ring = cellToBoundary(row.gridId).map(([cellLat, cellLng]) => [cellLng, cellLat]);
    return {
      ...toSummary(row, null),
      latestContractDate: fromDateColumn(row.latestContractDate),
      sourceRange: { from: fromDateColumn(row.sourceFrom), to: fromDateColumn(row.sourceTo) },
      boundary: { type: "Polygon" as const, coordinates: [[...ring, ring[0]]] },
      legalDongRentStats: dongStats.map((s) => ({
        source: s.source,
        transactionCount: s.transactionCount,
        monthlyDepositMedian: s.monthlyDepositMedian,
        monthlyRentMedian: s.monthlyRentMedian,
        jeonseDepositMedian: s.jeonseDepositMedian,
      })),
    };
  }
}

/** $queryRaw 결과(snake_case)를 Prisma 모델 형태로 바꾼다 */
type ResidentialAnchorRow = Record<string, unknown>;

function fromRow(r: ResidentialAnchorRow): ResidentialAnchor {
  return {
    id: r.id as string,
    gridId: r.grid_id as string,
    latitude: r.latitude as number,
    longitude: r.longitude as number,
    sido: r.sido as string,
    sigungu: r.sigungu as string,
    legalDong: r.legal_dong as string,
    sggCd: r.sgg_cd as string,
    buildingCount: r.building_count as number,
    transactionCount: r.transaction_count as number,
    officetelCount: r.officetel_count as number,
    multifamilyCount: r.multifamily_count as number,
    apartmentCount: r.apartment_count as number,
    dongDetachedCount: r.dong_detached_count as number,
    monthlyDepositMedian: r.monthly_deposit_median as number | null,
    monthlyRentMedian: r.monthly_rent_median as number | null,
    jeonseDepositMedian: r.jeonse_deposit_median as number | null,
    smallUnitShare: r.small_unit_share as number,
    residentialScore: r.residential_score as number,
    latestContractDate: r.latest_contract_date as Date,
    sourceFrom: r.source_from as Date,
    sourceTo: r.source_to as Date,
    createdAt: r.created_at as Date,
    updatedAt: r.updated_at as Date,
  };
}
