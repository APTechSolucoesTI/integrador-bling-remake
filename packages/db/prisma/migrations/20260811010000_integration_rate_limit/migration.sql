-- Global per-tenant integration rate limit shared by all worker instances.
CREATE TABLE "integration_rate_limit" (
    "tenant_id" UUID NOT NULL,
    "kind" "IntegrationKind" NOT NULL,
    "next_available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "integration_rate_limit_pkey" PRIMARY KEY ("tenant_id", "kind")
);

ALTER TABLE "integration_rate_limit" ADD CONSTRAINT "integration_rate_limit_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
