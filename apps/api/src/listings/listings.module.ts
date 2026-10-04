import { Module } from "@nestjs/common";
import { ListingsController } from "./listings.controller.js";
import { ProposalsService } from "./proposals.service.js";

@Module({
  controllers: [ListingsController],
  providers: [ProposalsService],
  exports: [ProposalsService],
})
export class ListingsModule {}
