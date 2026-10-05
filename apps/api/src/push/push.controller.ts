import { Body, Controller, Delete, HttpCode, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import { ApiException } from "../common/api-exception.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { SessionService, isMember } from "../session/session.service.js";
import { PushService } from "./push.service.js";

const registerSchema = z.object({ token: z.string().min(20).max(4096), platform: z.enum(["ios", "android"]) });
const removeSchema = z.object({ token: z.string().min(20).max(4096) });

/** 앱 푸시 기기 등록 (로그인한 사용자) */
@Controller("push/devices")
export class PushController {
  constructor(
    private readonly push: PushService,
    private readonly session: SessionService,
  ) {}

  @Post()
  @HttpCode(200)
  async register(@Body(new ZodValidationPipe<z.infer<typeof registerSchema>>(registerSchema)) body: z.infer<typeof registerSchema>, @Req() req: Request) {
    const user = await this.session.getUser(req);
    if (!isMember(user)) throw new ApiException(401, "unauthorized", "로그인이 필요해요.");
    await this.push.register(user.id, body.token, body.platform);
    return { ok: true };
  }

  @Delete()
  async remove(@Body(new ZodValidationPipe<z.infer<typeof removeSchema>>(removeSchema)) body: z.infer<typeof removeSchema>, @Req() req: Request) {
    const user = await this.session.getUser(req);
    if (isMember(user)) await this.push.unregister(user.id, body.token);
    return { ok: true };
  }
}
