import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  dashboardExecutiveQuerySchema,
  dashboardInvoiceReportQuerySchema,
  type DashboardExecutive,
  type DashboardInvoiceReport,
  type DashboardSummary,
} from "@integrador/contracts";
import { PermissionsGuard, RequirePermissions } from "../auth/roles.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { DashboardService } from "./dashboard.service.js";

@Controller("v1/dashboard")
@UseGuards(SessionGuard, PermissionsGuard)
@RequirePermissions("dashboard:view")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("executive")
  executive(
    @Req() request: AuthenticatedRequest,
    @Query() rawQuery: Record<string, string | undefined>,
  ): Promise<DashboardExecutive> {
    const parsed = dashboardExecutiveQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException("Filtros inválidos");
    return this.dashboard.executive(request.auth, parsed.data);
  }

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

  @Get("invoices")
  invoices(
    @Req() request: AuthenticatedRequest,
    @Query() rawQuery: Record<string, string | undefined>,
  ): Promise<DashboardInvoiceReport> {
    const parsed = dashboardInvoiceReportQuerySchema.safeParse(rawQuery);
    if (!parsed.success)
      throw new BadRequestException("Filtros do relatório inválidos");
    return this.dashboard.invoices(request.auth, parsed.data);
  }
}
