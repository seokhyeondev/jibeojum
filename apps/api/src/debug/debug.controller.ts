import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { ApiException, notFound } from "../common/api-exception.js";
import { UuidParamPipe } from "../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AreaRecommendationsService } from "../areas/area-recommendations.service.js";
import { DebugGuard } from "./debug.guard.js";

const manwon = z.number().int().min(0).max(1_000_000).nullable();

/** 요청 스텝 2·3과 같은 조건. 비우면 조건 없이 통근시간만 본다 */
const criteriaSchema = z.object({
  housingTypes: z.array(z.enum(["studio", "officetel", "two_room", "apartment"])).max(4),
  transactionPreference: z.enum(["rent", "jeonse", "both"]),
  depositMax: manwon,
  monthlyRentMax: manwon,
  jeonseMax: manwon,
  budgetFlexibility: z.enum(["fixed", "negotiable", "consultation"]),
});

const computeSchema = z.object({
  label: z.string().trim().min(1).max(100).default("출근지"),
  latitude: z.number().min(33).max(39),
  longitude: z.number().min(124).max(132),
  maxCommuteMinutes: z.number().int().min(10).max(180),
  noTransferExtraMinutes: z.number().int().min(0).max(60).default(0),
  criteria: criteriaSchema.nullable().default(null),
});
type ComputeBody = z.infer<typeof computeSchema>;

/** 개발·운영 확인용. 실제 사용자 화면에서는 쓰지 않는다. */
@Controller("debug")
@UseGuards(DebugGuard)
export class DebugController {
  constructor(private readonly areas: AreaRecommendationsService) {}

  /** 출근지 검색 (역·회사·주소) */
  @Get("places")
  async places(@Query("query") query?: string) {
    const q = query?.trim();
    if (!q) throw new ApiException(400, "invalid_input", "query를 입력해주세요");
    return { places: await this.areas.searchPlaces(q) };
  }

  /** 좌표와 조건을 직접 넣어 추천 생활권 계산 (TMAP 호출, 캐시 사용). 조건에 맞는 곳만 돌려준다 */
  @Post("area-recommendations")
  async compute(@Body(new ZodValidationPipe<ComputeBody>(computeSchema)) body: ComputeBody) {
    const result = await this.areas.compute({
      destination: { label: body.label, latitude: body.latitude, longitude: body.longitude },
      maxCommuteMinutes: body.maxCommuteMinutes,
      noTransferExtraMinutes: body.noTransferExtraMinutes,
      criteria: body.criteria,
    });
    return { result };
  }

  /** 최근 요청과 추천 동네 계산 상태 (모든 사용자) */
  @Get("requests")
  async requests() {
    return { requests: await this.areas.listRecent() };
  }

  @Get("requests/:id/areas")
  async requestAreas(@Param("id", UuidParamPipe) id: string) {
    const recommendation = await this.areas.findForRequest(id);
    if (!recommendation) throw notFound();
    return { recommendation };
  }

  /** 다시 계산 (큐에 넣고 바로 돌아온다) */
  @Post("requests/:id/areas/recompute")
  async recompute(@Param("id", UuidParamPipe) id: string) {
    await this.areas.scheduleForRequest(id, { force: true });
    return { ok: true };
  }
}
