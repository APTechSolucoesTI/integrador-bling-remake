import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  ALL_MODULE_PERMISSIONS,
  adminUsersResponseSchema,
  tenantSettingsResponseSchema,
  type AdminCreateUser,
  type AdminUpdateUser,
  type AdminUsersResponse,
  type AccessProfileInput,
  type AccessProfilesResponse,
  type TenantSettingsResponse,
  type TenantSettingsUpdate,
  type OrganizationCreate,
  type OrganizationsResponse,
  organizationsResponseSchema,
} from "@integrador/contracts";
import { type DatabaseClient } from "@integrador/db";
import { hashPassword } from "@integrador/domain";
import type { AuthPrincipal } from "../auth/auth.types.js";
import { DATABASE_CLIENT } from "../database/database.module.js";

@Injectable()
export class AdministrationService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  async users(principal: AuthPrincipal): Promise<AdminUsersResponse> {
    const manageableTenantIds = await this.manageableTenantIds(principal);
    const memberships = await this.database.tenantMembership.findMany({
      where: { tenantId: principal.activeTenantId },
      include: { user: true, accessProfile: true },
      orderBy: { createdAt: "asc" },
    });
    const sharedMemberships = await this.database.tenantMembership.findMany({
      where: {
        userId: { in: memberships.map(({ userId }) => userId) },
        tenantId: { in: manageableTenantIds },
      },
      select: { userId: true, tenantId: true },
    });
    const items = memberships.map((membership) => ({
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      active: membership.active && membership.user.active,
      joinedAt: membership.createdAt.toISOString(),
      permissions: membership.accessProfile.permissions,
      accessProfileId: membership.accessProfileId,
      accessProfileName: membership.accessProfile.name,
      tenantIds: sharedMemberships
        .filter(({ userId }) => userId === membership.userId)
        .map(({ tenantId }) => tenantId),
    }));
    return adminUsersResponseSchema.parse({
      items,
      counts: {
        total: items.length,
        active: items.filter((item) => item.active).length,
        administrators: items.filter((item) =>
          item.permissions.includes("users:manage"),
        ).length,
      },
    });
  }

  async createUser(
    principal: AuthPrincipal,
    input: AdminCreateUser,
  ): Promise<AdminUsersResponse> {
    if (await this.database.user.findUnique({ where: { email: input.email } }))
      throw new ConflictException("Já existe um usuário com este e-mail");
    const profile = await this.profileForTenant(
      principal.activeTenantId,
      input.accessProfileId,
    );
    const requestedTenantIds = Array.from(
      new Set([principal.activeTenantId, ...input.tenantIds]),
    );
    await this.assertManageableTenants(principal, requestedTenantIds);
    const profiles = await this.copyProfileToTenants(
      profile,
      requestedTenantIds,
    );
    const passwordHash = await hashPassword(input.password);
    await this.database.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: { name: input.name, email: input.email, passwordHash },
      });
      await transaction.tenantMembership.createMany({
        data: requestedTenantIds.map((tenantId) => ({
          tenantId,
          userId: user.id,
          accessProfileId: profiles.get(tenantId)!,
        })),
      });
      await transaction.auditLog.create({
        data: {
          tenantId: principal.activeTenantId,
          actorUserId: principal.userId,
          action: "administration.user.created",
          entityType: "user",
          entityId: user.id,
          correlationId: randomUUID(),
          metadata: {
            accessProfileId: profile.id,
            accessProfileName: profile.name,
          },
        },
      });
    });
    return this.users(principal);
  }

  async updateUser(
    principal: AuthPrincipal,
    userId: string,
    input: AdminUpdateUser,
  ): Promise<AdminUsersResponse> {
    const membership = await this.database.tenantMembership.findUnique({
      where: {
        tenantId_userId: { tenantId: principal.activeTenantId, userId },
      },
      include: { accessProfile: true },
    });
    if (!membership)
      throw new NotFoundException("Usuário não pertence a esta empresa");
    if (userId === principal.userId && input.active === false)
      throw new BadRequestException(
        "Você não pode desativar seu próprio acesso",
      );
    if (input.email !== undefined) {
      const conflict = await this.database.user.findFirst({
        where: { email: input.email, NOT: { id: userId } },
        select: { id: true },
      });
      if (conflict)
        throw new ConflictException("Já existe um usuário com este e-mail");
    }
    const profile = input.accessProfileId
      ? await this.profileForTenant(
          principal.activeTenantId,
          input.accessProfileId,
        )
      : null;
    const manageableTenantIds = await this.manageableTenantIds(principal);
    const selectedTenantIds = input.tenantIds
      ? Array.from(new Set(input.tenantIds))
      : null;
    if (selectedTenantIds) {
      await this.assertManageableTenants(principal, selectedTenantIds);
      if (
        userId === principal.userId &&
        !selectedTenantIds.includes(principal.activeTenantId)
      )
        throw new BadRequestException(
          "Você não pode remover seu próprio acesso",
        );
    }
    const targetProfile = profile ?? membership.accessProfile;
    const profileIds = selectedTenantIds
      ? await this.copyProfileToTenants(targetProfile, selectedTenantIds)
      : null;
    if (
      userId === principal.userId &&
      profile &&
      !profile.permissions.includes("users:manage")
    )
      throw new BadRequestException(
        "Você não pode remover sua própria permissão de administrar usuários",
      );
    if (
      membership.accessProfile.permissions.includes("users:manage") &&
      (input.active === false ||
        (profile && !profile.permissions.includes("users:manage")))
    )
      await this.ensureAnotherUserManager(
        principal.activeTenantId,
        membership.id,
      );
    const auditMetadata = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.accessProfileId !== undefined
        ? { accessProfileId: input.accessProfileId }
        : {}),
      ...(input.password !== undefined ? { passwordChanged: true } : {}),
    };
    await this.database.$transaction([
      this.database.user.update({
        where: { id: userId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.password !== undefined
            ? { passwordHash: await hashPassword(input.password) }
            : {}),
        },
      }),
      this.database.tenantMembership.update({
        where: {
          tenantId_userId: { tenantId: principal.activeTenantId, userId },
        },
        data: {
          ...(input.active !== undefined ? { active: input.active } : {}),
          ...(input.accessProfileId !== undefined
            ? { accessProfileId: input.accessProfileId }
            : {}),
        },
      }),
      ...(selectedTenantIds && profileIds
        ? selectedTenantIds
            .filter((tenantId) => tenantId !== principal.activeTenantId)
            .map((tenantId) =>
              this.database.tenantMembership.upsert({
                where: { tenantId_userId: { tenantId, userId } },
                create: {
                  tenantId,
                  userId,
                  accessProfileId: profileIds.get(tenantId)!,
                  active: input.active ?? true,
                },
                update: {
                  accessProfileId: profileIds.get(tenantId)!,
                  active: input.active ?? true,
                },
              }),
            )
        : []),
      ...(selectedTenantIds
        ? [
            this.database.tenantMembership.deleteMany({
              where: {
                userId,
                tenantId: {
                  in: manageableTenantIds.filter(
                    (tenantId) => !selectedTenantIds.includes(tenantId),
                  ),
                },
              },
            }),
          ]
        : []),
      this.database.auditLog.create({
        data: {
          tenantId: principal.activeTenantId,
          actorUserId: principal.userId,
          action: "administration.user.updated",
          entityType: "user",
          entityId: userId,
          correlationId: randomUUID(),
          metadata: auditMetadata,
        },
      }),
    ]);
    return this.users(principal);
  }

  async removeUser(
    principal: AuthPrincipal,
    userId: string,
  ): Promise<AdminUsersResponse> {
    const membership = await this.database.tenantMembership.findUnique({
      where: {
        tenantId_userId: { tenantId: principal.activeTenantId, userId },
      },
      include: { accessProfile: true },
    });
    if (!membership)
      throw new NotFoundException("Usuário não pertence a esta empresa");
    if (userId === principal.userId)
      throw new BadRequestException("Você não pode remover seu próprio acesso");
    if (membership.accessProfile.permissions.includes("users:manage")) {
      const managers = await this.database.tenantMembership.count({
        where: {
          tenantId: principal.activeTenantId,
          accessProfile: { permissions: { has: "users:manage" } },
          active: true,
        },
      });
      if (managers <= 1)
        throw new BadRequestException(
          "A empresa precisa manter ao menos um usuário ativo com permissão para administrar usuários",
        );
    }
    await this.database.$transaction([
      this.database.authSession.updateMany({
        where: {
          userId,
          activeTenantId: principal.activeTenantId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      }),
      this.database.tenantMembership.delete({
        where: {
          tenantId_userId: { tenantId: principal.activeTenantId, userId },
        },
      }),
      this.database.auditLog.create({
        data: {
          tenantId: principal.activeTenantId,
          actorUserId: principal.userId,
          action: "administration.user.removed",
          entityType: "user",
          entityId: userId,
          correlationId: randomUUID(),
          metadata: { previousAccessProfileId: membership.accessProfileId },
        },
      }),
    ]);
    return this.users(principal);
  }

  async accessProfiles(
    principal: AuthPrincipal,
  ): Promise<AccessProfilesResponse> {
    const profiles = await this.database.accessProfile.findMany({
      where: { tenantId: principal.activeTenantId },
      include: { _count: { select: { memberships: true } } },
      orderBy: { name: "asc" },
    });
    return {
      items: profiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
        description: profile.description,
        permissions:
          profile.permissions as AccessProfilesResponse["items"][number]["permissions"],
        assignedUsers: profile._count.memberships,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      })),
    };
  }

  async createAccessProfile(
    principal: AuthPrincipal,
    input: AccessProfileInput,
  ): Promise<AccessProfilesResponse> {
    const profileData = { ...input, description: input.description ?? null };
    try {
      await this.database.accessProfile.create({
        data: { tenantId: principal.activeTenantId, ...profileData },
      });
    } catch (cause) {
      if (this.isUniqueViolation(cause))
        throw new ConflictException("Já existe um perfil com este nome");
      throw cause;
    }
    return this.accessProfiles(principal);
  }

  async updateAccessProfile(
    principal: AuthPrincipal,
    profileId: string,
    input: AccessProfileInput,
  ): Promise<AccessProfilesResponse> {
    const currentProfile = await this.profileForTenant(
      principal.activeTenantId,
      profileId,
    );
    const profileData = { ...input, description: input.description ?? null };
    if (
      currentProfile.permissions.includes("users:manage") &&
      !profileData.permissions.includes("users:manage")
    ) {
      const otherManagers = await this.database.tenantMembership.count({
        where: {
          tenantId: principal.activeTenantId,
          active: true,
          accessProfileId: { not: profileId },
          accessProfile: { permissions: { has: "users:manage" } },
        },
      });
      if (otherManagers === 0)
        throw new BadRequestException(
          "A empresa precisa manter ao menos um perfil ativo com administração de usuários",
        );
    }
    try {
      await this.database.accessProfile.update({
        where: { id: profileId },
        data: profileData,
      });
    } catch (cause) {
      if (this.isUniqueViolation(cause))
        throw new ConflictException("Já existe um perfil com este nome");
      throw cause;
    }
    return this.accessProfiles(principal);
  }

  async removeAccessProfile(
    principal: AuthPrincipal,
    profileId: string,
  ): Promise<AccessProfilesResponse> {
    await this.profileForTenant(principal.activeTenantId, profileId);
    const assignedUsers = await this.database.tenantMembership.count({
      where: { tenantId: principal.activeTenantId, accessProfileId: profileId },
    });
    if (assignedUsers > 0)
      throw new ConflictException(
        "Reatribua os usuários antes de excluir este perfil de acesso",
      );
    await this.database.accessProfile.delete({ where: { id: profileId } });
    return this.accessProfiles(principal);
  }

  private async profileForTenant(tenantId: string, profileId: string) {
    const profile = await this.database.accessProfile.findFirst({
      where: { id: profileId, tenantId },
    });
    if (!profile)
      throw new NotFoundException("Perfil de acesso não encontrado");
    return profile;
  }

  private async ensureAnotherUserManager(
    tenantId: string,
    excludedMembershipId: string,
  ): Promise<void> {
    const managers = await this.database.tenantMembership.count({
      where: {
        tenantId,
        active: true,
        id: { not: excludedMembershipId },
        accessProfile: { permissions: { has: "users:manage" } },
      },
    });
    if (managers === 0)
      throw new BadRequestException(
        "A empresa precisa manter ao menos um usuário ativo com permissão para administrar usuários",
      );
  }

  private isUniqueViolation(cause: unknown): boolean {
    return (
      typeof cause === "object" &&
      cause !== null &&
      "code" in cause &&
      cause.code === "P2002"
    );
  }

  private async manageableTenantIds(
    principal: AuthPrincipal,
  ): Promise<string[]> {
    if (principal.superAdmin) {
      const tenants = await this.database.tenant.findMany({
        where: { active: true },
        select: { id: true },
      });
      return tenants.map(({ id }) => id);
    }
    const memberships = await this.database.tenantMembership.findMany({
      where: {
        userId: principal.userId,
        active: true,
        accessProfile: { permissions: { has: "users:manage" } },
      },
      select: { tenantId: true },
    });
    return memberships.map(({ tenantId }) => tenantId);
  }

  private async assertManageableTenants(
    principal: AuthPrincipal,
    tenantIds: string[],
  ): Promise<void> {
    const allowed = new Set(await this.manageableTenantIds(principal));
    if (tenantIds.some((tenantId) => !allowed.has(tenantId)))
      throw new ForbiddenException(
        "Uma ou mais unidades não podem ser administradas",
      );
  }

  private async copyProfileToTenants(
    profile: {
      name: string;
      description: string | null;
      permissions: string[];
    },
    tenantIds: string[],
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    for (const tenantId of tenantIds) {
      const target = await this.database.accessProfile.upsert({
        where: { tenantId_name: { tenantId, name: profile.name } },
        create: {
          tenantId,
          name: profile.name,
          description: profile.description,
          permissions: profile.permissions,
        },
        update: {},
        select: { id: true },
      });
      result.set(tenantId, target.id);
    }
    return result;
  }

  async settings(principal: AuthPrincipal): Promise<TenantSettingsResponse> {
    const [tenant, membership, preferences, flags] = await Promise.all([
      this.database.tenant.findUnique({
        where: { id: principal.activeTenantId },
      }),
      this.database.tenantMembership.findUnique({
        where: {
          tenantId_userId: {
            tenantId: principal.activeTenantId,
            userId: principal.userId,
          },
        },
      }),
      this.database.userPreference.findUnique({
        where: {
          tenantId_userId: {
            tenantId: principal.activeTenantId,
            userId: principal.userId,
          },
        },
      }),
      this.database.featureFlag.findMany({
        where: { tenantId: principal.activeTenantId },
        orderBy: { key: "asc" },
      }),
    ]);
    if (!tenant || !membership)
      throw new NotFoundException("Empresa não encontrada");
    return tenantSettingsResponseSchema.parse({
      organization: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        brandName: tenant.brandName,
        legacyUnitId: tenant.legacyUnitId,
        taxRegime:
          tenant.taxRegime === "SN" || tenant.taxRegime === "Simples Nacional"
            ? "Simples Nacional"
            : "Lucro Presumido",
      },
      preferences: {
        zoom: preferences?.zoom ?? 100,
        fixedMenu: preferences?.fixedMenu ?? true,
      },
      featureFlags: flags.map((flag) => ({
        key: flag.key,
        enabled: flag.enabled,
      })),
    });
  }

  async updateSettings(
    principal: AuthPrincipal,
    input: TenantSettingsUpdate,
  ): Promise<TenantSettingsResponse> {
    if (
      (input.name !== undefined ||
        input.brandName !== undefined ||
        input.taxRegime !== undefined) &&
      !principal.permissions.includes("settings:manage")
    )
      throw new ForbiddenException(
        "Seu perfil não permite alterar dados da empresa",
      );
    const membership = await this.database.tenantMembership.findUnique({
      where: {
        tenantId_userId: {
          tenantId: principal.activeTenantId,
          userId: principal.userId,
        },
      },
    });
    if (!membership)
      throw new NotFoundException("Vínculo com a empresa não encontrado");
    await this.database.$transaction(async (transaction) => {
      if (
        input.name !== undefined ||
        input.brandName !== undefined ||
        input.taxRegime !== undefined
      ) {
        await transaction.tenant.update({
          where: { id: principal.activeTenantId },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.brandName !== undefined
              ? { brandName: input.brandName }
              : {}),
            ...(input.taxRegime !== undefined
              ? { taxRegime: input.taxRegime }
              : {}),
          },
        });
      }
      if (input.zoom !== undefined || input.fixedMenu !== undefined) {
        await transaction.userPreference.upsert({
          where: {
            tenantId_userId: {
              tenantId: principal.activeTenantId,
              userId: principal.userId,
            },
          },
          create: {
            tenantId: principal.activeTenantId,
            userId: principal.userId,
            zoom: input.zoom ?? 100,
            fixedMenu: input.fixedMenu ?? true,
          },
          update: {
            ...(input.zoom !== undefined ? { zoom: input.zoom } : {}),
            ...(input.fixedMenu !== undefined
              ? { fixedMenu: input.fixedMenu }
              : {}),
          },
        });
      }
      await transaction.auditLog.create({
        data: {
          tenantId: principal.activeTenantId,
          actorUserId: principal.userId,
          action: "administration.settings.updated",
          entityType: "tenant",
          entityId: principal.activeTenantId,
          correlationId: randomUUID(),
          metadata: input,
        },
      });
    });
    return this.settings(principal);
  }

  async organizations(
    principal: AuthPrincipal,
  ): Promise<OrganizationsResponse> {
    if (!principal.superAdmin)
      throw new ForbiddenException("Acesso exclusivo do superadministrador");
    const tenants = await this.database.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { memberships: true } } },
    });
    return organizationsResponseSchema.parse({
      items: tenants.map((tenant) => ({
        id: tenant.id,
        legacyUnitId: tenant.legacyUnitId,
        name: tenant.name,
        slug: tenant.slug,
        brandName: tenant.brandName,
        active: tenant.active,
        demo: tenant.demo,
        members: tenant._count.memberships,
        createdAt: tenant.createdAt.toISOString(),
      })),
    });
  }

  async createOrganization(
    principal: AuthPrincipal,
    input: OrganizationCreate,
  ): Promise<OrganizationsResponse> {
    if (!principal.superAdmin)
      throw new ForbiddenException("Acesso exclusivo do superadministrador");
    const conflict = await this.database.tenant.findFirst({
      where: {
        OR: [
          { slug: input.slug },
          ...(input.legacyUnitId ? [{ legacyUnitId: input.legacyUnitId }] : []),
        ],
      },
    });
    if (conflict)
      throw new ConflictException("Slug ou unidade legada já vinculados");
    await this.database.$transaction(async (transaction) => {
      const tenant = await transaction.tenant.create({
        data: {
          name: input.name,
          slug: input.slug,
          brandName: input.brandName,
          legacyUnitId: input.legacyUnitId,
        },
      });
      const administratorProfile = await transaction.accessProfile.create({
        data: {
          tenantId: tenant.id,
          name: "Administrador",
          description: "Acesso completo à empresa, configurações e usuários.",
          permissions: [...ALL_MODULE_PERMISSIONS],
        },
      });
      await transaction.tenantMembership.create({
        data: {
          tenantId: tenant.id,
          userId: principal.userId,
          accessProfileId: administratorProfile.id,
        },
      });
      await transaction.auditLog.create({
        data: {
          tenantId: tenant.id,
          actorUserId: principal.userId,
          action: "administration.organization.created",
          entityType: "tenant",
          entityId: tenant.id,
          correlationId: randomUUID(),
          metadata: { legacyUnitId: input.legacyUnitId },
        },
      });
    });
    return this.organizations(principal);
  }
}
