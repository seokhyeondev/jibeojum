import { Body, Controller, Delete, Get, HttpCode, Param, Post, Res, UseGuards } from "@nestjs/common";
import {
  agentListingInputSchema,
  agentLoginSchema,
  agentSignupSchema,
  type AgentListingInput,
  type AgentSignupInput,
} from "@zipazum/shared";
import type { Response } from "express";
import type { z } from "zod";
import { AGENT_COOKIE, AgentGuard, CurrentAgentId, setAgentCookie } from "../auth/guards.js";
import { UuidParamPipe } from "../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AgentService } from "./agent.service.js";

type LoginBody = z.infer<typeof agentLoginSchema>;

/** 공인중개사 웹 API. 아이디·비밀번호로 로그인한다 */
@Controller("agent")
export class AgentController {
  constructor(private readonly agents: AgentService) {}

  /** 직접 가입 (아이디·비밀번호·이름·번호·사진). 가입하면 바로 로그인된다 */
  @Post("signup")
  async signup(@Body(new ZodValidationPipe<AgentSignupInput>(agentSignupSchema)) body: AgentSignupInput, @Res({ passthrough: true }) res: Response) {
    const agentId = await this.agents.signup(body);
    setAgentCookie(res, agentId);
    return { agent: await this.agents.me(agentId) };
  }

  @Post("session")
  @HttpCode(200)
  async login(@Body(new ZodValidationPipe<LoginBody>(agentLoginSchema)) body: LoginBody, @Res({ passthrough: true }) res: Response) {
    const agentId = await this.agents.login(body.loginId, body.password);
    setAgentCookie(res, agentId);
    return { agent: await this.agents.me(agentId) };
  }

  @Delete("session")
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AGENT_COOKIE, { path: "/" });
    return { ok: true };
  }

  @Get("me")
  @UseGuards(AgentGuard)
  async me(@CurrentAgentId() agentId: string) {
    return { agent: await this.agents.me(agentId) };
  }

  /** 나에게 배정된 요청 */
  @Get("assignments")
  @UseGuards(AgentGuard)
  async assignments(@CurrentAgentId() agentId: string) {
    return { assignments: await this.agents.assignments(agentId) };
  }

  @Get("assignments/:id")
  @UseGuards(AgentGuard)
  async assignment(@CurrentAgentId() agentId: string, @Param("id", UuidParamPipe) id: string) {
    return { assignment: await this.agents.assignment(agentId, id) };
  }

  /** 매물 등록 → 사용자에게 알림 */
  @Post("assignments/:id/listings")
  @UseGuards(AgentGuard)
  async register(
    @CurrentAgentId() agentId: string,
    @Param("id", UuidParamPipe) id: string,
    @Body(new ZodValidationPipe<AgentListingInput>(agentListingInputSchema)) body: AgentListingInput,
  ) {
    return { listing: await this.agents.registerListing(agentId, id, body) };
  }
}
