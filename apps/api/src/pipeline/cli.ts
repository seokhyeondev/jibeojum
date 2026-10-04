import "../env.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { requireEnv } from "../env.js";
import { PrismaClient } from "../generated/prisma/client.js";

/** 파이프라인 스크립트용 Prisma 클라이언트 (Nest 밖에서 실행) */
export function createPrisma(): PrismaClient {
  const url = new URL(requireEnv("DATABASE_URL"));
  url.searchParams.delete("schema");
  url.searchParams.delete("sslmode");
  const schema = process.env.DATABASE_SCHEMA ?? "zipazum";
  return new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: url.toString(), ssl: { rejectUnauthorized: false }, max: 4, options: `-c search_path=${schema}` },
      { schema },
    ),
  });
}

/** --key value 형태의 인자를 읽는다 */
export function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export const argList = (name: string) => argValue(name)?.split(",").map((s) => s.trim()).filter(Boolean);

/** YYYYMM 범위의 월 목록 */
export function monthRange(from: string, to: string): string[] {
  const months: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(4, 6));
  const end = Number(to);
  while (y * 100 + m <= end) {
    months.push(`${y}${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return months;
}

/** 기본 수집 범위: 지난달까지 12개월 (이번 달은 신고 기간이라 덜 모였다) */
export function defaultMonthWindow(now = new Date()): { from: string; to: string } {
  const to = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const from = new Date(to.getFullYear(), to.getMonth() - 11, 1);
  const ym = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  return { from: ym(from), to: ym(to) };
}

/** 동시 실행 수를 제한해 작업을 돌린다 */
export async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        await worker(items[index], index);
      }
    }),
  );
}

export function runMain(main: () => Promise<void>) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
