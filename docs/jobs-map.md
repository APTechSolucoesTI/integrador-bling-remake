# Mapa de jobs legados

## Artefatos encontrados

- `app/model/Horario.php` e `app/control/basico/HorarioList.php`: configuração de horários.
- `app/model/CrontabConfig.php`: configuração de rotinas.
- `app/model/LogCrontab.php` e `LogCrontabHeaderList.php`: histórico operacional.
- `app/control/basico/SincronizarPorData.php`: disparo manual de sincronização.
- `app/service/basico/NFEService.php`: execução pesada atualmente síncrona/monolítica em vários fluxos.

Os arquivos de crontab do host não estão versionados no primeiro levantamento. `cmd.php` é um dispatcher CLI genérico: recebe `class`, `method` e demais parâmetros no primeiro argumento e executa a ação Adianti. `crontab_config` armazena `unit_id`, descrição, método chamado e flags horárias `h0` a `h23`; a tradução exata dessas flags ainda deve ser caracterizada.

## Destino obrigatório

Jobs longos irão para BullMQ/Redis, nunca para o runtime do Next. Cada execução deverá registrar `tenantId`, `jobType`, payload sanitizado, `correlationId`, tentativa, timestamps e estado. Retry será finito e diferenciará falha transitória, autenticação, rate limit, dado inválido e falha permanente.

## Candidatos iniciais

- Sincronização de NF-e por tenant/período.
- Renovação de token Bling com exclusão mútua distribuída.
- Download e processamento de XML/PDF.
- Atualização de boleto e rastreio.
- Cálculo de tributação, custos, lucro e margem.
- Entrega APChat com chave idempotente.
- Processamento de metas vencidas (`MetaService::processarMetasVencidas`).

O legado também expõe métodos orquestradores por unidade em `NFEService`: sincronização geral, status de envio, formas de pagamento, canais, vendedores, naturezas, grupos, produtos, cancelamentos, pedidos, rotinas horárias e de meia-noite. Esses métodos são candidatos a produtores de jobs separados, não a um único worker monolítico.

Nenhum job será declarado equivalente antes da caracterização dos invocadores e efeitos legados.

## Implementação moderna atual

O worker BullMQ abre consumidor real com concorrência 5, limiter de 3 jobs/segundo, lock de 60 segundos, retry/backoff configurados na fila e logs estruturados de conclusão/falha. Em `DEMO_MODE=true`, `bling.sync-nfe` e `apchat.deliver` usam exclusivamente gateways fake e recusam outro tenant. Fora do demo, esses handlers falham fechado até os adapters/repositórios produtivos serem conectados.
