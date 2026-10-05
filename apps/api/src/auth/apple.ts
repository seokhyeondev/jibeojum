import { createCipheriv, createDecipheriv, createHash, createPrivateKey, createPublicKey, createSign, createVerify, randomBytes, type JsonWebKey } from "node:crypto";

// Apple 로그인 (Sign in with Apple, 웹 방식)
// https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api
// 이름·이메일은 받지 않는다 (scope 없음). 그래야 GET 콜백(response_mode=query)으로 받을 수 있다.

export interface AppleConfig {
  /** Services ID (웹 로그인용 client_id) */
  clientId: string;
  teamId: string;
  keyId: string;
  /** .p8 개인키 (PEM). 환경변수에는 줄바꿈을 \n으로 넣는다 */
  privateKey: string;
  redirectUri: string;
}

export function appleConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AppleConfig | null {
  const { APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY, APPLE_REDIRECT_URI } = env;
  if (!APPLE_CLIENT_ID || !APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY || !APPLE_REDIRECT_URI) return null;
  return { clientId: APPLE_CLIENT_ID, teamId: APPLE_TEAM_ID, keyId: APPLE_KEY_ID, privateKey: APPLE_PRIVATE_KEY.replace(/\\n/g, "\n"), redirectUri: APPLE_REDIRECT_URI };
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

export function appleAuthorizeUrl(config: AppleConfig, state: string): string {
  const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code", response_mode: "query", state });
  return `https://appleid.apple.com/auth/authorize?${params}`;
}

/** Apple 토큰 API에 쓰는 client_secret (ES256 JWT, 5분) */
function clientSecret(config: AppleConfig, now = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({ alg: "ES256", kid: config.keyId }));
  const payload = b64url(JSON.stringify({ iss: config.teamId, iat: now, exp: now + 300, aud: "https://appleid.apple.com", sub: config.clientId }));
  const signature = createSign("SHA256").update(`${header}.${payload}`).sign({ key: createPrivateKey(config.privateKey), dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${b64url(signature)}`;
}

let jwksCache: { at: number; keys: (JsonWebKey & { kid: string })[] } | null = null;

async function appleKeys() {
  if (jwksCache && Date.now() - jwksCache.at < 60 * 60_000) return jwksCache.keys;
  const response = await fetch("https://appleid.apple.com/auth/keys", { signal: AbortSignal.timeout(10_000) });
  const body = (await response.json()) as { keys: (JsonWebKey & { kid: string })[] };
  jwksCache = { at: Date.now(), keys: body.keys };
  return body.keys;
}

/** id_token 서명·발급자·대상·만료를 확인하고 사용자 식별자(sub)를 돌려준다 */
export async function verifyAppleIdToken(config: AppleConfig, idToken: string): Promise<string> {
  const [h, p, s] = idToken.split(".");
  if (!h || !p || !s) throw new Error("apple id_token: malformed");
  const header = JSON.parse(Buffer.from(h, "base64url").toString()) as { kid?: string; alg?: string };
  const jwk = (await appleKeys()).find((k) => k.kid === header.kid);
  if (!jwk || header.alg !== "RS256") throw new Error("apple id_token: unknown key");
  const ok = createVerify("RSA-SHA256").update(`${h}.${p}`).verify(createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(s, "base64url"));
  if (!ok) throw new Error("apple id_token: bad signature");
  const claims = JSON.parse(Buffer.from(p, "base64url").toString()) as { iss?: string; aud?: string; exp?: number; sub?: string };
  if (claims.iss !== "https://appleid.apple.com" || claims.aud !== config.clientId || !claims.sub || (claims.exp ?? 0) * 1000 < Date.now()) {
    throw new Error("apple id_token: invalid claims");
  }
  return claims.sub;
}

/** 인가 코드 → 토큰. sub와 refresh_token(탈퇴 때 연결 해제용)을 돌려준다 */
export async function exchangeAppleCode(config: AppleConfig, code: string): Promise<{ sub: string; refreshToken: string | null }> {
  const response = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: clientSecret(config), code, grant_type: "authorization_code", redirect_uri: config.redirectUri }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await response.json().catch(() => ({}))) as { id_token?: string; refresh_token?: string; error?: string };
  if (!response.ok || !body.id_token) throw new Error(`apple token: HTTP ${response.status} ${body.error ?? ""}`.trim());
  return { sub: await verifyAppleIdToken(config, body.id_token), refreshToken: body.refresh_token ?? null };
}

/** 탈퇴할 때 Apple 쪽 연결도 끊는다 (Apple 심사 요구사항) */
export async function revokeApple(config: AppleConfig, refreshToken: string): Promise<void> {
  await fetch("https://appleid.apple.com/auth/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: clientSecret(config), token: refreshToken, token_type_hint: "refresh_token" }),
    signal: AbortSignal.timeout(10_000),
  });
}

// refresh_token은 AUTH_SECRET에서 만든 키로 암호화해 둔다 (AES-256-GCM)
const key = () => createHash("sha256").update(`apple-token:${process.env.AUTH_SECRET ?? ""}`).digest();

export function sealToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function openToken(sealed: string): string | null {
  try {
    const [iv, tag, data] = sealed.split(".").map((part) => Buffer.from(part, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
