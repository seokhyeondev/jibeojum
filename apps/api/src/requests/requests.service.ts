import { Injectable } from "@nestjs/common";
import type { HousingRequest, RequestInput } from "@zipazum/shared";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { withMatching, toHousingRequest, toRequestColumns } from "./request-mapper.js";


@Injectable()
export class RequestsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 요청을 만든다. 같은 사용자의 같은 clientKey로 다시 들어오면 기존 요청을 돌려준다.
   * created가 false면 중복 제출이다.
   */
  async create(userId: string, clientKey: string, input: RequestInput) {
    const key = { userId_clientKey: { userId, clientKey } };
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.housingRequest.findUnique({ where: key });
        if (existing) return { request: toHousingRequest(existing), created: false };
        const row = await tx.housingRequest.create({ data: { userId, clientKey, ...toRequestColumns(input) } });
        return { request: toHousingRequest(row), created: true };
      });
    } catch (error) {
      // 동시에 두 번 들어와 고유 제약에 걸리면 먼저 만들어진 요청을 돌려준다.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.prisma.housingRequest.findUniqueOrThrow({ where: key });
        return { request: toHousingRequest(existing), created: false };
      }
      throw error;
    }
  }

  findOwn(userId: string, requestId: string) {
    return this.prisma.housingRequest.findFirst({ where: { id: requestId, userId } });
  }

  async listOwn(userId: string): Promise<HousingRequest[]> {
    const rows = await this.prisma.housingRequest.findMany({
      where: { userId },
      orderBy: { submittedAt: "desc" },
      take: 20,
      include: { areaRecommendation: { select: { status: true, result: true } } },
    });
    return rows.map(withMatching);
  }

  async update(requestId: string, input: RequestInput): Promise<HousingRequest> {
    const row = await this.prisma.housingRequest.update({ where: { id: requestId }, data: toRequestColumns(input) });
    return toHousingRequest(row);
  }

  /** 사용자가 요청을 취소한다. 배정도 함께 닫아 공인중개사가 더는 매물을 올리지 못한다 */
  async cancel(requestId: string): Promise<HousingRequest> {
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.requestAssignment.updateMany({ where: { requestId }, data: { status: "closed" } });
      return tx.housingRequest.update({ where: { id: requestId }, data: { status: "closed" } });
    });
    return toHousingRequest(row);
  }
}
