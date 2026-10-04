import { Logger, Module } from "@nestjs/common";
import { MockTransitProvider } from "./mock-transit.provider.js";
import { TmapTransitProvider } from "./tmap-transit.provider.js";
import { TransitRouteCacheService } from "./transit-route-cache.service.js";
import { TRANSIT_ROUTE_PROVIDER, type TransitRouteProvider } from "./transit.types.js";

/** TMAP_APP_KEY가 없으면 외부 호출 없이 mock 제공자를 쓴다 */
export function createTransitProvider(env: NodeJS.ProcessEnv): TransitRouteProvider {
  if (!env.TMAP_APP_KEY) {
    new Logger("Transit").warn("TMAP_APP_KEY가 없어 mock 경로 제공자를 사용합니다 (실제 통근시간 아님)");
    return new MockTransitProvider();
  }
  return new TmapTransitProvider(env.TMAP_APP_KEY, env.TMAP_TRANSIT_API_URL || undefined);
}

@Module({
  providers: [{ provide: TRANSIT_ROUTE_PROVIDER, useFactory: () => createTransitProvider(process.env) }, TransitRouteCacheService],
  exports: [TransitRouteCacheService],
})
export class TransitModule {}
