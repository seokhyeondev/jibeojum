import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { AgentChatController, UserChatController } from "./chat.controller.js";
import { ChatService } from "./chat.service.js";

@Module({
  imports: [NotificationsModule],
  controllers: [UserChatController, AgentChatController],
  providers: [ChatService],
})
export class ChatModule {}
