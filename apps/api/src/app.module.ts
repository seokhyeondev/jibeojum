import { Module } from "@nestjs/common";
import { AdminModule } from "./admin/admin.module.js";
import { AgentModule } from "./agent/agent.module.js";
import { AnchorsModule } from "./anchors/anchors.module.js";
import { DebugModule } from "./debug/debug.module.js";
import { HealthController } from "./health/health.controller.js";
import { ListingsModule } from "./listings/listings.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { UploadsModule } from "./uploads/uploads.module.js";
import { UserAuthModule } from "./auth/user-auth.module.js";
import { ChatModule } from "./chat/chat.module.js";
import { PlacesModule } from "./places/places.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { RequestsModule } from "./requests/requests.module.js";
import { SessionModule } from "./session/session.module.js";
import { TransitModule } from "./transit/transit.module.js";

@Module({
  imports: [PrismaModule, SessionModule, RequestsModule, ListingsModule, AnchorsModule, TransitModule, DebugModule, PlacesModule, AdminModule, AgentModule, NotificationsModule, UploadsModule, UserAuthModule, ChatModule],
  controllers: [HealthController],
})
export class AppModule {}
