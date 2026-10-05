import { Module } from "@nestjs/common";
import { DemoModule } from "../demo/demo.module.js";
import { TransitModule } from "../transit/transit.module.js";
import { AreaRecommendationsService } from "./area-recommendations.service.js";

@Module({
  imports: [TransitModule, DemoModule],
  providers: [AreaRecommendationsService],
  exports: [AreaRecommendationsService],
})
export class AreasModule {}
