// 카카오 로그인 (REST API, 인가 코드 방식)
// https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api

export interface KakaoProfile {
  id: string;
  nickname: string | null;
  profileImageUrl: string | null;
}

export interface KakaoConfig {
  restApiKey: string;
  clientSecret: string | null;
  redirectUri: string;
  /** 테스트에서 가짜 서버로 바꿀 수 있게 둔다 */
  authBase: string;
  apiBase: string;
}

export function kakaoConfigFromEnv(env: NodeJS.ProcessEnv = process.env): KakaoConfig | null {
  if (!env.KAKAO_REST_API_KEY) return null;
  return {
    restApiKey: env.KAKAO_REST_API_KEY,
    clientSecret: env.KAKAO_CLIENT_SECRET || null,
    redirectUri: env.KAKAO_REDIRECT_URI ?? "http://localhost:3000/api/auth/kakao/callback",
    authBase: env.KAKAO_AUTH_BASE ?? "https://kauth.kakao.com",
    apiBase: env.KAKAO_API_BASE ?? "https://kapi.kakao.com",
  };
}

export function kakaoAuthorizeUrl(config: KakaoConfig, state: string): string {
  const params = new URLSearchParams({ client_id: config.restApiKey, redirect_uri: config.redirectUri, response_type: "code", state });
  return `${config.authBase}/oauth/authorize?${params}`;
}

/** 인가 코드 → 액세스 토큰 → 사용자 정보 */
export async function fetchKakaoProfile(config: KakaoConfig, code: string): Promise<KakaoProfile> {
  const tokenResponse = await fetch(`${config.authBase}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.restApiKey,
      redirect_uri: config.redirectUri,
      code,
      ...(config.clientSecret ? { client_secret: config.clientSecret } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const token = (await tokenResponse.json().catch(() => ({}))) as { access_token?: string; error_code?: string };
  if (!tokenResponse.ok || !token.access_token) throw new Error(`kakao token: HTTP ${tokenResponse.status} ${token.error_code ?? ""}`.trim());

  const meResponse = await fetch(`${config.apiBase}/v2/user/me`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(10_000),
  });
  const me = (await meResponse.json().catch(() => ({}))) as {
    id?: number | string;
    kakao_account?: { profile?: { nickname?: string; profile_image_url?: string; is_default_image?: boolean } };
  };
  if (!meResponse.ok || me.id === undefined) throw new Error(`kakao me: HTTP ${meResponse.status}`);
  const profile = me.kakao_account?.profile;
  return {
    id: String(me.id),
    nickname: profile?.nickname ?? null,
    profileImageUrl: profile && !profile.is_default_image ? (profile.profile_image_url ?? null) : null,
  };
}

/** 로그인 뒤 돌아갈 주소는 우리 사이트 안의 경로만 허용한다 */
export function safeReturnTo(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/";
  return raw.slice(0, 500);
}
