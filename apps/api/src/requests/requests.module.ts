import { Module } from "@nestjs/common";
import { AreasModule } from "../areas/areas.module.js";
import { ListingsModule } from "../listings/listings.module.js";
import { RequestsController } from "./requests.controller.js";
import { RequestsService } from "./requests.service.js";

@Module({
  imports: [ListingsModule, AreasModule],
  controllers: [RequestsController],
  providers: [RequestsService],
})
export class RequestsModule {}
