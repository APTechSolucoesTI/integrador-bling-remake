import { ApChatFakeGateway, ApChatRealGateway, BlingFakeGateway, DemoOutboundBlockedError, MercadoLivreRealGateway, } from "../src/index.js";
import { describe, expect, it } from "vitest";
const demoContext = {
    tenantId: "00000000-0000-4000-8000-000000000001",
    correlationId: "00000000-0000-4000-8000-000000000003",
    demo: true,
};
describe("trava de saída do ambiente de demonstração", () => {
    it("bloqueia APChat real antes de qualquer chamada externa", async () => {
        await expect(new ApChatRealGateway(false).deliver(demoContext, {
            recipient: "+5500000000000",
            body: "mensagem fictícia",
            idempotencyKey: "nfe-1042",
        })).rejects.toBeInstanceOf(DemoOutboundBlockedError);
    });
    it("bloqueia Mercado Livre real quando DEMO_MODE global está ativo", async () => {
        await expect(new MercadoLivreRealGateway(true).getOrderFees({ ...demoContext, demo: false }, "order-1")).rejects.toBeInstanceOf(DemoOutboundBlockedError);
    });
    it("gateways fake produzem respostas determinísticas", async () => {
        const bling = new BlingFakeGateway();
        const apchat = new ApChatFakeGateway();
        await expect(bling.listNfe(demoContext, {
            status: 6,
            issuedFrom: "2026-08-01",
            issuedTo: "2026-08-07",
            page: 1,
            limit: 100,
        })).resolves.toHaveLength(1);
        await expect(apchat.deliver(demoContext, {
            recipient: "+5500000000000",
            body: "demo",
            idempotencyKey: "same-input",
        })).resolves.toMatchObject({ accepted: true });
    });
});
