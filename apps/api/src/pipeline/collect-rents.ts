// 국토부 전월세 실거래를 수도권 시군구 × 월 × 유형별로 받아 rent_transactions에 넣는다.
// 다시 실행해도 dedupe_key로 중복을 막는다.
//
// pnpm pipeline:collect [--from 202510] [--to 202609] [--regions 11620,11680] [--sources apt,rh,sh,offi]
import { requireEnv } from "../env.js";
import { MolitRentClient } from "../residential/molit-client.js";
import { RENT_SOURCES, normalizeRentBatch, type RentSource } from "../residential/rent-normalize.js";
import { CAPITAL_AREA_REGIONS } from "../residential/regions.js";
import { argList, argValue, createPrisma, defaultMonthWindow, monthRange, runMain, runWithConcurrency } from "./cli.js";

const INSERT_CHUNK = 1000;

runMain(async () => {
  const window = defaultMonthWindow();
  const months = monthRange(argValue("from") ?? window.from, argValue("to") ?? window.to);
  const regionCodes = argList("regions");
  const regions = regionCodes ? CAPITAL_AREA_REGIONS.filter((r) => regionCodes.includes(r.code)) : CAPITAL_AREA_REGIONS;
  const sources = (argList("sources") ?? Object.keys(RENT_SOURCES)) as RentSource[];

  const client = new MolitRentClient(requireEnv("DATA_GO_KR_SERVICE_KEY"), { delayMs: 100 });
  const prisma = createPrisma();
  const jobs = sources.flatMap((source) => regions.flatMap((region) => months.map((month) => ({ source, region, month }))));
  console.log(`collect: ${sources.join(",")} × ${regions.length} regions × ${months[0]}~${months.at(-1)} = ${jobs.length} jobs`);

  let fetched = 0;
  let inserted = 0;
  let failed = 0;
  try {
    await runWithConcurrency(jobs, 4, async ({ source, region, month }, index) => {
      try {
        const items = await client.fetchMonth(source, region.code, month);
        const rows = normalizeRentBatch(source, items);
        fetched += rows.length;
        for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
          const result = await prisma.rentTransaction.createMany({
            data: rows.slice(i, i + INSERT_CHUNK).map((row) => ({ ...row, contractDate: new Date(`${row.contractDate}T00:00:00.000Z`) })),
            skipDuplicates: true,
          });
          inserted += result.count;
        }
      } catch (error) {
        failed++;
        console.error(`  ! ${source} ${region.code} ${month}: ${error instanceof Error ? error.message : error}`);
      }
      if ((index + 1) % 50 === 0) console.log(`  ${index + 1}/${jobs.length} jobs, fetched ${fetched}, new ${inserted}`);
    });
  } finally {
    await prisma.$disconnect();
  }
  console.log(`done: fetched ${fetched}, newly inserted ${inserted}, failed jobs ${failed}`);
  if (failed) process.exitCode = 1;
});
