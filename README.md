# Integrador Bling — Modernização SaaS

Migração incremental do legado PHP/Adianti para TypeScript, Node.js e Next.js. O sistema original permanece preservado em `legacy/` como especificação funcional.

## Estado atual

- Monorepo pnpm com web, API e worker.
- Control plane multi-tenant Prisma/PostgreSQL, sem mudanças destrutivas no legado.
- Demo pública sem login/backend, com mocks manipuláveis persistidos em `localStorage`.
- Gateways produtivos isolados para Bling, APChat e Mercado Livre, com OAuth moderno e execução externa via API/worker.
- Sincronização BullMQ de NF-e, detalhes documentais, produtos e pedidos de venda para o PostgreSQL legado, sempre limitada à unidade ativa.
- Núcleo decimal de caracterização para lucro/margem.
- BullMQ com retry finito, backoff e idempotência por tenant.
- Landing APBling, dashboard SaaS responsivo e áreas reais de NF-e, catálogos, documentos, financeiro, metas, operações e administração.

Consulte [MIGRATION_STATUS.md](MIGRATION_STATUS.md) para o progresso e os bloqueios reais. A matriz de paridade está em [docs/feature-matrix.md](docs/feature-matrix.md).

## Início rápido

```powershell
corepack pnpm install
Copy-Item .env.example .env
corepack pnpm dev
```

Depois da migration/build, o primeiro acesso real é provisionado de forma idempotente:

```powershell
$env:APBLING_ADMIN_EMAIL="admin@empresa.com.br"
$env:APBLING_ADMIN_PASSWORD="defina-uma-senha-forte"
$env:APBLING_ADMIN_NAME="Administrador"
$env:APBLING_TENANT_NAME="Minha Empresa"
$env:APBLING_TENANT_SLUG="minha-empresa"
$env:APBLING_LEGACY_UNIT_ID="1"
$env:APBLING_LEGACY_USER_ID="-1"
corepack pnpm bootstrap:admin
```

O banco apontado por `DATABASE_URL` deve conter o schema legado, além das migrations aditivas `saas_*`.

Para os callbacks OAuth, configure `WEB_APP_URL`, `BLING_REDIRECT_URI` e `MERCADO_LIVRE_REDIRECT_URI` com URLs cadastradas nos respectivos aplicativos. Tokens e credenciais continuam vinculados à unidade no PostgreSQL e nunca pertencem à demonstração pública.

Ou, com Docker disponível:

```powershell
docker compose up --build
```

## Validação

```powershell
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

Nenhuma integração real é executada quando o tenant ou o processo está em modo demonstração. Não faça `db push` contra o banco legado; siga [docs/deployment.md](docs/deployment.md).
