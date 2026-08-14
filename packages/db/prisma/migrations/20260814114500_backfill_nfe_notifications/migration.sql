WITH nfe_events AS (
  SELECT
    "unit_id" AS tenant_id,
    "last_synchronized_at"::date AS event_date,
    1 AS synchronized,
    0 AS delivered
  FROM "nfe"
  WHERE "last_synchronized_at" IS NOT NULL
    AND "last_synchronized_at" >= CURRENT_DATE - INTERVAL '30 days'

  UNION ALL

  SELECT
    "unit_id" AS tenant_id,
    "data_nota_envio"::date AS event_date,
    0 AS synchronized,
    1 AS delivered
  FROM "nfe"
  WHERE "data_nota_envio" IS NOT NULL
    AND "data_nota_envio" >= CURRENT_DATE - INTERVAL '30 days'
), summaries AS (
  SELECT
    tenant_id,
    event_date,
    SUM(synchronized)::int AS synchronized,
    SUM(delivered)::int AS delivered
  FROM nfe_events
  WHERE event_date IS NOT NULL
  GROUP BY tenant_id, event_date
)
INSERT INTO "system_notification" (
  "tenant_id",
  "source_key",
  "kind",
  "level",
  "title",
  "message",
  "detail",
  "action_href",
  "permission",
  "occurred_at"
)
SELECT
  tenant_id,
  'nfe:daily:' || TO_CHAR(event_date, 'YYYY-MM-DD'),
  'nfe.daily',
  'success',
  'Resumo de NF-e de ' || TO_CHAR(event_date, 'DD/MM/YYYY'),
  synchronized || ' notas sincronizadas e ' || delivered || ' enviadas.',
  JSONB_BUILD_OBJECT(
    'persisted', synchronized,
    'delivered', delivered,
    'periodoInicial', TO_CHAR(event_date, 'YYYY-MM-DD'),
    'periodoFinal', TO_CHAR(event_date, 'YYYY-MM-DD')
  ),
  '/app/nfe?dataInicial=' || TO_CHAR(event_date, 'YYYY-MM-DD') ||
    '&dataFinal=' || TO_CHAR(event_date, 'YYYY-MM-DD'),
  'nfe:view',
  event_date + TIME '23:59:59'
FROM summaries
ON CONFLICT ("tenant_id", "source_key") DO NOTHING;
