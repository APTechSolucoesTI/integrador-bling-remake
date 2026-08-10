export class DemoOutboundBlockedError extends Error {
    constructor(integration) {
        super(`Saída real para ${integration} bloqueada no ambiente de demonstração`);
        this.name = "DemoOutboundBlockedError";
    }
}
export function assertRealOutboundAllowed(integration, context, globalDemoMode) {
    if (context.demo || globalDemoMode) {
        throw new DemoOutboundBlockedError(integration);
    }
}
