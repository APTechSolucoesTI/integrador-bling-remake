import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  fixedCostInputSchema,
  fixedCostDuplicateInputSchema,
  type FixedCostDuplicateResponse,
  ncmCreditInputSchema,
  sectorInputSchema,
  type BusinessOverviewResponse,
} from "@integrador/contracts";
import {
  PermissionsGuard,
  RequireAnyPermission,
  RequirePermissions,
} from "../auth/roles.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { BusinessService } from "./business.service.js";

@Controller("v1/business")
@UseGuards(SessionGuard, PermissionsGuard)
export class BusinessController {
  constructor(private readonly business: BusinessService) {}

  @Get("overview")
  @RequireAnyPermission(
    "documents:view",
    "commercial:view",
    "costs:view",
    "tax:view",
  )
  overview(
    @Req() request: AuthenticatedRequest,
  ): Promise<BusinessOverviewResponse> {
    return this.business.overview(request.auth);
  }

  @Post("sectors")
  @RequirePermissions("commercial:manage")
  createSector(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<BusinessOverviewResponse> {
    const input = sectorInputSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Setor inválido");
    return this.business.saveSector(request.auth, null, input.data);
  }

  @Patch("sectors/:id")
  @RequirePermissions("commercial:manage")
  updateSector(
    @Req() request: AuthenticatedRequest,
    @Param("id") rawId: string,
    @Body() body: unknown,
  ): Promise<BusinessOverviewResponse> {
    const id = Number(rawId);
    const input = sectorInputSchema.safeParse(body);
    if (!Number.isInteger(id) || id <= 0 || !input.success)
      throw new BadRequestException("Setor inválido");
    return this.business.saveSector(request.auth, id, input.data);
  }

  @Delete("sectors/:id")
  @RequirePermissions("commercial:manage")
  deleteSector(
    @Req() request: AuthenticatedRequest,
    @Param("id") rawId: string,
  ): Promise<BusinessOverviewResponse> {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0)
      throw new BadRequestException("Setor inválido");
    return this.business.deleteSector(request.auth, id);
  }

  @Post("fixed-costs")
  @RequirePermissions("costs:manage")
  createFixedCost(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<BusinessOverviewResponse> {
    const input = fixedCostInputSchema.safeParse(body);
    if (!input.success)
      throw new BadRequestException("Dados do custo fixo inválidos");
    return this.business.saveFixedCost(request.auth, null, input.data);
  }

  @Patch("fixed-costs/:id")
  @RequirePermissions("costs:manage")
  updateFixedCost(
    @Req() request: AuthenticatedRequest,
    @Param("id") rawId: string,
    @Body() body: unknown,
  ): Promise<BusinessOverviewResponse> {
    const id = Number(rawId);
    const input = fixedCostInputSchema.safeParse(body);
    if (!Number.isInteger(id) || id <= 0 || !input.success)
      throw new BadRequestException("Alteração de custo fixo inválida");
    return this.business.saveFixedCost(request.auth, id, input.data);
  }

  @Delete("fixed-costs/:id")
  @RequirePermissions("costs:manage")
  deleteFixedCost(
    @Req() request: AuthenticatedRequest,
    @Param("id") rawId: string,
  ): Promise<BusinessOverviewResponse> {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0)
      throw new BadRequestException("Custo fixo inválido");
    return this.business.deleteFixedCost(request.auth, id);
  }

  @Post("fixed-costs/:id/duplicate")
  @RequirePermissions("costs:manage")
  duplicateFixedCost(
    @Req() request: AuthenticatedRequest,
    @Param("id") rawId: string,
    @Body() body: unknown,
  ): Promise<FixedCostDuplicateResponse> {
    const id = Number(rawId);
    const input = fixedCostDuplicateInputSchema.safeParse(body);
    if (!Number.isInteger(id) || id <= 0 || !input.success)
      throw new BadRequestException("Destinos da duplicação inválidos");
    return this.business.duplicateFixedCost(
      request.auth,
      id,
      input.data.targetTenantIds,
    );
  }

  @Post("ncm-credits")
  @RequirePermissions("tax:manage")
  createNcmCredit(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<BusinessOverviewResponse> {
    const input = ncmCreditInputSchema.safeParse(body);
    if (!input.success)
      throw new BadRequestException("Crédito de NCM inválido");
    return this.business.saveNcmCredit(request.auth, null, input.data);
  }

  @Patch("ncm-credits/:id")
  @RequirePermissions("tax:manage")
  updateNcmCredit(
    @Req() request: AuthenticatedRequest,
    @Param("id") rawId: string,
    @Body() body: unknown,
  ): Promise<BusinessOverviewResponse> {
    const id = Number(rawId);
    const input = ncmCreditInputSchema.safeParse(body);
    if (!Number.isInteger(id) || id <= 0 || !input.success)
      throw new BadRequestException("Crédito de NCM inválido");
    return this.business.saveNcmCredit(request.auth, id, input.data);
  }

  @Delete("ncm-credits/:id")
  @RequirePermissions("tax:manage")
  deleteNcmCredit(
    @Req() request: AuthenticatedRequest,
    @Param("id") rawId: string,
  ): Promise<BusinessOverviewResponse> {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0)
      throw new BadRequestException("Crédito de NCM inválido");
    return this.business.deleteNcmCredit(request.auth, id);
  }
}
