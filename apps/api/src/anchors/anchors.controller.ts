import { Controller, Get, Param, Query } from "@nestjs/common";
import { notFound } from "../common/api-exception.js";
import { UuidParamPipe } from "../common/uuid-param.pipe.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AnchorsService, anchorQuerySchema, type AnchorQuery } from "./anchors.service.js";

@Controller("residential-anchors")
export class AnchorsController {
  constructor(private readonly anchors: AnchorsService) {}

  /**
   * 출근지 주변(또는 전체) 주거 앵커 목록. 아직 통근시간은 계산하지 않는다.
   * ?latitude&longitude&radiusKm&limit&minScore&housingTypes=officetel,multifamily,apartment,detached
   */
  @Get()
  async list(@Query(new ZodValidationPipe<AnchorQuery>(anchorQuerySchema)) query: AnchorQuery) {
    return { anchors: await this.anchors.list(query) };
  }

  /** 앵커 상세: 유형별 통계, 동 단위 시세, 지도용 경계(GeoJSON) */
  @Get(":id")
  async detail(@Param("id", UuidParamPipe) id: string) {
    const anchor = await this.anchors.detail(id);
    if (!anchor) throw notFound();
    return { anchor };
  }
}
