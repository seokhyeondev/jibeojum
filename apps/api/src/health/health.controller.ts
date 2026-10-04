import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** 서버와 DB 연결 상태 */
  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  }
}
