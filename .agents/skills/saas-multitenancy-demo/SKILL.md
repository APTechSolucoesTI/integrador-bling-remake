---
name: saas-multitenancy-demo
description: Use ao transformar a aplicação em produto multiempresa comercial ou implementar o ambiente Demonstração.
---

# SaaS Multi-tenancy + Demo

## Tenant

O tenant deve ser resolvido no servidor.

Nunca usar `tenantId` do frontend como autorização suficiente.

## Isolamento

Toda entidade de negócio compartilhada deve possuir vínculo inequívoco com tenant.

Queries devem ser escopadas.

Testes devem comprovar que Tenant A não acessa Tenant B.

## Compatibilidade

Enquanto o legado depender de `unit_id`, crie mapping explícito em vez de uma migração agressiva.

## Credenciais

Bling, APChat e Mercado Livre devem ser configuráveis por tenant.

## Demo

O tenant Demonstração:

- usa somente dados falsos;
- usa gateways fake;
- não chama APIs reais;
- não envia mensagens;
- não carrega tokens reais;
- pode ser resetado;
- tem banner de demo.

Crie uma trava no nível de gateway para impedir saída real quando `DEMO_MODE=true`.
