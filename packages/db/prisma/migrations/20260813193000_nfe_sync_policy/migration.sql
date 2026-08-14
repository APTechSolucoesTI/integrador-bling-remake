CREATE TABLE "nfe_sync_policy" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "allowed_statuses" INTEGER[] NOT NULL DEFAULT ARRAY[5, 6]::INTEGER[],
  "allowed_directions" INTEGER[] NOT NULL DEFAULT ARRAY[1]::INTEGER[],
  "require_sale_nature" BOOLEAN NOT NULL DEFAULT TRUE,
  "exclude_return_nature" BOOLEAN NOT NULL DEFAULT TRUE,
  "included_nature_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "excluded_nature_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "included_customer_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "excluded_customer_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "included_customer_documents" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "excluded_customer_documents" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "included_customer_terms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "excluded_customer_terms" TEXT[] NOT NULL DEFAULT ARRAY['ebazar']::TEXT[],
  "included_sales_channel_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "excluded_sales_channel_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "included_seller_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "excluded_seller_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "included_cfops" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "excluded_cfops" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "included_skus" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "excluded_skus" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "included_ncms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "excluded_ncms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "minimum_total" NUMERIC(18,4),
  "maximum_total" NUMERIC(18,4),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "nfe_sync_policy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "nfe_sync_policy_tenant_id_key" UNIQUE ("tenant_id"),
  CONSTRAINT "nfe_sync_policy_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "saas_tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "nfe_sync_policy_total_range_check"
    CHECK ("minimum_total" IS NULL OR "maximum_total" IS NULL OR "minimum_total" <= "maximum_total")
);

INSERT INTO "nfe_sync_policy" (
  "tenant_id",
  "allowed_statuses",
  "allowed_directions",
  "require_sale_nature",
  "exclude_return_nature",
  "excluded_customer_terms"
)
SELECT
  "id",
  ARRAY[5, 6]::INTEGER[],
  ARRAY[1]::INTEGER[],
  TRUE,
  TRUE,
  ARRAY['ebazar']::TEXT[]
FROM "saas_tenant"
ON CONFLICT ("tenant_id") DO NOTHING;
