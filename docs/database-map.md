# Mapa do banco legado

## Fontes

- DDL PostgreSQL versionado: `legacy/app/database/integrador_aptech-pgsql.sql`.
- Ajuste de sequences: `legacy/app/database/integrador_aptech-pgsql-adjust-sequences.sql`.
- Configuração: `legacy/app/config/integrador_aptech.php`.

Este mapa é baseado no DDL versionado. Introspecção de uma instância PostgreSQL real ainda não foi executada e poderá revelar drift, views, índices, defaults ou constraints adicionais.

## Grupos de tabelas

- Integrações: `bling_tokens`, `mercadolivre_tokens`, `ap_chat`, `api_lock`.
- Fiscal/vendas: `nfe`, `nfe_item`, `pedido_venda`, `boleto`, `natureza_operacao`, `status_envio`, `obs_envio`.
- Cadastro: `produtos`, `grupo_produto`, `pessoa`, `pessoa_endereco`, `vendedores`, `setor`, `canal_venda`, `forma_pagamento`.
- Tributação/custos: `tributacao`, `tributacao_difal`, `tributacao_item`, `credito_item`, `credito_ncm`, `custo_entrada`, `custo_fixo`, `custo_item`, `taxa_item`, `taxa_parcelamento`, `tipo_custo_fixo`, `cfcv`.
- Metas: `meta`, `meta_custo`, `meta_setor`, `meta_status`, `meta_vendedores`.
- Operação: `horario`, `crontab_config`, `log_crontab`, `pesquisa_satisfacao`, `preferencia_geral`.
- Framework/autorização: `system_unit`, `system_users`, `system_group`, `system_program` e tabelas de associação.

## Tenant legado

`system_unit.id` é referenciado diretamente por tokens Bling/ML, NF-e, itens, produtos, custos, taxas, vendedores e várias configurações. A migração adotará mapping explícito `system_unit.id -> tenant.legacyUnitId` inicialmente.

Risco: nem todas as colunas `unit_id` possuem FK declarada para `system_unit` no DDL. `pessoa` e `pessoa_endereco` possuem `unit_id NOT NULL`, mas não aparecem entre as FKs declaradas no final do arquivo; esse padrão exige validação por tabela e testes de isolamento. Não será adicionada migration destrutiva ou regra inventada para corrigir isso.

O DDL declara unique por unidade para `bling_tokens` e `mercadolivre_tokens`. A view localizada após o DDL relaciona NF-e a boleto, pessoa, vendedor e canal sempre combinando também `unit_id`, evidenciando que o tenant faz parte da identidade funcional desses joins.

## Control plane aditivo

A migration `20260808010000_saas_control_plane` cria somente objetos prefixados por `saas_` e três enums novos. Usuários, memberships, sessões e auditoria ficam no PostgreSQL:

- `saas_user` e `saas_tenant_membership` fazem o vínculo entre identidade moderna, papel e `legacy_user_id`;
- `saas_auth_session` armazena apenas o SHA-256 do token opaco, expiração e tenant ativo;
- dashboards e a listagem de NF-e do produto real consultam `view_nfe` com o `legacy_unit_id` autorizado;
- a demonstração pública não cria tabelas nem registros: seus mocks versionados são gravados exclusivamente no `localStorage` do visitante.

O vínculo de `user_id` na membership é opcional para permitir migração gradual dos registros legados existentes.

## Pendências de introspecção

- PKs, uniques, índices, sequences e defaults completos.
- Precisão/escala de todos os campos monetários.
- Semântica de NULL e timestamps.
- Status informais em `char`, `varchar` e inteiros.
- SQL manual em controllers/services.
- Drift entre DDL e banco executado.
