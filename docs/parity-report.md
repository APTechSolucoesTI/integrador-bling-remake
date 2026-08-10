# Relatório de paridade

## Estado

Paridade completa ainda não comprovada. Este relatório é incremental.

## Evidências implementadas

| Área         | Evidência                                                                               | Resultado                                                 |
| ------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Lucro/margem | Fixtures derivadas de `NFEService.php:1630-1653`, `1889-1958`, `1964-1970`, `2234-2277` | Testes TypeScript verdes; execução PHP ainda indisponível |
| Tenant       | Sessão só pode selecionar tenant presente em `allowedTenantIds`                         | Teste de acesso cruzado verde                             |
| Demo         | APChat/ML reais bloqueados por tenant demo ou `DEMO_MODE`; Bling fake determinístico    | Testes verdes                                             |
| Jobs         | Chave idempotente inclui tenant, tipo e chave de negócio; retry finito/exponencial      | Testes verdes                                             |

| Bling refresh | Estados `S/R/N`, rechecagem concorrente, `invalid_grant`, falha transitória e advisory lock por tenant | Testes de concorrência/lock verdes; banco real pendente |

## Diferenças/riscos documentados

- O PHP calcula margem agregada sem guarda explícita para venda líquida zero. O TypeScript devolve margem zero; isto é uma correção candidata, não paridade confirmada, e está marcado em teste.
- Outras despesas entram na venda líquida total, mas não na unitária no legado. A assimetria foi preservada no núcleo de caracterização.
- A fixture atual foi calculada a partir do código, não capturada pela execução do PHP, pois não há PHP/banco no ambiente. Deve ser promovida a golden master somente depois de rodar o legado sobre dataset sanitizado.
