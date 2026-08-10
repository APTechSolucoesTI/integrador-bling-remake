# Plano preliminar de rollback

- Desligar feature flags de escrita do moderno por tenant.
- Pausar consumidores BullMQ sem remover filas ou históricos.
- Restaurar o legado como único escritor externo.
- Reconciliar jobs iniciados/concluídos por `correlationId` e chave idempotente.
- Não remover tabelas `saas_`; elas são aditivas e preservam auditoria.
- Restaurar backup somente se uma migration tiver afetado dados legados, após validação de impacto.

Rollback de produção depende de backup restaurável, migrations com `down`/script compensatório e ensaio em clone sanitizado. Nada destrutivo foi criado nesta fase.
