# AGENTS.md — Integrador Bling Modernization

## Objetivo

Este repositório está em processo de migração de PHP/Adianti/MadBuilder para TypeScript/Node/Next.

O legado é a fonte primária de verdade para comportamento funcional.

## Política de autonomia

Para tarefas de implementação:

- leia os arquivos necessários;
- faça mudanças locais;
- rode validações;
- corrija os problemas encontrados;
- avance sem pedir confirmação para ações locais, reversíveis e não destrutivas.

Exija confirmação para:

- produção;
- dados reais;
- migrations destrutivas;
- push/deploy;
- chamadas externas com efeitos reais;
- envio de mensagens reais.

## Regras obrigatórias

1. Não apagar o legado antes da paridade.
2. Não inventar regras de negócio.
3. Não simplificar cálculo fiscal/financeiro sem teste.
4. Não mover jobs longos para o runtime do Next.
5. Não registrar tokens/segredos.
6. Não confiar em tenant vindo do cliente sem autorização no servidor.
7. Não fazer migration destrutiva sem rollback.
8. Não considerar tela pronta sem fluxo backend e teste quando aplicável.
9. Atualizar `docs/feature-matrix.md` e `MIGRATION_STATUS.md`.
10. Preferir fatias verticais completas.

## Arquitetura preferencial

- Next.js + TypeScript para web.
- NestJS + TypeScript para API.
- BullMQ + Redis para workers.
- PostgreSQL + Prisma.
- Zod para contratos.
- pnpm workspace/monorepo.
- Tailwind + shadcn/ui.
- Vitest para unit/integration.
- Playwright para E2E.

## Domínios críticos

- Tenant/Unit
- Usuários e permissões
- Bling OAuth
- NF-e
- XML/PDF
- Boletos
- Rastreamento
- Pessoas
- Produtos
- Canais de venda
- Mercado Livre
- APChat
- Tributação/DIFAL
- Custos
- Lucro/margem
- Metas
- Jobs/crontab
- Logs
- Dashboards

## Sequência de análise

Antes de migrar um domínio:

1. encontrar controllers/forms relacionados;
2. encontrar models;
3. encontrar services;
4. encontrar SQL;
5. encontrar jobs;
6. encontrar integrações externas;
7. identificar status/enums;
8. identificar efeitos colaterais;
9. criar fixtures/testes de caracterização;
10. implementar equivalente moderno;
11. validar paridade.

## Skills

Leia a skill mais específica antes de executar trabalho relevante em:

- arqueologia Adianti;
- migração PostgreSQL;
- Bling;
- jobs;
- multi-tenancy/demo;
- testes de paridade;
- frontend;
- segurança.

## Qualidade de entrega

Toda mudança relevante deve terminar com o máximo possível de:

- format;
- lint;
- typecheck;
- unit tests;
- integration tests;
- build;
- smoke test.

Se uma validação não puder ser executada, registre o motivo de forma objetiva.

## Commits

Pode preparar commits locais pequenos e coerentes se útil.

Não faça push sem autorização.
