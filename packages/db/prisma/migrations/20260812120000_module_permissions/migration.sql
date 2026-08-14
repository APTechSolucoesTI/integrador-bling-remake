ALTER TABLE "saas_tenant_membership"
ADD COLUMN "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "saas_tenant_membership_tenant_id_permissions_idx"
ON "saas_tenant_membership" USING GIN ("permissions");
