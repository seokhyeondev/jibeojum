// 출근지 근처 상위 앵커 몇 곳에서 출근지까지 대중교통 경로를 조회해 본다 (캐시 사용).
// TMAP_APP_KEY가 없으면 mock 제공자로 동작한다.
//
// pnpm pipeline:transit-sample [--dest 37.4979,127.0276] [--limit 3]
import { PrismaService } from "../prisma/prisma.service.js";
import { TransitRouteCacheService } from "../transit/transit-route-cache.service.js";
import { createTransitProvider } from "../transit/transit.module.js";
import { argValue, runMain } from "./cli.js";

runMain(async () => {
  const [destLat, destLng] = (argValue("dest") ?? "37.4979,127.0276").split(",").map(Number);
  const limit = Number(argValue("limit") ?? 3);
  const prisma = new PrismaService();
  const routes = new TransitRouteCacheService(prisma, createTransitProvider(process.env));
  try {
    const anchors = await prisma.residentialAnchor.findMany({ orderBy: { residentialScore: "desc" }, take: limit });
    for (const anchor of anchors) {
      const { result, cached } = await routes.getRoutes({
        originKey: anchor.gridId,
        originLat: anchor.latitude,
        originLng: anchor.longitude,
        destLat,
        destLng,
        dataDate: anchor.sourceTo.toISOString().slice(0, 10),
      });
      const best = result.best ? `${result.best.totalMinutes}분 환승 ${result.best.transferCount}회` : "경로 없음";
      const direct = result.bestNoTransfer ? `${result.bestNoTransfer.totalMinutes}분` : "-";
      console.log(`${anchor.sigungu} ${anchor.legalDong} (점수 ${anchor.residentialScore}) → 최단 ${best}, 무환승 ${direct} [${routes.providerName}${cached ? ", 캐시" : ""}]`);
    }
  } finally {
    await prisma.$disconnect();
  }
});
