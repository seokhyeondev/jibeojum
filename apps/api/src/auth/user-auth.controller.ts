import { Body, Controller, Delete, Get, HttpCode, Logger, Param, Post, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { ApiException } from "../common/api-exception.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { SessionService, isMember } from "../session/session.service.js";
import { appleAuthorizeUrl, appleConfigFromEnv, exchangeAppleCode } from "./apple.js";
import { fetchKakaoProfile, kakaoAuthorizeUrl, kakaoConfigFromEnv, safeReturnTo } from "./kakao.js";
import { safeEqual, signValue, verifyValue } from "./signed-cookie.js";
import { UserAuthService, type SocialIdentity } from "./user-auth.service.js";

const STATE_COOKIE = "zp_oauth";
const STATE_TTL_MS = 10 * 60_000;
/** 앱 로그인: 시스템 브라우저에서 로그인한 뒤 앱으로 돌아가 쓰는 1회용 코드 (2분) */
const HANDOFF_TTL_MS = 2 * 60_000;
const APP_SCHEME = () => process.env.APP_URL_SCHEME ?? "zipazum";

type Provider = "kakao" | "apple";
const PROVIDERS: Provider[] = ["kakao", "apple"];

interface OAuthState {
  nonce: string;
  back: string;
  /** 앱(Capacitor)에서 시작한 로그인이면 끝나고 앱으로 돌려보낸다 */
  app: boolean;
}

const withParam = (path: string, key: string, value: string) => `${path}${path.includes("?") ? "&" : "?"}${key}=${value}`;
const encodeState = (state: OAuthState) => signValue(Buffer.from(JSON.stringify(state)).toString("base64url"), STATE_TTL_MS);

/** 이미 쓴 앱 로그인 코드 (같은 코드로 두 번 로그인되지 않게). 서버 1대라 메모리로 충분하다 */
const usedHandoffs = new Map<string, number>();

/** 사용자 웹 로그인 (카카오·Apple) */
@Controller("auth")
export class UserAuthController {
  private readonly logger = new Logger("Auth");

  constructor(
    private readonly session: SessionService,
    private readonly auth: UserAuthService,
  ) {}

  /** 로그인한 사용자 정보. 로그인 전이면 user: null */
  @Get("me")
  async me(@Req() req: Request) {
    const user = await this.session.getUser(req);
    return {
      user: isMember(user) ? { nickname: user.nickname, profileImageUrl: user.profileImageUrl, provider: user.kakaoId ? "kakao" : "apple" } : null,
      kakaoEnabled: kakaoConfigFromEnv() !== null,
      appleEnabled: appleConfigFromEnv() !== null,
    };
  }

  /** 소셜 로그인 화면으로 보낸다. 끝나면 returnTo로 (app=1이면 앱으로) 돌아온다 */
  @Get(":provider")
  start(@Param("provider") provider: string, @Query("returnTo") returnTo: string | undefined, @Query("app") app: string | undefined, @Res() res: Response) {
    const back = safeReturnTo(returnTo);
    const fromApp = app === "1";
    if (!PROVIDERS.includes(provider as Provider)) return res.redirect(withParam(back, "login", "failed"));
    const kakao = kakaoConfigFromEnv();
    const apple = appleConfigFromEnv();
    if ((provider === "kakao" && !kakao) || (provider === "apple" && !apple)) return this.finishFailed(res, back, fromApp, "unavailable");
    const nonce = randomBytes(16).toString("base64url");
    // nonce를 쿠키와 맞춰 다른 사람이 만든 로그인 링크로 로그인되는 것을 막는다
    res.cookie(STATE_COOKIE, nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth",
      maxAge: STATE_TTL_MS,
    });
    const state = encodeState({ nonce, back, app: fromApp });
    return res.redirect(provider === "kakao" ? kakaoAuthorizeUrl(kakao!, state) : appleAuthorizeUrl(apple!, state));
  }

  @Get(":provider/callback")
  async callback(
    @Param("provider") provider: string,
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const parsed = parseState(state);
    const back = parsed?.back ?? "/";
    const fromApp = parsed?.app ?? false;
    const cookieNonce: unknown = req.cookies?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, { path: "/api/auth" });
    // 동의 화면에서 취소하면 error=access_denied(카카오) / user_cancelled_authorize(Apple)로 온다
    if (error) return this.finishFailed(res, back, fromApp, /denied|cancel/.test(error) ? "cancelled" : "failed");
    if (!code || !parsed || typeof cookieNonce !== "string" || !safeEqual(cookieNonce, parsed.nonce) || !PROVIDERS.includes(provider as Provider)) {
      return this.finishFailed(res, back, fromApp, "failed");
    }
    try {
      const identity = await this.identify(provider as Provider, code);
      const current = await this.session.getUser(req);
      const userId = await this.auth.login(current, identity);
      if (fromApp) {
        // 시스템 브라우저의 세션은 앱 화면과 공유되지 않으므로 1회용 코드로 넘긴다
        const handoff = signValue(Buffer.from(JSON.stringify({ userId, n: randomBytes(8).toString("hex") })).toString("base64url"), HANDOFF_TTL_MS);
        return res.redirect(`${APP_SCHEME()}://auth?${new URLSearchParams({ code: handoff, returnTo: back })}`);
      }
      // 다른 사용자로 바뀌면 이 브라우저의 예전 세션을 끝내고 새로 발급한다
      if (current?.id !== userId) {
        await this.session.endSession(req, res);
        await this.session.startSession(res, userId);
      }
      return res.redirect(back);
    } catch (err) {
      this.logger.warn(`${provider} login failed: ${err instanceof Error ? err.message : err}`);
      return this.finishFailed(res, back, fromApp, "failed");
    }
  }

  /** 앱: 브라우저 로그인 후 받은 1회용 코드로 앱 화면에 세션을 만든다 */
  @Post("exchange")
  @HttpCode(200)
  async exchange(@Body(new ZodValidationPipe<{ code: string }>(z.object({ code: z.string().min(10).max(500) }))) body: { code: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const now = Date.now();
    for (const [k, exp] of usedHandoffs) if (exp < now) usedHandoffs.delete(k);
    const raw = verifyValue(body.code);
    if (!raw || usedHandoffs.has(body.code)) throw new ApiException(401, "unauthorized", "로그인이 만료됐어요. 다시 로그인해주세요.");
    usedHandoffs.set(body.code, now + HANDOFF_TTL_MS);
    const { userId } = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { userId: string };
    await this.session.endSession(req, res);
    await this.session.startSession(res, userId);
    return { ok: true };
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.session.endSession(req, res);
    return { ok: true };
  }

  /** 회원탈퇴: 요청·대화·알림을 모두 지우고 카카오·Apple 연결을 끊는다 */
  @Delete("account")
  async withdraw(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = await this.session.getUser(req);
    if (!isMember(user)) throw new ApiException(401, "unauthorized", "로그인이 필요해요.");
    await this.auth.withdraw(user.id);
    await this.session.endSession(req, res);
    return { ok: true };
  }

  private async identify(provider: Provider, code: string): Promise<SocialIdentity> {
    if (provider === "kakao") {
      const profile = await fetchKakaoProfile(kakaoConfigFromEnv()!, code);
      return { provider, id: profile.id, nickname: profile.nickname, profileImageUrl: profile.profileImageUrl };
    }
    const { sub, refreshToken } = await exchangeAppleCode(appleConfigFromEnv()!, code);
    return { provider, id: sub, nickname: null, profileImageUrl: null, appleRefreshToken: refreshToken };
  }

  private finishFailed(res: Response, back: string, fromApp: boolean, reason: string) {
    if (fromApp) return res.redirect(`${APP_SCHEME()}://auth?${new URLSearchParams({ error: reason, returnTo: back })}`);
    return res.redirect(withParam(back, "login", reason));
  }
}

function parseState(state: string | undefined): OAuthState | null {
  const raw = verifyValue(state);
  if (!raw) return null;
  try {
    const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<OAuthState>;
    return typeof value.nonce === "string" ? { nonce: value.nonce, back: safeReturnTo(value.back), app: value.app === true } : null;
  } catch {
    return null;
  }
}
