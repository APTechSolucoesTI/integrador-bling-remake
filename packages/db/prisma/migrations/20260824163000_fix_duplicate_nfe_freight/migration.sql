-- Corrige NF-e calculadas somando o frete fiscal do XML com o custo de frete
-- do pedido de venda. Quando o XML possui frete, ele é a fonte de verdade.
WITH candidates AS (
  SELECT
    ni.id,
    ni.nfe_id,
    ni.unit_id,
    ROUND(
      GREATEST(
        COALESCE(ni.venda_liquido_total, 0)
          - COALESCE(ni.venda_bruto_total, 0)
          + COALESCE(ni.desconto, 0)
          - COALESCE(ni.outras_despesas, 0),
        0
      ),
      4
    ) AS fiscal_freight
  FROM nfe_item ni
), corrected AS (
  UPDATE nfe_item ni
  SET
    frete = c.fiscal_freight,
    valor_lucro_total = ni.valor_lucro_total + (ni.frete - c.fiscal_freight),
    valor_lucro_unitario = CASE
      WHEN ni.qnt > 0
        THEN ni.valor_lucro_unitario + ((ni.frete - c.fiscal_freight) / ni.qnt)
      ELSE ni.valor_lucro_unitario + (ni.frete - c.fiscal_freight)
    END,
    margem_lucro_total = CASE
      WHEN ni.venda_liquido_total <> 0
        THEN ((ni.valor_lucro_total + (ni.frete - c.fiscal_freight)) * 100)
          / ni.venda_liquido_total
      ELSE 0
    END,
    margem_lucro_unitario = CASE
      WHEN ni.venda_liquido_unitario <> 0
        THEN (
          (
            ni.valor_lucro_unitario
              + CASE WHEN ni.qnt > 0
                  THEN (ni.frete - c.fiscal_freight) / ni.qnt
                  ELSE ni.frete - c.fiscal_freight
                END
          ) * 100
        ) / ni.venda_liquido_unitario
      ELSE 0
    END,
    updated_at = NOW()
  FROM candidates c
  WHERE ni.id = c.id
    AND c.fiscal_freight > 0
    AND ni.frete > c.fiscal_freight + 0.005
  RETURNING ni.nfe_id, ni.unit_id
), affected AS (
  SELECT DISTINCT nfe_id, unit_id FROM corrected
), totals AS (
  SELECT
    ni.nfe_id,
    ni.unit_id,
    SUM(ni.frete) AS freight,
    SUM(ni.valor_lucro_total) AS profit,
    SUM(ni.venda_liquido_total) AS net_revenue
  FROM nfe_item ni
  JOIN affected a ON a.nfe_id = ni.nfe_id AND a.unit_id = ni.unit_id
  GROUP BY ni.nfe_id, ni.unit_id
)
UPDATE nfe n
SET
  frete = t.freight,
  lucro = t.profit,
  margem_lucro = CASE
    WHEN t.net_revenue <> 0 THEN (t.profit * 100) / t.net_revenue
    ELSE 0
  END,
  updated_at = NOW()
FROM totals t
WHERE n.id = t.nfe_id AND n.unit_id = t.unit_id;

-- Situação 2 é tratada apenas pelo sincronizador de cancelamentos.
UPDATE nfe_sync_policy
SET allowed_statuses = array_remove(allowed_statuses, 2), updated_at = NOW()
WHERE 2 = ANY(allowed_statuses);
