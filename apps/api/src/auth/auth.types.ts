import type { ModulePermission } from "@integrador/contracts";
import type { Request } from "express";

export interface AuthPrincipal {
  sessionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  superAdmin: boolean;
  masterKeyAccess: boolean;
  activeTenantId: string;
  tenantName: string;
  tenantSlug: string;
  tenantDemo: boolean;
  legacyUnitId: number | null;
  permissions: ModulePermission[];
  expiresAt: Date;
}

export interface AuthenticatedRequest extends Request {
  auth: AuthPrincipal;
}
