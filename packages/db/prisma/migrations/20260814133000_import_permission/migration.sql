-- Importação inteligente exige autorização explícita.
-- Perfis administrativos existentes preservam acesso; demais perfis continuam sem acesso.
UPDATE "saas_access_profile"
SET "permissions" = array_append("permissions", 'imports:manage'),
    "updated_at" = NOW()
WHERE ('users:manage' = ANY("permissions") OR LOWER("name") = 'administrador')
  AND NOT ('imports:manage' = ANY("permissions"));
