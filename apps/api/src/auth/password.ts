import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// 중개사 비밀번호: scrypt("salt:hash", 16바이트 salt, 64바이트 키)
const KEY_LENGTH = 64;

const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, KEY_LENGTH, (error, key) => (error ? reject(error) : resolve(key))),
  );

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await derive(password, salt)).toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = await derive(password, salt);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** 운영자가 계정을 만들 때 보여줄 임시 비밀번호 (헷갈리는 글자 제외) */
export function temporaryPassword(length = 10): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}
