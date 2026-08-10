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
  adminUsersResponseSchema,
  tenantSettingsResponseSchema,
  type AdminCreateUser,
  type AdminUpdateUser,
  type AdminUsersResponse,
  type TenantSettingsResponse,
  type TenantSettingsUpdate,
  type OrganizationCreate,
  type OrganizationsResponse,
  organizationsResponseSchema,
} from "@integrador/contracts";
import { Prisma, type DatabaseClient } from "@integrador/db";
import { hashPassword } from "@integrador/domain";
import type { AuthPrincipal } from "../auth/auth.types.js";
import { DATABASE_CLIENT } from "../database/database.module.js";

interface TaxRegimeRow {
  taxRegime: string | null;
}
interface PreferenceRow {
  zoom: number | null;
  menu: string | null;
}

@Injectable()
export class AdministrationService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  async users(principal: AuthPrincipal): Promise<AdminUsersResponse> {
    const memberships = await this.database.tenantMembership.findMany({
      where: { tenantId: principal.activeTenantId, userId: { not: null } },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
    const items = memberships.flatMap((membership) =>
      membership.user
        ? [
            {
              id: membership.user.id,
              name: membership.user.name,
              email: membership.user.email,
              role: membership.role,
              active: membership.active && membership.user.active,
              joinedAt: membership.createdAt.toISOString(),
            },
          ]
        : [],
    );
    return adminUsersResponseSchema.parse({
      items,
      counts: {
        total: items.length,
        active: items.filter((item) => item.active).length,
        administrators: items.filter(
          (item) => item.role === "owner" || item.role === "admin",
        ).length,
      },
    });
  }

  async createUser(
    principal: AuthPrincipal,
    input: AdminCreateUser,
  ): Promise<AdminUsersResponse> {
    if (principal.role === "admin" && input.role === "owner")
      throw new BadRequestException(
        "Somente proprietários podem criar outro proprietário",
      );
    if (await this.database.user.findUnique({ where: { email: input.email } }))
      throw new ConflictException("Já existe um usuário com este e-mail");
    const passwordHash = await hashPassword(input.password);
    await this.database.$transaction(async (transaction) => {
      const minimum = await transaction.tenantMembership.aggregate({
        where: { tenantId: principal.activeTenantId },
        _min: { legacyUserId: true },
      });
      const legacyUserId = Math.min(-1, (minimum._min.legacyUserId ?? 0) - 1);
      const user = await transaction.user.create({
        data: { name: input.name, email: input.email, passwordHash },
      });
      await transaction.tenantMembership.create({
        data: {
          tenantId: principal.activeTenantId,
          legacyUserId,
          userId: user.id,
          role: input.role,
        },
      });
      await transaction.auditLog.create({
        data: {
          tenantId: principal.activeTenantId,
          actorUserId: principal.userId,
          action: "administration.user.created",
          entityType: "user",
          entityId: user.id,
          correlationId: randomUUID(),
          metadata: { role: input.role },
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
    });
    if (!membership)
      throw new NotFoundException("Usuário não pertence a esta empresa");
    if (
      principal.role === "admin" &&
      (membership.role === "owner" || input.role === "owner")
    )
      throw new BadRequestException(
        "Administradores não podem alterar proprietários",
      );
    if (userId === principal.userId && input.active === false)
      throw new BadRequestException(
        "Você não pode desativar seu próprio acesso",
      );
    const removingOwner =
      membership.role === "owner" &&
      (input.active === false || (input.role && input.role !== "owner"));
    if (removingOwner) {
      const owners = await this.database.tenantMembership.count({
        where: {
          tenantId: principal.activeTenantId,
          role: "owner",
          active: true,
        },
      });
      if (owners <= 1)
        throw new BadRequestException(
          "A empresa precisa manter ao menos um proprietário ativo",
        );
    }
    await this.database.$transaction([
      this.database.tenantMembership.update({
        where: {
          tenantId_userId: { tenantId: principal.activeTenantId, userId },
        },
        data: {
          ...(input.role !== undefined ? { role: input.role } : {}),
          ...(input.active !== undefined ? { active: input.active } : {}),
        },
      }),
      this.database.auditLog.create({
        data: {
          tenantId: principal.activeTenantId,
          actorUserId: principal.userId,
          action: "administration.user.updated",
          entityType: "user",
          entityId: userId,
          correlationId: randomUUID(),
          metadata: input,
        },
      }),
    ]);
    return this.users(principal);
  }

  async settings(principal: AuthPrincipal): Promise<TenantSettingsResponse> {
    const unitId = this.unit(principal);
    const [tenant, membership, regimes, flags] = await Promise.all([
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
      this.database.$queryRaw<TaxRegimeRow[]>(Prisma.sql`
        SELECT NULLIF(BTRIM(regime_tributario), '') AS "taxRegime"
        FROM system_unit WHERE id = ${unitId} LIMIT 1
      `),
      this.database.featureFlag.findMany({
        where: { tenantId: principal.activeTenantId },
        orderBy: { key: "asc" },
      }),
    ]);
    if (!tenant || !membership)
      throw new NotFoundException("Empresa não encontrada");
    const preferences =
      membership.legacyUserId > 0
        ? await this.database.$queryRaw<PreferenceRow[]>(Prisma.sql`
          SELECT zoom, menu FROM preferencia_geral
          WHERE system_users_id = ${membership.legacyUserId} LIMIT 1
        `)
        : [];
    return tenantSettingsResponseSchema.parse({
      organization: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        brandName: tenant.brandName,
        legacyUnitId: unitId,
        taxRegime: regimes[0]?.taxRegime ?? null,
      },
      preferences: {
        zoom: preferences[0]?.zoom ?? 100,
        fixedMenu: preferences[0]?.menu !== "N",
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
    const unitId = this.unit(principal);
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
      if (input.name !== undefined || input.brandName !== undefined) {
        await transaction.tenant.update({
          where: { id: principal.activeTenantId },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.brandName !== undefined
              ? { brandName: input.brandName }
              : {}),
          },
        });
      }
      if (input.taxRegime !== undefined) {
        await transaction.$executeRaw(Prisma.sql`
          UPDATE system_unit SET regime_tributario = ${input.taxRegime}
          WHERE id = ${unitId}
        `);
      }
      if (
        (input.zoom !== undefined || input.fixedMenu !== undefined) &&
        membership.legacyUserId > 0
      ) {
        const current = await transaction.$queryRaw<PreferenceRow[]>(Prisma.sql`
          SELECT zoom, menu FROM preferencia_geral
          WHERE system_users_id = ${membership.legacyUserId} LIMIT 1
        `);
        const zoom = input.zoom ?? current[0]?.zoom ?? 100;
        const menu = (input.fixedMenu ?? current[0]?.menu !== "N") ? "S" : "N";
        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO preferencia_geral (system_users_id, zoom, menu)
          VALUES (${membership.legacyUserId}, ${zoom}, ${menu})
          ON CONFLICT (system_users_id) DO UPDATE SET zoom = EXCLUDED.zoom, menu = EXCLUDED.menu
        `);
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
      await transaction.tenantMembership.create({
        data: {
          tenantId: tenant.id,
          legacyUserId: -1,
          userId: principal.userId,
          role: "owner",
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

  private unit(principal: AuthPrincipal): number {
    if (principal.tenantDemo || principal.legacyUnitId === null)
      throw new BadRequestException("Empresa sem vínculo com o banco legado");
    return principal.legacyUnitId;
  }
}
