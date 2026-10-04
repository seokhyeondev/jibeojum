import { Injectable } from "@nestjs/common";
import type { BrokerSearch } from "@zipazum/shared";
import { notFound } from "../common/api-exception.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { brokerKeywords, mergeOffices, parseBrokerOffices, type NaverOffice } from "./broker-search.js";

/** 생활권 대표 좌표 주변(약 ±700m) 거래로 법정동·건물명을 뽑는다 */
const NEAR_LAT = 0.0065;
const NEAR_LNG = 0.008;

@Injectable()
export class BrokerSearchService {
  /** 네이버 검색 결과만 캐시한다 (연락 기록은 매번 DB에서 붙인다) */
  private readonly cache = new Map<
    string,
    { at: number; keywords: BrokerSearch["keywords"]; naver: NaverOffice[]; origin: { latitude: number; longitude: number } }
  >();

  constructor(private readonly prisma: PrismaService) {}

  /** 생활권 근처 부동산: 네이버 검색 + 우리 목록(연락했던 곳). requestId가 있으면 이 요청의 연락 상태도 붙인다 */
  async forZone(zoneKey: string, requestId: string | null = null): Promise<BrokerSearch> {
    const { keywords, naver, origin } = await this.naverForZone(zoneKey);
    // 1.5km ≈ 위도 0.0135°, 경도 0.017° (서울 기준)
    const near = { lat0: origin.latitude - 0.0135, lat1: origin.latitude + 0.0135, lng0: origin.longitude - 0.017, lng1: origin.longitude + 0.017 };
    const saved = await this.prisma.brokerOffice.findMany({
      where: {
        OR: [
          { latitude: { gte: near.lat0, lte: near.lat1 }, longitude: { gte: near.lng0, lte: near.lng1 } },
          { name: { in: naver.map((n) => n.name) } },
        ],
      },
      include: {
        contacts: { select: { id: true, requestId: true, status: true, contactedAt: true } },
        agents: { where: { loginId: { not: null } }, select: { id: true, name: true } },
      },
      take: 200,
    });
    return { zoneKey, keywords, offices: mergeOffices(naver, saved, requestId, origin) };
  }

  private async naverForZone(zoneKey: string) {
    const hit = this.cache.get(zoneKey);
    if (hit && Date.now() - hit.at < 30 * 60_000) return hit;

    const zone = await this.prisma.commuteZone.findUnique({ where: { zoneKey } });
    if (!zone) throw notFound();
    const near = { lat0: zone.latitude - NEAR_LAT, lat1: zone.latitude + NEAR_LAT, lng0: zone.longitude - NEAR_LNG, lng1: zone.longitude + NEAR_LNG };

    const [dongRows, buildingRows] = await Promise.all([
      this.prisma.$queryRaw<{ umd_nm: string; n: number }[]>`
        SELECT t.umd_nm, COUNT(*)::int AS n FROM rent_transactions t
        JOIN geocoded_addresses g ON g.address_key = t.address_key AND g.status = 'ok'
        WHERE g.latitude BETWEEN ${near.lat0} AND ${near.lat1} AND g.longitude BETWEEN ${near.lng0} AND ${near.lng1}
        GROUP BY t.umd_nm ORDER BY n DESC LIMIT 1`,
      this.prisma.$queryRaw<{ building_name: string; n: number }[]>`
        SELECT t.building_name, COUNT(*)::int AS n FROM rent_transactions t
        JOIN geocoded_addresses g ON g.address_key = t.address_key AND g.status = 'ok'
        WHERE t.source IN ('offi', 'apt') AND t.building_name IS NOT NULL
          AND g.latitude BETWEEN ${near.lat0} AND ${near.lat1} AND g.longitude BETWEEN ${near.lng0} AND ${near.lng1}
        GROUP BY t.building_name ORDER BY n DESC LIMIT 2`,
    ]);

    const keywords = brokerKeywords(
      { kind: zone.kind as "station" | "bus", stationName: zone.stationName, admName: zone.admName, sigungu: zone.sigungu },
      dongRows[0]?.umd_nm ?? null,
      buildingRows.map((b) => b.building_name),
    );
    const naver = await this.searchOffices(
      keywords.map((k) => k.query),
      { latitude: zone.latitude, longitude: zone.longitude, sigungu: zone.sigungu },
    );
    const entry = { at: Date.now(), keywords, naver, origin: { latitude: zone.latitude, longitude: zone.longitude } };
    this.cache.set(zoneKey, entry);
    return entry;
  }

  /** 네이버 지역 검색으로 실제 중개사무소 몇 곳 (키가 없으면 빈 목록, 검색어 링크만 쓴다) */
  private async searchOffices(queries: string[], origin: Parameters<typeof parseBrokerOffices>[2]): Promise<NaverOffice[]> {
    const { NAVER_API_HUB_CLIENT_ID: id, NAVER_API_HUB_CLIENT_SECRET: secret } = process.env;
    if (!id || !secret) return [];
    const offices: NaverOffice[] = [];
    for (const query of queries) {
      try {
        const response = await fetch(`https://naverapihub.apigw.ntruss.com/search/v1/local?${new URLSearchParams({ query, display: "5", sort: "comment" })}`, {
          headers: { "X-NCP-APIGW-API-KEY-ID": id, "X-NCP-APIGW-API-KEY": secret },
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) continue;
        const body = (await response.json()) as { items?: Parameters<typeof parseBrokerOffices>[0] };
        for (const office of parseBrokerOffices(body.items ?? [], query, origin)) {
          if (!offices.some((o) => o.name === office.name && o.address === office.address)) offices.push(office);
        }
      } catch {
        // 검색 실패는 링크로 대신한다
      }
    }
    // 가까운 순 (좌표 없는 결과는 뒤로)
    return offices.sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
  }
}
