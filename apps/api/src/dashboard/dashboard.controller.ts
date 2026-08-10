import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { DashboardSummary } from "@integrador/contracts";
import { RequireRoles, RolesGuard } from "../auth/roles.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { DashboardService } from "./dashboard.service.js";

@Controller("v1/dashboard")
@UseGuards(SessionGuard, RolesGuard)
@RequireRoles("owner", "admin", "operator", "viewer")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("summary")
  summary(
    @Req() request: AuthenticatedRequest,
    @Query("months") rawMonths?: string,
  ): Promise<DashboardSummary> {
    const months = rawMonths === undefined ? 6 : Number(rawMonths);
    if (!Number.isInteger(months)) {
      throw new BadRequestException("Período inválido");
    }
    return this.dashboard.summary(request.auth, months);
  }
}
