CREATE TABLE "system_notification" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "source_key" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "level" TEXT NOT NULL DEFAULT 'info',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "detail" JSONB NOT NULL DEFAULT '{}',
  "action_href" TEXT,
  "permission" TEXT,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "system_notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "system_notification_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "saas_tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "system_notification_tenant_id_source_key_key"
  ON "system_notification"("tenant_id", "source_key");
CREATE INDEX "system_notification_tenant_id_occurred_at_idx"
  ON "system_notification"("tenant_id", "occurred_at");

CREATE TABLE "system_notification_read" (
  "notification_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "read_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "system_notification_read_pkey" PRIMARY KEY ("notification_id", "user_id"),
  CONSTRAINT "system_notification_read_notification_id_fkey"
    FOREIGN KEY ("notification_id") REFERENCES "system_notification"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "system_notification_read_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "saas_user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "system_notification_read_user_id_read_at_idx"
  ON "system_notification_read"("user_id", "read_at");
