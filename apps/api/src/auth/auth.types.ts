import type { Request } from "express";

export type TenantRole = "owner" | "admin" | "operator" | "viewer";

export interface AuthPrincipal {
  sessionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  superAdmin: boolean;
  activeTenantId: string;
  tenantName: string;
  tenantSlug: string;
  tenantDemo: boolean;
  legacyUnitId: number | null;
  role: TenantRole;
  expiresAt: Date;
}

export interface AuthenticatedRequest extends Request {
  auth: AuthPrincipal;
}
