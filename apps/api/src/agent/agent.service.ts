import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  AgentLicenseInput,
  AgentInvitePreview,
  AgentAssignmentDetail,
  AgentAssignmentSummary,
  AgentListingInput,
  AgentSignupInput,
  AgentSummary,
  AreaRecommendationResult,
  CommuteSummary,
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
import { NearbyFacilitiesFinder } from "../places/nearby-facilities.js";
import { MockTransitProvider } from "../transit/mock-transit.provider.js";
import { TransitRouteCacheService } from "../transit/transit-route-cache.service.js";
import type { TransitRouteResult } from "../transit/transit.types.js";
import { UploadsService, uploadPrefix } from "../uploads/uploads.service.js";
import { walkMinutes } from "../zones/zone-builder.js";
import { inviteTokenHash } from "../admin/outreach.service.js";
import { WALK_COMMUTE_MAX_M, listingTags, toCommuteSummary, walkingCommute } from "./listing-builder.js";

const STATION_SEARCH_DEG = 0.03;

@Injectable()
export class AgentService {
  private readonly logger = new Logger("Agent");
  private readonly places = new PlaceSearch(process.env);
  private readonly estimator = new MockTransitProvider();
  private readonly nearby = new NearbyFacilitiesFinder();

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
        data: {
          loginId: input.loginId,
          passwordHash: await hashPassword(input.password),
          name: input.name,
          phone: input.phone,
          address: input.address,
          photoUrl: input.photoUrl,
          registrationNo: input.registrationNo,
          licenseImageKey: input.licenseImageKey,
          verificationStatus: "pending",
          createdBy: "self",
        },
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
      launchPartnerAt: agent.launchPartnerAt?.toISOString() ?? null,
      stats: { proposals: 0, viewed: 0, favorited: 0, inquired: 0, reportsOpen: 0, reportsConfirmed: 0 },
      verificationStatus: agent.verificationStatus as AgentSummary["verificationStatus"],
      registrationNo: agent.registrationNo,
      hasLicenseImage: agent.licenseImageKey !== null,
      rejectReason: agent.rejectReason,
    };
  }

  /** 반려된 뒤 등록증을 다시 낸다 → 다시 확인 대기 */
  async resubmitLicense(agentId: string, input: AgentLicenseInput): Promise<AgentSummary> {
    const agent = await this.me(agentId);
    if (agent.verificationStatus === "verified") throw new ApiException(409, "conflict", "이미 확인된 계정이에요.");
    await this.prisma.agent.update({
      where: { id: agentId },
      data: { registrationNo: input.registrationNo, licenseImageKey: input.licenseImageKey, verificationStatus: "pending", rejectReason: null },
    });
    return this.me(agentId);
  }

  // ───── 초대 링크 ─────

  /** 초대 링크를 연 사람에게 보여줄 요청 요약 (로그인 전에도 본다. 사용자 개인정보 없음) */
  async previewInvite(token: string): Promise<AgentInvitePreview> {
    const invite = await this.findInvite(token);
    const request = toHousingRequest(invite.request);
    const zones = invite.zoneKeys.length
      ? await this.prisma.commuteZone.findMany({ where: { zoneKey: { in: invite.zoneKeys } }, select: { name: true } })
      : [];
    return {
      destinationLabel: request.commuteDestination.label,
      summary: summarizeRequest(request),
      conditions: requestConditionLabels(request),
      zoneNames: zones.map((z) => z.name),
      officeName: invite.office?.name ?? null,
      officeAddress: invite.office?.address ?? null,
      expired: invite.expiresAt.getTime() < Date.now(),
      accepted: invite.acceptedAgentId !== null,
      closed: invite.request.status === "closed",
    };
  }

  /**
   * 로그인한 공인중개사가 초대를 받는다: 요청(생활권)을 배정하고, 사무소를 계정에 붙이고, 연락 기록을 "가입함"으로 바꾼다.
   * 같은 사람이 다시 열면 기존 배정을 돌려준다. 다른 계정이 이미 받은 링크면 막는다.
   */
  async acceptInvite(agentId: string, token: string): Promise<{ assignmentId: string }> {
    await this.me(agentId);
    const invite = await this.findInvite(token);
    if (invite.acceptedAgentId && invite.acceptedAgentId !== agentId) throw new ApiException(409, "conflict", "이미 다른 계정으로 받은 링크예요. 운영팀에 새 링크를 요청해주세요.");
    if (!invite.acceptedAgentId && invite.expiresAt.getTime() < Date.now()) throw new ApiException(410, "conflict", "만료된 링크예요. 운영팀에 새 링크를 요청해주세요.");
    if (invite.request.status === "closed") throw new ApiException(409, "conflict", "고객이 취소한 요청이에요.");
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.requestAssignment.findUnique({ where: { requestId_agentId: { requestId: invite.requestId, agentId } } });
      const zoneKeys = [...new Set([...(existing?.zoneKeys ?? []), ...invite.zoneKeys])];
      const assignment = existing
        ? await tx.requestAssignment.update({ where: { id: existing.id }, data: { zoneKeys } })
        : await tx.requestAssignment.create({ data: { requestId: invite.requestId, agentId, zoneKeys, note: null } });
      if (!invite.acceptedAgentId) await tx.agentInvite.update({ where: { id: invite.id }, data: { acceptedAgentId: agentId, acceptedAt: new Date() } });
      if (invite.officeId) {
        await tx.agent.updateMany({ where: { id: agentId, officeId: null }, data: { officeId: invite.officeId } });
      }
      if (invite.contactId) {
        await tx.brokerContact.updateMany({ where: { id: invite.contactId, status: { not: "has_listing" } }, data: { status: "joined" } });
      }
      return { assignmentId: assignment.id };
    });
  }

  private async findInvite(token: string) {
    const invite = await this.prisma.agentInvite.findUnique({
      where: { tokenHash: inviteTokenHash(token) },
      include: { request: true, office: { select: { name: true, address: true } } },
    });
    if (!invite) throw new ApiException(404, "not_found", "링크를 찾을 수 없어요. 주소를 다시 확인해주세요.");
    return invite;
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
    if (me.verificationStatus !== "verified") {
      throw new ApiException(403, "forbidden", "운영팀이 중개사무소 등록증을 확인한 뒤 매물을 올릴 수 있어요.");
    }
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

    const [station, nearby] = await Promise.all([this.nearestStation(place.latitude, place.longitude), this.nearby.find(place.latitude, place.longitude)]);
    const destination = await this.destinationOf(request);
    const listingId = randomUUID();

    const commute = destination ? await this.commuteTo(place, destination, `listing:${listingId}`) : null;
    if (!commute) throw new ApiException(400, "invalid_input", "출근지까지 경로를 계산하지 못했어요. 운영팀에 문의해주세요.");
    // 같이 사는 사람 출근지까지도 계산한다 (못 하면 비워 둔다)
    const partner =
      request.partnerDestinationLatitude !== null && request.partnerDestinationLongitude !== null
        ? { latitude: request.partnerDestinationLatitude, longitude: request.partnerDestinationLongitude }
        : null;
    const partnerCommute = partner ? await this.commuteTo(place, partner, `listing:${listingId}`) : null;

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
          direction: input.direction,
          builtYear: input.builtYear,
          availableFrom: input.availableFrom ? new Date(`${input.availableFrom}T00:00:00.000Z`) : null,
          moveInNote: input.moveInNote,
          options: input.options,
          security: input.security,
          // 주변 시설은 서버가 카카오 로컬 검색으로 채운다 (중개사 입력 없음)
          nearby: nearby as unknown as Prisma.InputJsonValue,
          tags: listingTags(input),
          description: input.description,
          images: input.imageUrls.map((src, i) => ({ src, alt: `${input.title} 사진 ${i + 1}` })),
          isSample: false,
          verifiedAt: new Date(),
        },
      });
      await tx.proposal.create({
        data: { requestId: request.id, listingId, commute: commute as unknown as Prisma.InputJsonValue, ...(partnerCommute ? { partnerCommute: partnerCommute as unknown as Prisma.InputJsonValue } : {}), rank: 0, status: "proposed", agentNote: input.agentNote },
      });
      await tx.requestAssignment.update({ where: { id: assignment.id }, data: { status: "proposed" } });
      // 운영팀이 연락했던 사무소면 연락 기록을 "매물 등록"으로 바꾼다
      const agentOffice = await tx.agent.findUnique({ where: { id: agentId }, select: { officeId: true } });
      if (agentOffice?.officeId) {
        await tx.brokerContact.updateMany({ where: { requestId: request.id, officeId: agentOffice.officeId }, data: { status: "has_listing" } });
      }
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
  /**
   * 매물에서 출근지까지 통근. 경로 API → 안 되면 직선거리 추정.
   * 걸어갈 거리면 TMAP이 경로를 주지 않으므로(경로 없음) 대중교통 추정 대신 도보 시간으로 둔다.
   */
  private async commuteTo(
    place: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    originKey: string,
  ): Promise<CommuteSummary | null> {
    let route: TransitRouteResult | null = null;
    let estimated = false;
    try {
      route = (
        await this.routes.getRoutes({
          originKey,
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
    const walkMeters = haversineMeters(place.latitude, place.longitude, destination.latitude, destination.longitude);
    if (estimated && walkMeters <= WALK_COMMUTE_MAX_M) return walkingCommute(walkMinutes(walkMeters * 1.3)); // 직선거리 × 1.3 ≈ 실제 걷는 길
    return toCommuteSummary(route, estimated);
  }

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
