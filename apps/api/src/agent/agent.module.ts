import { Module } from "@nestjs/common";
import { ListingsModule } from "../listings/listings.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { TransitModule } from "../transit/transit.module.js";
import { AgentController } from "./agent.controller.js";
import { AgentService } from "./agent.service.js";

@Module({
  imports: [ListingsModule, NotificationsModule, TransitModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
