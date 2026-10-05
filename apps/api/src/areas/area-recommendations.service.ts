import { DemoProposalsService } from "../demo/demo-proposals.service.js";
import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import type {
  AreaCriteria,
  AreaRecommendation,
  AreaRecommendationResult,
  HousingType,
  RequestAreaRecommendation,
  ZoneTypeStats,
} from "@zipazum/shared";
import type { Prisma } from "../generated/prisma/client.js";
import { PlaceSearch } from "../places/place-search.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { MockTransitProvider } from "../transit/mock-transit.provider.js";
import { TransitRouteCacheService } from "../transit/transit-route-cache.service.js";
import { TransitQuotaError, type TransitRouteResult } from "../transit/transit.types.js";
import {
  AREA_SETTINGS,
  candidateRadiusKm,
  classifyMinutes,
  estimateCutoff,
  isFit,
  matchTypes,
  rankAreas,
} from "./area-recommend.js";

export interface AreaRecommendationInput {
  destination: { label: string; latitude: number; longitude: number };
  maxCommuteMinutes: number;
  noTransferExtraMinutes: number;
  criteria?: AreaCriteria | null;
}

interface ZoneCandidate {
  id: string;
  zoneKey: string;
  kind: "station" | "bus";
  name: string;
  stationId: string | null;
  stationName: string | null;
  admName: string | null;
  sido: string;
  sigungu: string;
  latitude: number;
  longitude: number;
  stationWalkMinutes: number | null;
  stationLatitude: number | null;
  stationLongitude: number | null;
  residentialScore: number;
  statsByType: Partial<Record<HousingType, ZoneTypeStats>>;
  sourceTo: string;
  distanceKm: number;
}

/** 대중교통 출발점: 역세권은 역, 버스권은 생활권 대표 좌표 */
const originOf = (z: ZoneCandidate) =>
  z.kind === "station" && z.stationId && z.stationLatitude !== null && z.stationLongitude !== null
    ? { key: `station:${z.stationId}`, latitude: z.stationLatitude, longitude: z.stationLongitude, walk: z.stationWalkMinutes ?? 0 }
    : { key: `zone:${z.zoneKey}`, latitude: z.latitude, longitude: z.longitude, walk: 0 };

const KM_PER_DEG_LAT = 111.32;

/**
 * 출근지 기준 추천 생활권 (역세권 도보 15분 / 행정동 버스권).
 * 1) 반경 안 생활권 → 2) 유형·예산 조건 → 3) 직선 추정으로 먼 곳 제외 → 4) 점수 상위만 경로 API 실측
 * → 5) 대표값(도보 + 대중교통)이 허용 시간 안인 곳만 돌려준다.
 * 요청이 들어오면 백그라운드에서 한 건씩 계산해 저장한다. 사용자 화면에는 노출하지 않는다.
 */
@Injectable()
export class AreaRecommendationsService implements OnApplicationBootstrap {
  private readonly logger = new Logger("AreaRecommendations");
  private readonly places = new PlaceSearch(process.env);
  /** 경로 API를 못 쓰거나 실측 상한을 넘은 후보에 쓰는 직선거리 추정 */
  private readonly estimator = new MockTransitProvider();
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaService,
    private readonly routes: TransitRouteCacheService,
    private readonly demo: DemoProposalsService,
  ) {}

  /** 서버가 꺼져 있는 동안 남은 계산을 다시 넣는다 */
  async onApplicationBootstrap() {
    if (!onSubmitEnabled()) return;
    const pending = await this.prisma.requestAreaRecommendation.findMany({
      where: { status: { in: ["pending", "running"] } },
      select: { requestId: true },
    });
    for (const { requestId } of pending) this.enqueue(requestId);
  }

  searchPlaces(query: string) {
    return this.places.search(query);
  }

  async compute(input: AreaRecommendationInput): Promise<AreaRecommendationResult> {
    const { destination, maxCommuteMinutes, noTransferExtraMinutes } = input;
    const criteria = input.criteria ?? null;
    const dest = { endX: destination.longitude, endY: destination.latitude };

    // 1) 반경 안 생활권
    const inRadius = await this.zonesAround(destination, candidateRadiusKm(maxCommuteMinutes, noTransferExtraMinutes));

    // 2) 유형·예산 조건
    const matched = inRadius.flatMap((zone) => {
      const types = matchTypes(zone.statsByType, criteria);
      return types.length ? [{ zone, types }] : [];
    });

    // 3) 직선 추정으로 확실히 먼 곳 제외 (호출 없음)
    const cutoff = estimateCutoff(maxCommuteMinutes, noTransferExtraMinutes);
    const estimated = await Promise.all(
      matched.map(async (m) => {
        const origin = originOf(m.zone);
        const route = await this.estimator.getRoutes({ startX: origin.longitude, startY: origin.latitude, ...dest });
        return { ...m, origin, estimate: route };
      }),
    );
    const plausible = estimated.filter((e) => (e.estimate.best?.totalMinutes ?? Infinity) + e.origin.walk <= cutoff);

    // 4) 점수 상위만 실측, 나머지와 한도 초과 이후는 추정값
    const ordered = [...plausible].sort((a, b) => b.zone.residentialScore - a.zone.residentialScore);
    let quotaHit = false;
    let measured = 0;
    const areas: AreaRecommendation[] = [];
    for (const [index, item] of ordered.entries()) {
      let route: TransitRouteResult | null = null;
      if (index < AREA_SETTINGS.measureLimit && !quotaHit) {
        try {
          route = (
            await this.routes.getRoutes({
              originKey: item.origin.key,
              originLat: item.origin.latitude,
              originLng: item.origin.longitude,
              destLat: destination.latitude,
              destLng: destination.longitude,
              dataDate: item.zone.sourceTo,
            })
          ).result;
          measured++;
        } catch (error) {
          if (error instanceof TransitQuotaError) quotaHit = true;
          else this.logger.warn(`route failed for ${item.zone.zoneKey}: ${error instanceof Error ? error.message : error}`);
        }
      }
      const isEstimate = route === null;
      const r = route ?? item.estimate;
      const walk = item.origin.walk;
      const best = r.best ? r.best.totalMinutes + walk : null;
      const noTransfer = r.bestNoTransfer ? r.bestNoTransfer.totalMinutes + walk : null;
      const z = item.zone;
      areas.push({
        zoneId: z.id,
        zoneKey: z.zoneKey,
        kind: z.kind,
        name: z.name,
        stationName: z.stationName,
        admName: z.admName,
        sido: z.sido,
        sigungu: z.sigungu,
        latitude: z.latitude,
        longitude: z.longitude,
        distanceKm: Math.round(z.distanceKm * 10) / 10,
        residentialScore: z.residentialScore,
        commute: {
          bestMinutes: best,
          walkMinutes: z.kind === "station" ? walk : null,
          transitMinutes: r.best?.totalMinutes ?? null,
          bestTransferCount: r.best?.transferCount ?? null,
          noTransferMinutes: noTransfer,
          fit: classifyMinutes(best, noTransfer, maxCommuteMinutes, noTransferExtraMinutes),
          provider: isEstimate ? "estimate" : r.provider,
          estimated: isEstimate,
        },
        matchedTypes: item.types,
      });
    }

    // 5) 통근시간까지 맞는 곳만
    const fit = rankAreas(areas.filter((a) => isFit(a.commute.fit)));
    const estimatedCount = areas.length - measured;
    return {
      destination,
      maxCommuteMinutes,
      noTransferExtraMinutes,
      criteria,
      provider: this.routes.providerName,
      computedAt: new Date().toISOString(),
      funnel: {
        zonesInRadius: inRadius.length,
        matchedConditions: matched.length,
        afterEstimate: plausible.length,
        measured,
        estimated: estimatedCount,
        fit: fit.length,
      },
      warnings: [
        ...(quotaHit ? ["경로 API 호출 한도를 초과했어요. 캐시에 없는 생활권은 직선거리 추정값입니다."] : []),
        ...(!quotaHit && plausible.length > AREA_SETTINGS.measureLimit
          ? [`실측은 점수 상위 ${AREA_SETTINGS.measureLimit}곳까지만 했어요. 나머지 ${plausible.length - AREA_SETTINGS.measureLimit}곳은 추정값입니다.`]
          : []),
        ...(inRadius.length === 0 ? ["주변에 생활권이 없어요. 이 지역 실거래 수집·지오코딩 후 pipeline:anchors, pipeline:zones가 필요합니다."] : []),
      ],
      areas: fit,
    };
  }

  /** 요청 제출·수정 후 호출. 계산은 기다리지 않고 큐에 넣는다. force면 자동 계산이 꺼져 있어도 넣는다. */
  async scheduleForRequest(requestId: string, options: { force?: boolean } = {}) {
    if (!options.force && !onSubmitEnabled()) return;
    const request = await this.prisma.housingRequest.findUnique({ where: { id: requestId }, select: { destinationLabel: true } });
    if (!request) return;
    await this.prisma.requestAreaRecommendation.upsert({
      where: { requestId },
      create: { requestId, status: "pending", destinationQuery: request.destinationLabel },
      update: { status: "pending", destinationQuery: request.destinationLabel, error: null },
    });
    this.enqueue(requestId);
  }

  async findForRequest(requestId: string): Promise<RequestAreaRecommendation | null> {
    const row = await this.prisma.requestAreaRecommendation.findUnique({ where: { requestId } });
    return row ? toDto(row) : null;
  }

  async listRecent(limit = 20) {
    const rows = await this.prisma.housingRequest.findMany({
      orderBy: { submittedAt: "desc" },
      take: limit,
      include: { areaRecommendation: true },
    });
    return rows.map((r) => ({
      requestId: r.id,
      destinationLabel: r.destinationLabel,
      maxCommuteMinutes: r.maxCommuteMinutes,
      submittedAt: r.submittedAt.toISOString(),
      recommendation: r.areaRecommendation ? toDto(r.areaRecommendation) : null,
    }));
  }

  private enqueue(requestId: string) {
    this.queue = this.queue.then(() => this.runForRequest(requestId)).catch(() => undefined);
  }

  private async runForRequest(requestId: string) {
    const request = await this.prisma.housingRequest.findUnique({ where: { id: requestId } });
    if (!request) return;
    await this.prisma.requestAreaRecommendation.update({ where: { requestId }, data: { status: "running" } });
    try {
      // 사용자가 검색에서 고른 좌표가 있으면 그대로 쓰고, 직접 입력이면 서버에서 찾는다
      const chosen =
        request.destinationLatitude !== null && request.destinationLongitude !== null
          ? { label: request.destinationLabel, address: request.destinationAddress, latitude: request.destinationLatitude, longitude: request.destinationLongitude, category: null, source: "user" as const }
          : null;
      const place = chosen ?? (await this.places.search(request.destinationLabel, 1))[0];
      if (!place) throw new Error(`출근지를 찾지 못했어요: ${request.destinationLabel}`);
      const result = await this.compute({
        destination: { label: place.label, latitude: place.latitude, longitude: place.longitude },
        maxCommuteMinutes: request.maxCommuteMinutes,
        noTransferExtraMinutes: request.noTransferExtraMinutes,
        criteria: {
          housingTypes: request.housingTypes as HousingType[],
          transactionPreference: request.transactionPreference as AreaCriteria["transactionPreference"],
          depositMax: request.depositMax,
          monthlyRentMax: request.monthlyRentMax,
          jeonseMax: request.jeonseMax,
          budgetFlexibility: request.budgetFlexibility as AreaCriteria["budgetFlexibility"],
        },
      });
      await this.prisma.requestAreaRecommendation.update({
        where: { requestId },
        data: { status: "done", destination: place as unknown as Prisma.InputJsonValue, result: result as unknown as Prisma.InputJsonValue, error: null },
      });
      this.logger.log(`request ${requestId}: ${result.funnel.fit} zones fit (of ${result.funnel.zonesInRadius} in radius)`);
      // 시범 운영: 실거래로 만든 예시 매물을 붙인다 (DEMO_PROPOSALS=true일 때만)
      await this.demo.generate(requestId, result).catch((err: unknown) => this.logger.warn(`demo proposals failed: ${err instanceof Error ? err.message : err}`));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`request ${requestId} failed: ${message}`);
      await this.prisma.requestAreaRecommendation.update({ where: { requestId }, data: { status: "failed", error: message } });
    }
  }

  private async zonesAround(destination: { latitude: number; longitude: number }, radiusKm: number): Promise<ZoneCandidate[]> {
    const { latitude: lat, longitude: lng } = destination;
    const dLat = radiusKm / KM_PER_DEG_LAT;
    const dLng = radiusKm / (KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
    const rows = await this.prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT * FROM (
        SELECT z.*, s.latitude AS station_latitude, s.longitude AS station_longitude,
          6371 * 2 * asin(sqrt(
            power(sin(radians(z.latitude - ${lat}) / 2), 2) +
            cos(radians(${lat})) * cos(radians(z.latitude)) * power(sin(radians(z.longitude - ${lng}) / 2), 2)
          )) AS distance_km
        FROM commute_zones z
        LEFT JOIN stations s ON s.id = z.station_id
        WHERE z.latitude BETWEEN ${lat - dLat} AND ${lat + dLat}
          AND z.longitude BETWEEN ${lng - dLng} AND ${lng + dLng}
      ) a
      WHERE distance_km <= ${radiusKm}`;
    return rows.map((r) => ({
      id: r.id as string,
      zoneKey: r.zone_key as string,
      kind: r.kind as ZoneCandidate["kind"],
      name: r.name as string,
      stationId: (r.station_id as string | null) ?? null,
      stationName: (r.station_name as string | null) ?? null,
      admName: (r.adm_name as string | null) ?? null,
      sido: r.sido as string,
      sigungu: r.sigungu as string,
      latitude: r.latitude as number,
      longitude: r.longitude as number,
      stationWalkMinutes: (r.station_walk_minutes as number | null) ?? null,
      stationLatitude: (r.station_latitude as number | null) ?? null,
      stationLongitude: (r.station_longitude as number | null) ?? null,
      residentialScore: r.residential_score as number,
      statsByType: r.stats_by_type as Partial<Record<HousingType, ZoneTypeStats>>,
      sourceTo: (r.source_to as Date).toISOString().slice(0, 10),
      distanceKm: r.distance_km as number,
    }));
  }
}

/** 요청 제출 시 자동 계산 여부. 기본 켜짐 (TMAP 호출 비용이 들면 false로 끈다) */
const onSubmitEnabled = () => process.env.AREA_RECOMMENDATIONS_ON_SUBMIT !== "false";

function toDto(row: { requestId: string; status: string; destinationQuery: string; error: string | null; result: unknown; updatedAt: Date }): RequestAreaRecommendation {
  return {
    requestId: row.requestId,
    status: row.status as RequestAreaRecommendation["status"],
    destinationQuery: row.destinationQuery,
    error: row.error,
    result: (row.result as AreaRecommendationResult | null) ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}
