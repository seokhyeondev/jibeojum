import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// 운영자·중개사 세션 쿠키: "<값>.<만료 ms>.<서명>". 서버에 세션을 저장하지 않는다.
// AUTH_SECRET이 없으면 프로세스마다 임시 키를 만든다 (재시작하면 다시 로그인해야 함).
let fallbackSecret: string | null = null;

function secret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (!fallbackSecret) {
    fallbackSecret = randomBytes(32).toString("hex");
    console.warn("AUTH_SECRET이 없어 임시 키로 세션을 서명합니다. 서버를 다시 켜면 운영자·중개사가 다시 로그인해야 해요.");
  }
  return fallbackSecret;
}

const sign = (data: string, key = secret()) => createHmac("sha256", key).update(data).digest("base64url");

export function signValue(value: string, ttlMs: number, now = Date.now(), key?: string): string {
  const data = `${value}.${now + ttlMs}`;
  return `${data}.${sign(data, key)}`;
}

/** 서명이 맞고 만료 전이면 값, 아니면 null */
export function verifyValue(cookie: string | undefined, now = Date.now(), key?: string): string | null {
  if (!cookie) return null;
  const parts = cookie.split(".");
  if (parts.length !== 3) return null;
  const [value, exp, signature] = parts;
  const expected = Buffer.from(sign(`${value}.${exp}`, key));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return Number(exp) > now ? value : null;
}

export const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/** 길이가 달라도 시간 차이가 나지 않게 비교 */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(sha256(a));
  const y = Buffer.from(sha256(b));
  return timingSafeEqual(x, y);
}

