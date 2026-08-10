export interface GatewayContext {
  tenantId: string;
  correlationId: string;
  demo: boolean;
}

export class DemoOutboundBlockedError extends Error {
  constructor(integration: string) {
    super(
      `Saída real para ${integration} bloqueada no ambiente de demonstração`,
    );
    this.name = "DemoOutboundBlockedError";
  }
}

export function assertRealOutboundAllowed(
  integration: string,
  context: GatewayContext,
  globalDemoMode: boolean,
): void {
  if (context.demo || globalDemoMode) {
    throw new DemoOutboundBlockedError(integration);
  }
}
