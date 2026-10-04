// 실거래 지번 주소 중 아직 좌표가 없는 것을 좌표로 바꿔 geocoded_addresses에 저장한다.
// 브이월드가 기본이고, NAVER_MAP_CLIENT_ID/SECRET가 있으면 브이월드가 실패한 주소만 네이버로 보낸다.
// 성공·없음 결과는 다시 호출하지 않고, 오류만 다음 실행에서 재시도한다.
//
// pnpm pipeline:geocode [--limit 5000] [--concurrency 2] [--interval 150]
import { createGeocoderFromEnv } from "../residential/geocoder.js";
import { regionOf } from "../residential/regions.js";
import { argValue, createPrisma, runMain, runWithConcurrency } from "./cli.js";

runMain(async () => {
  const limit = Number(argValue("limit") ?? 5000);
  const concurrency = Number(argValue("concurrency") ?? 2);
  const intervalMs = Number(argValue("interval") ?? 150);
  const geocoder = createGeocoderFromEnv(process.env, { vworldIntervalMs: intervalMs });
  const prisma = createPrisma();

  try {
    const pending = await prisma.$queryRaw<{ address_key: string; sgg_cd: string; umd_nm: string; jibun: string }[]>`
      SELECT t.address_key, MIN(t.sgg_cd) AS sgg_cd, MIN(t.umd_nm) AS umd_nm, MIN(t.jibun) AS jibun
      FROM rent_transactions t
      LEFT JOIN geocoded_addresses g ON g.address_key = t.address_key
      WHERE t.address_key IS NOT NULL AND (g.address_key IS NULL OR g.status = 'error')
      GROUP BY t.address_key
      ORDER BY COUNT(*) DESC
      LIMIT ${limit}`;
    console.log(`geocode: ${pending.length} addresses via ${geocoder.provider} (limit ${limit})`);

    const tally = { ok: 0, not_found: 0, error: 0 };
    await runWithConcurrency(pending, concurrency, async (row, index) => {
      const region = regionOf(row.sgg_cd);
      if (!region) return;
      const query = `${region.sido} ${region.sigungu} ${row.umd_nm} ${row.jibun}`;
      const result = await geocoder.geocodeWithProvider(query);
      tally[result.status]++;
      const data = {
        query,
        status: result.status,
        latitude: result.latitude ?? null,
        longitude: result.longitude ?? null,
        refinedAddress: result.refinedAddress ?? null,
        provider: result.provider,
        geocodedAt: new Date(),
      };
      await prisma.geocodedAddress.upsert({ where: { addressKey: row.address_key }, create: { addressKey: row.address_key, ...data }, update: data });
      if ((index + 1) % 500 === 0) console.log(`  ${index + 1}/${pending.length}`, tally);
    });
    console.log("done:", tally);
  } finally {
    await prisma.$disconnect();
  }
});
