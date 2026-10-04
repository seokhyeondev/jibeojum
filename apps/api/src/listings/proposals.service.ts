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
  async findForUser(userId: string, listingId: string): Promise<ProposedListing | null> {
    const row = await this.prisma.proposal.findFirst({
      where: { listingId, request: { userId }, status: { not: "hidden" } },
      include: proposalInclude,
      orderBy: { createdAt: "asc" },
    });
    return row ? toProposedListing(row) : null;
  }
}
