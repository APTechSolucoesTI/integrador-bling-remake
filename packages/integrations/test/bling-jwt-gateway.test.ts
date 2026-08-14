import { describe, expect, it, vi } from "vitest";
import { BlingOAuthHttpGateway, BlingRealGateway } from "../src/index.js";

const context = {
  tenantId: "00000000-0000-4000-8000-000000000001",
  correlationId: "00000000-0000-4000-8000-000000000002",
  demo: false,
};

describe("gateway Bling JWT", () => {
  it("renova uma vez após 401 e repete a requisição com enable-jwt", async () => {
    const getAccessToken = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("access-antigo")
      .mockResolvedValueOnce("access-novo");
    const handleUnauthorized = vi.fn<() => Promise<void>>().mockResolvedValue();
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    const gateway = new BlingRealGateway({
      globalDemoMode: false,
      tokenProvider: { getAccessToken, handleUnauthorized },
      fetch,
      minimumIntervalMs: 0,
    });

    await expect(
      gateway.listNfe(context, {
        status: 5,
        issuedFrom: "2026-08-01 00:00:00",
        issuedTo: "2026-08-01 23:59:59",
        page: 1,
        limit: 1,
      }),
    ).resolves.toEqual([]);

    expect(handleUnauthorized).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]?.[1]?.headers).toMatchObject({
      authorization: "Bearer access-novo",
      "enable-jwt": "1",
    });
  });

  it("envia enable-jwt ao renovar um refresh token", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "access-jwt",
          refresh_token: "refresh-rotacionado",
          expires_in: 3600,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    const oauth = new BlingOAuthHttpGateway({
      globalDemoMode: false,
      fetch,
    });

    await expect(
      oauth.refresh(
        context,
        { clientId: "id", clientSecret: "secret" },
        "refresh",
      ),
    ).resolves.toMatchObject({ kind: "success" });
    expect(fetch.mock.calls[0]?.[1]?.headers).toMatchObject({
      "enable-jwt": "1",
    });
  });
});
