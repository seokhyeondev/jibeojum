import { Body, Controller, Get, HttpCode, Param, Post, Req } from "@nestjs/common";
import { listingReactionSchema, listingReportSchema, type ListingReaction, type ListingReportInput } from "@zipazum/shared";
import type { Request } from "express";
import { ApiException, notFound } from "../common/api-exception.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { UuidParamPipe } from "../common/uuid-param.pipe.js";
import { SessionService } from "../session/session.service.js";
import { ProposalsService } from "./proposals.service.js";

@Controller("listings")
export class ListingsController {
  constructor(
    private readonly proposals: ProposalsService,
    private readonly session: SessionService,
  ) {}

  /** 매물 상세. 내 요청에 제안된 매물만 볼 수 있다. */
  @Get(":id")
  async get(@Param("id", UuidParamPipe) id: string, @Req() req: Request) {
    const user = await this.session.getUser(req);
    const listing = user ? await this.proposals.findForUser(user.id, id) : null;
    if (!listing) throw notFound();
    // 사용자가 제안을 처음 연 시각을 남긴다 (응답은 기다리지 않는다)
    if (user) void this.proposals.markReaction(user.id, id, "view").catch(() => undefined);
    return { listing };
  }

  /** 찜·문의 같은 사용자 반응 (처음 한 번만 기록) */
  @Post(":id/reactions")
  @HttpCode(204)
  async react(
    @Param("id", UuidParamPipe) id: string,
    @Body(new ZodValidationPipe<{ type: ListingReaction }>(listingReactionSchema)) body: { type: ListingReaction },
    @Req() req: Request,
  ) {
    const user = await this.session.getUser(req);
    if (user) await this.proposals.markReaction(user.id, id, body.type);
  }

  /** 매물 신고 (이미 거래됨·정보 다름·허위) */
  @Post(":id/report")
  @HttpCode(200)
  async report(
    @Param("id", UuidParamPipe) id: string,
    @Body(new ZodValidationPipe<ListingReportInput>(listingReportSchema)) body: ListingReportInput,
    @Req() req: Request,
  ) {
    const user = await this.session.getUser(req);
    if (!user?.kakaoId) throw new ApiException(401, "unauthorized", "로그인한 뒤 신고할 수 있어요.");
    if (!(await this.proposals.report(user.id, id, body))) throw notFound();
    return { ok: true };
  }
}
