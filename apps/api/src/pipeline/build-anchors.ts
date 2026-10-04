// 좌표를 찾은 실거래 건물을 H3 셀로 묶어 residential_anchors를 다시 만들고,
// 법정동 × 유형별 시세를 legal_dong_rent_stats에 갱신한다. 다시 실행해도 결과가 같다.
//
// pnpm pipeline:anchors [--from 2025-10-01] [--to 2026-09-30]
import { buildAnchors, dongKey, type GeocodedBuilding } from "../residential/anchor-builder.js";
import type { RentSource } from "../residential/rent-normalize.js";
import { regionOf } from "../residential/regions.js";
import { argValue, createPrisma, runMain } from "./cli.js";

const toDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

runMain(async () => {
  const prisma = createPrisma();
  try {
    const range = await prisma.rentTransaction.aggregate({ _min: { contractDate: true }, _max: { contractDate: true } });
    if (!range._min.contractDate || !range._max.contractDate) {
      console.log("no rent transactions. run pipeline:collect first");
      return;
    }
    const from = argValue("from") ?? isoDate(range._min.contractDate);
    const to = argValue("to") ?? isoDate(range._max.contractDate);
    const window = { gte: toDate(from), lte: toDate(to) };

    // 1) 좌표가 있는 거래 → 건물 단위로 묶기
    const rows = await prisma.$queryRaw<
      { address_key: string; sgg_cd: string; umd_nm: string; latitude: number; longitude: number; source: string; deposit: number; monthly_rent: number; area_m2: number | null; contract_date: Date }[]
    >`
      SELECT t.address_key, t.sgg_cd, t.umd_nm, g.latitude, g.longitude, t.source, t.deposit, t.monthly_rent, t.area_m2, t.contract_date
      FROM rent_transactions t
      JOIN geocoded_addresses g ON g.address_key = t.address_key AND g.status = 'ok'
      WHERE t.contract_date BETWEEN ${window.gte} AND ${window.lte}`;

    const buildings = new Map<string, GeocodedBuilding>();
    for (const r of rows) {
      let building = buildings.get(r.address_key);
      if (!building) {
        building = { addressKey: r.address_key, latitude: r.latitude, longitude: r.longitude, sggCd: r.sgg_cd, umdNm: r.umd_nm, transactions: [] };
        buildings.set(r.address_key, building);
      }
      building.transactions.push({
        source: r.source as RentSource,
        deposit: r.deposit,
        monthlyRent: r.monthly_rent,
        areaM2: r.area_m2,
        contractDate: isoDate(r.contract_date),
      });
    }

    // 2) 위치가 없는 단독다가구는 법정동 단위 거래 수로만 반영
    const detached = await prisma.rentTransaction.groupBy({
      by: ["sggCd", "umdNm"],
      where: { source: "sh", contractDate: window },
      _count: { _all: true },
    });
    const dongDetached = new Map(detached.map((d) => [dongKey(d.sggCd, d.umdNm), d._count._all]));

    const anchors = buildAnchors([...buildings.values()], dongDetached);
    console.log(`anchors: ${rows.length} geocoded transactions, ${buildings.size} buildings → ${anchors.length} anchors (${from}~${to})`);

    // 3) 앵커 교체: 이번에 만들어지지 않은 셀은 지우고 나머지는 upsert
    const gridIds = anchors.map((a) => a.gridId);
    const removed = await prisma.residentialAnchor.deleteMany({ where: { gridId: { notIn: gridIds } } });
    for (let i = 0; i < anchors.length; i += 50) {
      await Promise.all(
        anchors.slice(i, i + 50).map((anchor) => {
          const region = regionOf(anchor.sggCd);
          const data = {
            ...anchor,
            sido: region?.sido ?? "",
            sigungu: region?.sigungu ?? "",
            latestContractDate: toDate(anchor.latestContractDate),
            sourceFrom: window.gte,
            sourceTo: window.lte,
          };
          return prisma.residentialAnchor.upsert({ where: { gridId: anchor.gridId }, create: data, update: data });
        }),
      );
    }

    // 4) 법정동 × 유형별 시세 (중위값)
    const stats = await prisma.$queryRaw<
      { sgg_cd: string; umd_nm: string; source: string; n: number; monthly_deposit: number | null; monthly_rent: number | null; jeonse_deposit: number | null }[]
    >`
      SELECT sgg_cd, umd_nm, source, COUNT(*)::int AS n,
        (percentile_cont(0.5) WITHIN GROUP (ORDER BY deposit) FILTER (WHERE monthly_rent > 0))::int AS monthly_deposit,
        (percentile_cont(0.5) WITHIN GROUP (ORDER BY monthly_rent) FILTER (WHERE monthly_rent > 0))::int AS monthly_rent,
        (percentile_cont(0.5) WITHIN GROUP (ORDER BY deposit) FILTER (WHERE monthly_rent = 0))::int AS jeonse_deposit
      FROM rent_transactions
      WHERE contract_date BETWEEN ${window.gte} AND ${window.lte}
      GROUP BY sgg_cd, umd_nm, source`;
    for (let i = 0; i < stats.length; i += 50) {
      await Promise.all(
        stats.slice(i, i + 50).map((s) => {
          const data = {
            sigungu: regionOf(s.sgg_cd)?.sigungu ?? "",
            transactionCount: s.n,
            monthlyDepositMedian: s.monthly_deposit,
            monthlyRentMedian: s.monthly_rent,
            jeonseDepositMedian: s.jeonse_deposit,
            sourceFrom: window.gte,
            sourceTo: window.lte,
          };
          return prisma.legalDongRentStat.upsert({
            where: { sggCd_umdNm_source: { sggCd: s.sgg_cd, umdNm: s.umd_nm, source: s.source } },
            create: { sggCd: s.sgg_cd, umdNm: s.umd_nm, source: s.source, ...data },
            update: data,
          });
        }),
      );
    }
    console.log(`done: upserted ${anchors.length} anchors, removed ${removed.count} stale, ${stats.length} dong stats`);
  } finally {
    await prisma.$disconnect();
  }
});
