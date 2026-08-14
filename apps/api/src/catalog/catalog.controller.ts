import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  goalListQuerySchema,
  globalSearchQuerySchema,
  goalCreateInputSchema,
  operationsJobRequestSchema,
  operationsSettingsUpdateSchema,
  peopleListQuerySchema,
  peopleMessagingUpdateSchema,
  productListQuerySchema,
  profitabilityQuerySchema,
  type GoalListResponse,
  type GlobalSearchResult,
  type GoalDetailResponse,
  type GoalResourcesResponse,
  type InvoiceFilterOptionsResponse,
  type OperationsOverview,
  type OauthAuthorizationResponse,
  type PeopleListResponse,
  type ProductListResponse,
  type ProfitabilityResponse,
  type QueuedJobResponse,
} from "@integrador/contracts";
import { PermissionsGuard, RequirePermissions } from "../auth/roles.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { CatalogService } from "./catalog.service.js";

@Controller("v1")
@UseGuards(SessionGuard, PermissionsGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("search")
  search(
    @Req() request: AuthenticatedRequest,
    @Query() rawQuery: Record<string, string | string[] | undefined>,
  ): Promise<GlobalSearchResult> {
    const result = globalSearchQuerySchema.safeParse(rawQuery);
    if (!result.success) throw new BadRequestException("Busca inválida");
    return this.catalog.globalSearch(request.auth, result.data.q);
  }

  @Get("products")
  @RequirePermissions("products:view")
  products(
    @Req() request: AuthenticatedRequest,
    @Query() rawQuery: Record<string, string | string[] | undefined>,
  ): Promise<ProductListResponse> {
    const result = productListQuerySchema.safeParse(rawQuery);
    if (!result.success) {
      throw new BadRequestException("Filtros de produtos inválidos");
    }
    return this.catalog.products(request.auth, result.data);
  }

  @Get("people")
  @RequirePermissions("people:view")
  people(
    @Req() request: AuthenticatedRequest,
    @Query() rawQuery: Record<string, string | string[] | undefined>,
  ): Promise<PeopleListResponse> {
    const result = peopleListQuerySchema.safeParse(rawQuery);
    if (!result.success) {
      throw new BadRequestException("Filtros de pessoas inválidos");
    }
    return this.catalog.people(request.auth, result.data);
  }

  @Patch("people/:id/messaging")
  @RequirePermissions("people:manage")
  async updatePeopleMessaging(
    @Req() request: AuthenticatedRequest,
    @Param("id") rawId: string,
    @Body() body: unknown,
  ): Promise<void> {
    const id = Number(rawId);
    const result = peopleMessagingUpdateSchema.safeParse(body);
    if (!Number.isInteger(id) || id <= 0 || !result.success)
      throw new BadRequestException("Preferência de comunicação inválida");
    await this.catalog.updatePeopleMessaging(
      request.auth,
      id,
      result.data.disabled,
    );
  }

  @Get("goals")
  @RequirePermissions("goals:view")
  goals(
    @Req() request: AuthenticatedRequest,
    @Query() rawQuery: Record<string, string | string[] | undefined>,
  ): Promise<GoalListResponse> {
    const result = goalListQuerySchema.safeParse(rawQuery);
    if (!result.success) {
      throw new BadRequestException("Filtros de metas inválidos");
    }
    return this.catalog.goals(request.auth, result.data);
  }

  @Get("goals/resources")
  @RequirePermissions("goals:view")
  goalResources(
    @Req() request: AuthenticatedRequest,
  ): Promise<GoalResourcesResponse> {
    return this.catalog.goalResources(request.auth);
  }

  @Get("goals/:id")
  @RequirePermissions("goals:view")
  goalDetail(
    @Req() request: AuthenticatedRequest,
    @Param("id") rawId: string,
  ): Promise<GoalDetailResponse> {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0)
      throw new BadRequestException("Meta inválida");
    return this.catalog.goalDetail(request.auth, id);
  }

  @Post("goals")
  @RequirePermissions("goals:manage")
  createGoal(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<GoalListResponse> {
    const result = goalCreateInputSchema.safeParse(body);
    if (!result.success)
      throw new BadRequestException("Dados da meta inválidos");
    return this.catalog.createGoal(request.auth, result.data);
  }

  @Patch("goals/:id")
  @RequirePermissions("goals:manage")
  updateGoal(
    @Req() request: AuthenticatedRequest,
    @Param("id") rawId: string,
    @Body() body: unknown,
  ): Promise<GoalListResponse> {
    const id = Number(rawId);
    const result = goalCreateInputSchema.safeParse(body);
    if (!Number.isInteger(id) || id <= 0 || !result.success)
      throw new BadRequestException("Dados da meta inválidos");
    return this.catalog.updateGoal(request.auth, id, result.data);
  }

  @Post("goals/:id/finalize")
  @RequirePermissions("goals:manage")
  finalizeGoal(
    @Req() request: AuthenticatedRequest,
    @Param("id") rawId: string,
  ): Promise<GoalListResponse> {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0)
      throw new BadRequestException("Meta inválida");
    return this.catalog.finalizeGoal(request.auth, id);
  }

  @Post("goals/:id/cancel")
  @RequirePermissions("goals:manage")
  cancelGoal(
    @Req() request: AuthenticatedRequest,
    @Param("id") rawId: string,
  ): Promise<GoalListResponse> {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0)
      throw new BadRequestException("Meta inválida");
    return this.catalog.cancelGoal(request.auth, id);
  }

  @Get("operations")
  @RequirePermissions("operations:view")
  operations(
    @Req() request: AuthenticatedRequest,
  ): Promise<OperationsOverview> {
    return this.catalog.operations(request.auth);
  }

  @Post("operations/jobs")
  @RequirePermissions("operations:manage")
  enqueueOperation(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<QueuedJobResponse> {
    const result = operationsJobRequestSchema.safeParse(body);
    if (!result.success)
      throw new BadRequestException("Solicitação operacional inválida");
    return this.catalog.enqueueOperation(request.auth, result.data);
  }

  @Patch("operations/settings")
  @RequirePermissions("operations:manage")
  updateOperationsSettings(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<OperationsOverview> {
    const result = operationsSettingsUpdateSchema.safeParse(body);
    if (!result.success)
      throw new BadRequestException("Configuração operacional inválida");
    return this.catalog.updateOperationsSettings(request.auth, result.data);
  }

  @Get("operations/authorization/:kind")
  @RequirePermissions("integrations:manage")
  authorization(
    @Req() request: AuthenticatedRequest,
    @Param("kind") kind: string,
  ): Promise<OauthAuthorizationResponse> {
    if (kind !== "bling" && kind !== "mercado_livre")
      throw new BadRequestException("Integração inválida");
    return this.catalog.authorization(request.auth, kind);
  }

  @Get("finance/profitability")
  @RequirePermissions("finance:view")
  profitability(
    @Req() request: AuthenticatedRequest,
    @Query() rawQuery: Record<string, string | string[] | undefined>,
  ): Promise<ProfitabilityResponse> {
    const result = profitabilityQuerySchema.safeParse(rawQuery);
    if (!result.success) {
      throw new BadRequestException("Filtros financeiros inválidos");
    }
    return this.catalog.profitability(request.auth, result.data);
  }

  @Get("finance/filter-options")
  @RequirePermissions("finance:view")
  financeFilterOptions(
    @Req() request: AuthenticatedRequest,
  ): Promise<InvoiceFilterOptionsResponse> {
    return this.catalog.financeFilterOptions(request.auth);
  }
}
