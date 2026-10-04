import { Injectable } from "@nestjs/common";
import type {
  AdminRequestDetail,
  AdminRequestSummary,
  AgentSummary,
  AreaRecommendationResult,
  AssignmentSummary,
} from "@zipazum/shared";
import { summarizeRequest } from "@zipazum/shared";
import type { AdminCreateAgentInput } from "@zipazum/shared";
import { hashPassword, temporaryPassword } from "../auth/password.js";
import { Prisma, type Agent } from "../generated/prisma/client.js";
import { ApiException, notFound } from "../common/api-exception.js";
import { ProposalsService } from "../listings/proposals.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { UploadsService, uploadPrefix } from "../uploads/uploads.service.js";
import { toHousingRequest } from "../requests/request-mapper.js";

type AreaStatus = AdminRequestSummary["areaStatus"];

const areaFit = (result: unknown) => (result as AreaRecommendationResult | null)?.funnel?.fit ?? null;

function toAgentSummary(a: Agent & { _count: { assignments: number } }): AgentSummary {
  return {
    id: a.id,
    loginId: a.loginId ?? "",
    name: a.name,
    phone: a.phone,
    address: a.address,
    photoUrl: a.photoUrl,
    status: a.status as AgentSummary["status"],
    createdBy: a.createdBy === "self" ? "self" : "admin",
    assignmentCount: a._count.assignments,
    createdAt: a.createdAt.toISOString(),
  };
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly proposals: ProposalsService,
    private readonly uploads: UploadsService,
  ) {}

  async listRequests(): Promise<AdminRequestSummary[]> {
    const rows = await this.prisma.housingRequest.findMany({
      orderBy: { submittedAt: "desc" },
      take: 100,
      include: {
        areaRecommendation: { select: { status: true, result: true } },
        _count: { select: { assignments: true, proposals: { where: { listing: { isSample: false } } } } },
      },
    });
    return rows.map((row) => {
      const request = toHousingRequest(row);
      return {
        id: row.id,
        destinationLabel: row.destinationLabel,
        maxCommuteMinutes: row.maxCommuteMinutes,
        summary: summarizeRequest(request),
        submittedAt: row.submittedAt.toISOString(),
        status: request.status,
        areaStatus: (row.areaRecommendation?.status ?? "none") as AreaStatus,
        fitZoneCount: areaFit(row.areaRecommendation?.result),
        assignmentCount: row._count.assignments,
        proposalCount: row._count.proposals,
      };
    });
  }

  async requestDetail(id: string): Promise<AdminRequestDetail> {
    const row = await this.prisma.housingRequest.findUnique({ where: { id }, include: { areaRecommendation: true } });
    if (!row) throw notFound();
    const [assignments, proposals] = await Promise.all([this.assignmentsFor(id), this.proposals.listRealForRequest(id)]);
    return {
      request: toHousingRequest(row),
      area: {
        status: (row.areaRecommendation?.status ?? "none") as AreaStatus,
        error: row.areaRecommendation?.error ?? null,
        result: (row.areaRecommendation?.result as AreaRecommendationResult | null) ?? null,
      },
      assignments,
      proposals,
    };
  }

  async listAgents(): Promise<AgentSummary[]> {
    const rows = await this.prisma.agent.findMany({
      where: { loginId: { not: null } },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { assignments: true } } },
    });
    return rows.map(toAgentSummary);
  }

  /** 운영자가 중개사 계정을 만든다. 비밀번호를 비우면 임시 비밀번호를 만들어 한 번만 돌려준다 */
  async createAgent(input: AdminCreateAgentInput) {
    this.uploads.assertOwnAssets([input.photoUrl], uploadPrefix("agent-photo", null));
    const password = input.password ?? temporaryPassword();
    try {
      const agent = await this.prisma.agent.create({
        data: {
          loginId: input.loginId,
          passwordHash: await hashPassword(password),
          name: input.name,
          phone: input.phone,
          address: input.address,
          photoUrl: input.photoUrl,
          createdBy: "admin",
        },
        include: { _count: { select: { assignments: true } } },
      });
      return { agent: toAgentSummary(agent), temporaryPassword: input.password ? null : password };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ApiException(409, "conflict", "이미 쓰고 있는 아이디예요.");
      }
      throw error;
    }
  }

  /** 임시 비밀번호로 바꾼다 (한 번만 보여준다) */
  async resetPassword(agentId: string) {
    const password = temporaryPassword();
    const updated = await this.prisma.agent.updateMany({ where: { id: agentId, loginId: { not: null } }, data: { passwordHash: await hashPassword(password) } });
    if (updated.count === 0) throw notFound();
    return { temporaryPassword: password };
  }

  async setAgentStatus(agentId: string, status: "active" | "inactive") {
    const updated = await this.prisma.agent.updateMany({ where: { id: agentId, loginId: { not: null } }, data: { status } });
    if (updated.count === 0) throw notFound();
    return { ok: true };
  }

  /**
   * 한 생활권에 여러 공인중개사를 배정한다. 배정은 (요청, 공인중개사)마다 한 줄이고
   * 맡은 생활권을 zoneKeys에 모은다. 이미 배정된 공인중개사면 생활권만 더한다.
   */
  async assign(requestId: string, input: { zoneKey: string; agentIds: string[]; note: string | null }): Promise<AssignmentSummary[]> {
    const agentIds = [...new Set(input.agentIds)];
    const [request, zone, agents] = await Promise.all([
      this.prisma.housingRequest.findUnique({ where: { id: requestId }, select: { id: true } }),
      this.prisma.commuteZone.findUnique({ where: { zoneKey: input.zoneKey }, select: { zoneKey: true } }),
      this.prisma.agent.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true, status: true } }),
    ]);
    if (!request || !zone || agents.length !== agentIds.length) throw notFound();
    const inactive = agents.find((a) => a.status !== "active");
    if (inactive) throw new ApiException(409, "conflict", `${inactive.name}님은 사용 중지된 계정이라 배정할 수 없어요.`);

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.requestAssignment.findMany({ where: { requestId, agentId: { in: agentIds } } });
      for (const agentId of agentIds) {
        const row = existing.find((e) => e.agentId === agentId);
        if (!row) {
          await tx.requestAssignment.create({ data: { requestId, agentId, zoneKeys: [input.zoneKey], note: input.note } });
        } else {
          const zoneKeys = row.zoneKeys.includes(input.zoneKey) ? row.zoneKeys : [...row.zoneKeys, input.zoneKey];
          await tx.requestAssignment.update({ where: { id: row.id }, data: { zoneKeys, ...(input.note ? { note: input.note } : {}) } });
        }
      }
    });
    return this.assignmentsFor(requestId);
  }

  /** 생활권 하나에서만 빼거나(zoneKey), 배정 전체를 지운다. 맡은 생활권이 없어지면 배정도 지운다 */
  async unassign(assignmentId: string, zoneKey: string | null) {
    const row = await this.prisma.requestAssignment.findUnique({ where: { id: assignmentId }, select: { requestId: true, zoneKeys: true } });
    if (!row) throw notFound();
    const zoneKeys = zoneKey ? row.zoneKeys.filter((k) => k !== zoneKey) : [];
    if (zoneKeys.length) await this.prisma.requestAssignment.update({ where: { id: assignmentId }, data: { zoneKeys } });
    else await this.prisma.requestAssignment.delete({ where: { id: assignmentId } });
    return this.assignmentsFor(row.requestId);
  }

  private async assignmentsFor(requestId: string): Promise<AssignmentSummary[]> {
    const rows = await this.prisma.requestAssignment.findMany({
      where: { requestId },
      orderBy: { createdAt: "asc" },
      include: { agent: { include: { office: true } } },
    });
    const counts = await this.prisma.proposal.groupBy({
      by: ["listingId"],
      where: { requestId, listing: { agentId: { in: rows.map((r) => r.agentId) } } },
    });
    const listingAgents = await this.prisma.listing.findMany({ where: { id: { in: counts.map((c) => c.listingId) } }, select: { agentId: true } });
    return rows.map((r) => ({
      id: r.id,
      requestId: r.requestId,
      agent: { id: r.agent.id, name: r.agent.name, officeName: r.agent.office?.name ?? "" },
      zoneKeys: r.zoneKeys,
      note: r.note,
      status: r.status as AssignmentSummary["status"],
      proposalCount: listingAgents.filter((l) => l.agentId === r.agentId).length,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
