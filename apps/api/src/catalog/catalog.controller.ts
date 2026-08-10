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
  goalCreateInputSchema,
  operationsJobRequestSchema,
  operationsSettingsUpdateSchema,
  peopleListQuerySchema,
  peopleMessagingUpdateSchema,
  productListQuerySchema,
  profitabilityQuerySchema,
  type GoalListResponse,
  type GoalResourcesResponse,
  type OperationsOverview,
  type OauthAuthorizationResponse,
  type PeopleListResponse,
  type ProductListResponse,
  type ProfitabilityResponse,
  type QueuedJobResponse,
} from "@integrador/contracts";
import { RequireRoles, RolesGuard } from "../auth/roles.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { CatalogService } from "./catalog.service.js";

@Controller("v1")
@UseGuards(SessionGuard, RolesGuard)
@RequireRoles("owner", "admin", "operator", "viewer")
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("products")
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
  @RequireRoles("owner", "admin", "operator")
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
  goalResources(
    @Req() request: AuthenticatedRequest,
  ): Promise<GoalResourcesResponse> {
    return this.catalog.goalResources(request.auth);
  }

  @Post("goals")
  @RequireRoles("owner", "admin")
  createGoal(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<GoalListResponse> {
    const result = goalCreateInputSchema.safeParse(body);
    if (!result.success)
      throw new BadRequestException("Dados da meta inválidos");
    return this.catalog.createGoal(request.auth, result.data);
  }

  @Post("goals/:id/finalize")
  @RequireRoles("owner", "admin")
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
  @RequireRoles("owner", "admin")
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
  operations(
    @Req() request: AuthenticatedRequest,
  ): Promise<OperationsOverview> {
    return this.catalog.operations(request.auth);
  }

  @Post("operations/jobs")
  @RequireRoles("owner", "admin", "operator")
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
  @RequireRoles("owner", "admin")
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
  @RequireRoles("owner", "admin")
  authorization(
    @Req() request: AuthenticatedRequest,
    @Param("kind") kind: string,
  ): Promise<OauthAuthorizationResponse> {
    if (kind !== "bling" && kind !== "mercado_livre")
      throw new BadRequestException("Integração inválida");
    return this.catalog.authorization(request.auth, kind);
  }

  @Get("finance/profitability")
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
}
