import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  nfeBulkActionRequestSchema,
  nfeContactUpdateInputSchema,
  nfeItemNormalizationInputSchema,
  nfeListQuerySchema,
  type NfeBulkActionResponse,
  type NfeDetailResponse,
  type InvoiceFilterOptionsResponse,
  type NfeListResponse,
  type NfeSyncResponse,
} from "@integrador/contracts";
import { PermissionsGuard, RequirePermissions } from "../auth/roles.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { NfeService } from "./nfe.service.js";

@Controller("v1/nfe")
@UseGuards(SessionGuard, PermissionsGuard)
@RequirePermissions("nfe:view")
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

  @Get("filter-options")
  filterOptions(
    @Req() request: AuthenticatedRequest,
  ): Promise<InvoiceFilterOptionsResponse> {
    return this.nfe.filterOptions(request.auth);
  }

  @Get(":id")
  detail(
    @Req() request: AuthenticatedRequest,
    @Param("id") rawId: string,
  ): Promise<NfeDetailResponse> {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0)
      throw new BadRequestException("Identificador de NF-e inválido");
    return this.nfe.detail(request.auth, id, false);
  }

  @Get(":id/financial")
  @RequirePermissions("finance:view")
  financialDetail(
    @Req() request: AuthenticatedRequest,
    @Param("id") rawId: string,
  ): Promise<NfeDetailResponse> {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0)
      throw new BadRequestException("Identificador de NF-e inválido");
    return this.nfe.detail(request.auth, id, true);
  }

  @Post(":id/sync")
  @RequirePermissions("nfe:manage")
  syncDetails(
    @Req() request: AuthenticatedRequest,
    @Param("id") rawId: string,
  ): Promise<NfeSyncResponse> {
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0)
      throw new BadRequestException("Identificador de NF-e inválido");
    return this.nfe.enqueueDetails(request.auth, id);
  }

  @Patch(":id/contact")
  @RequirePermissions("nfe:manage")
  updateContact(
    @Req() request: AuthenticatedRequest,
    @Param("id") rawId: string,
    @Body() rawBody: unknown,
  ): Promise<NfeSyncResponse> {
    const id = Number(rawId);
    const input = nfeContactUpdateInputSchema.safeParse(rawBody);
    if (!Number.isInteger(id) || id <= 0 || !input.success)
      throw new BadRequestException(
        input.success
          ? "Identificador de NF-e inválido"
          : (input.error.issues[0]?.message ?? "Contato inválido"),
      );
    return this.nfe.enqueueContactUpdate(request.auth, id, input.data);
  }

  @Post(":id/items/:itemId/normalize")
  @RequirePermissions("nfe:manage")
  normalizeItem(
    @Req() request: AuthenticatedRequest,
    @Param("id") rawId: string,
    @Param("itemId") rawItemId: string,
    @Body() rawBody: unknown,
  ): Promise<NfeSyncResponse> {
    const id = Number(rawId);
    const itemId = Number(rawItemId);
    const input = nfeItemNormalizationInputSchema.safeParse(rawBody);
    if (
      !Number.isInteger(id) ||
      id <= 0 ||
      !Number.isInteger(itemId) ||
      itemId <= 0 ||
      !input.success
    )
      throw new BadRequestException("Vínculo de produto inválido");
    return this.nfe.normalizeItem(
      request.auth,
      id,
      itemId,
      input.data.productId,
    );
  }

  @Post("sync")
  @RequirePermissions("nfe:manage")
  syncSelected(
    @Req() request: AuthenticatedRequest,
    @Body() rawBody: unknown,
  ): Promise<NfeBulkActionResponse> {
    const result = nfeBulkActionRequestSchema.safeParse(rawBody);
    if (!result.success)
      throw new BadRequestException("Seleção de NF-e inválida");
    return this.nfe.enqueueBulkDetails(request.auth, result.data.ids);
  }

  @Post("send")
  @RequirePermissions("nfe:manage")
  sendSelected(
    @Req() request: AuthenticatedRequest,
    @Body() rawBody: unknown,
  ): Promise<NfeBulkActionResponse> {
    const result = nfeBulkActionRequestSchema.safeParse(rawBody);
    if (!result.success)
      throw new BadRequestException("Seleção de NF-e inválida");
    return this.nfe.enqueueBulkDelivery(request.auth, result.data.ids);
  }
}
