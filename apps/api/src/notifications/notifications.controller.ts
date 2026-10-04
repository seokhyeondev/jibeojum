import { Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { SessionService } from "../session/session.service.js";
import { NotificationsService } from "./notifications.service.js";

/** 사용자 알림함. 세션이 없으면 빈 목록 */
@Controller("notifications")
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly session: SessionService,
  ) {}

  @Get()
  async list(@Req() req: Request) {
    const user = await this.session.getUser(req);
    return user ? await this.notifications.list(user.id) : { items: [], unreadCount: 0 };
  }

  @Post("read-all")
  @HttpCode(200)
  async readAll(@Req() req: Request) {
    const user = await this.session.getUser(req);
    if (user) await this.notifications.markAllRead(user.id);
    return { ok: true };
  }
}
