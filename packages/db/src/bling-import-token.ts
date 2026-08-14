import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPrismaClient } from "./client.js";
import { encryptSecret } from "./secret-codec.js";
import {
  BlingOAuthHttpGateway,
  BlingRealGateway,
} from "@integrador/integrations";

loadEnvironmentFile();

const tenantId = requiredArgument("--tenant");
const skipRefresh = process.argv.includes("--skip-refresh");
const expiresAtArgument = optionalArgument("--expires-at");
const databaseUrl = requiredEnvironment("DATABASE_URL");
const clientId = requiredEnvironment("BLING_CLIENT_ID");
const clientSecret = requiredEnvironment("BLING_CLIENT_SECRET");

if (!isUuid(tenantId)) throw new Error("--tenant deve ser um UUID válido");

const database = createPrismaClient(databaseUrl);

try {
  const tenant = await database.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, active: true, demo: true },
  });
  if (!tenant?.active || tenant.demo)
    throw new Error(
      "O tenant informado deve existir, estar ativo e não ser demo",
    );

  const refreshToken = await readSecret("Refresh token Bling: ");
  let accessToken: string;
  let nextRefreshToken: string;
  let expiresAt: Date;

  if (skipRefresh) {
    accessToken = requiredEnvironment("BLING_ACCESS_TOKEN");
    nextRefreshToken = refreshToken;
    expiresAt = parseExpiresAt(expiresAtArgument);
  } else {
    const oauth = new BlingOAuthHttpGateway({ globalDemoMode: false });
    const refreshed = await oauth.refresh(
      { tenantId, correlationId: randomUUID(), demo: false },
      { clientId, clientSecret },
      refreshToken,
    );
    if (refreshed.kind !== "success") {
      throw new Error(
        refreshed.kind === "invalid_grant"
          ? "O refresh token foi recusado pelo Bling"
          : `Não foi possível renovar o token Bling (${refreshed.code})`,
      );
    }
    accessToken = refreshed.accessToken;
    nextRefreshToken = refreshed.refreshToken;
    expiresAt = new Date(Date.now() + refreshed.expiresInSeconds * 1_000);
  }

  await database.$transaction(async (transaction) => {
    await transaction.oAuthCredential.upsert({
      where: { tenantId_kind: { tenantId, kind: "bling" } },
      create: {
        tenantId,
        kind: "bling",
        status: "connected",
        accessTokenCiphertext: encryptSecret(accessToken),
        refreshTokenCiphertext: encryptSecret(nextRefreshToken),
        accessTokenExpiresAt: expiresAt,
        connectedAt: new Date(),
        metadata: {
          source: "secure-cli-bootstrap",
          jwtRequested: !skipRefresh,
        },
      },
      update: {
        status: "connected",
        accessTokenCiphertext: encryptSecret(accessToken),
        refreshTokenCiphertext: encryptSecret(nextRefreshToken),
        accessTokenExpiresAt: expiresAt,
        authorizationStateHash: null,
        authorizationExpiresAt: null,
        connectedAt: new Date(),
        lastError: null,
        metadata: {
          source: "secure-cli-bootstrap",
          jwtRequested: !skipRefresh,
        },
      },
    });
    await transaction.auditLog.create({
      data: {
        tenantId,
        actorUserId: null,
        action: "bling.credential.bootstrap",
        entityType: "integration",
        entityId: "bling",
        correlationId: randomUUID(),
        metadata: { refreshed: !skipRefresh, jwtRequested: !skipRefresh },
      },
    });
  });

  const gateway = new BlingRealGateway({
    globalDemoMode: false,
    tokenProvider: fixedTokenProvider(accessToken),
  });
  const today = new Date().toISOString().slice(0, 10);
  const response = await gateway.listNfe(
    { tenantId, correlationId: randomUUID(), demo: false },
    {
      status: 5,
      issuedFrom: `${today} 00:00:00`,
      issuedTo: `${today} 23:59:59`,
      page: 1,
      limit: 1,
    },
  );

  console.info(
    JSON.stringify({
      event: "bling.credential.bootstrap.completed",
      tenantId,
      refreshed: !skipRefresh,
      accessTokenStored: true,
      refreshTokenRotated: !skipRefresh,
      verificationResource: "GET /Api/v3/nfe",
      verificationRecords: response.length,
    }),
  );
} finally {
  await database.$disconnect();
}

function fixedTokenProvider(accessToken: string) {
  return {
    getAccessToken: () => Promise.resolve(accessToken),
    handleUnauthorized: () =>
      Promise.reject(
        new Error("O token recém-renovado foi recusado pelo Bling"),
      ),
  };
}

function requiredArgument(name: string): string {
  const value = optionalArgument(name);
  if (!value) throw new Error(`Parâmetro obrigatório ausente: ${name}`);
  return value;
}

function optionalArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} não configurada`);
  return value;
}

function parseExpiresAt(value: string | undefined): Date {
  if (!value) throw new Error("--skip-refresh exige --expires-at em ISO-8601");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("--expires-at inválido");
  return date;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function readSecret(prompt: string): Promise<string> {
  if (!process.stdin.isTTY)
    throw new Error(
      "Este comando exige um terminal interativo para proteger o token",
    );
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return await new Promise<string>((resolve, reject) => {
    let value = "";
    const finish = (): void => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    };
    process.stdin.on("data", (chunk: Buffer) => {
      const key = chunk.toString("utf8");
      if (key === "\u0003") {
        finish();
        reject(new Error("Entrada cancelada"));
        return;
      }
      if (key === "\r" || key === "\n") {
        finish();
        if (!value) reject(new Error("Refresh token vazio"));
        else resolve(value);
        return;
      }
      if (key === "\u007f" || key === "\b") {
        value = value.slice(0, -1);
        return;
      }
      value += key;
    });
  });
}

function loadEnvironmentFile(): void {
  const candidates = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
  ];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) continue;
    const [, name, value] = match;
    if (
      name !== undefined &&
      value !== undefined &&
      process.env[name] === undefined
    )
      process.env[name] = value;
  }
}
