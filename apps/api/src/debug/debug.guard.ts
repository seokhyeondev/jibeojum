import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { notFound } from "../common/api-exception.js";

/**
 * 디버그 API는 DEBUG_TOOLS=true일 때만 열린다. 꺼져 있으면 없는 경로처럼 404.
 * DEBUG_TOKEN이 있으면 x-debug-token 헤더가 같아야 한다 (운영 서버에서 켤 때).
 */
@Injectable()
export class DebugGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (process.env.DEBUG_TOOLS !== "true") throw notFound();
    const token = process.env.DEBUG_TOKEN;
    if (token && context.switchToHttp().getRequest<Request>().header("x-debug-token") !== token) throw notFound();
    return true;
  }
}
