import { Module } from "@nestjs/common";
import { AreasModule } from "../areas/areas.module.js";
import { ListingsModule } from "../listings/listings.module.js";
import { AdminController } from "./admin.controller.js";
import { AdminService } from "./admin.service.js";
import { BrokerSearchService } from "./broker-search.service.js";

@Module({
  imports: [ListingsModule, AreasModule],
  controllers: [AdminController],
  providers: [AdminService, BrokerSearchService],
})
export class AdminModule {}
