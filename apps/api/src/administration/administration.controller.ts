import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  adminCreateUserSchema,
  adminUpdateUserSchema,
  tenantSettingsUpdateSchema,
  organizationCreateSchema,
  type AdminUsersResponse,
  type TenantSettingsResponse,
  type OrganizationsResponse,
} from "@integrador/contracts";
import { z } from "zod";
import { RequireRoles, RolesGuard } from "../auth/roles.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { AdministrationService } from "./administration.service.js";

const userIdSchema = z.uuid();

@Controller("v1/administration")
@UseGuards(SessionGuard, RolesGuard)
export class AdministrationController {
  constructor(private readonly administration: AdministrationService) {}

  @Get("users")
  @RequireRoles("owner", "admin")
  users(@Req() request: AuthenticatedRequest): Promise<AdminUsersResponse> {
    return this.administration.users(request.auth);
  }

  @Post("users")
  @RequireRoles("owner", "admin")
  createUser(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<AdminUsersResponse> {
    const result = adminCreateUserSchema.safeParse(body);
    if (!result.success) throw new BadRequestException("Dados do usuário inválidos");
    return this.administration.createUser(request.auth, result.data);
  }

  @Patch("users/:userId")
  @RequireRoles("owner", "admin")
  updateUser(
    @Req() request: AuthenticatedRequest,
    @Param("userId") rawUserId: string,
    @Body() body: unknown,
  ): Promise<AdminUsersResponse> {
    const userId = userIdSchema.safeParse(rawUserId);
    const input = adminUpdateUserSchema.safeParse(body);
    if (!userId.success || !input.success)
      throw new BadRequestException("Alteração de usuário inválida");
    return this.administration.updateUser(request.auth, userId.data, input.data);
  }

  @Get("settings")
  settings(
    @Req() request: AuthenticatedRequest,
  ): Promise<TenantSettingsResponse> {
    return this.administration.settings(request.auth);
  }

  @Patch("settings")
  @RequireRoles("owner", "admin")
  updateSettings(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<TenantSettingsResponse> {
    const result = tenantSettingsUpdateSchema.safeParse(body);
    if (!result.success) throw new BadRequestException("Configurações inválidas");
    return this.administration.updateSettings(request.auth, result.data);
  }

  @Get("organizations")
  organizations(@Req() request: AuthenticatedRequest): Promise<OrganizationsResponse> {
    return this.administration.organizations(request.auth);
  }

  @Post("organizations")
  createOrganization(@Req() request: AuthenticatedRequest, @Body() body: unknown): Promise<OrganizationsResponse> {
    const result = organizationCreateSchema.safeParse(body);
    if (!result.success) throw new BadRequestException("Dados da organização inválidos");
    return this.administration.createOrganization(request.auth, result.data);
  }
}
