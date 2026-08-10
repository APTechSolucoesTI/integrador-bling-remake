# NF-e — caracterização da listagem

Atualizado em: 2026-08-08

## Evidência legada

A listagem principal está em `legacy/app/control/basico/ViewNfeHeaderList.php`, usa o model `ViewNfe` sobre a view PostgreSQL `view_nfe` e fixa 50 registros por página. O critério `unit_id = TSession::getValue('userunitid')` é aplicado antes dos demais filtros.

Filtros observados no método `onSearch`:

- `numero`, `serie` e `valor` por igualdade;
- `nome` por `ilike %valor%`;
- `envio` por `S`/`N`;
- emissão inicial `>=` e final `<=`, considerando a data;
- status pelo texto de `status_envio`;
- atalhos de status pelos IDs 1, 2, 4 e 5.

A ordenação padrão é `data_emissao desc`. A tabela apresenta número, série, cliente, bloqueio de mensagens, valor, emissão, DANFE, rastreio e status. Os totais por status são lidos da tabela `nfe` para toda a unidade, sem os filtros correntes da grade.

## Implementação moderna

`GET /v1/nfe` mantém o limite padrão de 50, paginação, filtros exatos e ordenações permitidas por allowlist. O `unit_id` nunca é aceito da query: ele vem exclusivamente do `legacyUnitId` do tenant autenticado. A resposta é validada por Zod antes de sair da API.

A rota `/app/nfe` é read-only nesta fatia. DANFE vindo do banco só vira link quando o protocolo é HTTP(S); rastreio abre o domínio dos Correios com o código escapado. Envio, ressincronização e alterações permanecem no legado até seus efeitos colaterais serem caracterizados e testados.

## Divergências legadas registradas

1. O campo visual “código de rastreio” envia `S`/`N`, mas o controller filtra `codigo_rastreio = S/N`, embora a própria view exponha `tem_cod`. A UI moderna aplica a semântica apresentada ao usuário: existência ou ausência de código. Essa correção deve ser comparada com dados sanitizados antes de declarar paridade comprovada.
2. Os inserts versionados nomeiam ID 2 como “Inconformidade” e ID 4 como “Pronto para Envio”, enquanto o transformer atual pinta ID 2 como “Pronto para Envio” e ID 4 como “Erro”. A API retorna o texto armazenado em `status_envio` e usa o ID somente para filtro/tonalidade; não renomeia status.
3. O DDL é apenas baseline versionado. Tipos, índices e drift da instância executada ainda precisam de introspecção.

## Provas atuais

- contrato rejeita paginação acima de 100, normaliza valor decimal e valida o intervalo;
- teste de serviço comprova que todas as consultas recebem a unidade da sessão;
- tenant marcado como demo falha antes de qualquer acesso ao PostgreSQL;
- integração contra PostgreSQL real continua pendente por indisponibilidade do runtime/banco local.
