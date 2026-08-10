---
name: legacy-adianti-archaeology
description: Use para entender e decompor código legado PHP feito com Adianti Framework/MadBuilder antes de migrar para outra stack.
---

# Legacy Adianti Archaeology

## Objetivo

Extrair comportamento de negócio do legado sem confundir código do framework com código customizado.

## Procedimento

Ao analisar uma funcionalidade:

1. encontre a entrada no menu;
2. encontre a classe em `app/control`;
3. identifique métodos `onSave`, `onEdit`, `onReload`, ações customizadas e callbacks;
4. encontre models usados;
5. encontre services chamados;
6. encontre `TTransaction::open(...)` para descobrir banco;
7. registre queries SQL manuais;
8. procure `where`, `load`, `first`, `store`, `delete`;
9. descubra efeitos colaterais externos;
10. descubra status e números mágicos;
11. descubra arquivos gerados/baixados;
12. descubra mensagens de erro que representam regras;
13. procure crons/scripts que usam as mesmas models.

## Classificação

Classifique cada trecho como:

- framework;
- boilerplate gerado;
- UI;
- persistência;
- regra de negócio;
- integração;
- job;
- autenticação/permissão;
- relatório;
- utilitário.

## Saída esperada

Atualize a feature matrix com:

- arquivo legado;
- regra;
- tabelas;
- integração;
- efeitos colaterais;
- nova implementação;
- teste de paridade.

Nunca porte automaticamente código do Adianti para TypeScript linha a linha.
