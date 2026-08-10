---
name: parity-testing
description: Use para provar que a implementação TypeScript mantém o comportamento funcional do PHP legado.
---

# Parity Testing

## Estratégia Golden Master

Para cada regra crítica:

1. selecione entrada realista sanitizada;
2. capture resultado do legado;
3. armazene fixture esperada;
4. execute código novo;
5. compare semanticamente.

## Prioridades

Testar primeiro:

- cálculos;
- status;
- sincronização;
- deduplicação;
- seleção de notas;
- envio;
- XML;
- boleto;
- rastreio;
- token refresh.

## Dinheiro

Não comparar floats de forma ingênua.

Use decimal e a mesma escala/regra de arredondamento do legado.

## Banco

Para fluxos com persistência, valide:

- registros criados;
- registros atualizados;
- status;
- ausência de duplicação;
- escopo de tenant.

## E2E

Use Playwright nos fluxos críticos de operador.

Paridade é comportamento, não aparência visual.
