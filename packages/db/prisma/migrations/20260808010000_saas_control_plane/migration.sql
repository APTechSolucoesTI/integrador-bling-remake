CREATE TYPE "TenantRole" AS ENUM ('owner', 'admin', 'operator', 'viewer');
CREATE TYPE "IntegrationKind" AS ENUM ('bling', 'apchat', 'mercado_livre');
CREATE TYPE "JobExecutionStatus" AS ENUM ('queued', 'active', 'completed', 'failed', 'cancelled');

CREATE TABLE "saas_tenant" (
  "id" UUID NOT NULL,
  "legacy_unit_id" INTEGER,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "demo" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "brand_name" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "saas_tenant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "saas_user" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "super_admin" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "saas_user_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "saas_tenant_membership" (
  "tenant_id" UUID NOT NULL,
  "legacy_user_id" INTEGER NOT NULL,
  "user_id" UUID,
  "role" "TenantRole" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saas_tenant_membership_pkey" PRIMARY KEY ("tenant_id", "legacy_user_id")
);

CREATE TABLE "saas_auth_session" (
  "id" UUID NOT NULL,
  "token_hash" VARCHAR(64) NOT NULL,
  "user_id" UUID NOT NULL,
  "active_tenant_id" UUID NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "revoked_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "saas_auth_session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "saas_integration_config" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "kind" "IntegrationKind" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "fake" BOOLEAN NOT NULL DEFAULT false,
  "credential_ciphertext" BYTEA,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "saas_integration_config_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "saas_feature_flag" (
  "tenant_id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "saas_feature_flag_pkey" PRIMARY KEY ("tenant_id", "key")
);

CREATE TABLE "saas_audit_log" (
  "id" BIGSERIAL NOT NULL,
  "tenant_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT,
  "correlation_id" UUID NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saas_audit_log_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "saas_job_execution" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "job_type" TEXT NOT NULL,
  "status" "JobExecutionStatus" NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "correlation_id" UUID NOT NULL,
  "started_at" TIMESTAMPTZ(3),
  "finished_at" TIMESTAMPTZ(3),
  "error_code" TEXT,
  "error_message" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saas_job_execution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saas_tenant_legacy_unit_id_key" ON "saas_tenant"("legacy_unit_id");
CREATE UNIQUE INDEX "saas_tenant_slug_key" ON "saas_tenant"("slug");
CREATE UNIQUE INDEX "saas_user_email_key" ON "saas_user"("email");
CREATE INDEX "saas_tenant_membership_legacy_user_id_idx" ON "saas_tenant_membership"("legacy_user_id");
CREATE INDEX "saas_tenant_membership_user_id_idx" ON "saas_tenant_membership"("user_id");
CREATE UNIQUE INDEX "saas_tenant_membership_tenant_id_user_id_key" ON "saas_tenant_membership"("tenant_id", "user_id");
CREATE UNIQUE INDEX "saas_auth_session_token_hash_key" ON "saas_auth_session"("token_hash");
CREATE INDEX "saas_auth_session_user_id_expires_at_idx" ON "saas_auth_session"("user_id", "expires_at");
CREATE INDEX "saas_auth_session_active_tenant_id_expires_at_idx" ON "saas_auth_session"("active_tenant_id", "expires_at");
CREATE UNIQUE INDEX "saas_integration_config_tenant_id_kind_key" ON "saas_integration_config"("tenant_id", "kind");
CREATE INDEX "saas_audit_log_tenant_id_created_at_idx" ON "saas_audit_log"("tenant_id", "created_at");
CREATE INDEX "saas_job_execution_tenant_id_created_at_idx" ON "saas_job_execution"("tenant_id", "created_at");
CREATE INDEX "saas_job_execution_status_created_at_idx" ON "saas_job_execution"("status", "created_at");

ALTER TABLE "saas_tenant_membership" ADD CONSTRAINT "saas_tenant_membership_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "saas_tenant_membership" ADD CONSTRAINT "saas_tenant_membership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "saas_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "saas_auth_session" ADD CONSTRAINT "saas_auth_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "saas_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saas_auth_session" ADD CONSTRAINT "saas_auth_session_active_tenant_id_fkey" FOREIGN KEY ("active_tenant_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "saas_integration_config" ADD CONSTRAINT "saas_integration_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "saas_feature_flag" ADD CONSTRAINT "saas_feature_flag_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "saas_audit_log" ADD CONSTRAINT "saas_audit_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "saas_job_execution" ADD CONSTRAINT "saas_job_execution_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
