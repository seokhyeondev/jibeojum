import { Module } from "@nestjs/common";
import { AnchorsController } from "./anchors.controller.js";
import { AnchorsService } from "./anchors.service.js";

@Module({
  controllers: [AnchorsController],
  providers: [AnchorsService],
  exports: [AnchorsService],
})
export class AnchorsModule {}
