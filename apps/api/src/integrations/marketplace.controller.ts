import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { MarketplaceFeeResponse } from "@integrador/contracts";
import { RequireRoles, RolesGuard } from "../auth/roles.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { MarketplaceService } from "./marketplace.service.js";

@Controller("v1/integrations/mercado-livre")
@UseGuards(SessionGuard, RolesGuard)
@RequireRoles("owner", "admin", "operator", "viewer")
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  @Get("orders/:id/fees")
  fees(
    @Req() request: AuthenticatedRequest,
    @Param("id") orderId: string,
  ): Promise<MarketplaceFeeResponse> {
    if (!/^\d+$/.test(orderId))
      throw new BadRequestException("Order do Mercado Livre inválida");
    return this.marketplace.orderFees(request.auth, orderId);
  }
}
