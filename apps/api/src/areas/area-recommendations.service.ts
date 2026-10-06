import { DemoProposalsService } from "../demo/demo-proposals.service.js";
import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { secondPlaceText, type SecondPlaceKind } from "@zipazum/shared";
import type {
  AreaCommute,
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
  rankPairAreas,
  walkCommuteOf,
} from "./area-recommend.js";
import { haversineMeters } from "../residential/anchor-builder.js";

type Destination = { label: string; latitude: number; longitude: number };

export interface AreaRecommendationInput {
  destination: Destination;
  maxCommuteMinutes: number;
  noTransferExtraMinutes: number;
  /** 두 번째 장소 (있으면 두 곳 모두 갈 수 있는 곳만) */
  partner?: { name: string; destination: Destination; maxCommuteMinutes: number } | null;
  criteria?: AreaCriteria | null;
}

interface Target {
  destination: Destination;
  maxCommuteMinutes: number;
}

const distanceKm = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) =>
  haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude) / 1000;

/** 경로 결과 → 생활권 통근 대표값 (도보 + 대중교통) */
function areaCommuteOf(
  r: TransitRouteResult,
  isEstimate: boolean,
  walk: number,
  kind: "station" | "bus",
  maxCommuteMinutes: number,
  noTransferExtraMinutes: number,
): AreaCommute {
  const best = r.best ? r.best.totalMinutes + walk : null;
  const noTransfer = r.bestNoTransfer ? r.bestNoTransfer.totalMinutes + walk : null;
  return {
    bestMinutes: best,
    walkMinutes: kind === "station" ? walk : null,
    transitMinutes: r.best?.totalMinutes ?? null,
    bestTransferCount: r.best?.transferCount ?? null,
    noTransferMinutes: noTransfer,
    fit: classifyMinutes(best, noTransfer, maxCommuteMinutes, noTransferExtraMinutes),
    provider: isEstimate ? "estimate" : r.provider,
    estimated: isEstimate,
  };
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
 * 출근지까지 걸어서 15분 안인 곳(직주근접)은 경로 API 없이 도보 통근으로 넣는다.
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
    const partner = input.partner ?? null;
    // 두 출근지가 거의 같은 곳이면 같이 사는 사람 경로는 다시 재지 않고 내 결과를 쓴다
    const samePlace = partner !== null && distanceKm(destination, partner.destination) <= AREA_SETTINGS.samePlaceKm;
    const targets: Target[] = [
      { destination, maxCommuteMinutes },
      ...(partner ? [{ destination: partner.destination, maxCommuteMinutes: partner.maxCommuteMinutes }] : []),
    ];

    // 1) 반경 안 생활권. 같이 사는 사람이 있으면 두 사람 반경이 겹치는 곳만
    const mine = await this.zonesAround(destination, candidateRadiusKm(maxCommuteMinutes, noTransferExtraMinutes));
    const inRadius = partner
      ? mine.filter((z) => distanceKm(z, partner.destination) <= candidateRadiusKm(partner.maxCommuteMinutes, noTransferExtraMinutes))
      : mine;

    // 2) 유형·예산 조건
    const matched = inRadius.flatMap((zone) => {
      const types = matchTypes(zone.statsByType, criteria);
      return types.length ? [{ zone, types }] : [];
    });

    // 3) 직선 추정으로 확실히 먼 곳 제외 (호출 없음). 한 사람이라도 확실히 멀면 뺀다. 걸어서 갈 수 있는 사람은 통과
    const estimated = await Promise.all(
      matched.map(async (m) => {
        const origin = originOf(m.zone);
        const estimates = await Promise.all(
          targets.map((t) => this.estimator.getRoutes({ startX: origin.longitude, startY: origin.latitude, endX: t.destination.longitude, endY: t.destination.latitude })),
        );
        const walks = targets.map((t) =>
          walkCommuteOf(haversineMeters(m.zone.latitude, m.zone.longitude, t.destination.latitude, t.destination.longitude), t.maxCommuteMinutes, noTransferExtraMinutes),
        );
        return { ...m, origin, estimates, walks };
      }),
    );
    const plausible = estimated.filter((e) =>
      targets.every(
        (t, i) => e.walks[i] !== null || (e.estimates[i].best?.totalMinutes ?? Infinity) + e.origin.walk <= estimateCutoff(t.maxCommuteMinutes, noTransferExtraMinutes),
      ),
    );

    // 4) 상위만 실측, 나머지와 한도 초과 이후는 추정값.
    //    혼자면 주거 점수 순, 같이 사는 사람이 있으면 둘 중 더 오래 걸리는 추정 시간이 짧은 순으로 잰다.
    //    모두 걸어서 갈 수 있는 곳은 실측하지 않으므로 실측 상한에 세지 않는다
    const worstEstimate = (e: (typeof plausible)[number]) => Math.max(...e.estimates.map((r) => r.best?.totalMinutes ?? Infinity));
    const ordered = [...plausible].sort((a, b) =>
      partner ? worstEstimate(a) - worstEstimate(b) || b.zone.residentialScore - a.zone.residentialScore : b.zone.residentialScore - a.zone.residentialScore,
    );
    const limit = partner ? AREA_SETTINGS.pairMeasureLimit : AREA_SETTINGS.measureLimit;
    const needsRoute = (e: (typeof plausible)[number]) => e.walks.some((w, t) => w === null && !(t === 1 && samePlace));
    const routable = plausible.filter(needsRoute).length;
    let quotaHit = false;
    let measured = 0;
    let rank = 0;
    const areas: AreaRecommendation[] = [];
    for (const item of ordered) {
      const index = needsRoute(item) ? rank++ : -1;
      const commutes: AreaCommute[] = [];
      for (const [t, target] of targets.entries()) {
        if (t === 1 && samePlace) {
          commutes.push(commutes[0]);
          continue;
        }
        const walk = item.walks[t];
        if (walk) {
          commutes.push(walk);
          continue;
        }
        let route: TransitRouteResult | null = null;
        if (index < limit && !quotaHit) {
          try {
            route = (
              await this.routes.getRoutes({
                originKey: item.origin.key,
                originLat: item.origin.latitude,
                originLng: item.origin.longitude,
                destLat: target.destination.latitude,
                destLng: target.destination.longitude,
                dataDate: item.zone.sourceTo,
              })
            ).result;
            measured++;
          } catch (error) {
            if (error instanceof TransitQuotaError) quotaHit = true;
            else this.logger.warn(`route failed for ${item.zone.zoneKey}: ${error instanceof Error ? error.message : error}`);
          }
        }
        commutes.push(areaCommuteOf(route ?? item.estimates[t], route === null, item.origin.walk, item.zone.kind, target.maxCommuteMinutes, noTransferExtraMinutes));
      }
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
        commute: commutes[0],
        ...(partner ? { partnerCommute: commutes[1] } : {}),
        matchedTypes: item.types,
      });
    }

    // 5) 통근시간까지 맞는 곳만 (같이 사는 사람이 있으면 두 사람 모두)
    const passing = areas.filter((a) => isFit(a.commute.fit) && (!a.partnerCommute || isFit(a.partnerCommute.fit)));
    const fit = partner ? rankPairAreas(passing) : rankAreas(passing);
    const lookups = areas.length * targets.length - (samePlace ? areas.length : 0);
    return {
      destination,
      maxCommuteMinutes,
      noTransferExtraMinutes,
      partner: partner ? { name: partner.name, destination: partner.destination, maxCommuteMinutes: partner.maxCommuteMinutes } : null,
      criteria,
      provider: this.routes.providerName,
      computedAt: new Date().toISOString(),
      funnel: {
        zonesInRadius: inRadius.length,
        matchedConditions: matched.length,
        afterEstimate: plausible.length,
        measured,
        estimated: lookups - measured,
        fit: fit.length,
      },
      warnings: [
        ...(quotaHit ? ["경로 API 호출 한도를 초과했어요. 캐시에 없는 생활권은 직선거리 추정값입니다."] : []),
        ...(!quotaHit && routable > limit
          ? [`실측은 상위 ${limit}곳까지만 했어요. 나머지 ${routable - limit}곳은 추정값입니다.`]
          : []),
        ...(partner && mine.length > 0 && inRadius.length === 0 ? ["두 출근지에서 모두 갈 수 있는 반경 안에 생활권이 없어요. 통근시간을 늘려보세요."] : []),
        ...(mine.length === 0 ? ["주변에 생활권이 없어요. 이 지역 실거래 수집·지오코딩 후 pipeline:anchors, pipeline:zones가 필요합니다."] : []),
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
      const partner = await this.partnerOf(request);
      const result = await this.compute({
        destination: { label: place.label, latitude: place.latitude, longitude: place.longitude },
        maxCommuteMinutes: request.maxCommuteMinutes,
        partner,
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

  /** 두 번째 장소. 좌표가 없으면 이름으로 찾는다 (못 찾으면 혼자 기준으로 계산) */
  private async partnerOf(request: {
    partnerDestinationLabel: string | null;
    partnerDestinationLatitude: number | null;
    partnerDestinationLongitude: number | null;
    partnerMaxCommuteMinutes: number | null;
    partnerKind: string | null;
  }): Promise<AreaRecommendationInput["partner"]> {
    const name = secondPlaceText((request.partnerKind as SecondPlaceKind | null) ?? "partner_work").name;
    const label = request.partnerDestinationLabel;
    if (!label || !request.partnerMaxCommuteMinutes) return null;
    if (request.partnerDestinationLatitude !== null && request.partnerDestinationLongitude !== null) {
      return { name, destination: { label, latitude: request.partnerDestinationLatitude, longitude: request.partnerDestinationLongitude }, maxCommuteMinutes: request.partnerMaxCommuteMinutes };
    }
    const [place] = await this.places.search(label, 1);
    return place ? { name, destination: { label, latitude: place.latitude, longitude: place.longitude }, maxCommuteMinutes: request.partnerMaxCommuteMinutes } : null;
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
