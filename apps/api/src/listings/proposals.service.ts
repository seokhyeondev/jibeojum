import { Injectable } from "@nestjs/common";
import type { CommuteSummary, Listing, ListingImage, NearbyFacility, ProposedListing } from "@zipazum/shared";
import type { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { fromDateColumn } from "../requests/request-mapper.js";

const proposalInclude = {
  listing: { include: { agent: { include: { office: true } } } },
} satisfies Prisma.ProposalInclude;

type ProposalRow = Prisma.ProposalGetPayload<{ include: typeof proposalInclude }>;

function toProposedListing(row: ProposalRow): ProposedListing {
  const l = row.listing;
  return {
    id: l.id,
    proposalId: row.id,
    agentId: l.agentId,
    agent: { id: l.agent.id, name: l.agent.name, officeName: l.agent.office?.name ?? "", photoUrl: l.agent.photoUrl },
    title: l.title,
    housingType: l.housingType as Listing["housingType"],
    transactionType: l.transactionType as Listing["transactionType"],
    deposit: l.deposit,
    monthlyRent: l.monthlyRent,
    maintenanceFee: l.maintenanceFee,
    address: l.address,
    station: { name: l.stationName, walkMinutes: l.stationWalkMinutes },
    exclusiveAreaM2: l.exclusiveAreaM2,
    floor: l.floor,
    totalFloors: l.totalFloors,
    floorType: l.floorType as Listing["floorType"],
    builtYear: l.builtYear,
    availableFrom: l.availableFrom ? fromDateColumn(l.availableFrom) : null,
    moveInNote: l.moveInNote ?? undefined,
    options: l.options as Listing["options"],
    security: l.security as Listing["security"],
    nearby: l.nearby as unknown as NearbyFacility[],
    tags: l.tags,
    description: l.description,
    images: l.images as unknown as ListingImage[],
    commute: row.commute as unknown as CommuteSummary,
    verifiedAt: l.verifiedAt.toISOString(),
    status: l.status as Listing["status"],
  };
}

@Injectable()
export class ProposalsService {
  constructor(private readonly prisma: PrismaService) {}

  /** 요청에 도착한 제안. 숨김 처리된 제안은 빼고 보낸다. */
  async listForRequest(userId: string, requestId: string): Promise<ProposedListing[]> {
    const rows = await this.prisma.proposal.findMany({
      where: { requestId, request: { userId }, status: { not: "hidden" } },
      include: proposalInclude,
      orderBy: [{ rank: "asc" }, { createdAt: "asc" }],
    });
    return rows.map(toProposedListing);
  }

  /** 운영자용: 요청에 들어온 실제 중개사 제안 (샘플 제외) */
  async listRealForRequest(requestId: string): Promise<ProposedListing[]> {
    const rows = await this.prisma.proposal.findMany({
      where: { requestId, listing: { isSample: false } },
      include: proposalInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toProposedListing);
  }

  /** 중개사용: 이 요청에 내가 올린 매물 */
  async listByAgentForRequest(agentId: string, requestId: string): Promise<ProposedListing[]> {
    const rows = await this.prisma.proposal.findMany({
      where: { requestId, listing: { agentId } },
      include: proposalInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toProposedListing);
  }

  /** 사용자가 제안받은 매물만 상세를 볼 수 있다. */
  /**
   * 사용자 반응을 처음 한 번만 기록한다 (열람·찜·문의). 유료화 후 "24시간 미열람 환급"과 열람률 계산에 쓴다.
   * 내 요청에 제안된 매물이 아니면 아무것도 하지 않는다.
   */
  async markReaction(userId: string, listingId: string, type: "view" | "favorite" | "inquire") {
    const field = type === "view" ? "viewedAt" : type === "favorite" ? "favoritedAt" : "inquiredAt";
    await this.prisma.proposal.updateMany({
      where: { listingId, request: { userId }, [field]: null },
      data: { [field]: new Date() },
    });
  }

  /** 매물 신고. 내게 제안된 매물만, 같은 매물은 한 번만 (다시 하면 이유를 고친다) */
  async report(userId: string, listingId: string, input: { reason: string; note: string | null }): Promise<boolean> {
    const mine = await this.prisma.proposal.findFirst({ where: { listingId, request: { userId } }, select: { id: true } });
    if (!mine) return false;
    await this.prisma.listingReport.upsert({
      where: { listingId_userId: { listingId, userId } },
      create: { listingId, userId, reason: input.reason, note: input.note },
      update: { reason: input.reason, note: input.note, status: "open", reviewedAt: null },
    });
    return true;
  }

  async findForUser(userId: string, listingId: string): Promise<ProposedListing | null> {
    const row = await this.prisma.proposal.findFirst({
      where: { listingId, request: { userId }, status: { not: "hidden" } },
      include: proposalInclude,
      orderBy: { createdAt: "asc" },
    });
    return row ? toProposedListing(row) : null;
  }
}
