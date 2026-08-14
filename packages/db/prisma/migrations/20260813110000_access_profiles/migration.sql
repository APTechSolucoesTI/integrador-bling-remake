CREATE TABLE "saas_access_profile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "saas_access_profile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "saas_access_profile_tenant_id_name_key" UNIQUE ("tenant_id", "name")
);

ALTER TABLE "saas_tenant_membership"
  ADD COLUMN "access_profile_id" UUID;

CREATE INDEX "saas_access_profile_tenant_id_name_idx"
  ON "saas_access_profile"("tenant_id", "name");
CREATE INDEX "saas_tenant_membership_tenant_id_access_profile_id_idx"
  ON "saas_tenant_membership"("tenant_id", "access_profile_id");

ALTER TABLE "saas_access_profile"
  ADD CONSTRAINT "saas_access_profile_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "saas_tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saas_tenant_membership"
  ADD CONSTRAINT "saas_tenant_membership_access_profile_id_fkey"
  FOREIGN KEY ("access_profile_id") REFERENCES "saas_access_profile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
