import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { requireEnv } from "../env.js";
import { PrismaClient } from "../generated/prisma/client.js";

/** 연결 문자열에서 schema·sslmode 같은 Prisma 전용 파라미터를 떼어 pg에 넘긴다. */
function pgConnectionString(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.delete("schema");
  parsed.searchParams.delete("sslmode");
  return parsed.toString();
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const schema = process.env.DATABASE_SCHEMA ?? "zipazum";
    const adapter = new PrismaPg(
      {
        connectionString: pgConnectionString(requireEnv("DATABASE_URL")),
        max: Number(process.env.DATABASE_POOL_MAX ?? 5),
        // RDS 인증서 검증은 CA 번들을 붙일 때 켠다.
        ssl: { rejectUnauthorized: false },
        // $queryRaw도 zipazum 스키마만 보도록 한다.
        options: `-c search_path=${schema}`,
      },
      { schema },
    );
    super({ adapter });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
