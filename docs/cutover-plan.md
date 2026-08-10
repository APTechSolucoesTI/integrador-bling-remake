# Plano preliminar de cutover

1. Congelar versão do legado e capturar backup/restore testado.
2. Introspectar clone sanitizado do PostgreSQL e validar drift contra o DDL versionado.
3. Executar migrations exclusivamente aditivas do control plane SaaS.
4. Rodar legado e moderno em paralelo por tenant piloto, sem escrita externa do moderno.
5. Comparar NF-e, itens, status, XML, boleto, rastreio, tributos, custos, lucro e margem.
6. Habilitar escrita por integração/tenant com feature flag e observabilidade.
7. Manter legado disponível em modo de consulta durante a janela acordada.

Este plano ainda não autoriza cutover. Critérios e janelas serão fechados após paridade dos domínios críticos.
