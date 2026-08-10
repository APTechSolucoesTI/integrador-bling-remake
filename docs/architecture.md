# Arquitetura moderna

## Estrutura

- `apps/web`: Next.js 16/App Router, experiência administrativa responsiva.
- `apps/api`: NestJS 11, OpenAPI em `/docs` e módulos HTTP.
- `apps/worker`: BullMQ, políticas de retry e chaves idempotentes por tenant.
- `packages/contracts`: contratos Zod compartilhados.
- `packages/domain`: regras puras, incluindo a caracterização decimal do lucro legado.
- `packages/integrations`: gateways Bling, APChat e Mercado Livre, reais/fake.
- `packages/db`: control plane SaaS em Prisma 7, separado das tabelas legadas.

## Limites de segurança

O login valida hash scrypt, cria um token opaco e grava somente seu SHA-256 em `saas_auth_session`. O navegador recebe o token em cookie HttpOnly/SameSite. O tenant ativo é resolvido dessa sessão e qualquer troca exige uma membership ativa. O teste `tenant-access.test.ts` comprova a rejeição cruzada básica.

Os gateways reais chamam `assertRealOutboundAllowed` antes de qualquer efeito. A saída é bloqueada quando o contexto do tenant é demo ou quando `DEMO_MODE=true` globalmente.

A rota pública `/demo` é uma fronteira separada: não usa sessão, API, banco ou gateways. Os mocks ficam no bundle do frontend, mudanças são validadas e persistidas em `localStorage`, e o visitante pode restaurar o estado inicial. O produto real continua autenticado e tenant-aware.

## Compatibilidade do banco

O schema Prisma atual contém apenas tabelas novas prefixadas por `saas_`. Ele não representa autorização para alterar o schema legado. `legacy/app/database/integrador_aptech-pgsql.sql` continua sendo o baseline estático, e uma instância real deverá passar por `prisma db pull`/introspecção controlada antes de models legados serem adicionados.

Nenhum `db push` automático é executado no Compose. Ele usa `prisma migrate deploy`, que aplica a migration aditiva versionada antes da API. Antes de usar a migration em um banco legado existente, ainda é obrigatório validar nomes, enums e histórico de migrations contra um clone sanitizado.
