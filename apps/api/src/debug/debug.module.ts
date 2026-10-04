import { Module } from "@nestjs/common";
import { AreasModule } from "../areas/areas.module.js";
import { DebugController } from "./debug.controller.js";

@Module({
  imports: [AreasModule],
  controllers: [DebugController],
})
export class DebugModule {}
