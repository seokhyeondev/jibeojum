import { Controller, Get, Param, Req } from "@nestjs/common";
import type { Request } from "express";
import { notFound } from "../common/api-exception.js";
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
    return { listing };
  }
}
