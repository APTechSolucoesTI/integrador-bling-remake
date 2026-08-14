-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TenantRole" AS ENUM ('owner', 'admin', 'operator', 'viewer');

-- CreateEnum
CREATE TYPE "IntegrationKind" AS ENUM ('bling', 'apchat', 'mercado_livre');

-- CreateEnum
CREATE TYPE "OAuthStatus" AS ENUM ('disconnected', 'pending', 'connected', 'expired', 'error');

-- CreateEnum
CREATE TYPE "JobExecutionStatus" AS ENUM ('queued', 'active', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "CalculationStatus" AS ENUM ('pending', 'calculated', 'inconsistent', 'failed');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('pending', 'sent', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('open', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "CostApplication" AS ENUM ('Item', 'Nota');

-- CreateEnum
CREATE TYPE "CostValueType" AS ENUM ('F', 'P');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('pending', 'running', 'completed', 'failed');

-- CreateTable
CREATE TABLE "saas_tenant" (
    "id" UUID NOT NULL,
    "legacy_unit_id" INTEGER,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "brand_name" TEXT,
    "tax_regime" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "saas_tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_user" (
    "id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "super_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "saas_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_tenant_membership" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "legacy_user_id" INTEGER,
    "role" "TenantRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "saas_tenant_membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_user_preference" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "zoom" INTEGER NOT NULL DEFAULT 100,
    "fixed_menu" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saas_user_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "integration_config" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "kind" "IntegrationKind" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "fake" BOOLEAN NOT NULL DEFAULT false,
    "credential_ciphertext" BYTEA,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "integration_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_credential" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "kind" "IntegrationKind" NOT NULL,
    "status" "OAuthStatus" NOT NULL DEFAULT 'disconnected',
    "client_id_ciphertext" BYTEA,
    "client_secret_ciphertext" BYTEA,
    "access_token_ciphertext" BYTEA,
    "refresh_token_ciphertext" BYTEA,
    "access_token_expires_at" TIMESTAMPTZ(3),
    "authorization_state_hash" VARCHAR(64),
    "authorization_expires_at" TIMESTAMPTZ(3),
    "connected_at" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "oauth_credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apchat_config" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "workspace_id_ciphertext" BYTEA,
    "token_ciphertext" BYTEA,
    "invoice_phone" VARCHAR(20),
    "report_phone" VARCHAR(20),
    "test_phone" VARCHAR(20),
    "send_messages" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apchat_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_feature_flag" (
    "tenant_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saas_feature_flag_pkey" PRIMARY KEY ("tenant_id","key")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "saas_job_execution" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "job_type" TEXT NOT NULL,
    "status" "JobExecutionStatus" NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "correlation_id" UUID NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saas_job_execution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupo_produto" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "id_bling" TEXT,
    "nome" TEXT NOT NULL,
    "own_manufacture" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "grupo_produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "id_produto" TEXT NOT NULL,
    "group_id" INTEGER,
    "codigo" TEXT,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ncm" VARCHAR(8),
    "custo" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "fabricacao_propria" BOOLEAN NOT NULL DEFAULT false,
    "monophase" BOOLEAN NOT NULL DEFAULT false,
    "ultima_atualizacao_bling" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pessoa" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "id_bling" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "numero_documento" TEXT,
    "ie" TEXT,
    "rg" TEXT,
    "telefone" TEXT,
    "telefone_contato" TEXT,
    "celular" TEXT,
    "email" TEXT,
    "desabilitar_envio" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pessoa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pessoa_endereco" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "pessoa_id" INTEGER NOT NULL,
    "legacy_id" INTEGER,
    "label" TEXT,
    "endereco" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cep" VARCHAR(12),
    "municipio" TEXT,
    "uf" VARCHAR(2),
    "country" VARCHAR(2),
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pessoa_endereco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setor" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "nome" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "setor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendedores" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "id_bling" TEXT,
    "sector_id" INTEGER,
    "nome" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vendedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canal_venda" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "loja_id" TEXT,
    "descricao" TEXT NOT NULL,
    "tipo" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "canal_venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forma_pagamento" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "id_bling" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo_pagamento" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "forma_pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "natureza_operacao" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "id_bling" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "natureza_operacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_venda" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "id_bling" TEXT NOT NULL,
    "numero" INTEGER,
    "data" DATE,
    "total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "situacao" INTEGER,
    "desconto" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "nfe_id_bling" TEXT,
    "taxa_comissao" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "custo_frete" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "ultima_att" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pedido_venda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfe" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "id_bling" TEXT NOT NULL,
    "contact_id" INTEGER,
    "seller_id" INTEGER,
    "sales_channel_id" INTEGER,
    "payment_method_id" INTEGER,
    "operation_nature_id" INTEGER,
    "contato_id_bling" TEXT,
    "vendedor_id" TEXT,
    "loja_id" TEXT,
    "natureza_operacao_id" TEXT,
    "tipo" INTEGER,
    "situacao" INTEGER NOT NULL,
    "numero" TEXT NOT NULL,
    "serie" INTEGER,
    "chave_acesso" TEXT,
    "data_emissao" TIMESTAMPTZ(3),
    "link_xml" TEXT,
    "link_pdf" TEXT,
    "codigo_rastreio" TEXT,
    "codigo_rastreio2" TEXT,
    "valor" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "frete" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "desconto" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxa" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "outras_despesas" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "custo_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "custo_liquido" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "venda_liquido" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "impostos" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "credito_ipi" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "credito_icms" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "lucro" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "margem_lucro" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "calculation_status" "CalculationStatus" NOT NULL DEFAULT 'pending',
    "obs_calculo" TEXT,
    "obs_envio" TEXT,
    "parcela_obs" TEXT,
    "invoice_message_status" "MessageStatus" NOT NULL DEFAULT 'pending',
    "data_nota_envio" TIMESTAMPTZ(3),
    "satisfaction_message_status" "MessageStatus" NOT NULL DEFAULT 'pending',
    "data_pesquisa_envio" TIMESTAMPTZ(3),
    "last_synchronized_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "nfe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfe_item" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "nfe_id" INTEGER NOT NULL,
    "produtos_id" INTEGER,
    "legacy_id" INTEGER,
    "id_produto" TEXT,
    "n_item" INTEGER NOT NULL,
    "descricao" TEXT,
    "cfop" VARCHAR(8),
    "qnt" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "frete" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "desconto" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxa" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "custo_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "custo_unitario" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "venda_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "venda_unitario" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "custo_bruto_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "custo_bruto_unitario" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "custo_liquido_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "custo_liquido_unitario" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "venda_bruto_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "venda_bruto_unitario" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "venda_liquido_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "venda_liquido_unitario" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "valor_lucro_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "valor_lucro_unitario" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "margem_lucro_total" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "margem_lucro_unitario" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "imposto_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "imposto_unitario" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "credito_ipi" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "credito_icms" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "outras_despesas" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "inconsistencia" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "nfe_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boleto" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "nfe_id" INTEGER,
    "nfe_id_bling" TEXT NOT NULL,
    "legacy_id" INTEGER,
    "conta_id" TEXT,
    "numero_externo" TEXT,
    "venda" TEXT,
    "vencimento" DATE,
    "valor" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "valor_total" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "situacao" INTEGER,
    "link_boleto" TEXT,
    "contato_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "boleto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_code" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "carrier" TEXT,
    "tracking_url" TEXT,
    "delivered_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tracking_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipo_custo_fixo" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "tipo" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tipo_custo_fixo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custo_fixo" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "tipo_custo_fixo_id" INTEGER,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "valor" DECIMAL(18,4) NOT NULL,
    "tipo" "CostApplication" NOT NULL,
    "tipo_valor" "CostValueType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "custo_fixo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cfcv" (
    "fixed_cost_id" INTEGER NOT NULL,
    "canal_venda_id" INTEGER NOT NULL,
    "unit_id" UUID NOT NULL,

    CONSTRAINT "cfcv_pkey" PRIMARY KEY ("fixed_cost_id","canal_venda_id")
);

-- CreateTable
CREATE TABLE "credito_ncm" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "ncm" VARCHAR(8) NOT NULL,
    "aliquota" DECIMAL(9,4) NOT NULL,
    "reducao" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credito_ncm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tributacao" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "nome" TEXT NOT NULL,
    "aliquota_simulacao" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tributacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tributacao_difal" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "estado" VARCHAR(2) NOT NULL,
    "aliquota_interna" DECIMAL(9,4) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tributacao_difal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxa_parcelamento" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "parcela" INTEGER NOT NULL,
    "aliquota" DECIMAL(9,4) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taxa_parcelamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custo_item" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "nfe_item_id" INTEGER NOT NULL,
    "custo_fixo_id" INTEGER,
    "nome" TEXT,
    "aliquota" DECIMAL(9,4),
    "valor" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "custo_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tributacao_item" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "nfe_item_id" INTEGER NOT NULL,
    "tributacao_id" INTEGER,
    "nome" TEXT,
    "cst" TEXT,
    "valor_base" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "reducao" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "aliquota" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "valor" DECIMAL(18,4) NOT NULL DEFAULT 0,

    CONSTRAINT "tributacao_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxa_item" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "nfe_item_id" INTEGER NOT NULL,
    "custo_fixo_id" INTEGER,
    "nome" TEXT,
    "aliquota" DECIMAL(9,4),
    "valor" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "taxa_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credito_item" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "nfe_item_id" INTEGER NOT NULL,
    "custo_fixo_id" INTEGER,
    "nome" TEXT,
    "aliquota" DECIMAL(9,4),
    "valor" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "credito_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pesquisa_satisfacao" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "habilitar" BOOLEAN NOT NULL DEFAULT false,
    "tempo_dia_env" INTEGER NOT NULL DEFAULT 0,
    "tempo_hora_env" INTEGER,
    "msg" TEXT,
    "link" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pesquisa_satisfacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "satisfaction_dispatch" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "contact_id" INTEGER,
    "status" "MessageStatus" NOT NULL DEFAULT 'pending',
    "scheduled_at" TIMESTAMPTZ(3) NOT NULL,
    "sent_at" TIMESTAMPTZ(3),
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "satisfaction_dispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_schedule" (
    "id" SERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "job_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "hours" INTEGER[],
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operational_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_log" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "job_type" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "correlation_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operational_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta" (
    "id" SERIAL NOT NULL,
    "unit_id" UUID NOT NULL,
    "legacy_id" INTEGER,
    "status" "GoalStatus" NOT NULL DEFAULT 'open',
    "mes_ano" VARCHAR(7) NOT NULL,
    "data_inicial" TIMESTAMPTZ(3) NOT NULL,
    "data_final" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_vendedores" (
    "id" SERIAL NOT NULL,
    "meta_id" INTEGER NOT NULL,
    "vendedores_id" INTEGER NOT NULL,
    "valor_meta" DECIMAL(18,4) NOT NULL,
    "tipo_comissao" VARCHAR(1),
    "comissao" DECIMAL(9,4),

    CONSTRAINT "meta_vendedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_setor" (
    "id" SERIAL NOT NULL,
    "meta_id" INTEGER NOT NULL,
    "setor_id" INTEGER NOT NULL,
    "valor_meta" DECIMAL(18,4) NOT NULL,
    "tipo_comissao" VARCHAR(1),
    "comissao" DECIMAL(9,4),

    CONSTRAINT "meta_setor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_custo" (
    "id" SERIAL NOT NULL,
    "meta_id" INTEGER NOT NULL,
    "description" TEXT,
    "valor_custo" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "meta_custo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_import_run" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "status" "ImportStatus" NOT NULL DEFAULT 'pending',
    "source_fingerprint" TEXT,
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "checkpoints" JSONB NOT NULL DEFAULT '{}',
    "statistics" JSONB NOT NULL DEFAULT '{}',
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "legacy_import_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_entity_mapping" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "legacy_id" TEXT NOT NULL,
    "modern_id" UUID NOT NULL,
    "source_hash" TEXT,
    "imported_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legacy_entity_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saas_tenant_legacy_unit_id_key" ON "saas_tenant"("legacy_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "saas_tenant_slug_key" ON "saas_tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "saas_user_legacy_id_key" ON "saas_user"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "saas_user_email_key" ON "saas_user"("email");

-- CreateIndex
CREATE INDEX "saas_tenant_membership_user_id_idx" ON "saas_tenant_membership"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "saas_tenant_membership_tenant_id_user_id_key" ON "saas_tenant_membership"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "saas_tenant_membership_tenant_id_legacy_user_id_key" ON "saas_tenant_membership"("tenant_id", "legacy_user_id");

-- CreateIndex
CREATE INDEX "saas_user_preference_user_id_idx" ON "saas_user_preference"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "saas_user_preference_tenant_id_user_id_key" ON "saas_user_preference"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "saas_auth_session_token_hash_key" ON "saas_auth_session"("token_hash");

-- CreateIndex
CREATE INDEX "saas_auth_session_user_id_expires_at_idx" ON "saas_auth_session"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "saas_auth_session_active_tenant_id_expires_at_idx" ON "saas_auth_session"("active_tenant_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "integration_config_tenant_id_kind_key" ON "integration_config"("tenant_id", "kind");

-- CreateIndex
CREATE INDEX "oauth_credential_kind_status_idx" ON "oauth_credential"("kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_credential_tenant_id_kind_key" ON "oauth_credential"("tenant_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "apchat_config_tenant_id_key" ON "apchat_config"("tenant_id");

-- CreateIndex
CREATE INDEX "saas_audit_log_tenant_id_created_at_idx" ON "saas_audit_log"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "saas_audit_log_actor_user_id_created_at_idx" ON "saas_audit_log"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "saas_job_execution_tenant_id_created_at_idx" ON "saas_job_execution"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "saas_job_execution_status_created_at_idx" ON "saas_job_execution"("status", "created_at");

-- CreateIndex
CREATE INDEX "saas_job_execution_correlation_id_idx" ON "saas_job_execution"("correlation_id");

-- CreateIndex
CREATE INDEX "grupo_produto_unit_id_nome_idx" ON "grupo_produto"("unit_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "grupo_produto_unit_id_legacy_id_key" ON "grupo_produto"("unit_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "grupo_produto_unit_id_id_bling_key" ON "grupo_produto"("unit_id", "id_bling");

-- CreateIndex
CREATE INDEX "produtos_unit_id_codigo_idx" ON "produtos"("unit_id", "codigo");

-- CreateIndex
CREATE INDEX "produtos_unit_id_nome_idx" ON "produtos"("unit_id", "nome");

-- CreateIndex
CREATE INDEX "produtos_unit_id_ncm_idx" ON "produtos"("unit_id", "ncm");

-- CreateIndex
CREATE UNIQUE INDEX "produtos_unit_id_legacy_id_key" ON "produtos"("unit_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "produtos_unit_id_id_produto_key" ON "produtos"("unit_id", "id_produto");

-- CreateIndex
CREATE INDEX "pessoa_unit_id_nome_idx" ON "pessoa"("unit_id", "nome");

-- CreateIndex
CREATE INDEX "pessoa_unit_id_numero_documento_idx" ON "pessoa"("unit_id", "numero_documento");

-- CreateIndex
CREATE UNIQUE INDEX "pessoa_unit_id_legacy_id_key" ON "pessoa"("unit_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "pessoa_unit_id_id_bling_key" ON "pessoa"("unit_id", "id_bling");

-- CreateIndex
CREATE INDEX "pessoa_endereco_unit_id_pessoa_id_idx" ON "pessoa_endereco"("unit_id", "pessoa_id");

-- CreateIndex
CREATE UNIQUE INDEX "pessoa_endereco_unit_id_legacy_id_key" ON "pessoa_endereco"("unit_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "setor_unit_id_legacy_id_key" ON "setor"("unit_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "setor_unit_id_nome_key" ON "setor"("unit_id", "nome");

-- CreateIndex
CREATE INDEX "vendedores_unit_id_nome_idx" ON "vendedores"("unit_id", "nome");

-- CreateIndex
CREATE INDEX "vendedores_unit_id_sector_id_idx" ON "vendedores"("unit_id", "sector_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendedores_unit_id_legacy_id_key" ON "vendedores"("unit_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendedores_unit_id_id_bling_key" ON "vendedores"("unit_id", "id_bling");

-- CreateIndex
CREATE INDEX "canal_venda_unit_id_descricao_idx" ON "canal_venda"("unit_id", "descricao");

-- CreateIndex
CREATE UNIQUE INDEX "canal_venda_unit_id_legacy_id_key" ON "canal_venda"("unit_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "canal_venda_unit_id_loja_id_key" ON "canal_venda"("unit_id", "loja_id");

-- CreateIndex
CREATE INDEX "forma_pagamento_unit_id_descricao_idx" ON "forma_pagamento"("unit_id", "descricao");

-- CreateIndex
CREATE UNIQUE INDEX "forma_pagamento_unit_id_legacy_id_key" ON "forma_pagamento"("unit_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "forma_pagamento_unit_id_id_bling_key" ON "forma_pagamento"("unit_id", "id_bling");

-- CreateIndex
CREATE INDEX "natureza_operacao_unit_id_descricao_idx" ON "natureza_operacao"("unit_id", "descricao");

-- CreateIndex
CREATE UNIQUE INDEX "natureza_operacao_unit_id_legacy_id_key" ON "natureza_operacao"("unit_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "natureza_operacao_unit_id_id_bling_key" ON "natureza_operacao"("unit_id", "id_bling");

-- CreateIndex
CREATE INDEX "pedido_venda_unit_id_data_idx" ON "pedido_venda"("unit_id", "data");

-- CreateIndex
CREATE INDEX "pedido_venda_unit_id_nfe_id_bling_idx" ON "pedido_venda"("unit_id", "nfe_id_bling");

-- CreateIndex
CREATE UNIQUE INDEX "pedido_venda_unit_id_legacy_id_key" ON "pedido_venda"("unit_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "pedido_venda_unit_id_id_bling_key" ON "pedido_venda"("unit_id", "id_bling");

-- CreateIndex
CREATE INDEX "nfe_unit_id_data_emissao_idx" ON "nfe"("unit_id", "data_emissao");

-- CreateIndex
CREATE INDEX "nfe_unit_id_situacao_data_emissao_idx" ON "nfe"("unit_id", "situacao", "data_emissao");

-- CreateIndex
CREATE INDEX "nfe_unit_id_numero_idx" ON "nfe"("unit_id", "numero");

-- CreateIndex
CREATE INDEX "nfe_unit_id_calculation_status_idx" ON "nfe"("unit_id", "calculation_status");

-- CreateIndex
CREATE UNIQUE INDEX "nfe_unit_id_legacy_id_key" ON "nfe"("unit_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "nfe_unit_id_id_bling_key" ON "nfe"("unit_id", "id_bling");

-- CreateIndex
CREATE INDEX "nfe_item_unit_id_produtos_id_idx" ON "nfe_item"("unit_id", "produtos_id");

-- CreateIndex
CREATE INDEX "nfe_item_unit_id_id_produto_idx" ON "nfe_item"("unit_id", "id_produto");

-- CreateIndex
CREATE UNIQUE INDEX "nfe_item_unit_id_legacy_id_key" ON "nfe_item"("unit_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "nfe_item_nfe_id_n_item_key" ON "nfe_item"("nfe_id", "n_item");

-- CreateIndex
CREATE INDEX "boleto_unit_id_nfe_id_bling_idx" ON "boleto"("unit_id", "nfe_id_bling");

-- CreateIndex
CREATE INDEX "boleto_unit_id_vencimento_idx" ON "boleto"("unit_id", "vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "boleto_unit_id_legacy_id_key" ON "boleto"("unit_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "boleto_unit_id_conta_id_numero_externo_key" ON "boleto"("unit_id", "conta_id", "numero_externo");

-- CreateIndex
CREATE INDEX "tracking_code_tenant_id_code_idx" ON "tracking_code"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_code_invoice_id_code_key" ON "tracking_code"("invoice_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_custo_fixo_unit_id_legacy_id_key" ON "tipo_custo_fixo"("unit_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_custo_fixo_unit_id_tipo_key" ON "tipo_custo_fixo"("unit_id", "tipo");

-- CreateIndex
CREATE INDEX "custo_fixo_unit_id_active_nome_idx" ON "custo_fixo"("unit_id", "active", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "custo_fixo_unit_id_legacy_id_key" ON "custo_fixo"("unit_id", "legacy_id");

-- CreateIndex
CREATE INDEX "cfcv_unit_id_canal_venda_id_idx" ON "cfcv"("unit_id", "canal_venda_id");

-- CreateIndex
CREATE UNIQUE INDEX "credito_ncm_unit_id_legacy_id_key" ON "credito_ncm"("unit_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "credito_ncm_unit_id_ncm_key" ON "credito_ncm"("unit_id", "ncm");

-- CreateIndex
CREATE UNIQUE INDEX "tributacao_unit_id_legacy_id_key" ON "tributacao"("unit_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "tributacao_unit_id_nome_key" ON "tributacao"("unit_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "tributacao_difal_unit_id_legacy_id_key" ON "tributacao_difal"("unit_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "tributacao_difal_unit_id_estado_key" ON "tributacao_difal"("unit_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "taxa_parcelamento_unit_id_legacy_id_key" ON "taxa_parcelamento"("unit_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "taxa_parcelamento_unit_id_parcela_key" ON "taxa_parcelamento"("unit_id", "parcela");

-- CreateIndex
CREATE INDEX "custo_item_unit_id_nfe_item_id_idx" ON "custo_item"("unit_id", "nfe_item_id");

-- CreateIndex
CREATE INDEX "tributacao_item_unit_id_nfe_item_id_idx" ON "tributacao_item"("unit_id", "nfe_item_id");

-- CreateIndex
CREATE INDEX "taxa_item_unit_id_nfe_item_id_idx" ON "taxa_item"("unit_id", "nfe_item_id");

-- CreateIndex
CREATE INDEX "credito_item_unit_id_nfe_item_id_idx" ON "credito_item"("unit_id", "nfe_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "pesquisa_satisfacao_unit_id_key" ON "pesquisa_satisfacao"("unit_id");

-- CreateIndex
CREATE INDEX "satisfaction_dispatch_tenant_id_status_scheduled_at_idx" ON "satisfaction_dispatch"("tenant_id", "status", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX "satisfaction_dispatch_invoice_id_key" ON "satisfaction_dispatch"("invoice_id");

-- CreateIndex
CREATE INDEX "operational_schedule_enabled_job_type_idx" ON "operational_schedule"("enabled", "job_type");

-- CreateIndex
CREATE UNIQUE INDEX "operational_schedule_tenant_id_job_type_key" ON "operational_schedule"("tenant_id", "job_type");

-- CreateIndex
CREATE INDEX "operational_log_tenant_id_created_at_idx" ON "operational_log"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "operational_log_tenant_id_job_type_created_at_idx" ON "operational_log"("tenant_id", "job_type", "created_at");

-- CreateIndex
CREATE INDEX "meta_unit_id_status_data_final_idx" ON "meta"("unit_id", "status", "data_final");

-- CreateIndex
CREATE UNIQUE INDEX "meta_unit_id_legacy_id_key" ON "meta"("unit_id", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "meta_unit_id_mes_ano_key" ON "meta"("unit_id", "mes_ano");

-- CreateIndex
CREATE INDEX "meta_vendedores_vendedores_id_idx" ON "meta_vendedores"("vendedores_id");

-- CreateIndex
CREATE UNIQUE INDEX "meta_vendedores_meta_id_vendedores_id_key" ON "meta_vendedores"("meta_id", "vendedores_id");

-- CreateIndex
CREATE INDEX "meta_setor_setor_id_idx" ON "meta_setor"("setor_id");

-- CreateIndex
CREATE UNIQUE INDEX "meta_setor_meta_id_setor_id_key" ON "meta_setor"("meta_id", "setor_id");

-- CreateIndex
CREATE INDEX "meta_custo_meta_id_idx" ON "meta_custo"("meta_id");

-- CreateIndex
CREATE INDEX "legacy_import_run_status_created_at_idx" ON "legacy_import_run"("status", "created_at");

-- CreateIndex
CREATE INDEX "legacy_import_run_tenant_id_created_at_idx" ON "legacy_import_run"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "legacy_entity_mapping_entity_type_legacy_id_idx" ON "legacy_entity_mapping"("entity_type", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_entity_mapping_tenant_id_entity_type_legacy_id_key" ON "legacy_entity_mapping"("tenant_id", "entity_type", "legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_entity_mapping_tenant_id_entity_type_modern_id_key" ON "legacy_entity_mapping"("tenant_id", "entity_type", "modern_id");

-- AddForeignKey
ALTER TABLE "saas_tenant_membership" ADD CONSTRAINT "saas_tenant_membership_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_tenant_membership" ADD CONSTRAINT "saas_tenant_membership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "saas_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_user_preference" ADD CONSTRAINT "saas_user_preference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "saas_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_auth_session" ADD CONSTRAINT "saas_auth_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "saas_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_auth_session" ADD CONSTRAINT "saas_auth_session_active_tenant_id_fkey" FOREIGN KEY ("active_tenant_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_config" ADD CONSTRAINT "integration_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_credential" ADD CONSTRAINT "oauth_credential_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apchat_config" ADD CONSTRAINT "apchat_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_feature_flag" ADD CONSTRAINT "saas_feature_flag_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_audit_log" ADD CONSTRAINT "saas_audit_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_job_execution" ADD CONSTRAINT "saas_job_execution_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_produto" ADD CONSTRAINT "grupo_produto_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "grupo_produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pessoa" ADD CONSTRAINT "pessoa_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pessoa_endereco" ADD CONSTRAINT "pessoa_endereco_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setor" ADD CONSTRAINT "setor_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendedores" ADD CONSTRAINT "vendedores_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendedores" ADD CONSTRAINT "vendedores_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "setor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canal_venda" ADD CONSTRAINT "canal_venda_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forma_pagamento" ADD CONSTRAINT "forma_pagamento_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "natureza_operacao" ADD CONSTRAINT "natureza_operacao_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_venda" ADD CONSTRAINT "pedido_venda_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe" ADD CONSTRAINT "nfe_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe" ADD CONSTRAINT "nfe_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "pessoa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe" ADD CONSTRAINT "nfe_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "vendedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe" ADD CONSTRAINT "nfe_sales_channel_id_fkey" FOREIGN KEY ("sales_channel_id") REFERENCES "canal_venda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe" ADD CONSTRAINT "nfe_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "forma_pagamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe" ADD CONSTRAINT "nfe_operation_nature_id_fkey" FOREIGN KEY ("operation_nature_id") REFERENCES "natureza_operacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_item" ADD CONSTRAINT "nfe_item_nfe_id_fkey" FOREIGN KEY ("nfe_id") REFERENCES "nfe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfe_item" ADD CONSTRAINT "nfe_item_produtos_id_fkey" FOREIGN KEY ("produtos_id") REFERENCES "produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boleto" ADD CONSTRAINT "boleto_nfe_id_fkey" FOREIGN KEY ("nfe_id") REFERENCES "nfe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_code" ADD CONSTRAINT "tracking_code_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "nfe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipo_custo_fixo" ADD CONSTRAINT "tipo_custo_fixo_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custo_fixo" ADD CONSTRAINT "custo_fixo_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custo_fixo" ADD CONSTRAINT "custo_fixo_tipo_custo_fixo_id_fkey" FOREIGN KEY ("tipo_custo_fixo_id") REFERENCES "tipo_custo_fixo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cfcv" ADD CONSTRAINT "cfcv_fixed_cost_id_fkey" FOREIGN KEY ("fixed_cost_id") REFERENCES "custo_fixo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cfcv" ADD CONSTRAINT "cfcv_canal_venda_id_fkey" FOREIGN KEY ("canal_venda_id") REFERENCES "canal_venda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credito_ncm" ADD CONSTRAINT "credito_ncm_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tributacao" ADD CONSTRAINT "tributacao_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tributacao_difal" ADD CONSTRAINT "tributacao_difal_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxa_parcelamento" ADD CONSTRAINT "taxa_parcelamento_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custo_item" ADD CONSTRAINT "custo_item_nfe_item_id_fkey" FOREIGN KEY ("nfe_item_id") REFERENCES "nfe_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custo_item" ADD CONSTRAINT "custo_item_custo_fixo_id_fkey" FOREIGN KEY ("custo_fixo_id") REFERENCES "custo_fixo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tributacao_item" ADD CONSTRAINT "tributacao_item_nfe_item_id_fkey" FOREIGN KEY ("nfe_item_id") REFERENCES "nfe_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tributacao_item" ADD CONSTRAINT "tributacao_item_tributacao_id_fkey" FOREIGN KEY ("tributacao_id") REFERENCES "tributacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxa_item" ADD CONSTRAINT "taxa_item_nfe_item_id_fkey" FOREIGN KEY ("nfe_item_id") REFERENCES "nfe_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxa_item" ADD CONSTRAINT "taxa_item_custo_fixo_id_fkey" FOREIGN KEY ("custo_fixo_id") REFERENCES "custo_fixo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credito_item" ADD CONSTRAINT "credito_item_nfe_item_id_fkey" FOREIGN KEY ("nfe_item_id") REFERENCES "nfe_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credito_item" ADD CONSTRAINT "credito_item_custo_fixo_id_fkey" FOREIGN KEY ("custo_fixo_id") REFERENCES "custo_fixo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesquisa_satisfacao" ADD CONSTRAINT "pesquisa_satisfacao_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "satisfaction_dispatch" ADD CONSTRAINT "satisfaction_dispatch_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "nfe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "satisfaction_dispatch" ADD CONSTRAINT "satisfaction_dispatch_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "pessoa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_schedule" ADD CONSTRAINT "operational_schedule_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_log" ADD CONSTRAINT "operational_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta" ADD CONSTRAINT "meta_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_vendedores" ADD CONSTRAINT "meta_vendedores_meta_id_fkey" FOREIGN KEY ("meta_id") REFERENCES "meta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_vendedores" ADD CONSTRAINT "meta_vendedores_vendedores_id_fkey" FOREIGN KEY ("vendedores_id") REFERENCES "vendedores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_setor" ADD CONSTRAINT "meta_setor_meta_id_fkey" FOREIGN KEY ("meta_id") REFERENCES "meta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_setor" ADD CONSTRAINT "meta_setor_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_custo" ADD CONSTRAINT "meta_custo_meta_id_fkey" FOREIGN KEY ("meta_id") REFERENCES "meta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legacy_import_run" ADD CONSTRAINT "legacy_import_run_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legacy_entity_mapping" ADD CONSTRAINT "legacy_entity_mapping_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "saas_tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Product-level integrity rules not expressible in Prisma Schema.
ALTER TABLE "credito_ncm" ADD CONSTRAINT "credito_ncm_ncm_format_check" CHECK ("ncm" ~ '^[0-9]{8}$');
ALTER TABLE "tributacao_difal" ADD CONSTRAINT "tributacao_difal_estado_check" CHECK ("estado" ~ '^[A-Z]{2}$');
ALTER TABLE "operational_schedule" ADD CONSTRAINT "operational_schedule_hours_check" CHECK ("hours" <@ ARRAY[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23]);
ALTER TABLE "meta" ADD CONSTRAINT "meta_competencia_check" CHECK ("mes_ano" ~ '^(0[1-9]|1[0-2])/[0-9]{4}$');

-- Read model used by NF-e lists, profitability and dashboard queries.
CREATE VIEW "invoice_overview" AS
SELECT
  invoice.id,
  invoice.id_bling,
  invoice.numero,
  invoice.serie,
  contact.nome,
  CASE WHEN COALESCE(contact.desabilitar_envio, FALSE) THEN 'S' ELSE 'N' END AS envio,
  invoice.contato_id_bling,
  invoice.valor,
  invoice.data_emissao,
  invoice.link_pdf,
  invoice.codigo_rastreio,
  CASE invoice.calculation_status
    WHEN 'calculated' THEN 'S'
    WHEN 'inconsistent' THEN 'I'
    ELSE 'N'
  END AS tem_calculo,
  invoice.obs_calculo,
  invoice.custo_total,
  invoice.custo_liquido,
  invoice.venda_liquido,
  invoice.impostos,
  invoice.outras_despesas,
  invoice.parcela_obs,
  invoice.taxa,
  invoice.frete,
  invoice.desconto,
  invoice.lucro,
  invoice.credito_ipi,
  invoice.credito_icms,
  invoice.margem_lucro,
  CASE
    WHEN invoice.cancelled_at IS NOT NULL OR invoice.situacao = 2 THEN 'Cancelada'
    WHEN invoice.invoice_message_status = 'sent' THEN 'Enviada'
    WHEN invoice.invoice_message_status = 'pending' THEN 'Pronta para envio'
    WHEN invoice.invoice_message_status = 'failed' THEN 'Falhou'
    ELSE 'Ignorada'
  END AS status_envio,
  CASE
    WHEN invoice.cancelled_at IS NOT NULL OR invoice.situacao = 2 THEN 6
    WHEN invoice.invoice_message_status = 'sent' THEN 1
    WHEN invoice.invoice_message_status = 'pending' THEN 2
    WHEN invoice.invoice_message_status = 'failed' THEN 4
    ELSE 5
  END AS status_envio_id,
  invoice.obs_envio,
  seller.nome AS vendedor,
  channel.descricao AS tipo_venda,
  channel.id AS cv_id,
  invoice.unit_id,
  CASE WHEN NULLIF(BTRIM(invoice.codigo_rastreio), '') IS NULL THEN 'N' ELSE 'S' END AS tem_cod,
  CASE WHEN EXISTS (
    SELECT 1 FROM boleto bill
    WHERE bill.nfe_id_bling = invoice.id_bling
      AND bill.unit_id = invoice.unit_id
  ) THEN 'S' ELSE 'N' END AS tem_boleto
FROM nfe invoice
LEFT JOIN pessoa contact
  ON contact.id_bling = invoice.contato_id_bling
 AND contact.unit_id = invoice.unit_id
LEFT JOIN vendedores seller
  ON seller.id_bling = invoice.vendedor_id
 AND seller.unit_id = invoice.unit_id
LEFT JOIN canal_venda channel
  ON channel.loja_id = invoice.loja_id
 AND channel.unit_id = invoice.unit_id;
