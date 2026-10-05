import { Module } from "@nestjs/common";
import { ListingRouteService } from "./listing-route.service.js";
import { ListingsController } from "./listings.controller.js";
import { ProposalsService } from "./proposals.service.js";

@Module({
  controllers: [ListingsController],
  providers: [ProposalsService, ListingRouteService],
  exports: [ProposalsService],
})
export class ListingsModule {}
