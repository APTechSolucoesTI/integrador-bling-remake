import {
  Inject,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { SessionResponse } from "@integrador/contracts";
import type { DatabaseClient } from "@integrador/db";
import { verifyPassword } from "@integrador/domain";
import { DATABASE_CLIENT } from "../database/database.module.js";
import type { AuthPrincipal, TenantRole } from "./auth.types.js";

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

export interface LoginResult {
  token: string;
  session: SessionResponse;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly database: DatabaseClient,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.database.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { active: true },
          include: { tenant: true },
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

  async authenticate(token: string | undefined): Promise<AuthPrincipal> {
    if (!token) throw new UnauthorizedException("Sessão não encontrada");
    const session = await this.database.authSession.findUnique({
      where: { tokenHash: tokenHash(token) },
      include: {
        activeTenant: true,
        user: {
          include: {
            memberships: {
              where: { active: true },
              include: { tenant: true },
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
      activeTenantId: session.activeTenantId,
      tenantName: session.activeTenant.name,
      tenantSlug: session.activeTenant.slug,
      tenantDemo: session.activeTenant.demo,
      legacyUnitId: session.activeTenant.legacyUnitId,
      role: membership.role,
      expiresAt: session.expiresAt,
    };
  }

  async session(principal: AuthPrincipal): Promise<SessionResponse> {
    const user = await this.database.user.findUnique({
      where: { id: principal.userId },
      include: {
        memberships: {
          where: { active: true },
          include: { tenant: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!user) throw new UnauthorizedException();
    return buildSessionResponse(
      user,
      principal.activeTenantId,
      principal.expiresAt,
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
}

type UserWithMemberships = Awaited<
  ReturnType<DatabaseClient["user"]["findUnique"]>
> & {
  memberships: Array<{
    tenantId: string;
    role: TenantRole;
    tenant: {
      id: string;
      name: string;
      slug: string;
      demo: boolean;
      active: boolean;
    };
  }>;
};

function buildSessionResponse(
  user: NonNullable<UserWithMemberships>,
  activeTenantId: string,
  expiresAt: Date,
): SessionResponse {
  const membership = user.memberships.find(
    ({ tenantId }) => tenantId === activeTenantId,
  );
  if (!membership) throw new ForbiddenException("Tenant não autorizado");
  return {
    user: { id: user.id, name: user.name, email: user.email, superAdmin: user.superAdmin },
    tenant: {
      id: membership.tenant.id,
      name: membership.tenant.name,
      slug: membership.tenant.slug,
      demo: membership.tenant.demo,
    },
    role: membership.role,
    availableTenants: user.memberships
      .filter(({ tenant }) => tenant.active)
      .map(({ role, tenant }) => ({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        demo: tenant.demo,
        role,
      })),
    expiresAt: expiresAt.toISOString(),
  };
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
