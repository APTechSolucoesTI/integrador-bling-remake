---
name: frontend-saas
description: Use para criar ou migrar telas administrativas do Integrador Bling para uma UI SaaS moderna.
---

# Frontend SaaS

## Stack

Preferir:

- Next.js;
- TypeScript;
- Tailwind;
- shadcn/ui;
- Lucide;
- TanStack Table;
- React Hook Form;
- Zod;
- Recharts.

## Princípios

- densidade adequada para sistema administrativo;
- ações primárias evidentes;
- filtros persistentes quando útil;
- status com badge;
- skeleton/loading;
- empty state;
- erro acionável;
- acessibilidade;
- responsividade.

## Tabelas

Suportar quando aplicável:

- busca;
- filtros;
- paginação;
- sort;
- seleção;
- ações;
- exportação.

## Formulários

- labels claros;
- validação inline;
- máscaras;
- feedback de sucesso/erro;
- impedir double-submit.

## Arquitetura

Nenhuma regra fiscal ou integração externa deve morar em componente React.

UI chama contratos estáveis da API.
