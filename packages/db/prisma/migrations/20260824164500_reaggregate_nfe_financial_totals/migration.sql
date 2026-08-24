-- Recompõe os cabeçalhos a partir dos itens persistidos. A migration anterior
-- corrigiu os itens, mas um SELECT no mesmo data-modifying CTE ainda enxergava
-- o snapshot anterior ao UPDATE.
WITH totals AS (
  SELECT
    ni.nfe_id,
    ni.unit_id,
    SUM(ni.custo_total) AS gross_cost,
    SUM(ni.custo_liquido_total) AS net_cost,
    SUM(ni.venda_liquido_total) AS net_revenue,
    SUM(ni.imposto_total) AS taxes,
    SUM(ni.valor_lucro_total) AS profit,
    SUM(ni.frete) AS freight,
    SUM(ni.desconto) AS discount,
    SUM(ni.taxa) AS fees,
    SUM(ni.credito_ipi) AS ipi_credit,
    SUM(ni.credito_icms) AS icms_credit,
    SUM(ni.outras_despesas) AS other_expenses
  FROM nfe_item ni
  GROUP BY ni.nfe_id, ni.unit_id
)
UPDATE nfe n
SET
  custo_total = t.gross_cost,
  custo_liquido = t.net_cost,
  venda_liquido = t.net_revenue,
  impostos = t.taxes,
  lucro = t.profit,
  margem_lucro = CASE
    WHEN t.net_revenue <> 0 THEN (t.profit * 100) / t.net_revenue
    ELSE 0
  END,
  frete = t.freight,
  desconto = t.discount,
  taxa = t.fees,
  credito_ipi = t.ipi_credit,
  credito_icms = t.icms_credit,
  outras_despesas = t.other_expenses,
  updated_at = NOW()
FROM totals t
WHERE n.id = t.nfe_id AND n.unit_id = t.unit_id;
