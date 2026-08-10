export class TenantAccessDeniedError extends Error {
  constructor() {
    super("Usuário não possui acesso ao tenant solicitado");
    this.name = "TenantAccessDeniedError";
  }
}

export interface AuthenticatedTenantSession {
  userId: string;
  activeTenantId: string;
  allowedTenantIds: readonly string[];
}

/** O tenant ativo vem da sessão autenticada; um header apenas pode restringi-lo. */
export function resolveAuthorizedTenant(
  session: AuthenticatedTenantSession,
  requestedTenantId?: string,
): string {
  const tenantId = requestedTenantId ?? session.activeTenantId;

  if (!session.allowedTenantIds.includes(tenantId)) {
    throw new TenantAccessDeniedError();
  }

  return tenantId;
}
