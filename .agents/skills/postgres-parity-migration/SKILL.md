---
name: postgres-parity-migration
description: Use para introspecção, compatibilidade e evolução segura do PostgreSQL legado durante a modernização.
---

# PostgreSQL Parity Migration

## Princípio

Compatibilidade primeiro. Limpeza depois.

## Regras

- Fazer introspecção do schema antes de criar models.
- Preservar nomes e semântica quando isso reduzir risco.
- Catalogar PKs, FKs, índices, uniques, views e sequences.
- Procurar SQL manual no PHP antes de mudar schema.
- Mapear `unit_id` e isolamento de tenant.
- Verificar tipos monetários, numeric precision e timestamps.
- Verificar comportamento de NULL/default.
- Verificar status armazenados como char/int.
- Não executar `DROP`, truncate ou alteração destrutiva em dados reais.

## Prisma

Use `prisma db pull` ou processo equivalente para compreender o banco existente.

Não trate o schema Prisma gerado como autorização para alterar o banco.

## Migrations

Uma migration destrutiva requer:

- backup;
- migração de dados;
- validação;
- rollback;
- impacto conhecido.

## Teste

Para queries críticas:

- crie dataset controlado;
- execute versão legada quando possível;
- execute versão nova;
- compare linhas, valores e arredondamentos.
