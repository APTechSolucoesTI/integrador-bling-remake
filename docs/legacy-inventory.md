# Inventário do legado

## Escopo e fonte de verdade

O código original foi preservado integralmente em `legacy/`. Este documento registra o primeiro passe de arqueologia; itens ainda não verificados estão marcados como pendentes e não devem ser tratados como regra de negócio confirmada.

## Runtime e estrutura

- PHP com Adianti Framework e artefatos MadBuilder.
- PostgreSQL principal configurado como `integrador_aptech`.
- Bases auxiliares do framework: `permission`, `communication` e `log`.
- Entradas HTTP principais: `index.php`, `rest.php`, `MadRestServer.php`, `callback.php`, `app/control/callbackml.php` e `download.php`.
- Código de produto concentrado em `app/control/basico`, `app/control/administracao`, `app/model`, `app/service/MetaService.php` e `app/service/basico/NFEService.php`.
- Framework/boilerplate concentrado em `lib`, `vendor`, `app/lib`, controles `admin`, `communication`, `log`, `builder` e serviços equivalentes. Eles são referência para autenticação/autorização, mas não serão portados linha a linha.

## Funcionalidades descobertas

| Área             | Entradas principais                                                  | Classificação                        | Observação inicial                                                                         |
| ---------------- | -------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------ |
| NF-e             | `ViewNfeHeaderList`, `NfeHeaderList`, `NFEService`                   | UI, regra, persistência, integração  | Sincronização Bling, itens, XML/PDF, boleto, rastreio e status precisam ser decompostos.   |
| Produtos         | `ProdutosHeaderList`, `GrupoProdutoHeaderList`                       | UI, persistência, integração         | Menu parcialmente comentado, mas funcionalidade ainda existe no código.                    |
| Tributação/DIFAL | `TributacaoHeaderList`, `TributacaoForm`, `TributacaoDifal*`         | regra financeira/fiscal              | Não alterar fórmulas sem golden master.                                                    |
| Custos/lucro     | `CustoFixoHeaderList`, `LucroNfeHeaderList`                          | regra financeira, relatório          | Usa custos fixos, taxas, créditos e itens de NF-e.                                         |
| Metas            | `MetaHeaderList`, `MetaForm`, `MetaService`                          | regra, persistência, relatório       | Relaciona metas, setores, vendedores, status e custos.                                     |
| Bling OAuth      | `callback.php`, `BlingTokenRefreshService`, `BlingTokens`, `ApiLock` | integração, segurança                | URLs legadas fixas; lock atual deve ser caracterizado antes da troca por lock distribuído. |
| Mercado Livre    | `app/control/callbackml.php`, `MercadolivreTokens`, `DashTaxasML`    | integração, dashboard                | OAuth e dashboard externo encontrados.                                                     |
| APChat           | `ApChatFormList`, `ApChat`                                           | integração, UI                       | Requer gateway isolado e modo fake no demo.                                                |
| Administração    | controles `app/control/admin` e models `app/model/admin`             | framework, autenticação, autorização | Usuários, grupos, programas e unidades são base para a transição SaaS.                     |
| Jobs             | `HorarioList`, `LogCrontabHeaderList`, `CrontabConfig`, `LogCrontab` | job, operação                        | Agendamentos efetivos e invocadores externos ainda precisam ser localizados.               |
| Relatórios       | várias ações de impressão/exportação e dashboards                    | relatório                            | HTML/PDF, planilhas, QR code e código de barras presentes nas dependências/runtime.        |

## Achados que exigem caracterização

- `app/service/basico/NFEService.php` é um serviço monolítico com chamadas cURL diretas e muitas transações; será dividido somente após mapear métodos, entradas, saídas e efeitos colaterais.
- `callback.php` e `app/control/callbackml.php` possuem redirect URIs legadas com IP/HTTP fixos. A migração deverá usar configuração validada por ambiente.
- Dashboards atuais apontam para URLs externas fixas. Conteúdo, filtros e autorização ainda precisam ser verificados.
- O menu não é inventário exaustivo: há ações comentadas e telas existentes fora dele.

## Próxima análise

1. Relacionar cada ação de menu a controller, model, service e tabelas.
2. Extrair todos os métodos e fluxos de `NFEService` e `MetaService`.
3. Localizar invocadores de cron/CLI e callbacks.
4. Criar fixtures sanitizadas dos cálculos e estados críticos.
