import { Controller, Get, HttpCode, Logger, Post, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { SessionService } from "../session/session.service.js";
import { fetchKakaoProfile, kakaoAuthorizeUrl, kakaoConfigFromEnv, safeReturnTo } from "./kakao.js";
import { safeEqual, signValue, verifyValue } from "./signed-cookie.js";
import { UserAuthService } from "./user-auth.service.js";

const STATE_COOKIE = "zp_oauth";
const STATE_TTL_MS = 10 * 60_000;

const withParam = (path: string, key: string, value: string) => `${path}${path.includes("?") ? "&" : "?"}${key}=${value}`;

/** 사용자 웹 로그인 (카카오) */
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
      user: user?.kakaoId ? { nickname: user.nickname, profileImageUrl: user.profileImageUrl } : null,
      kakaoEnabled: kakaoConfigFromEnv() !== null,
    };
  }

  /** 카카오 로그인 화면으로 보낸다. 끝나면 returnTo로 돌아온다 */
  @Get("kakao")
  start(@Query("returnTo") returnTo: string | undefined, @Res() res: Response) {
    const back = safeReturnTo(returnTo);
    const config = kakaoConfigFromEnv();
    if (!config) return res.redirect(withParam(back, "login", "unavailable"));
    const nonce = randomBytes(16).toString("base64url");
    // state = 서명된 (nonce, 돌아갈 주소). nonce를 쿠키와 맞춰 다른 사람이 만든 로그인 링크로 로그인되는 것을 막는다
    res.cookie(STATE_COOKIE, nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth",
      maxAge: STATE_TTL_MS,
    });
    return res.redirect(kakaoAuthorizeUrl(config, signValue(Buffer.from(JSON.stringify({ nonce, back })).toString("base64url"), STATE_TTL_MS)));
  }

  @Get("kakao/callback")
  async callback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const parsed = parseState(state);
    const back = parsed?.back ?? "/";
    const cookieNonce: unknown = req.cookies?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, { path: "/api/auth" });
    const config = kakaoConfigFromEnv();
    // 동의 화면에서 취소하면 error=access_denied로 온다
    if (error || !code || !parsed || typeof cookieNonce !== "string" || !safeEqual(cookieNonce, parsed.nonce) || !config) {
      return res.redirect(withParam(back, "login", error === "access_denied" ? "cancelled" : "failed"));
    }
    try {
      const profile = await fetchKakaoProfile(config, code);
      const current = await this.session.getUser(req);
      const userId = await this.auth.loginWithKakao(current, profile);
      // 다른 사용자로 바뀌면 이 브라우저의 익명 세션을 끝내고 새로 발급한다
      if (current?.id !== userId) {
        await this.session.endSession(req, res);
        await this.session.startSession(res, userId);
      }
      return res.redirect(back);
    } catch (err) {
      this.logger.warn(`kakao login failed: ${err instanceof Error ? err.message : err}`);
      return res.redirect(withParam(back, "login", "failed"));
    }
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.session.endSession(req, res);
    return { ok: true };
  }
}

function parseState(state: string | undefined): { nonce: string; back: string } | null {
  const raw = verifyValue(state);
  if (!raw) return null;
  try {
    const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { nonce?: unknown; back?: unknown };
    return typeof value.nonce === "string" ? { nonce: value.nonce, back: safeReturnTo(value.back) } : null;
  } catch {
    return null;
  }
}
