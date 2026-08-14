import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { Buffer } from "node:buffer";
import process from "node:process";
import EmbeddedPostgres from "embedded-postgres";

const root = resolve(import.meta.dirname, "..");
const corepack = "corepack";
const node = process.execPath;
const password = "bootstrap-only-password";
const databaseName = "integrador_bootstrap";
const children = [];

const freePort = async () =>
  await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Não foi possível reservar uma porta local"));
        return;
      }
      server.close(() => resolvePort(address.port));
    });
  });

const run = (args, env) => {
  const result = spawnSync(corepack, ["pnpm", ...args], {
    cwd: root,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(
      `Falha: pnpm ${args.join(" ")}${result.error ? ` (${result.error.message})` : ""}`,
    );
  }
};

const startNode = (args, cwd, env) => {
  const child = spawn(node, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  children.push(child);
  return child;
};

const waitForUrl = async (url, child, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(`${url} encerrou antes do smoke test`);
    try {
      const response = await globalThis.fetch(url);
      if (response.ok) return response;
    } catch {
      // O serviço ainda está inicializando.
    }
    await new Promise((resolveWait) => globalThis.setTimeout(resolveWait, 250));
  }
  throw new Error(`Timeout aguardando ${url}`);
};

const stopChildren = () => {
  for (const child of children) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }
};

const databaseDir = await mkdtemp(join(tmpdir(), "integrador-bootstrap-"));
const postgresPort = await freePort();
const apiPort = await freePort();
const webPort = await freePort();
const postgres = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password,
  port: postgresPort,
  persistent: false,
  onLog: () => {},
});

try {
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase(databaseName);

  const databaseUrl = `postgresql://postgres:${password}@127.0.0.1:${postgresPort}/${databaseName}`;
  const env = {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl,
    DEMO_MODE: "false",
    DEMO_TENANT_ID: "00000000-0000-4000-8000-000000000001",
    API_PORT: String(apiPort),
    NEXT_PUBLIC_API_URL: `http://127.0.0.1:${apiPort}`,
    WEB_APP_URL: `http://127.0.0.1:${webPort}`,
    COOKIE_SECURE: "false",
    TOKEN_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 7).toString("base64"),
    BOOTSTRAP_SMOKE_MODE: "true",
  };

  run(["--filter", "@integrador/db", "prisma:migrate:deploy"], env);
  run(["--filter", "@integrador/db", "prisma:generate"], env);
  run(["--filter", "@integrador/db", "prisma:seed"], env);
  run(["build"], env);

  const client = postgres.getPgClient(databaseName, "127.0.0.1");
  await client.connect();
  const verification = await client.query(`
    SELECT
      to_regclass('public.saas_tenant') IS NOT NULL AS tenant_table,
      to_regclass('public.nfe') IS NOT NULL AS invoice_table,
      to_regclass('public.invoice_overview') IS NOT NULL AS invoice_view,
      (SELECT COUNT(*) FROM saas_tenant) AS tenant_count
  `);
  await client.end();
  const row = verification.rows[0];
  if (
    !row?.tenant_table ||
    !row?.invoice_table ||
    !row?.invoice_view ||
    Number(row.tenant_count) < 1
  ) {
    throw new Error("Schema ou seed incompleto após as migrations");
  }

  const api = startNode(["dist/main.js"], join(root, "apps/api"), env);
  await waitForUrl(`http://127.0.0.1:${apiPort}/health`, api);

  const worker = startNode(["dist/main.js"], join(root, "apps/worker"), {
    ...env,
    BOOTSTRAP_SMOKE_MODE: "true",
  });
  const workerExit = await new Promise((resolveExit, reject) => {
    worker.once("error", reject);
    worker.once("exit", (code) => resolveExit(code));
  });
  if (workerExit !== 0) throw new Error("Worker falhou no smoke test do banco");

  const web = startNode(
    [
      join(root, "apps/web/node_modules/next/dist/bin/next"),
      "start",
      "-p",
      String(webPort),
    ],
    join(root, "apps/web"),
    env,
  );
  await waitForUrl(`http://127.0.0.1:${webPort}/demo`, web);

  globalThis.console.info(
    "CLEAN_BOOTSTRAP_OK: migrations, generate, seed, API, worker e web validados.",
  );
} finally {
  stopChildren();
  await postgres.stop().catch(() => {});
}
