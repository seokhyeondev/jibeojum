import { Body, Controller, Get, HttpCode, HttpStatus, Logger, Param, Patch, Post, Req, Res } from "@nestjs/common";
import { createRequestBodySchema, requestInputSchema, type RequestInput } from "@zipazum/shared";
import type { Request, Response } from "express";
import { AreaRecommendationsService } from "../areas/area-recommendations.service.js";
import { ApiException, notFound } from "../common/api-exception.js";
import { UuidParamPipe } from "../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { ProposalsService } from "../listings/proposals.service.js";
import { SessionService } from "../session/session.service.js";
import { toHousingRequest } from "./request-mapper.js";
import { RequestsService } from "./requests.service.js";

type CreateBody = RequestInput & { clientKey: string };

@Controller("requests")
export class RequestsController {
  private readonly logger = new Logger("Requests");

  constructor(
    private readonly requests: RequestsService,
    private readonly proposals: ProposalsService,
    private readonly session: SessionService,
    private readonly areas: AreaRecommendationsService,
  ) {}

  /** 내 요청 목록 */
  @Get()
  async list(@Req() req: Request) {
    const user = await this.session.getUser(req);
    return { requests: user ? await this.requests.listOwn(user.id) : [] };
  }

  /** 매물 요청 제출. 카카오로 로그인해야 한다. 같은 clientKey로 다시 보내면 기존 요청을 돌려준다. */
  @Post()
  async create(
    @Body(new ZodValidationPipe<CreateBody>(createRequestBodySchema)) body: CreateBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.session.getUser(req);
    if (!user?.kakaoId) throw new ApiException(401, "unauthorized", "카카오로 로그인한 뒤 요청을 보낼 수 있어요.");
    const { clientKey, ...input } = body;
    const result = await this.requests.create(user.id, clientKey, input);
    if (result.created) this.scheduleAreas(result.request.id);
    res.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);
    return { request: result.request };
  }

  /** 요청 상세와 진행 상태. 본인 요청이 아니면 없는 것처럼 응답한다. */
  @Get(":id")
  async get(@Param("id", UuidParamPipe) id: string, @Req() req: Request) {
    const row = await this.findOwnOrThrow(req, id);
    return { request: toHousingRequest(row) };
  }

  /** 제출한 조건 수정. 종료된 요청은 고칠 수 없다. */
  @Patch(":id")
  async update(
    @Param("id", UuidParamPipe) id: string,
    @Body(new ZodValidationPipe<RequestInput>(requestInputSchema)) input: RequestInput,
    @Req() req: Request,
  ) {
    const row = await this.findOwnOrThrow(req, id);
    if (row.status === "closed") throw new ApiException(409, "conflict", "종료된 요청은 수정할 수 없어요.");
    const updated = await this.requests.update(id, input);
    this.scheduleAreas(id);
    return { request: updated };
  }

  /** 요청 취소. 이미 취소된 요청이면 그대로 돌려준다 */
  @Post(":id/cancel")
  @HttpCode(200)
  async cancel(@Param("id", UuidParamPipe) id: string, @Req() req: Request) {
    const row = await this.findOwnOrThrow(req, id);
    if (row.status === "closed") return { request: toHousingRequest(row) };
    return { request: await this.requests.cancel(id) };
  }

  /** 요청에 도착한 매물 제안 목록 */
  @Get(":id/proposals")
  async listProposals(@Param("id", UuidParamPipe) id: string, @Req() req: Request) {
    const row = await this.findOwnOrThrow(req, id);
    return { proposals: await this.proposals.listForRequest(row.userId, id) };
  }

  /** 추천 동네 계산은 응답을 기다리게 하지 않고, 실패해도 요청 처리에는 영향을 주지 않는다 */
  private scheduleAreas(requestId: string) {
    this.areas.scheduleForRequest(requestId).catch((error: unknown) => {
      this.logger.warn(`area schedule failed for ${requestId}: ${error instanceof Error ? error.message : error}`);
    });
  }

  private async findOwnOrThrow(req: Request, id: string) {
    const user = await this.session.getUser(req);
    const row = user ? await this.requests.findOwn(user.id, id) : null;
    if (!row) throw notFound();
    return row;
  }
}
