import { Injectable, Logger } from "@nestjs/common";
import type { AreaCommute, AreaRecommendation, AreaRecommendationResult, CommuteSummary, HousingRequest, HousingType, RequiredOptionId, SafetyOptionId } from "@zipazum/shared";
import { HOUSING_TYPE_CHOICES, PYEONG_M2, choiceLabel, fitsMonthlyBudget, wantsJeonse, wantsRent } from "@zipazum/shared";
import { randomUUID } from "node:crypto";
import { BUDGET_FLEX } from "../areas/area-recommend.js";
import type { Prisma } from "../generated/prisma/client.js";
import { NearbyFacilitiesFinder } from "../places/nearby-facilities.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { toHousingRequest } from "../requests/request-mapper.js";
import { haversineMeters } from "../residential/anchor-builder.js";
import type { RentSource } from "../residential/rent-normalize.js";
import { housingTypeOf, walkMinutes } from "../zones/zone-builder.js";

/**
 * 시범 운영용 매물 제안.
 * 실제 공인중개사가 아직 없을 때, 추천 생활권 근처의 실거래(주소·면적·층·보증금·월세)를 바탕으로 예시 매물을 만들어
 * 요청에 붙인다. 옵션·향 등 실거래에 없는 정보는 무작위로 채운다. 매물은 isSample=true로 저장하고 화면에 "시범 매물"로 보인다.
 * DEMO_PROPOSALS=true일 때만 동작한다.
 */

const ZONES = 3;
const PER_ZONE = 2;
const MAX_LISTINGS = 5;
/** 생활권 대표 좌표에서 약 600m 안의 거래 */
const NEAR_DEG = 0.0055;
const STATION_SEARCH_DEG = 0.03;
const RECENT_YEARS = 3;

const SURNAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임"];
const GIVEN = ["민준", "서연", "지훈", "수빈", "현우", "지민", "도윤", "하은", "준호", "예린", "성민", "유나"];
const OPTIONS: RequiredOptionId[] = ["station", "elevator", "parking", "pet", "jeonse_loan", "full_option"];
const SECURITY: SafetyOptionId[] = ["secure_entrance", "cctv", "window_guard", "main_road", "parcel_locker"];
const DIRECTIONS = ["south", "south", "south", "east", "west", "north"] as const;
const IMAGES = ["/room-1.png", "/room-2.png", "/room-3.png"];

const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];
const chance = (p: number) => Math.random() < p;
const between = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

type Db = Prisma.TransactionClient;

interface Tx {
  id: string;
  source: RentSource;
  umd_nm: string;
  building_name: string | null;
  deposit: number;
  monthly_rent: number;
  area_m2: number | null;
  floor: number | null;
  build_year: number | null;
  address: string | null;
  latitude: number;
  longitude: number;
}

@Injectable()
export class DemoProposalsService {
  private readonly logger = new Logger("Demo");
  private readonly nearby = new NearbyFacilitiesFinder();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  get enabled() {
    return process.env.DEMO_PROPOSALS === "true";
  }

  /** 추천 생활권 계산이 끝난 요청에 시범 매물을 붙인다. 이미 붙어 있으면 다시 만들지 않는다 */
  async generate(requestId: string, result: AreaRecommendationResult): Promise<number> {
    if (!this.enabled) return 0;
    // 같은 요청을 여러 서버가 동시에 계산해도 한 번만 만들도록, 확인과 생성을 잠금 안에서 한다
    const created = await this.prisma.$transaction(
      async (db) => {
        await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('zipazum:demo-proposals'))`;
        return this.build(db, requestId, result);
      },
      { maxWait: 60_000, timeout: 60_000 },
    );
    if (!created) return 0;
    // 알림은 커밋 뒤에 보낸다 (푸시는 알림 행이 있는지 확인한다)
    await this.notifications.create({
      userId: created.userId,
      type: "proposal_arrived",
      title: "시범 매물이 도착했어요",
      body: `출근 조건에 맞는 동네의 예시 매물 ${created.count}개를 먼저 보여드려요.`,
      link: `/listings?request=${requestId}`,
    });
    this.logger.log(`request ${requestId}: ${created.count} demo listings`);
    return created.count;
  }

  private async build(db: Db, requestId: string, result: AreaRecommendationResult): Promise<{ userId: string; count: number } | null> {
    const row = await db.housingRequest.findUnique({ where: { id: requestId } });
    if (!row || row.status === "closed") return null;
    const existing = await db.proposal.count({ where: { requestId, listing: { isSample: true } } });
    if (existing > 0) return null;
    const request = toHousingRequest(row);

    const picks: { area: AreaRecommendation; tx: Tx }[] = [];
    // 생활권끼리 겹칠 수 있어 같은 주소는 한 번만 쓴다
    const seen = new Set<string>();
    for (const area of result.areas.slice(0, ZONES)) {
      const candidates = (await this.transactionsNear(db, area)).filter((tx) => this.fits(tx, request));
      let taken = 0;
      for (const tx of candidates) {
        const key = tx.address ?? `${tx.umd_nm}:${tx.building_name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        picks.push({ area, tx });
        if (++taken >= PER_ZONE) break;
      }
      if (picks.length >= MAX_LISTINGS) break;
    }
    if (!picks.length) return null;

    let rank = 1;
    for (const { area, tx } of picks.slice(0, MAX_LISTINGS)) {
      const agentId = await this.demoAgent(db, area, tx.umd_nm);
      const station = await this.nearestStation(db, tx.latitude, tx.longitude);
      const listingId = randomUUID();
      const type = housingTypeOf(tx.source, tx.area_m2) ?? request.housingTypes[0] ?? "studio";
      const area_m2 = Math.round((tx.area_m2 ?? 20) * 10) / 10;
      const floor = tx.floor && tx.floor > 0 ? tx.floor : between(2, 6);
      const totalFloors = Math.max(floor, floor + between(0, 6));
      const pyeong = Math.round(area_m2 / PYEONG_M2);
      const typeLabel = choiceLabel(HOUSING_TYPE_CHOICES, type);
      const options = OPTIONS.filter((o) => (request.requiredOptions.includes(o) ? chance(0.75) : chance(0.35)));
      const security = SECURITY.filter((o) => (request.safetyOptions.includes(o as never) ? chance(0.75) : chance(0.3)));
      const direction = pick(DIRECTIONS);
      const commute = this.commuteOf(area, area.commute, station);
      const partnerCommute = area.partnerCommute ? this.commuteOf(area, area.partnerCommute, station) : null;
      const cleaned = tx.building_name?.replace(/\(.*?\)/g, "").replace(typeLabel, "").trim();
      // 건물 이름이 동 이름과 같으면 ("양재동 양재동 12평") 빼고 쓴다
      const building = cleaned && cleaned !== tx.umd_nm ? cleaned : null;
      const title = `${tx.umd_nm} ${building ? `${building} ` : ""}${pyeong}평 ${typeLabel}`.slice(0, 60);
      await db.listing.create({
        data: {
          id: listingId,
          agentId,
          title,
          housingType: type,
          transactionType: tx.monthly_rent > 0 ? "rent" : "jeonse",
          deposit: tx.deposit,
          monthlyRent: tx.monthly_rent,
          maintenanceFee: type === "apartment" ? between(15, 30) : between(5, 12),
          address: tx.address ?? `${tx.umd_nm}`,
          latitude: tx.latitude,
          longitude: tx.longitude,
          stationName: station?.name ?? "역 정보 없음",
          stationWalkMinutes: station?.walk ?? 0,
          exclusiveAreaM2: area_m2,
          floor,
          totalFloors,
          floorType: "normal",
          direction,
          builtYear: tx.build_year ?? between(2005, 2022),
          availableFrom: new Date(`${request.moveInDate}T00:00:00.000Z`),
          moveInNote: "날짜 협의 가능",
          options,
          security,
          nearby: (await this.nearby.find(tx.latitude, tx.longitude)) as unknown as Prisma.InputJsonValue,
          tags: [],
          description: `${tx.umd_nm}의 ${typeLabel}이에요. 실거래 정보를 바탕으로 만든 시범 매물로, 실제 매물과 다를 수 있어요.`,
          images: [{ src: pick(IMAGES), alt: `${title} 예시 사진` }],
          isSample: true,
          verifiedAt: new Date(),
        },
      });
      await db.proposal.create({
        data: {
          requestId,
          listingId,
          commute: commute as unknown as Prisma.InputJsonValue,
          ...(partnerCommute ? { partnerCommute: partnerCommute as unknown as Prisma.InputJsonValue } : {}),
          rank: rank++,
          status: "proposed",
          agentNote: null,
        },
      });
    }
    return { userId: row.userId, count: rank - 1 };
  }

  /** 요청의 유형·예산·넓이에 맞는 거래인지 */
  private fits(tx: Tx, request: HousingRequest): boolean {
    const type = housingTypeOf(tx.source, tx.area_m2);
    if (!type || !request.housingTypes.includes(type as HousingType)) return false;
    if (request.minPyeong && (tx.area_m2 ?? 0) < request.minPyeong * PYEONG_M2) return false;
    const flex = BUDGET_FLEX[request.budgetFlexibility];
    if (tx.monthly_rent > 0) {
      return wantsRent(request.transactionPreference) && request.depositMax !== null && request.monthlyRentMax !== null && fitsMonthlyBudget(tx.deposit, tx.monthly_rent, request.depositMax, request.monthlyRentMax, flex);
    }
    return wantsJeonse(request.transactionPreference) && request.jeonseMax !== null && tx.deposit <= request.jeonseMax * flex;
  }

  /** 생활권 대표 좌표 근처의 최근 거래 (주소·좌표가 확인된 것만, 최근 거래부터) */
  private transactionsNear(db: Db, area: AreaRecommendation): Promise<Tx[]> {
    const since = new Date();
    since.setFullYear(since.getFullYear() - RECENT_YEARS);
    return db.$queryRaw<Tx[]>`
      SELECT t.id, t.source, t.umd_nm, t.building_name, t.deposit, t.monthly_rent, t.area_m2, t.floor, t.build_year,
             g.refined_address AS address, g.latitude, g.longitude
      FROM rent_transactions t
      JOIN geocoded_addresses g ON g.address_key = t.address_key AND g.status = 'ok'
      WHERE g.latitude BETWEEN ${area.latitude - NEAR_DEG} AND ${area.latitude + NEAR_DEG}
        AND g.longitude BETWEEN ${area.longitude - NEAR_DEG * 1.25} AND ${area.longitude + NEAR_DEG * 1.25}
        AND t.contract_date >= ${since}
      ORDER BY t.contract_date DESC
      LIMIT 300`;
  }

  /** 그 동네 시범 공인중개사 (없으면 만든다). 로그인할 수 없는 계정이다 */
  private async demoAgent(db: Db, area: AreaRecommendation, dong: string): Promise<string> {
    const officeName = `${dong} 시범부동산`;
    const office =
      (await db.brokerOffice.findFirst({ where: { name: officeName, source: "demo" }, include: { agents: { select: { id: true } } } })) ??
      (await db.brokerOffice.create({
        data: { name: officeName, address: `${area.sigungu} ${dong}`, latitude: area.latitude, longitude: area.longitude, source: "demo" },
        include: { agents: { select: { id: true } } },
      }));
    if (office.agents[0]) return office.agents[0].id;
    const agent = await db.agent.create({
      data: { officeId: office.id, name: `${pick(SURNAMES)}${pick(GIVEN)}`, createdBy: "demo", verificationStatus: "verified", verifiedAt: new Date() },
    });
    return agent.id;
  }

  private async nearestStation(db: Db, lat: number, lng: number): Promise<{ name: string; walk: number } | null> {
    const stations = await db.station.findMany({
      where: { latitude: { gte: lat - STATION_SEARCH_DEG, lte: lat + STATION_SEARCH_DEG }, longitude: { gte: lng - STATION_SEARCH_DEG, lte: lng + STATION_SEARCH_DEG } },
      select: { name: true, latitude: true, longitude: true },
    });
    const nearest = stations.map((s) => ({ name: s.name, meters: haversineMeters(lat, lng, s.latitude, s.longitude) })).sort((a, b) => a.meters - b.meters)[0];
    return nearest ? { name: nearest.name, walk: walkMinutes(nearest.meters) } : null;
  }

  /** 생활권 대표값(도보 + 대중교통)을 매물 통근으로 쓴다 */
  private commuteOf(area: AreaRecommendation, c: AreaCommute, station: { name: string; walk: number } | null): CommuteSummary {
    const total = c.bestMinutes ?? 40;
    const walk = c.walkMinutes ?? station?.walk ?? 5;
    const transfers = c.bestTransferCount ?? 1;
    const ride = Math.max(0, total - walk);
    return {
      totalMinutes: total,
      walkMinutes: walk,
      busMinutes: area.kind === "bus" ? ride : 0,
      subwayMinutes: area.kind === "bus" ? 0 : ride,
      transferCount: transfers,
      routeSummary: c.walkOnly ? `${area.name} 동네 기준 · 걸어서 ${walk}분` : `${area.name} 동네 기준 · ${transfers ? `환승 ${transfers}회` : "환승 없음"} · 도보 ${walk}분`,
      calculatedAt: new Date().toISOString(),
      provider: "internal",
    };
  }
}
