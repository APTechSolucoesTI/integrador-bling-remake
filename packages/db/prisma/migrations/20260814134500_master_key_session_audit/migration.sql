ALTER TABLE "saas_auth_session"
ADD COLUMN "master_key_access" BOOLEAN NOT NULL DEFAULT FALSE;
