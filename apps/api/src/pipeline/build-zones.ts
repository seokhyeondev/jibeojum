// 주거 앵커를 역세권(도보 15분)·버스권(행정동) 생활권으로 묶어 commute_zones에 넣는다.
// 앵커에 행정동이 없으면 네이버 역지오코딩으로 붙인다(캐시). 다시 실행해도 결과가 같다.
// 순서: pipeline:anchors → pipeline:stations(최초 1회) → pipeline:zones
//
// pnpm pipeline:zones
import { latLngToCell } from "h3-js";
import type { Prisma } from "../generated/prisma/client.js";
import type { RentSource } from "../residential/rent-normalize.js";
import { SCORING } from "../residential/scoring.config.js";
import { reverseGeocodeAdmin } from "../zones/admin-area.js";
import { assignAnchor, buildZones, statsByType, type ZoneAnchor, type ZoneTransaction } from "../zones/zone-builder.js";
import { createPrisma, runMain, runWithConcurrency } from "./cli.js";

runMain(async () => {
  const prisma = createPrisma();
  try {
    const [anchors, stations] = await Promise.all([prisma.residentialAnchor.findMany(), prisma.station.findMany()]);
    if (anchors.length === 0) throw new Error("앵커가 없어요. pipeline:anchors를 먼저 실행하세요");
    if (stations.length === 0) throw new Error("역이 없어요. pipeline:stations를 먼저 실행하세요");

    // 1) 앵커 → 행정동 (캐시에 없는 것만)
    const cached = new Map((await prisma.anchorAdminArea.findMany()).map((a) => [a.gridId, a]));
    const missing = anchors.filter((a) => !cached.has(a.gridId));
    const { NAVER_MAP_CLIENT_ID: keyId, NAVER_MAP_CLIENT_SECRET: key } = process.env;
    if (missing.length && keyId && key) {
      console.log(`admin areas: reverse geocoding ${missing.length} anchors`);
      let failed = 0;
      await runWithConcurrency(missing, 3, async (anchor) => {
        try {
          const area = await reverseGeocodeAdmin(keyId, key, anchor.latitude, anchor.longitude);
          const row = await prisma.anchorAdminArea.upsert({
            where: { gridId: anchor.gridId },
            create: { gridId: anchor.gridId, ...area, provider: "naver" },
            update: { ...area, provider: "naver", fetchedAt: new Date() },
          });
          cached.set(anchor.gridId, row);
        } catch {
          failed++;
        }
      });
      if (failed) console.warn(`  ${failed} anchors failed (다음 실행에서 다시 시도)`);
    } else if (missing.length) {
      console.warn(`NAVER_MAP 키가 없어 ${missing.length}개 앵커는 시군구 단위 버스권으로 묶습니다`);
    }

    // 2) 앵커 → 생활권 배정과 생활권 생성
    const zoneAnchors: ZoneAnchor[] = anchors.map((a) => ({
      gridId: a.gridId,
      latitude: a.latitude,
      longitude: a.longitude,
      sido: a.sido,
      sigungu: a.sigungu,
      buildingCount: a.buildingCount,
      transactionCount: a.transactionCount,
      residentialScore: a.residentialScore,
      admCode: cached.get(a.gridId)?.admCode ?? null,
      admName: cached.get(a.gridId)?.admName ?? null,
    }));
    const assignments = zoneAnchors.map((a) => assignAnchor(a, stations));
    const zones = buildZones(zoneAnchors, assignments, stations);
    const zoneOfGrid = new Map(assignments.map((a) => [a.gridId, a.zoneKey]));

    // 3) 생활권별 유형 시세: 좌표가 있는 거래를 셀 → 생활권으로 모은다
    const from = anchors.reduce((m, a) => (a.sourceFrom < m ? a.sourceFrom : m), anchors[0].sourceFrom);
    const to = anchors.reduce((m, a) => (a.sourceTo > m ? a.sourceTo : m), anchors[0].sourceTo);
    const rows = await prisma.$queryRaw<{ latitude: number; longitude: number; source: string; area_m2: number | null; deposit: number; monthly_rent: number }[]>`
      SELECT g.latitude, g.longitude, t.source, t.area_m2, t.deposit, t.monthly_rent
      FROM rent_transactions t
      JOIN geocoded_addresses g ON g.address_key = t.address_key AND g.status = 'ok'
      WHERE t.contract_date BETWEEN ${from} AND ${to}`;
    const txByZone = new Map<string, ZoneTransaction[]>();
    for (const r of rows) {
      const zoneKey = zoneOfGrid.get(latLngToCell(r.latitude, r.longitude, SCORING.h3Resolution));
      if (!zoneKey) continue;
      const list = txByZone.get(zoneKey) ?? [];
      list.push({ source: r.source as RentSource, areaM2: r.area_m2, deposit: r.deposit, monthlyRent: r.monthly_rent });
      txByZone.set(zoneKey, list);
    }

    // 4) 저장: 생활권 upsert + 사라진 생활권 삭제, 배정은 통째로 교체
    await prisma.$transaction(
      async (tx) => {
        await tx.commuteZone.deleteMany({ where: { zoneKey: { notIn: zones.map((z) => z.zoneKey) } } });
        for (const zone of zones) {
          const data = {
            ...zone,
            statsByType: statsByType(txByZone.get(zone.zoneKey) ?? []) as unknown as Prisma.InputJsonValue,
            sourceFrom: from,
            sourceTo: to,
          };
          await tx.commuteZone.upsert({ where: { zoneKey: zone.zoneKey }, create: data, update: data });
        }
        await tx.anchorZoneAssignment.deleteMany({});
        await tx.anchorZoneAssignment.createMany({ data: assignments });
      },
      { timeout: 300_000 },
    );

    const stationZones = zones.filter((z) => z.kind === "station").length;
    console.log(`done: ${anchors.length} anchors → ${zones.length} zones (역세권 ${stationZones}, 버스권 ${zones.length - stationZones})`);
  } finally {
    await prisma.$disconnect();
  }
});
