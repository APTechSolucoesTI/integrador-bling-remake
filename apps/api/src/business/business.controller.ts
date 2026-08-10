import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { fixedCostInputSchema, type BusinessOverviewResponse } from "@integrador/contracts";
import { RequireRoles, RolesGuard } from "../auth/roles.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { BusinessService } from "./business.service.js";

@Controller("v1/business")
@UseGuards(SessionGuard, RolesGuard)
@RequireRoles("owner", "admin", "operator", "viewer")
export class BusinessController {
  constructor(private readonly business: BusinessService) {}

  @Get("overview")
  overview(@Req() request: AuthenticatedRequest): Promise<BusinessOverviewResponse> {
    return this.business.overview(request.auth);
  }

  @Post("fixed-costs")
  @RequireRoles("owner", "admin")
  createFixedCost(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<BusinessOverviewResponse> {
    const input = fixedCostInputSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Dados do custo fixo inválidos");
    return this.business.saveFixedCost(request.auth, null, input.data);
  }

  @Patch("fixed-costs/:id")
  @RequireRoles("owner", "admin")
  updateFixedCost(@Req() request: AuthenticatedRequest, @Param("id") rawId: string, @Body() body: unknown): Promise<BusinessOverviewResponse> {
    const id = Number(rawId);
    const input = fixedCostInputSchema.safeParse(body);
    if (!Number.isInteger(id) || id <= 0 || !input.success) throw new BadRequestException("Alteração de custo fixo inválida");
    return this.business.saveFixedCost(request.auth, id, input.data);
  }
}
