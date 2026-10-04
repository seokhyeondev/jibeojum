import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({ path: ".env.local", quiet: true });

// 공용 RDS이므로 DATABASE_URL의 schema=zipazum 안에서만 마이그레이션한다.
// migrate reset / db push는 쓰지 않는다.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});
