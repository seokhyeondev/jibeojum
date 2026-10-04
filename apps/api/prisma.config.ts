import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local", quiet: true });

// DATABASE_URL의 schema=zipazum 안에서만 마이그레이션한다. migrate reset / db push는 쓰지 않는다.
// prisma generate는 DB가 필요 없다. Vercel(웹 빌드)처럼 DATABASE_URL이 없는 곳에서도
// pnpm install의 postinstall(generate)이 실패하지 않게, 값이 있을 때만 datasource를 둔다.
const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  ...(url ? { datasource: { url } } : {}),
});
