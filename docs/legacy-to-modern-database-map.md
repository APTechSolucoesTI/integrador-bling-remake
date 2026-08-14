# Mapa legado → banco moderno

O DDL auditado está em `legacy/app/database/integrador_aptech-pgsql.sql`. Nomes físicos estáveis do domínio foram preservados quando isso reduz risco de transformação; isolamento e relações agora usam `saas_tenant.id` UUID. `legacy_id` e `legacy_entity_mapping` existem apenas para rastreabilidade.

| Área               | Origem legada                                                                | Destino Prisma/moderno                                                 | Estratégia                                       |
| ------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------ |
| Empresa            | `system_unit`                                                                | `Tenant` / `saas_tenant`                                               | UUID novo; `legacyUnitId` opcional e único       |
| Usuário e vínculo  | `system_users`, `system_user_unit`                                           | `User`, `TenantMembership`                                             | identidade nova, membership e papel explícitos   |
| Sessão/preferência | `system_user`, `preferencia_geral`                                           | `AuthSession`, `UserPreference`, campos de `Tenant`                    | não importar sessão; transformar preferências    |
| Integrações        | `bling_tokens`, `mercadolivre_tokens`, `ap_chat`                             | `OAuthCredential`, `IntegrationConfig`, `ApChatConfig`                 | cifrar segredos durante cutover                  |
| Produtos           | `grupo_produto`, `produtos`                                                  | `ProductGroup`, `Product`                                              | upsert tenant + ID externo                       |
| Pessoas            | `pessoa`, `pessoa_endereco`                                                  | `Contact`, `Address`                                                   | contato e endereços normalizados                 |
| Comercial          | `setor`, `vendedores`, `canal_venda`, `forma_pagamento`, `natureza_operacao` | `Sector`, `Seller`, `SalesChannel`, `PaymentMethod`, `OperationNature` | upsert por tenant/ID externo                     |
| Pedidos            | `pedido_venda`                                                               | `SalesOrder`                                                           | valores decimais e relações explícitas           |
| NF-e               | `nfe`                                                                        | `Invoice`                                                              | status tipados, tenant UUID, IDs externos únicos |
| Itens              | `nfe_item`                                                                   | `InvoiceItem`                                                          | FK real para nota/produto; snapshot financeiro   |
| Custos de item     | `custo_item`                                                                 | `InvoiceItemCost`                                                      | composição 1:N preservada                        |
| Tributos de item   | `tributacao_item`                                                            | `InvoiceItemTax`                                                       | tributos discriminados e decimais                |
| Taxas/créditos     | `taxa_item`, `credito_item`                                                  | `InvoiceItemFee`, `InvoiceItemCredit`                                  | componentes auditáveis                           |
| Boletos/rastreio   | `boleto`, códigos em `nfe`                                                   | `Bill`, `TrackingCode`                                                 | documentos separados e idempotentes              |
| Custos fixos       | `tipo_custo_fixo`, `custo_fixo`, `cfcv`                                      | `FixedCostCategory`, `FixedCost`, `FixedCostChannel`                   | associações com FK e tenant                      |
| Tributação         | `tributacao`, `tributacao_difal`, `credito_ncm`, `taxa_parcelamento`         | `TaxRule`, `DifalRule`, `NcmCredit`, `InstallmentFee`                  | regras por tenant, constraints de UF/NCM         |
| Metas              | `meta`, `meta_vendedores`, `meta_setor`, `meta_custo`                        | `Goal`, `GoalSeller`, `GoalSector`, `GoalCost`                         | ciclo/status tipado e relações reais             |
| Agenda/log         | `crontab_config`, `log_crontab`                                              | `OperationalSchedule`, `OperationalLog`, `JobExecution`                | horários validados e execução observável         |
| Pesquisa           | `pesquisa_satisfacao`                                                        | `SatisfactionConfig`, `SatisfactionDispatch`                           | configuração e envio idempotente                 |
| Locks              | `api_lock`                                                                   | lock distribuído BullMQ/Redis                                          | não migrar locks transitórios                    |
| Chat interno       | `ap_chat`                                                                    | `ApChatConfig`                                                         | somente configuração operacional necessária      |
| View               | `view_nfe`                                                                   | `invoice_overview`                                                     | recriada somente com tabelas modernas            |
| Framework          | demais `system_*`                                                            | sem destino direto                                                     | substituído por Auth/RBAC/auditoria modernos     |
| Histórico técnico  | `log_crontab` e eventos dispersos                                            | `AuditLog`, `OperationalLog`, `LegacyImportRun`                        | separar auditoria, operação e importação         |

## Regras de transformação

- Chaves externas são strings para evitar perda de precisão.
- Dinheiro é convertido para `Decimal`; nenhum `float` é usado como fonte contábil.
- Datas sem timezone recebem a interpretação documentada de `America/Sao_Paulo` antes de virar `timestamptz`.
- `S/N` e inteiros de status viram booleanos/enums.
- Cada upsert de cutover grava `sourceTable`, `legacyId`, entidade e UUID/ID de destino em `legacy_entity_mapping`.
- Registros órfãos ou inválidos são contabilizados no checkpoint e não são corrigidos silenciosamente.
