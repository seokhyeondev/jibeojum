import { Controller, Get, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { ApiException } from "../common/api-exception.js";
import { PlacesService } from "./places.service.js";
import { RateLimiter } from "./rate-limit.js";

/** 사용자 화면 출근지 검색. 외부 지도 API 호출을 아끼려고 IP당 분당 30회로 제한한다. */
@Controller("places")
export class PlacesController {
  private readonly limiter = new RateLimiter(30, 60_000);

  constructor(private readonly places: PlacesService) {}

  @Get()
  async search(@Query("query") query: string | undefined, @Req() req: Request) {
    const q = query?.trim() ?? "";
    if (q.length < 2 || q.length > 50) throw new ApiException(400, "invalid_input", "검색어는 2~50자로 입력해주세요");
    // 프록시 뒤에서는 main.ts의 TRUST_PROXY_HOPS로 req.ip가 사용자 IP가 된다 (X-Forwarded-For를 직접 읽으면 위조할 수 있다)
    const ip = req.ip ?? "unknown";
    if (!this.limiter.allow(ip)) throw new ApiException(429, "invalid_input", "잠시 후 다시 검색해주세요");
    return { places: await this.places.find(q) };
  }
}
