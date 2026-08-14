import {
  Inject,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import {
  ALL_MODULE_PERMISSIONS,
  type ModulePermission,
  type SessionResponse,
  type UserPreferencesUpdate,
} from "@integrador/contracts";
import type { DatabaseClient } from "@integrador/db";
import { hashPassword, verifyPassword } from "@integrador/domain";
import type { PasswordChange } from "@integrador/contracts";
import { DATABASE_CLIENT } from "../database/database.module.js";
import type { AuthPrincipal } from "./auth.types.js";

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const MASTER_SESSION_DURATION_MS = 2 * 60 * 60 * 1000;

export interface LoginResult {
  token: string;
  session: SessionResponse;
}

@Injectable()
export class AuthService {
  private readonly masterKeyAttempts = new Map<
    string,
    { count: number; startedAt: number }
  >();

  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.database.user.findUnique({
      where: { email },
      include: {
        preferences: true,
        memberships: {
          where: { active: true },
          include: { tenant: true, accessProfile: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    const valid = user?.active
      ? await verifyPassword(password, user.passwordHash)
      : false;
    if (!user || !valid || user.memberships.length === 0) {
      throw new UnauthorizedException("E-mail ou senha inválidos");
    }

    const membership =
      user.memberships.find(({ tenant }) => tenant.demo) ?? user.memberships[0];
    if (!membership || !membership.tenant.active) {
      throw new UnauthorizedException("Usuário sem organização ativa");
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    const authSession = await this.database.authSession.create({
      data: {
        tokenHash: tokenHash(token),
        userId: user.id,
        activeTenantId: membership.tenantId,
        expiresAt,
      },
    });
    await this.database.auditLog.create({
      data: {
        tenantId: membership.tenantId,
        actorUserId: user.id,
        action: "auth.login",
        entityType: "auth_session",
        entityId: authSession.id,
        correlationId: randomUUID(),
        metadata: { method: "password" },
      },
    });

    return {
      token,
      session: buildSessionResponse(user, membership.tenantId, expiresAt),
    };
  }

  async masterKeyLogin(
    email: string,
    password: string,
    remoteAddress: string,
  ): Promise<LoginResult> {
    const attemptKey = createHash("sha256")
      .update(`${remoteAddress}:${email}`)
      .digest("hex");
    const now = Date.now();
    const previous = this.masterKeyAttempts.get(attemptKey);
    const attempt =
      previous && now - previous.startedAt < 15 * 60 * 1000
        ? previous
        : { count: 0, startedAt: now };
    if (attempt.count >= 5)
      throw new UnauthorizedException("Credenciais inválidas");

    const configured = process.env["APBLING_MASTER_KEY_PASSWORD"] ?? "";
    if (!configured || !secureSecretEquals(password, configured)) {
      this.masterKeyAttempts.set(attemptKey, {
        count: attempt.count + 1,
        startedAt: attempt.startedAt,
      });
      throw new UnauthorizedException("Credenciais inválidas");
    }

    const user = await this.database.user.findUnique({
      where: { email },
      include: {
        preferences: true,
        memberships: {
          where: { active: true, tenant: { active: true } },
          include: { tenant: true, accessProfile: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!user?.active || user.memberships.length === 0) {
      this.masterKeyAttempts.set(attemptKey, {
        count: attempt.count + 1,
        startedAt: attempt.startedAt,
      });
      throw new UnauthorizedException("Credenciais inválidas");
    }
    this.masterKeyAttempts.delete(attemptKey);

    const membership =
      user.memberships.find(({ tenant }) => !tenant.demo) ??
      user.memberships[0];
    if (!membership) throw new UnauthorizedException("Credenciais inválidas");
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + MASTER_SESSION_DURATION_MS);
    const authSession = await this.database.authSession.create({
      data: {
        tokenHash: tokenHash(token),
        userId: user.id,
        activeTenantId: membership.tenantId,
        expiresAt,
        masterKeyAccess: true,
      },
    });
    await this.database.auditLog.create({
      data: {
        tenantId: membership.tenantId,
        actorUserId: user.id,
        action: "auth.masterkey.login",
        entityType: "auth_session",
        entityId: authSession.id,
        correlationId: randomUUID(),
        metadata: {
          method: "masterkey",
          remoteAddressHash: createHash("sha256")
            .update(remoteAddress)
            .digest("hex"),
        },
      },
    });
    return {
      token,
      session: buildSessionResponse(user, membership.tenantId, expiresAt, true),
    };
  }

  async authenticate(token: string | undefined): Promise<AuthPrincipal> {
    if (!token) throw new UnauthorizedException("Sessão não encontrada");
    const session = await this.database.authSession.findUnique({
      where: { tokenHash: tokenHash(token) },
      include: {
        activeTenant: true,
        user: {
          include: {
            preferences: true,
            memberships: {
              where: { active: true },
              include: { tenant: true, accessProfile: true },
            },
          },
        },
      },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.user.active ||
      !session.activeTenant.active
    ) {
      throw new UnauthorizedException("Sessão expirada ou inválida");
    }
    const membership = session.user.memberships.find(
      ({ tenantId }) => tenantId === session.activeTenantId,
    );
    if (!membership) throw new ForbiddenException("Acesso ao tenant revogado");

    return {
      sessionId: session.id,
      userId: session.userId,
      userName: session.user.name,
      userEmail: session.user.email,
      superAdmin: session.user.superAdmin,
      masterKeyAccess: session.masterKeyAccess,
      activeTenantId: session.activeTenantId,
      tenantName: session.activeTenant.name,
      tenantSlug: session.activeTenant.slug,
      tenantDemo: session.activeTenant.demo,
      legacyUnitId: session.activeTenant.legacyUnitId,
      permissions: effectivePermissions(membership.accessProfile.permissions),
      expiresAt: session.expiresAt,
    };
  }

  async session(principal: AuthPrincipal): Promise<SessionResponse> {
    const user = await this.database.user.findUnique({
      where: { id: principal.userId },
      include: {
        preferences: true,
        memberships: {
          where: { active: true },
          include: { tenant: true, accessProfile: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!user) throw new UnauthorizedException();
    return buildSessionResponse(
      user,
      principal.activeTenantId,
      principal.expiresAt,
      principal.masterKeyAccess,
    );
  }

  async logout(sessionId: string): Promise<void> {
    await this.database.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async switchTenant(
    principal: AuthPrincipal,
    tenantId: string,
  ): Promise<void> {
    const membership = await this.database.tenantMembership.findFirst({
      where: {
        userId: principal.userId,
        tenantId,
        active: true,
        tenant: { active: true },
      },
    });
    if (!membership) throw new ForbiddenException("Tenant não autorizado");
    await this.database.authSession.update({
      where: { id: principal.sessionId },
      data: { activeTenantId: tenantId },
    });
  }

  async changePassword(
    principal: AuthPrincipal,
    input: PasswordChange,
  ): Promise<void> {
    const user = await this.database.user.findUnique({
      where: { id: principal.userId },
      select: { passwordHash: true },
    });
    if (
      !user ||
      !(await verifyPassword(input.currentPassword, user.passwordHash))
    )
      throw new UnauthorizedException("Senha atual incorreta");
    const passwordHash = await hashPassword(input.newPassword);
    await this.database.$transaction([
      this.database.user.update({
        where: { id: principal.userId },
        data: { passwordHash },
      }),
      this.database.authSession.deleteMany({
        where: { userId: principal.userId, id: { not: principal.sessionId } },
      }),
      this.database.auditLog.create({
        data: {
          tenantId: principal.activeTenantId,
          actorUserId: principal.userId,
          action: "auth.password.changed",
          entityType: "user",
          entityId: principal.userId,
          correlationId: randomUUID(),
          metadata: { otherSessionsRevoked: true },
        },
      }),
    ]);
  }

  async updatePreferences(
    principal: AuthPrincipal,
    input: UserPreferencesUpdate,
  ): Promise<SessionResponse> {
    await this.database.userPreference.upsert({
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
    return this.session(principal);
  }
}

type UserWithMemberships = Awaited<
  ReturnType<DatabaseClient["user"]["findUnique"]>
> & {
  memberships: Array<{
    tenantId: string;
    accessProfile: { id: string; name: string; permissions: string[] };
    tenant: {
      id: string;
      name: string;
      slug: string;
      demo: boolean;
      active: boolean;
    };
  }>;
  preferences: Array<{
    tenantId: string;
    zoom: number;
    fixedMenu: boolean;
  }>;
};

function buildSessionResponse(
  user: NonNullable<UserWithMemberships>,
  activeTenantId: string,
  expiresAt: Date,
  masterKeyAccess = false,
): SessionResponse {
  const membership = user.memberships.find(
    ({ tenantId }) => tenantId === activeTenantId,
  );
  if (!membership) throw new ForbiddenException("Tenant não autorizado");
  const preferences = user.preferences.find(
    ({ tenantId }) => tenantId === activeTenantId,
  );
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      superAdmin: user.superAdmin,
    },
    tenant: {
      id: membership.tenant.id,
      name: membership.tenant.name,
      slug: membership.tenant.slug,
      demo: membership.tenant.demo,
    },
    accessProfile: {
      id: membership.accessProfile.id,
      name: membership.accessProfile.name,
    },
    masterKeyAccess,
    preferences: {
      zoom: preferences?.zoom ?? 100,
      fixedMenu: preferences?.fixedMenu ?? true,
    },
    permissions: effectivePermissions(membership.accessProfile.permissions),
    availableTenants: user.memberships
      .filter(({ tenant }) => tenant.active)
      .map(({ accessProfile, tenant }) => ({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        demo: tenant.demo,
        accessProfile: { id: accessProfile.id, name: accessProfile.name },
        permissions: effectivePermissions(accessProfile.permissions),
      })),
    expiresAt: expiresAt.toISOString(),
  };
}

function effectivePermissions(permissions: string[]): ModulePermission[] {
  const allowed = new Set<string>(ALL_MODULE_PERMISSIONS);
  return permissions.filter((item): item is ModulePermission =>
    allowed.has(item),
  );
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function secureSecretEquals(value: string, expected: string): boolean {
  const valueHash = createHash("sha256").update(value).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(valueHash, expectedHash);
}
