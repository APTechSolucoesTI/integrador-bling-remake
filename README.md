# Integrador Bling — plataforma moderna

Monorepo TypeScript que substitui gradualmente o sistema PHP/Adianti preservado em `legacy/` apenas como referência funcional e origem de uma futura importação.

## Arquitetura atual

- `apps/web`: Next.js 16, produto autenticado e demo pública em `/demo`.
- `apps/api`: NestJS 11, sessão opaca, RBAC, OpenAPI e operações tenant-aware.
- `apps/worker`: BullMQ, sincronizações Bling/APChat/Mercado Livre e rotinas agendadas.
- `packages/db`: banco PostgreSQL próprio, inteiramente definido por Prisma e migrations.
- `packages/contracts`, `domain` e `integrations`: contratos, regras e gateways compartilhados.

O banco antigo não é dependência operacional. `DATABASE_URL` sempre aponta para um PostgreSQL novo do produto; `LEGACY_DATABASE_URL` é opcional, somente leitura e usada exclusivamente pelo importador de cutover. Veja [arquitetura do banco](docs/database-architecture.md) e [mapa de migração](docs/legacy-to-modern-database-map.md).

## Início rápido

```powershell
corepack pnpm install
Copy-Item .env.example .env
corepack pnpm db:migrate:deploy
corepack pnpm db:seed
corepack pnpm dev
```

Para provisionar o primeiro proprietário:

```powershell
$env:APBLING_ADMIN_EMAIL="admin@empresa.com.br"
$env:APBLING_ADMIN_PASSWORD="defina-uma-senha-forte"
$env:APBLING_ADMIN_NAME="Administrador"
$env:APBLING_TENANT_NAME="Minha Empresa"
$env:APBLING_TENANT_SLUG="minha-empresa"
corepack pnpm bootstrap:admin
```

`APBLING_LEGACY_UNIT_ID` e `APBLING_LEGACY_USER_ID` são metadados opcionais de rastreabilidade, nunca chaves operacionais.

## Primeiro teste real do Bling

O fluxo preferencial é OAuth pelo painel em **Operações → Autorizar Bling**: ele usa o callback configurado em `BLING_REDIRECT_URI` e cria uma credencial própria. Para validar a transição com um refresh token já existente, use o bootstrap administrativo local — ele não aceita token como argumento nem o registra:

```powershell
corepack pnpm bling:import-token -- --tenant <UUID_DO_TENANT>
```

O comando pede o refresh token sem eco, usa `BLING_CLIENT_ID` e `BLING_CLIENT_SECRET` para renová-lo com `enable-jwt: 1`, cifra os tokens retornados com AES-256-GCM e faz um GET mínimo de NF-e. Em seguida, persista no máximo cinco NF-e recentes:

```powershell
corepack pnpm bling:smoke -- --tenant <UUID_DO_TENANT> --limit 1 --from 2026-08-04 --to 2026-08-11
```

O smoke nunca dispara sincronização histórica, mensagens ou automações. Ele exige `TOKEN_ENCRYPTION_KEY_BASE64`, `DATABASE_URL`, `BLING_CLIENT_ID` e `BLING_CLIENT_SECRET` já configurados no ambiente. O refresh token precisa pertencer exatamente ao mesmo aplicativo Bling dessas credenciais.

## Banco e importação

Use apenas migrations versionadas:

```powershell
corepack pnpm db:migrate:dev
corepack pnpm db:migrate:deploy
corepack pnpm db:seed
```

Não use `prisma db pull` ou `prisma db push` como fonte do schema. Para auditar uma origem legada sem escrever nela:

```powershell
$env:LEGACY_DATABASE_URL="postgresql://usuario_readonly:senha@host/banco_antigo"
corepack pnpm db:migrate-legacy
```

O modo `--execute` está restrito ao primeiro estágio idempotente (empresas); os demais transformadores permanecem deliberadamente bloqueados até o cutover aprovado.

## Validação

```powershell
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm db:bootstrap:clean
```

`db:bootstrap:clean` sobe um PostgreSQL efêmero vazio, aplica migrations, gera o client, executa seed, compila e faz smoke de API, worker e web. Nenhuma integração externa é executada em modo demonstração.
