import { Module } from "@nestjs/common";
import { UserAuthController } from "./user-auth.controller.js";
import { UserAuthService } from "./user-auth.service.js";

@Module({
  controllers: [UserAuthController],
  providers: [UserAuthService],
})
export class UserAuthModule {}
