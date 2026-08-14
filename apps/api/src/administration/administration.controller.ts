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
  adminCreateUserSchema,
  adminUpdateUserSchema,
  accessProfileInputSchema,
  tenantSettingsUpdateSchema,
  organizationCreateSchema,
  type AdminUsersResponse,
  type TenantSettingsResponse,
  type OrganizationsResponse,
  type AccessProfilesResponse,
} from "@integrador/contracts";
import { z } from "zod";
import { PermissionsGuard, RequirePermissions } from "../auth/roles.guard.js";
import { SessionGuard } from "../auth/session.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { AdministrationService } from "./administration.service.js";

const userIdSchema = z.uuid();

@Controller("v1/administration")
@UseGuards(SessionGuard, PermissionsGuard)
export class AdministrationController {
  constructor(private readonly administration: AdministrationService) {}

  @Get("users")
  @RequirePermissions("users:manage")
  users(@Req() request: AuthenticatedRequest): Promise<AdminUsersResponse> {
    return this.administration.users(request.auth);
  }

  @Post("users")
  @RequirePermissions("users:manage")
  createUser(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<AdminUsersResponse> {
    const result = adminCreateUserSchema.safeParse(body);
    if (!result.success)
      throw new BadRequestException("Dados do usuário inválidos");
    return this.administration.createUser(request.auth, result.data);
  }

  @Patch("users/:userId")
  @RequirePermissions("users:manage")
  updateUser(
    @Req() request: AuthenticatedRequest,
    @Param("userId") rawUserId: string,
    @Body() body: unknown,
  ): Promise<AdminUsersResponse> {
    const userId = userIdSchema.safeParse(rawUserId);
    const input = adminUpdateUserSchema.safeParse(body);
    if (!userId.success || !input.success)
      throw new BadRequestException("Alteração de usuário inválida");
    return this.administration.updateUser(
      request.auth,
      userId.data,
      input.data,
    );
  }

  @Delete("users/:userId")
  @RequirePermissions("users:manage")
  removeUser(
    @Req() request: AuthenticatedRequest,
    @Param("userId") rawUserId: string,
  ): Promise<AdminUsersResponse> {
    const userId = userIdSchema.safeParse(rawUserId);
    if (!userId.success) throw new BadRequestException("Usuário inválido");
    return this.administration.removeUser(request.auth, userId.data);
  }

  @Get("access-profiles")
  @RequirePermissions("users:manage")
  accessProfiles(
    @Req() request: AuthenticatedRequest,
  ): Promise<AccessProfilesResponse> {
    return this.administration.accessProfiles(request.auth);
  }

  @Post("access-profiles")
  @RequirePermissions("users:manage")
  createAccessProfile(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<AccessProfilesResponse> {
    const input = accessProfileInputSchema.safeParse(body);
    if (!input.success)
      throw new BadRequestException("Perfil de acesso inválido");
    return this.administration.createAccessProfile(request.auth, input.data);
  }

  @Patch("access-profiles/:profileId")
  @RequirePermissions("users:manage")
  updateAccessProfile(
    @Req() request: AuthenticatedRequest,
    @Param("profileId") rawProfileId: string,
    @Body() body: unknown,
  ): Promise<AccessProfilesResponse> {
    const profileId = userIdSchema.safeParse(rawProfileId);
    const input = accessProfileInputSchema.safeParse(body);
    if (!profileId.success || !input.success)
      throw new BadRequestException("Perfil de acesso inválido");
    return this.administration.updateAccessProfile(
      request.auth,
      profileId.data,
      input.data,
    );
  }

  @Delete("access-profiles/:profileId")
  @RequirePermissions("users:manage")
  removeAccessProfile(
    @Req() request: AuthenticatedRequest,
    @Param("profileId") rawProfileId: string,
  ): Promise<AccessProfilesResponse> {
    const profileId = userIdSchema.safeParse(rawProfileId);
    if (!profileId.success)
      throw new BadRequestException("Perfil de acesso inválido");
    return this.administration.removeAccessProfile(
      request.auth,
      profileId.data,
    );
  }

  @Get("settings")
  @RequirePermissions("settings:view")
  settings(
    @Req() request: AuthenticatedRequest,
  ): Promise<TenantSettingsResponse> {
    return this.administration.settings(request.auth);
  }

  @Patch("settings")
  @RequirePermissions("settings:view")
  updateSettings(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<TenantSettingsResponse> {
    const result = tenantSettingsUpdateSchema.safeParse(body);
    if (!result.success)
      throw new BadRequestException("Configurações inválidas");
    return this.administration.updateSettings(request.auth, result.data);
  }

  @Get("organizations")
  organizations(
    @Req() request: AuthenticatedRequest,
  ): Promise<OrganizationsResponse> {
    return this.administration.organizations(request.auth);
  }

  @Post("organizations")
  createOrganization(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ): Promise<OrganizationsResponse> {
    const result = organizationCreateSchema.safeParse(body);
    if (!result.success)
      throw new BadRequestException("Dados da organização inválidos");
    return this.administration.createOrganization(request.auth, result.data);
  }
}
