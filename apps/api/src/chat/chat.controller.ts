import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { chatMessageSchema, type ChatMessageInput } from "@zipazum/shared";
import type { Request } from "express";
import { AgentGuard, CurrentAgentId } from "../auth/guards.js";
import { ApiException } from "../common/api-exception.js";
import { UuidParamPipe } from "../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { RateLimiter } from "../places/rate-limit.js";
import { SessionService } from "../session/session.service.js";
import { ChatService } from "./chat.service.js";

/** 보내는 사람마다 1분에 30개까지 */
const limiter = new RateLimiter(30, 60_000);
const tooMany = () => new ApiException(429, "invalid_input", "메시지를 너무 빨리 보내고 있어요. 잠시 후 다시 보내주세요.");

/** 고객 채팅 (카카오 로그인 필요) */
@Controller("chats")
export class UserChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly session: SessionService,
  ) {}

  private async userId(req: Request) {
    const user = await this.session.getUser(req);
    if (!user?.kakaoId) throw new ApiException(401, "unauthorized", "카카오로 로그인한 뒤 문의할 수 있어요.");
    return user.id;
  }

  @Get()
  async list(@Req() req: Request) {
    return { threads: await this.chat.userThreads(await this.userId(req)) };
  }

  @Get("listing/:listingId")
  async get(@Param("listingId", UuidParamPipe) listingId: string, @Req() req: Request) {
    return { chat: await this.chat.userChat(await this.userId(req), listingId) };
  }

  @Post("listing/:listingId/messages")
  async send(
    @Param("listingId", UuidParamPipe) listingId: string,
    @Body(new ZodValidationPipe<ChatMessageInput>(chatMessageSchema)) body: ChatMessageInput,
    @Req() req: Request,
  ) {
    const userId = await this.userId(req);
    if (!limiter.allow(`user:${userId}`)) throw tooMany();
    return { chat: await this.chat.userSend(userId, listingId, body.body) };
  }
}

/** 공인중개사 채팅 */
@Controller("agent/chats")
@UseGuards(AgentGuard)
export class AgentChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  async list(@CurrentAgentId() agentId: string) {
    return { threads: await this.chat.agentThreads(agentId) };
  }

  /** 안 읽은 메시지 수 (메뉴 배지) */
  @Get("unread")
  async unread(@CurrentAgentId() agentId: string) {
    return { unread: await this.chat.agentUnreadTotal(agentId) };
  }

  @Get(":id")
  async get(@CurrentAgentId() agentId: string, @Param("id", UuidParamPipe) id: string) {
    return { chat: await this.chat.agentChat(agentId, id) };
  }

  @Post(":id/messages")
  async send(
    @CurrentAgentId() agentId: string,
    @Param("id", UuidParamPipe) id: string,
    @Body(new ZodValidationPipe<ChatMessageInput>(chatMessageSchema)) body: ChatMessageInput,
  ) {
    if (!limiter.allow(`agent:${agentId}`)) throw tooMany();
    return { chat: await this.chat.agentSend(agentId, id, body.body) };
  }
}
