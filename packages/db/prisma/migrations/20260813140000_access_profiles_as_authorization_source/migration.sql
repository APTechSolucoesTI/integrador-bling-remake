-- Perfis passam a ser a Ãºnica fonte de permissÃµes do tenant.
-- Os perfis padrÃ£o preservam os acessos efetivos dos papÃ©is antigos.

INSERT INTO "saas_access_profile" (
  "tenant_id", "name", "description", "permissions", "updated_at"
)
SELECT t."id", 'Administrador',
  'Acesso completo Ã  empresa, configuraÃ§Ãµes e usuÃ¡rios.',
  ARRAY[
    'dashboard:view','nfe:view','nfe:manage','products:view','products:manage',
    'people:view','people:manage','documents:view','commercial:view',
    'commercial:manage','goals:view','goals:manage','finance:view',
    'marketplace-fees:view','costs:view','costs:manage','tax:view','tax:manage',
    'integrations:manage','operations:view','operations:manage','settings:view',
    'settings:manage','users:manage'
  ]::TEXT[], CURRENT_TIMESTAMP
FROM "saas_tenant" t
ON CONFLICT ("tenant_id", "name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "permissions" = EXCLUDED."permissions",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "saas_access_profile" (
  "tenant_id", "name", "description", "permissions", "updated_at"
)
SELECT t."id", 'Operador',
  'Opera rotinas fiscais, cadastros, documentos e sincronizaÃ§Ãµes.',
  COALESCE(
    NULLIF(ARRAY(
      SELECT DISTINCT permission
      FROM "saas_tenant_membership" m,
        LATERAL unnest(m."permissions") permission
      WHERE m."tenant_id" = t."id" AND m."role" = 'operator'::"TenantRole"
      ORDER BY permission
    ), ARRAY[]::TEXT[]),
    ARRAY[
      'nfe:view','nfe:manage','products:view','products:manage','people:view',
      'people:manage','documents:view','commercial:view','commercial:manage',
      'goals:view','goals:manage','operations:view','operations:manage'
    ]::TEXT[]
  ), CURRENT_TIMESTAMP
FROM "saas_tenant" t
ON CONFLICT ("tenant_id", "name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "permissions" = EXCLUDED."permissions",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "saas_access_profile" (
  "tenant_id", "name", "description", "permissions", "updated_at"
)
SELECT t."id", 'Visualizador',
  'Consulta mÃ³dulos operacionais sem permissÃ£o de alteraÃ§Ã£o.',
  COALESCE(
    NULLIF(ARRAY(
      SELECT DISTINCT permission
      FROM "saas_tenant_membership" m,
        LATERAL unnest(m."permissions") permission
      WHERE m."tenant_id" = t."id" AND m."role" = 'viewer'::"TenantRole"
      ORDER BY permission
    ), ARRAY[]::TEXT[]),
    ARRAY[
      'nfe:view','products:view','people:view','documents:view',
      'commercial:view','goals:view','operations:view'
    ]::TEXT[]
  ), CURRENT_TIMESTAMP
FROM "saas_tenant" t
ON CONFLICT ("tenant_id", "name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "permissions" = EXCLUDED."permissions",
  "updated_at" = CURRENT_TIMESTAMP;

UPDATE "saas_tenant_membership" membership
SET "access_profile_id" = profile."id"
FROM "saas_access_profile" profile
WHERE membership."access_profile_id" IS NULL
  AND profile."tenant_id" = membership."tenant_id"
  AND profile."name" = CASE
    WHEN membership."role" IN ('owner'::"TenantRole", 'admin'::"TenantRole")
      THEN 'Administrador'
    WHEN membership."role" = 'operator'::"TenantRole" THEN 'Operador'
    ELSE 'Visualizador'
  END;

ALTER TABLE "saas_tenant_membership"
  DROP CONSTRAINT "saas_tenant_membership_access_profile_id_fkey";

ALTER TABLE "saas_tenant_membership"
  ALTER COLUMN "access_profile_id" SET NOT NULL;

ALTER TABLE "saas_tenant_membership"
  ADD CONSTRAINT "saas_tenant_membership_access_profile_id_fkey"
  FOREIGN KEY ("access_profile_id") REFERENCES "saas_access_profile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "saas_tenant_membership_tenant_id_permissions_idx";

ALTER TABLE "saas_tenant_membership"
  DROP COLUMN "permissions",
  DROP COLUMN "role";

DROP TYPE "TenantRole";
