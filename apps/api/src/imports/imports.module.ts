import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { ImportsController } from "./imports.controller.js";
import { ImportsService } from "./imports.service.js";

@Module({
  imports: [AuthModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
