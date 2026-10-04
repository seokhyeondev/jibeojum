import { Module } from "@nestjs/common";
import { TransitModule } from "../transit/transit.module.js";
import { AreaRecommendationsService } from "./area-recommendations.service.js";

@Module({
  imports: [TransitModule],
  providers: [AreaRecommendationsService],
  exports: [AreaRecommendationsService],
})
export class AreasModule {}
