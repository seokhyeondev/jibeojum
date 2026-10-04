import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  AgentAssignmentDetail,
  AgentAssignmentSummary,
  AgentListingInput,
  AgentSignupInput,
  AgentSummary,
  AreaRecommendationResult,
  ProposedListing,
} from "@zipazum/shared";
import { requestConditionLabels, summarizeRequest } from "@zipazum/shared";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { ApiException, notFound } from "../common/api-exception.js";
import { Prisma } from "../generated/prisma/client.js";
import { ProposalsService } from "../listings/proposals.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PlaceSearch } from "../places/place-search.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { toHousingRequest } from "../requests/request-mapper.js";
import { haversineMeters } from "../residential/anchor-builder.js";
import { MockTransitProvider } from "../transit/mock-transit.provider.js";
import { TransitRouteCacheService } from "../transit/transit-route-cache.service.js";
import type { TransitRouteResult } from "../transit/transit.types.js";
import { UploadsService, uploadPrefix } from "../uploads/uploads.service.js";
import { walkMinutes } from "../zones/zone-builder.js";
import { WALK_COMMUTE_MAX_M, listingTags, toCommuteSummary, walkingCommute } from "./listing-builder.js";

const STATION_SEARCH_DEG = 0.03;

@Injectable()
export class AgentService {
  private readonly logger = new Logger("Agent");
  private readonly places = new PlaceSearch(process.env);
  private readonly estimator = new MockTransitProvider();

  constructor(
    private readonly prisma: PrismaService,
    private readonly proposals: ProposalsService,
    private readonly notifications: NotificationsService,
    private readonly routes: TransitRouteCacheService,
    private readonly uploads: UploadsService,
  ) {}

  // ───── 계정 ─────

  async signup(input: AgentSignupInput): Promise<string> {
    this.uploads.assertOwnAssets([input.photoUrl], uploadPrefix("agent-photo", null));
    try {
      const agent = await this.prisma.agent.create({
        data: { loginId: input.loginId, passwordHash: await hashPassword(input.password), name: input.name, phone: input.phone, address: input.address, photoUrl: input.photoUrl, createdBy: "self" },
      });
      return agent.id;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ApiException(409, "conflict", "이미 쓰고 있는 아이디예요.");
      throw error;
    }
  }

  async login(loginId: string, password: string): Promise<string> {
    const agent = await this.prisma.agent.findUnique({ where: { loginId } });
    if (!agent || !(await verifyPassword(password, agent.passwordHash))) throw new ApiException(401, "unauthorized", "아이디 또는 비밀번호가 맞지 않아요.");
    if (agent.status !== "active") throw new ApiException(403, "forbidden", "사용이 중지된 계정이에요. 운영팀에 문의해주세요.");
    return agent.id;
  }

  async me(agentId: string): Promise<AgentSummary> {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId }, include: { _count: { select: { assignments: true } } } });
    if (!agent || agent.status !== "active") throw new ApiException(401, "unauthorized", "다시 로그인해주세요.");
    return {
      id: agent.id,
      loginId: agent.loginId ?? "",
      name: agent.name,
      phone: agent.phone,
      address: agent.address,
      photoUrl: agent.photoUrl,
      status: "active",
      createdBy: agent.createdBy === "self" ? "self" : "admin",
      assignmentCount: agent._count.assignments,
      createdAt: agent.createdAt.toISOString(),
    };
  }

  // ───── 배정 ─────

  async assignments(agentId: string): Promise<AgentAssignmentSummary[]> {
    await this.me(agentId);
    const rows = await this.prisma.requestAssignment.findMany({ where: { agentId }, orderBy: { createdAt: "desc" }, include: { request: true } });
    return Promise.all(rows.map((row) => this.summary(row, agentId)));
  }

  async assignment(agentId: string, assignmentId: string): Promise<AgentAssignmentDetail> {
    await this.me(agentId);
    const row = await this.prisma.requestAssignment.findFirst({ where: { id: assignmentId, agentId }, include: { request: true } });
    if (!row) throw notFound();
    const request = toHousingRequest(row.request);
    const zones = row.zoneKeys.length
      ? await this.prisma.commuteZone.findMany({ where: { zoneKey: { in: row.zoneKeys } }, select: { zoneKey: true, name: true, latitude: true, longitude: true, stationName: true } })
      : [];
    const { id: _id, status: _status, submittedAt: _submittedAt, ...conditions } = request;
    return {
      ...(await this.summary(row, agentId)),
      request: conditions,
      zones,
      note: row.note,
      myListings: await this.proposals.listByAgentForRequest(agentId, row.requestId),
    };
  }

  private async summary(
    row: { id: string; requestId: string; zoneKeys: string[]; status: string; createdAt: Date; request: Parameters<typeof toHousingRequest>[0] },
    agentId: string,
  ): Promise<AgentAssignmentSummary> {
    const request = toHousingRequest(row.request);
    const [zones, proposalCount] = await Promise.all([
      row.zoneKeys.length ? this.prisma.commuteZone.findMany({ where: { zoneKey: { in: row.zoneKeys } }, select: { name: true } }) : [],
      this.prisma.proposal.count({ where: { requestId: row.requestId, listing: { agentId } } }),
    ]);
    return {
      id: row.id,
      requestId: row.requestId,
      destinationLabel: request.commuteDestination.label,
      summary: summarizeRequest(request),
      conditions: requestConditionLabels(request),
      zoneNames: zones.map((z) => z.name),
      status: row.status as AgentAssignmentSummary["status"],
      proposalCount,
      createdAt: row.createdAt.toISOString(),
    };
  }

  // ───── 매물 등록 ─────

  /**
   * 배정받은 요청에 매물을 등록한다.
   * 주소 → 좌표 → 가까운 역 → 출근지까지 통근(경로 API, 안 되면 추정) → 매물·제안 저장 → 사용자 알림.
   */
  async registerListing(agentId: string, assignmentId: string, input: AgentListingInput): Promise<ProposedListing> {
    const me = await this.me(agentId);
    const assignment = await this.prisma.requestAssignment.findFirst({
      where: { id: assignmentId, agentId },
      include: { request: { include: { areaRecommendation: true } } },
    });
    if (!assignment) throw notFound();
    if (assignment.status === "closed") throw new ApiException(409, "conflict", "종료된 요청이에요.");
    const request = assignment.request;
    if (request.status === "closed") throw new ApiException(409, "conflict", "고객이 취소한 요청이에요.");

    this.uploads.assertOwnAssets(input.imageUrls, uploadPrefix("listing-photo", agentId));
    // 주소는 웹에서 주소 검색으로 골라 좌표와 함께 온다
    const place = { address: input.address, latitude: input.latitude, longitude: input.longitude };

    const station = await this.nearestStation(place.latitude, place.longitude);
    const destination = await this.destinationOf(request);
    const listingId = randomUUID();

    let route: TransitRouteResult | null = null;
    let estimated = false;
    if (destination) {
      try {
        route = (
          await this.routes.getRoutes({
            originKey: `listing:${listingId}`,
            originLat: place.latitude,
            originLng: place.longitude,
            destLat: destination.latitude,
            destLng: destination.longitude,
            dataDate: new Date().toISOString().slice(0, 10),
          })
        ).result;
      } catch (error) {
        this.logger.warn(`commute for listing failed, using estimate: ${error instanceof Error ? error.message : error}`);
      }
      if (!route?.best) {
        route = await this.estimator.getRoutes({ startX: place.longitude, startY: place.latitude, endX: destination.longitude, endY: destination.latitude });
        estimated = true;
      }
    }
    // 걸어갈 거리면 TMAP이 경로를 주지 않는다(경로 없음). 대중교통 추정 대신 도보 시간으로 둔다
    const walkMeters = destination ? haversineMeters(place.latitude, place.longitude, destination.latitude, destination.longitude) : null;
    const commute =
      estimated && walkMeters !== null && walkMeters <= WALK_COMMUTE_MAX_M
        ? walkingCommute(walkMinutes(walkMeters * 1.3)) // 직선거리 × 1.3 ≈ 실제 걷는 길
        : route
          ? toCommuteSummary(route, estimated)
          : null;
    if (!commute) throw new ApiException(400, "invalid_input", "출근지까지 경로를 계산하지 못했어요. 운영팀에 문의해주세요.");

    await this.prisma.$transaction(async (tx) => {
      await tx.listing.create({
        data: {
          id: listingId,
          agentId,
          title: input.title,
          housingType: input.housingType,
          transactionType: input.transactionType,
          deposit: input.deposit,
          monthlyRent: input.transactionType === "jeonse" ? 0 : input.monthlyRent,
          maintenanceFee: input.maintenanceFee,
          address: place.address,
          latitude: place.latitude,
          longitude: place.longitude,
          stationName: station?.name ?? "역 정보 없음",
          stationWalkMinutes: station?.walk ?? 0,
          exclusiveAreaM2: input.exclusiveAreaM2,
          floor: input.floor,
          totalFloors: input.totalFloors,
          floorType: input.floorType,
          builtYear: input.builtYear,
          availableFrom: input.availableFrom ? new Date(`${input.availableFrom}T00:00:00.000Z`) : null,
          moveInNote: input.moveInNote,
          options: input.options,
          security: input.security,
          nearby: [],
          tags: listingTags(input),
          description: input.description,
          images: input.imageUrls.map((src, i) => ({ src, alt: `${input.title} 사진 ${i + 1}` })),
          isSample: false,
          verifiedAt: new Date(),
        },
      });
      await tx.proposal.create({
        data: { requestId: request.id, listingId, commute: commute as unknown as Prisma.InputJsonValue, rank: 0, status: "proposed", agentNote: input.agentNote },
      });
      await tx.requestAssignment.update({ where: { id: assignment.id }, data: { status: "proposed" } });
      await tx.housingRequest.update({ where: { id: request.id }, data: { status: "proposed" } });
      await this.notifications.create(
        {
          userId: request.userId,
          type: "proposal_arrived",
          title: "새 매물이 도착했어요",
          body: `${me.name} 중개사 · ${input.title}`,
          link: `/listings/${listingId}`,
        },
        tx,
      );
    });

    const created = (await this.proposals.listByAgentForRequest(agentId, request.id)).find((l) => l.id === listingId);
    if (!created) throw new Error("listing not found after create");
    return created;
  }

  private async nearestStation(lat: number, lng: number): Promise<{ name: string; walk: number } | null> {
    const stations = await this.prisma.station.findMany({
      where: { latitude: { gte: lat - STATION_SEARCH_DEG, lte: lat + STATION_SEARCH_DEG }, longitude: { gte: lng - STATION_SEARCH_DEG, lte: lng + STATION_SEARCH_DEG } },
      select: { name: true, latitude: true, longitude: true },
    });
    const nearest = stations
      .map((s) => ({ name: s.name, meters: haversineMeters(lat, lng, s.latitude, s.longitude) }))
      .sort((a, b) => a.meters - b.meters)[0];
    return nearest ? { name: nearest.name, walk: walkMinutes(nearest.meters) } : null;
  }

  /** 사용자가 고른 출근지 좌표 → 추천 계산에 쓴 좌표 → 출근지 이름으로 다시 검색 */
  private async destinationOf(request: {
    destinationLabel: string;
    destinationLatitude: number | null;
    destinationLongitude: number | null;
    areaRecommendation: { result: unknown } | null;
  }): Promise<{ latitude: number; longitude: number } | null> {
    if (request.destinationLatitude !== null && request.destinationLongitude !== null) {
      return { latitude: request.destinationLatitude, longitude: request.destinationLongitude };
    }
    const computed = (request.areaRecommendation?.result as AreaRecommendationResult | null)?.destination;
    if (computed) return computed;
    const [place] = await this.places.search(request.destinationLabel, 1);
    return place ? { latitude: place.latitude, longitude: place.longitude } : null;
  }
}
