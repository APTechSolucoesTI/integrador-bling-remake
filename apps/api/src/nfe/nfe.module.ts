import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { NfeController } from "./nfe.controller.js";
import { NfeService } from "./nfe.service.js";

@Module({
  imports: [AuthModule],
  controllers: [NfeController],
  providers: [NfeService],
})
export class NfeModule {}
