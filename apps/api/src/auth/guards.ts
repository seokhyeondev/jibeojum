import { CanActivate, ExecutionContext, Injectable, createParamDecorator } from "@nestjs/common";
import type { CookieOptions, Request, Response } from "express";
import { ApiException } from "../common/api-exception.js";
import { signValue, verifyValue } from "./signed-cookie.js";

export const ADMIN_COOKIE = "jp_admin";
export const AGENT_COOKIE = "jp_agent";
export const ADMIN_TTL_MS = 12 * 60 * 60_000;
export const AGENT_TTL_MS = 30 * 24 * 60 * 60_000;

const cookieOptions = (maxAge: number): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge,
});

export function setAdminCookie(res: Response) {
  res.cookie(ADMIN_COOKIE, signValue("admin", ADMIN_TTL_MS), cookieOptions(ADMIN_TTL_MS));
}

export function setAgentCookie(res: Response, agentId: string) {
  res.cookie(AGENT_COOKIE, signValue(agentId, AGENT_TTL_MS), cookieOptions(AGENT_TTL_MS));
}

export const unauthorized = () => new ApiException(401, "unauthorized", "로그인이 필요해요.");

/** 내부 운영 웹 API. 운영자 로그인 쿠키가 있어야 한다 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (verifyValue(req.cookies?.[ADMIN_COOKIE]) !== "admin") throw unauthorized();
    return true;
  }
}

/** 중개사 웹 API. 전용 링크로 들어와 받은 쿠키가 있어야 한다 */
@Injectable()
export class AgentGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { agentId?: string }>();
    const agentId = verifyValue(req.cookies?.[AGENT_COOKIE]);
    if (!agentId) throw unauthorized();
    req.agentId = agentId;
    return true;
  }
}

/** AgentGuard가 확인한 중개사 id */
export const CurrentAgentId = createParamDecorator((_: unknown, context: ExecutionContext) => {
  return context.switchToHttp().getRequest<Request & { agentId?: string }>().agentId as string;
});
