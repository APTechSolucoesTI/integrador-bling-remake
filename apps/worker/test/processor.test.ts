import { ApChatFakeGateway, BlingFakeGateway } from "@integrador/integrations";
import { describe, expect, it } from "vitest";
import {
  createIntegrationProcessor,
  DemoTenantMismatchError,
  WorkerHandlerNotConfiguredError,
} from "../src/processor.js";

const tenantId = "00000000-0000-4000-8000-000000000001";
const base = {
  tenantId,
  correlationId: "00000000-0000-4000-8000-000000000003",
  createdAt: "2026-08-08T00:00:00.000Z",
};

function processor(demoMode = true) {
  return createIntegrationProcessor({
    demoMode,
    demoTenantId: tenantId,
    bling: new BlingFakeGateway(),
    apchat: new ApChatFakeGateway(),
  });
}

describe("processor de integrações", () => {
  it("processa sincronização Bling demo sem rede", async () => {
    await expect(
      processor()({
        ...base,
        jobType: "bling.sync-nfe",
        payload: { from: "2026-08-01", to: "2026-08-08" },
      }),
    ).resolves.toMatchObject({ mode: "demo", fetched: 1 });
  });

  it("processa entrega APChat fake com resposta determinística", async () => {
    await expect(
      processor()({
        ...base,
        jobType: "apchat.deliver",
        payload: {
          recipient: "+5500000000000",
          body: "Mensagem fictícia",
          idempotencyKey: "nfe-1042",
        },
      }),
    ).resolves.toMatchObject({ mode: "demo", accepted: true });
  });

  it("recusa tenant diferente no worker demo", async () => {
    await expect(
      processor()({
        ...base,
        tenantId: "00000000-0000-4000-8000-000000000009",
        jobType: "bling.sync-nfe",
        payload: { from: "2026-08-01", to: "2026-08-08" },
      }),
    ).rejects.toBeInstanceOf(DemoTenantMismatchError);
  });

  it("falha fechado fora do demo enquanto handler real não está ligado", async () => {
    await expect(
      processor(false)({
        ...base,
        jobType: "bling.sync-nfe",
        payload: { from: "2026-08-01", to: "2026-08-08" },
      }),
    ).rejects.toBeInstanceOf(WorkerHandlerNotConfiguredError);
  });
});
