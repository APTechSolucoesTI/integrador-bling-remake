# Execução e deployment

## Pré-requisitos locais

- Node.js 22 ou superior.
- Corepack disponível.
- PostgreSQL e Redis para fluxos persistentes/worker.
- Docker Compose opcional.

## Desenvolvimento

```powershell
corepack pnpm install
Copy-Item .env.example .env
corepack pnpm dev
```

API: `http://localhost:3001`, OpenAPI: `http://localhost:3001/docs`, web: `http://localhost:3000`.

Para desenvolvimento OAuth, cadastre e mantenha idênticas às URLs dos provedores:

```text
WEB_APP_URL=http://localhost:3000
BLING_REDIRECT_URI=http://localhost:3001/v1/integrations/bling/callback
MERCADO_LIVRE_REDIRECT_URI=http://localhost:3001/v1/integrations/mercado-livre/callback
```

O APChat usa as credenciais da tabela legada por unidade; `APCHAT_BASE_URL` só é necessário quando o endpoint contratado for diferente do padrão.

## Qualidade

```powershell
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

## Docker Compose

```powershell
docker compose up --build
```

O Compose sobe PostgreSQL, aplica somente as migrations aditivas versionadas e então inicia Redis, API, worker e web. A demonstração em `/demo` é pública, usa apenas dados fictícios no navegador e não precisa de banco, seed ou login.

Para executar a migration manualmente:

```powershell
corepack pnpm --filter @integrador/db exec prisma migrate deploy
```

## Primeiro proprietário

O produto real não cria credenciais fictícias. Configure `APBLING_ADMIN_EMAIL`, `APBLING_ADMIN_PASSWORD`, `APBLING_ADMIN_NAME`, `APBLING_TENANT_NAME`, `APBLING_TENANT_SLUG` e, quando disponível, `APBLING_LEGACY_UNIT_ID`/`APBLING_LEGACY_USER_ID`. Depois do build:

```powershell
corepack pnpm bootstrap:admin
```

O bootstrap pode ser repetido: ele atualiza o acesso informado, preserva os demais usuários e garante o papel de proprietário/superadmin.

Rotas web: landing em `/`, demonstração pública em `/demo`, autenticação em `/login` e produto protegido sob `/app/*` (dashboard, NF-e, cadastros, documentos, financeiro, metas, operações e administração). O painel de operações enfileira NF-e, produtos e pedidos de venda; Redis e o worker precisam estar ativos para executar essas rotinas.

`COOKIE_SECURE=false` existe apenas para o Compose local servido por HTTP. Em qualquer ambiente com TLS, mantenha `COOKIE_SECURE=true`.

## Produção

Antes de produção são obrigatórios: banco clonado/validado, migration aditiva revisada, secrets no cofre da plataforma, `DEMO_MODE=false`, credenciais por tenant criptografadas, TLS, domínio/callbacks OAuth cadastrados e plano de rollback ensaiado. O estado atual não está autorizado para deploy de produção.
