import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { roundCoord, routeCacheKey, searchDateTimeFor } from "./route-cache.js";
import { TRANSIT_ROUTE_PROVIDER, type TransitRouteProvider, type TransitRouteResult } from "./transit.types.js";

const CACHE_DAYS = 30;

export interface CachedRouteRequest {
  originKey?: string | null;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  /** 기본 평일 08:00 출발 */
  timeSlot?: string;
  /** 출발 데이터(앵커) 기준일. 앵커를 다시 만들면 바뀐다 */
  dataDate?: string;
}

/** 경로 제공자 앞단의 캐시. 같은 키는 만료 전까지 다시 호출하지 않는다. */
@Injectable()
export class TransitRouteCacheService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TRANSIT_ROUTE_PROVIDER) private readonly provider: TransitRouteProvider,
  ) {}

  get providerName() {
    return this.provider.name;
  }

  async getRoutes(request: CachedRouteRequest): Promise<{ result: TransitRouteResult; cached: boolean }> {
    const timeSlot = request.timeSlot ?? "weekday-0800";
    const dataDate = request.dataDate ?? "latest";
    const cacheKey = routeCacheKey({ provider: this.provider.name, ...request, timeSlot, dataDate });

    const hit = await this.prisma.transitRouteCache.findUnique({ where: { cacheKey } });
    if (hit && hit.expiresAt > new Date()) return { result: hit.result as unknown as TransitRouteResult, cached: true };

    const result = await this.provider.getRoutes({
      startX: request.originLng,
      startY: request.originLat,
      endX: request.destLng,
      endY: request.destLat,
      searchDateTime: searchDateTimeFor(timeSlot),
    });
    const data = {
      provider: this.provider.name,
      originKey: request.originKey ?? null,
      originLat: roundCoord(request.originLat, 6),
      originLng: roundCoord(request.originLng, 6),
      destLat: roundCoord(request.destLat),
      destLng: roundCoord(request.destLng),
      timeSlot,
      dataDate,
      bestMinutes: result.best?.totalMinutes ?? null,
      bestTransferCount: result.best?.transferCount ?? null,
      noTransferMinutes: result.bestNoTransfer?.totalMinutes ?? null,
      result: result as unknown as Prisma.InputJsonValue,
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + CACHE_DAYS * 86_400_000),
    };
    await this.prisma.transitRouteCache.upsert({ where: { cacheKey }, create: { cacheKey, ...data }, update: data });
    return { result, cached: false };
  }
}
