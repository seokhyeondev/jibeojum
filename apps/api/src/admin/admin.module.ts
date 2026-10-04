import { Module } from "@nestjs/common";
import { AreasModule } from "../areas/areas.module.js";
import { ListingsModule } from "../listings/listings.module.js";
import { AdminController } from "./admin.controller.js";
import { AdminService } from "./admin.service.js";
import { BrokerSearchService } from "./broker-search.service.js";
import { OutreachService } from "./outreach.service.js";

@Module({
  imports: [ListingsModule, AreasModule],
  controllers: [AdminController],
  providers: [AdminService, BrokerSearchService, OutreachService],
})
export class AdminModule {}
