-- Regras efetivamente observadas no cÃ¡lculo do NFEService legado para as UFs
-- presentes no lote de homologaÃ§Ã£o. A tabela permanece interna e por tenant.
INSERT INTO tributacao_difal (unit_id, estado, aliquota_interna, active, created_at, updated_at)
SELECT tenant.id, rule.estado, rule.aliquota, true, NOW(), NOW()
FROM saas_tenant tenant
CROSS JOIN (
  VALUES
    ('AL', 20.0000::numeric),
    ('MG', 18.0000::numeric),
    ('PR', 19.5000::numeric),
    ('RJ', 22.0000::numeric)
) AS rule(estado, aliquota)
ON CONFLICT (unit_id, estado) DO UPDATE
SET aliquota_interna = EXCLUDED.aliquota_interna,
    active = true,
    updated_at = NOW();
