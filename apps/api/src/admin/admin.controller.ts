import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import {
  adminCreateAgentSchema,
  brokerContactCreateSchema,
  brokerContactUpdateSchema,
  type AdminCreateAgentInput,
  type BrokerContactCreateInput,
  type BrokerContactUpdateInput,
} from "@zipazum/shared";
import { z } from "zod";
import { ADMIN_COOKIE, AdminGuard, setAdminCookie } from "../auth/guards.js";
import { safeEqual } from "../auth/signed-cookie.js";
import { AreaRecommendationsService } from "../areas/area-recommendations.service.js";
import { ApiException } from "../common/api-exception.js";
import { UuidParamPipe } from "../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminService } from "./admin.service.js";
import { BrokerSearchService } from "./broker-search.service.js";
import { OutreachService } from "./outreach.service.js";

const loginSchema = z.object({ password: z.string().min(1).max(200) });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .default(null)
    .transform((v) => v || null);


const statusSchema = z.object({ status: z.enum(["active", "inactive"]) });

const verifySchema = z
  .object({
    status: z.enum(["verified", "rejected"]),
    reason: z.string().trim().max(200, "반려 사유는 200자까지예요").nullable().default(null),
  })
  .refine((v) => v.status === "verified" || v.reason, { message: "반려 사유를 적어주세요", path: ["reason"] });
type VerifyBody = z.infer<typeof verifySchema>;

/** 한 생활권에 여러 공인중개사를 배정한다 */
const assignSchema = z.object({
  zoneKey: z.string().min(1).max(120),
  agentIds: z.array(z.string().uuid()).min(1).max(30),
  note: optionalText(300),
});

/** 내부 운영 웹 API. ADMIN_PASSWORD로 로그인한 운영자만 쓴다 */
@Controller("admin")
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly brokers: BrokerSearchService,
    private readonly outreach: OutreachService,
    private readonly areas: AreaRecommendationsService,
  ) {}

  @Post("session")
  @HttpCode(200)
  login(@Body(new ZodValidationPipe<z.infer<typeof loginSchema>>(loginSchema)) body: z.infer<typeof loginSchema>, @Res({ passthrough: true }) res: Response) {
    const password = process.env.ADMIN_PASSWORD;
    if (!password) throw new ApiException(403, "forbidden", "ADMIN_PASSWORD가 설정되지 않았어요.");
    if (!safeEqual(body.password, password)) throw new ApiException(401, "unauthorized", "비밀번호가 맞지 않아요.");
    setAdminCookie(res);
    return { ok: true };
  }

  @Delete("session")
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ADMIN_COOKIE, { path: "/" });
    return { ok: true };
  }

  @Get("session")
  @UseGuards(AdminGuard)
  me() {
    return { ok: true };
  }

  @Get("requests")
  @UseGuards(AdminGuard)
  async requests() {
    return { requests: await this.admin.listRequests() };
  }

  @Get("requests/:id")
  @UseGuards(AdminGuard)
  async request(@Param("id", UuidParamPipe) id: string) {
    return await this.admin.requestDetail(id);
  }

  @Post("requests/:id/areas/recompute")
  @UseGuards(AdminGuard)
  async recompute(@Param("id", UuidParamPipe) id: string) {
    await this.areas.scheduleForRequest(id, { force: true });
    return { ok: true };
  }

  @Post("requests/:id/assignments")
  @UseGuards(AdminGuard)
  async assign(@Param("id", UuidParamPipe) id: string, @Body(new ZodValidationPipe<z.infer<typeof assignSchema>>(assignSchema)) body: z.infer<typeof assignSchema>) {
    return { assignments: await this.admin.assign(id, body) };
  }

  /** zoneKey가 있으면 그 생활권에서만 빼고, 없으면 배정 전체를 지운다 */
  @Delete("assignments/:id")
  @UseGuards(AdminGuard)
  async unassign(@Param("id", UuidParamPipe) id: string, @Query("zoneKey") zoneKey?: string) {
    return { assignments: await this.admin.unassign(id, zoneKey?.slice(0, 120) || null) };
  }

  /** 생활권 근처 부동산 검색어와 네이버 지역 검색 결과 */
  @Get("brokers")
  @UseGuards(AdminGuard)
  async brokersNear(@Query("zoneKey") zoneKey?: string, @Query("requestId") requestId?: string) {
    if (!zoneKey) throw new ApiException(400, "invalid_input", "zoneKey가 필요해요");
    const request = requestId && /^[0-9a-f-]{36}$/i.test(requestId) ? requestId : null;
    return await this.brokers.forZone(zoneKey, request);
  }

  /** 등록증 확인 (승인·반려) */
  @Post("agents/:id/verify")
  @HttpCode(200)
  @UseGuards(AdminGuard)
  async verifyAgent(@Param("id", UuidParamPipe) id: string, @Body(new ZodValidationPipe<VerifyBody>(verifySchema)) body: VerifyBody) {
    await this.admin.verifyAgent(id, body.status, body.reason);
    return { ok: true };
  }

  /** 등록증 사진 보기 (5분짜리 주소) */
  @Get("agents/:id/license")
  @UseGuards(AdminGuard)
  async license(@Param("id", UuidParamPipe) id: string) {
    return { url: await this.admin.licenseUrl(id) };
  }

  /** 런칭 파트너 지정·해제 */
  @Post("agents/:id/launch-partner")
  @HttpCode(200)
  @UseGuards(AdminGuard)
  async launchPartner(@Param("id", UuidParamPipe) id: string, @Body(new ZodValidationPipe<{ on: boolean }>(z.object({ on: z.boolean() }))) body: { on: boolean }) {
    await this.admin.setLaunchPartner(id, body.on);
    return { ok: true };
  }

  /** 사용자 매물 신고 목록 */
  @Get("reports")
  @UseGuards(AdminGuard)
  async reports(@Query("status") status?: string) {
    const s = status === "confirmed" || status === "rejected" || status === "all" ? status : "open";
    return { reports: await this.admin.listReports(s) };
  }

  @Post("reports/:id/review")
  @HttpCode(200)
  @UseGuards(AdminGuard)
  async reviewReport(
    @Param("id", UuidParamPipe) id: string,
    @Body(new ZodValidationPipe<{ status: "confirmed" | "rejected" }>(z.object({ status: z.enum(["confirmed", "rejected"]) }))) body: { status: "confirmed" | "rejected" },
  ) {
    await this.admin.reviewReport(id, body.status);
    return { ok: true };
  }

  /** 부동산 연락 기록 남기기 (처음 보는 부동산이면 우리 목록에도 넣는다) */
  @Post("requests/:id/contacts")
  @UseGuards(AdminGuard)
  async recordContact(
    @Param("id", UuidParamPipe) id: string,
    @Body(new ZodValidationPipe<BrokerContactCreateInput>(brokerContactCreateSchema)) body: BrokerContactCreateInput,
  ) {
    return { contacts: await this.outreach.record(id, body) };
  }

  @Patch("contacts/:id")
  @UseGuards(AdminGuard)
  async updateContact(
    @Param("id", UuidParamPipe) id: string,
    @Body(new ZodValidationPipe<BrokerContactUpdateInput>(brokerContactUpdateSchema)) body: BrokerContactUpdateInput,
  ) {
    return { contacts: await this.outreach.update(id, body) };
  }

  @Delete("contacts/:id")
  @UseGuards(AdminGuard)
  async removeContact(@Param("id", UuidParamPipe) id: string) {
    return { contacts: await this.outreach.remove(id) };
  }

  /** 이 부동산에 보낼 초대 링크와 문구 */
  @Post("contacts/:id/invite")
  @UseGuards(AdminGuard)
  async invite(@Param("id", UuidParamPipe) id: string) {
    return { invite: await this.outreach.createInvite(id) };
  }

  @Get("agents")
  @UseGuards(AdminGuard)
  async agents() {
    return { agents: await this.admin.listAgents() };
  }

  /** 중개사 계정 만들기 (아이디·이름·사진·번호). 비밀번호를 비우면 임시 비밀번호를 돌려준다 */
  @Post("agents")
  @UseGuards(AdminGuard)
  async createAgent(@Body(new ZodValidationPipe<AdminCreateAgentInput>(adminCreateAgentSchema)) body: AdminCreateAgentInput) {
    return await this.admin.createAgent(body);
  }

  @Post("agents/:id/password-reset")
  @UseGuards(AdminGuard)
  async resetPassword(@Param("id", UuidParamPipe) id: string) {
    return await this.admin.resetPassword(id);
  }

  @Post("agents/:id/status")
  @UseGuards(AdminGuard)
  async setStatus(@Param("id", UuidParamPipe) id: string, @Body(new ZodValidationPipe<z.infer<typeof statusSchema>>(statusSchema)) body: z.infer<typeof statusSchema>) {
    return await this.admin.setAgentStatus(id, body.status);
  }
}
