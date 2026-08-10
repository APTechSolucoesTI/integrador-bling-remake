# DashFinal — análise de paridade

Atualizado em: 2026-08-08

## Evidência observada

`legacy/app/control/administracao/DashFinal.php` não calcula indicadores. O controller cria um `iframe` para o dashboard público Metabase `4a3324f1-de69-461a-8de0-55e7e0c8a8d1`, hospedado por HTTP no IP `194.140.198.97:3001`.

Em 2026-08-08, o HTML público e `GET /api/public/dashboard/{uuid}` responderam HTTP 200. O metadado retornado identifica o dashboard como **Faturamento Nadel**, com 5 abas, 32 cartões e 9 parâmetros.

### Abas e cartões

| Aba                  | Conteúdo confirmado                                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Faturamento          | quantidade e valor de faturamento; unidade; origem/tipo de venda; competência; faturamento diário com mediana; acumulado; ranking e quantidade de compras por cliente; mapa |
| Lucro                | faturamento; custo; lucro; imposto; margem; séries por período, unidade e origem; TME; acumulado; rankings por cliente e produto                                            |
| Lucro por Produto    | relatório consolidado com quantidade, venda bruta/líquida, imposto, custo líquido, lucro, margem, quantidade de notas e itens                                               |
| Custo X Lucro Mensal | lucro acumulado contra custo da meta, saldo e percentual atingido                                                                                                           |
| Mapa                 | distribuição geográfica do faturamento                                                                                                                                      |

Parâmetros confirmados: `Mês/Ano`, `Produto`, `Empresa`, `Origem`, `Competência`, `Mês de Competência`, `Ano`, `Mês` e `Dia`.

## Regras comprovadas

1. O cartão `Margem de Lucro` agrega lucro e faturamento e calcula `lucro / faturamento × 100`.
2. O relatório por produto consulta `bi.produtos_nfe_base` e calcula margem como `SUM(valor_lucro_item) / SUM(venda_bruta_item) × 100`, retornando `NULL` quando a venda bruta agregada é zero.
3. O mesmo relatório soma `quantidade_item`, `venda_bruta_item`, `venda_liquida_item`, `imposto_total`, `custo_liquido_item` e `valor_lucro_item`; conta notas distintas e itens de NF-e.
4. `Lucro x Custo Mensal` usa `bi.meta_geral_base`, `bi.meta_custo` e `bi.produtos_nfe_base`; preenche os dias do período, acumula lucro e compara com o custo total da meta.
5. Os modelos Metabase de faturamento e lucro são identificados internamente como tabelas 79 e 81. O dashboard público não expõe de forma confiável o pipeline/DDL que popula esses dois modelos.

Há uma inconsistência nominal que deve ser preservada na caracterização: `Total Faturamento Nfe Base` executa `count`, enquanto `Qtd. Faturamento` executa `sum`. Não se deve renomear ou reinterpretar esses cartões sem validar o resultado e o modelo BI.

## Implementação atual

O endpoint autenticado `GET /v1/dashboard/summary` implementa a primeira fatia nativa comprovável:

- faturamento bruto;
- venda líquida;
- custo;
- imposto;
- lucro;
- margem agregada `lucro / faturamento × 100`, com guarda para faturamento zero;
- série mensal de faturamento, custo e lucro;
- notas recentes com boleto e rastreio.

O tenant nunca vem do parâmetro da requisição. A API consulta a `view_nfe` do PostgreSQL legado usando somente o `legacyUnitId` associado ao tenant autorizado e passa os resultados pelo agregador decimal de domínio.

A demonstração pública não é evidência de paridade do DashFinal: seus indicadores são ilustrativos, calculados de mocks locais e nunca enviados ao endpoint autenticado.

## Paridade ainda não comprovada

- ETL e semântica completa dos modelos BI 79/81;
- faturamento diário com mediana;
- TME por origem/coligada;
- mapas, rankings e relatório detalhado por produto na nova UI;
- filtros combinados e valores padrão dos nove parâmetros;
- comparação de resultados contra um snapshot controlado do PostgreSQL/Metabase real.

Esses itens permanecem como paridade parcial. O iframe legado não deve ser removido até os resultados serem comparados com fixtures sanitizadas.

## Risco registrado

O legado carrega um dashboard público por HTTP, em IP fixo e sem TLS. A nova aplicação não incorpora esse iframe; reproduz consultas no backend autenticado e mantém o vínculo de tenant no servidor.
