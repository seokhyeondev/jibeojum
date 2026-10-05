import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { PrismaService } from "../prisma/prisma.service.js";

// 브라우저별 세션 토큰으로 사용자를 구분한다. 세션은 카카오 로그인 때 만든다
// (예전 익명 세션이 남아 있으면 로그인할 때 그 사용자에 카카오 계정을 붙인다). 토큰 원문은 쿠키에만, DB에는 해시만 둔다.
export const SESSION_COOKIE = "jp_session";
const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export interface SessionUser {
  id: string;
  kakaoId: string | null;
  appleSub: string | null;
  nickname: string | null;
  profileImageUrl: string | null;
}

const USER_SELECT = { id: true, kakaoId: true, appleSub: true, nickname: true, profileImageUrl: true } as const;

/** 카카오나 Apple로 로그인한 회원인지 (예전 익명 세션은 아니다) */
export const isMember = (user: SessionUser | null): user is SessionUser => Boolean(user && (user.kakaoId || user.appleSub));

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  /** 현재 요청의 사용자. 쿠키가 없거나 모르는 토큰이면 null. */
  async getUser(req: Request): Promise<SessionUser | null> {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== "string" || !token) return null;
    const session = await this.prisma.userSession.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { user: { select: USER_SELECT } },
    });
    return session?.user ?? null;
  }

  /** 이 브라우저를 userId로 로그인시킨다 (새 토큰 발급) */
  async startSession(res: Response, userId: string) {
    const token = randomBytes(32).toString("base64url");
    await this.prisma.userSession.create({ data: { userId, tokenHash: hashToken(token) } });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ONE_YEAR_MS,
    });
  }

  /** 이 브라우저의 세션만 끝낸다 */
  async endSession(req: Request, res: Response) {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token === "string" && token) await this.prisma.userSession.deleteMany({ where: { tokenHash: hashToken(token) } });
    res.clearCookie(SESSION_COOKIE, { path: "/" });
  }
}
