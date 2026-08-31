import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  marketplaceFeesQuerySchema,
  type MarketplaceFeeItemsResponse,
  type MarketplaceFeesResponse,
} from "@integrador/contracts";
import { PermissionsGuard, RequirePermissions } from "../auth/roles.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { MarketplaceFeesService } from "./marketplace-fees.service.js";

@Controller("v1/marketplace-fees")
@UseGuards(SessionGuard, PermissionsGuard)
@RequirePermissions("marketplace-fees:view")
export class MarketplaceFeesController {
  constructor(private readonly marketplaceFees: MarketplaceFeesService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query() rawQuery: Record<string, string | string[] | undefined>,
  ): Promise<MarketplaceFeesResponse> {
    const parsed = marketplaceFeesQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new BadRequestException("Filtros de taxas inválidos");
    }
    return this.marketplaceFees.list(request.auth, parsed.data);
  }

  @Get(":id/items")
  items(
    @Req() request: AuthenticatedRequest,
    @Param("id") rawId: string,
  ): Promise<MarketplaceFeeItemsResponse> {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException("NF-e inválida");
    }
    return this.marketplaceFees.items(request.auth, id);
  }
}
