# Mapa de jobs legados

## Artefatos encontrados

- `app/model/Horario.php` e `app/control/basico/HorarioList.php`: configuração de horários.
- `app/model/CrontabConfig.php`: configuração de rotinas.
- `app/model/LogCrontab.php` e `LogCrontabHeaderList.php`: histórico operacional.
- `app/control/basico/SincronizarPorData.php`: disparo manual de sincronização.
- `app/service/basico/NFEService.php`: execução pesada atualmente síncrona/monolítica em vários fluxos.

Os arquivos de crontab do host não estão versionados. `cmd.php` é um dispatcher CLI genérico. `crontab_config` armazena `unit_id`, descrição, método chamado e flags `h0` a `h23`; no moderno essas flags são lidas pelo scheduler em `America/Sao_Paulo`.

## Destino obrigatório

Jobs longos irão para BullMQ/Redis, nunca para o runtime do Next. Cada execução deverá registrar `tenantId`, `jobType`, payload sanitizado, `correlationId`, tentativa, timestamps e estado. Retry será finito e diferenciará falha transitória, autenticação, rate limit, dado inválido e falha permanente.

## Rotinas implementadas

- Sincronização de NF-e por tenant/período.
- Renovação de token Bling com exclusão mútua distribuída.
- Download e processamento de XML/PDF.
- Atualização de boleto e rastreio.
- Cálculo de tributação, custos, lucro e margem.
- Entrega APChat com chave idempotente.
- Processamento de metas vencidas (`MetaService::processarMetasVencidas`).

O legado também expõe métodos orquestradores por unidade em `NFEService`: sincronização geral, status de envio, formas de pagamento, canais, vendedores, naturezas, grupos, produtos, cancelamentos, pedidos, rotinas horárias e de meia-noite. Esses métodos são candidatos a produtores de jobs separados, não a um único worker monolítico.

## Implementação moderna atual

O worker BullMQ abre consumidor com concorrência 5, limiter de 3 jobs/segundo, lock renovável de 5 minutos, retry/backoff e logs estruturados. O scheduler consulta empresas ativas a cada minuto e cria IDs determinísticos para evitar duplicação entre réplicas.

A sincronização de NF-e aplica uma política por tenant antes da persistência e novamente no detalhe/XML. A política cobre situação, tipo, natureza, cliente, documento, termos de nome, canal, vendedor, faixa de valor, CFOP, SKU e NCM. A migration inicial preserva a regra do `NFEService`: saída, situações 5/6, natureza de venda sem devolução e cliente sem `ebazar` no nome.

Handlers produtivos conectados: NF-e autorizadas/emitidas/canceladas, detalhes, XML/cálculo, normalização com recálculo, envio APChat, renovação explícita de token, produtos/grupos, pedidos, formas de pagamento, canais, vendedores, naturezas, pesquisa de satisfação e metas vencidas. Em `DEMO_MODE=true`, os efeitos permanecem exclusivamente nos gateways fake e o worker recusa outro tenant.
