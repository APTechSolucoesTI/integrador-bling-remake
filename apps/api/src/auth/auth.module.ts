import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { PermissionsGuard } from "./roles.guard.js";
import { SessionGuard } from "./session.guard.js";

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionGuard, PermissionsGuard],
  exports: [AuthService, SessionGuard, PermissionsGuard],
})
export class AuthModule {}
