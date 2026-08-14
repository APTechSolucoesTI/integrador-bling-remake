# Arquitetura moderna

## Componentes

- `apps/web`: Next.js 16/App Router.
- `apps/api`: NestJS 11 e OpenAPI em `/docs`.
- `apps/worker`: BullMQ, retries e idempotência por tenant.
- `packages/contracts`: contratos Zod.
- `packages/domain`: regras financeiras decimais.
- `packages/integrations`: gateways Bling, APChat e Mercado Livre.
- `packages/db`: Prisma 7 e schema integral do PostgreSQL do produto.

## Fronteiras

Web e API nunca recebem uma unidade operacional da requisição. O tenant UUID vem da sessão, e toda consulta persistente o aplica no servidor. Tokens externos são cifrados com AES-256-GCM usando `TOKEN_ENCRYPTION_KEY_BASE64`.

O PostgreSQL legado não participa do runtime. Ele é uma fonte externa opcional e somente leitura do comando de importação. Tabelas do framework Adianti (`system_*`) e a antiga `view_nfe` não são dependências do produto.

O login grava somente o SHA-256 do token opaco em `saas_auth_session`; o navegador recebe cookie HttpOnly/SameSite. Trocas de empresa exigem membership ativa. A rota `/demo` permanece separada, sem API, banco ou efeitos externos.

Detalhes do ciclo do banco estão em [database-architecture.md](database-architecture.md).
