import { Body, Controller, Post, Req } from "@nestjs/common";
import { uploadRequestSchema, type UploadRequest } from "@zipazum/shared";
import type { Request } from "express";
import { ADMIN_COOKIE, AGENT_COOKIE } from "../auth/guards.js";
import { verifyValue } from "../auth/signed-cookie.js";
import { ApiException } from "../common/api-exception.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { RateLimiter } from "../places/rate-limit.js";
import { UploadsService } from "./uploads.service.js";

/**
 * 사진 업로드 주소 발급.
 * - 매물 사진: 로그인한 공인중개사만
 * - 프로필 사진: 운영자·공인중개사, 그리고 가입 화면(로그인 전)도 쓰므로 IP별로 횟수를 제한한다
 */
@Controller("uploads")
export class UploadsController {
  private readonly limiter = new RateLimiter(20, 10 * 60_000);

  constructor(private readonly uploads: UploadsService) {}

  @Post()
  async create(@Req() req: Request, @Body(new ZodValidationPipe<UploadRequest>(uploadRequestSchema)) body: UploadRequest) {
    const agentId = verifyValue(req.cookies?.[AGENT_COOKIE]);
    const admin = verifyValue(req.cookies?.[ADMIN_COOKIE]) === "admin";
    if (body.purpose === "listing-photo" && !agentId) throw new ApiException(401, "unauthorized", "로그인이 필요해요.");
    // 가입 화면(로그인 전)에서 쓰는 프로필 사진·등록증은 IP별로 횟수를 제한한다
    if (!agentId && !admin && !this.limiter.allow(req.ip ?? "unknown")) {
      throw new ApiException(429, "invalid_input", "잠시 후 다시 시도해주세요.");
    }
    return { ticket: await this.uploads.presign(body, agentId) };
  }
}
