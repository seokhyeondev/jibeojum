import { Injectable, Logger } from "@nestjs/common";
import type { AreaRecommendationResult, CommuteRoute, CommuteSummary } from "@zipazum/shared";
import type { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { roundCoord, searchDateTimeFor } from "../transit/route-cache.js";
import { fetchTmapRouteDetail } from "../transit/tmap-route-detail.js";

const TIME_SLOT = "weekday-0800";
/** 같은 매물·출근지 경로는 30일 동안 다시 부르지 않는다 */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** 상세 경로 → 카드에 쓰는 통근 요약 */
export function summaryOfRoute(route: CommuteRoute): CommuteSummary {
  const sum = (modes: string[]) => route.legs.filter((l) => modes.includes(l.mode)).reduce((n, l) => n + l.minutes, 0);
  const lines = [...new Set(route.legs.map((l) => (l.line && l.mode === "bus" ? `${l.line}번` : l.line)).filter((l): l is string => Boolean(l)))];
  const transfers = route.transferCount === 0 ? "환승 없음" : `환승 ${route.transferCount}회`;
  return {
    totalMinutes: route.totalMinutes,
    walkMinutes: route.walkMinutes,
    busMinutes: sum(["bus"]),
    subwayMinutes: sum(["subway", "train"]),
    transferCount: route.transferCount,
    fare: route.fare ?? undefined,
    routeSummary: `${lines.length ? lines.join(" → ") : "대중교통"} · ${transfers} · 도보 ${route.walkMinutes}분`,
    calculatedAt: route.calculatedAt,
    provider: "tmap",
  };
}

/**
 * 매물 상세에서 보는 출근 경로. 사용자가 상세를 열 때 한 번 계산해 캐시하고,
 * 추정 시간(시범 매물·직선거리 추정)이던 제안은 실제 경로 시간으로 바꿔 둔다.
 */
@Injectable()
export class ListingRouteService {
  private readonly logger = new Logger("ListingRoute");

  constructor(private readonly prisma: PrismaService) {}

  async forUser(userId: string, listingId: string): Promise<CommuteRoute | null> {
    const proposal = await this.prisma.proposal.findFirst({
      where: { listingId, request: { userId }, status: { not: "hidden" } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        commute: true,
        listing: { select: { latitude: true, longitude: true } },
        request: { select: { destinationLatitude: true, destinationLongitude: true, areaRecommendation: { select: { result: true } } } },
      },
    });
    if (!proposal) return null;
    const { latitude, longitude } = proposal.listing;
    const destination =
      proposal.request.destinationLatitude !== null && proposal.request.destinationLongitude !== null
        ? { latitude: proposal.request.destinationLatitude, longitude: proposal.request.destinationLongitude }
        : ((proposal.request.areaRecommendation?.result as AreaRecommendationResult | null)?.destination ?? null);
    if (!destination || latitude === null || longitude === null) return null;

    const route = await this.cached(latitude, longitude, destination.latitude, destination.longitude);
    if (route && (proposal.commute as unknown as CommuteSummary | null)?.provider !== "tmap") {
      await this.prisma.proposal.update({ where: { id: proposal.id }, data: { commute: summaryOfRoute(route) as unknown as Prisma.InputJsonValue } });
    }
    return route;
  }

  private async cached(originLat: number, originLng: number, destLat: number, destLng: number): Promise<CommuteRoute | null> {
    const cacheKey = `tmap-detail|${roundCoord(originLat, 6)},${roundCoord(originLng, 6)}|${roundCoord(destLat, 5)},${roundCoord(destLng, 5)}|${TIME_SLOT}`;
    const hit = await this.prisma.transitRouteCache.findUnique({ where: { cacheKey } });
    if (hit && hit.expiresAt > new Date()) return (hit.result as unknown as { route: CommuteRoute | null }).route;

    const appKey = process.env.TMAP_APP_KEY;
    if (!appKey) return null;
    let route: CommuteRoute | null;
    try {
      route = await fetchTmapRouteDetail(appKey, { startX: originLng, startY: originLat, endX: destLng, endY: destLat, searchDateTime: searchDateTimeFor(TIME_SLOT) });
    } catch (error) {
      // 한도 초과·장애면 요약 통근 정보만 보여준다 (캐시하지 않고 다음에 다시 시도)
      this.logger.warn(`route detail failed: ${error instanceof Error ? error.message : error}`);
      return null;
    }
    const data = {
      provider: "tmap-detail",
      originLat: roundCoord(originLat, 6),
      originLng: roundCoord(originLng, 6),
      destLat: roundCoord(destLat, 5),
      destLng: roundCoord(destLng, 5),
      timeSlot: TIME_SLOT,
      dataDate: new Date().toISOString().slice(0, 10),
      bestMinutes: route?.totalMinutes ?? null,
      bestTransferCount: route?.transferCount ?? null,
      // 경로가 없을 때(걸어갈 거리)도 캐시해서 다시 부르지 않는다
      result: { route } as unknown as Prisma.InputJsonValue,
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + TTL_MS),
    };
    await this.prisma.transitRouteCache.upsert({ where: { cacheKey }, create: { cacheKey, ...data }, update: data });
    return route;
  }
}
