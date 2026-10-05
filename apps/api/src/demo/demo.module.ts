import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { DemoProposalsService } from "./demo-proposals.service.js";

@Module({
  imports: [NotificationsModule],
  providers: [DemoProposalsService],
  exports: [DemoProposalsService],
})
export class DemoModule {}
