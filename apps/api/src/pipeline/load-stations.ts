// 수도권 지하철·철도역을 브이월드 장소 검색으로 받아 stations에 넣는다. 다시 실행하면 목록을 교체한다.
//
// pnpm pipeline:stations
import { requireEnv } from "../env.js";
import { fetchStationPlaces, fetchSupplementStations, mergeStations, SUPPLEMENT_STATIONS } from "../zones/stations.js";
import { createPrisma, runMain } from "./cli.js";

runMain(async () => {
  const key = requireEnv("VWORLD_API_KEY");
  const places = [...(await fetchStationPlaces(key, "지하철역")), ...(await fetchStationPlaces(key, "철도역"))];
  const { NAVER_API_HUB_CLIENT_ID: hubId, NAVER_API_HUB_CLIENT_SECRET: hubKey } = process.env;
  if (hubId && hubKey) places.push(...(await fetchSupplementStations(hubId, hubKey)));
  else console.warn(`NAVER_API_HUB 키가 없어 보충 역(${SUPPLEMENT_STATIONS.join(", ")})을 건너뜁니다`);
  const stations = mergeStations(places);
  console.log(`stations: ${places.length} places → ${stations.length} stations (${stations.filter((s) => s.kind === "subway").length} subway)`);
  if (stations.length < 300) throw new Error("역이 너무 적어요. 검색 결과를 확인하세요 (기존 목록은 그대로 둡니다)");

  const prisma = createPrisma();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.station.deleteMany({ where: { id: { notIn: stations.map((s) => s.id) } } });
      for (const station of stations) {
        await tx.station.upsert({ where: { id: station.id }, create: station, update: station });
      }
    }, { timeout: 120_000 });
    console.log("done");
  } finally {
    await prisma.$disconnect();
  }
});
