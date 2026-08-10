import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  nfeListQuerySchema,
  type NfeDetailResponse,
  type NfeListResponse,
  type NfeSyncResponse,
} from "@integrador/contracts";
import { RequireRoles, RolesGuard } from "../auth/roles.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { NfeService } from "./nfe.service.js";

@Controller("v1/nfe")
@UseGuards(SessionGuard, RolesGuard)
@RequireRoles("owner", "admin", "operator", "viewer")
export class NfeController {
  constructor(private readonly nfe: NfeService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query() rawQuery: Record<string, string | string[] | undefined>,
  ): Promise<NfeListResponse> {
    const result = nfeListQuerySchema.safeParse(rawQuery);
    if (!result.success) {
      throw new BadRequestException({
        message: "Filtros de NF-e inválidos",
        issues: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    return this.nfe.list(request.auth, result.data);
  }

  @Get(":id")
  detail(
    @Req() request: AuthenticatedRequest,
    @Param("id") rawId: string,
  ): Promise<NfeDetailResponse> {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0)
      throw new BadRequestException("Identificador de NF-e inválido");
    return this.nfe.detail(request.auth, id);
  }

  @Post(":id/sync")
  @RequireRoles("owner", "admin", "operator")
  syncDetails(
    @Req() request: AuthenticatedRequest,
    @Param("id") rawId: string,
  ): Promise<NfeSyncResponse> {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0)
      throw new BadRequestException("Identificador de NF-e inválido");
    return this.nfe.enqueueDetails(request.auth, id);
  }
}
