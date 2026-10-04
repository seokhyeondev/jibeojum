import { config } from "dotenv";

// 로컬 개발용 비밀값은 apps/api/.env.local에 둔다. 배포 환경에서는 실제 환경변수를 쓴다.
config({ path: ".env.local", quiet: true });

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
