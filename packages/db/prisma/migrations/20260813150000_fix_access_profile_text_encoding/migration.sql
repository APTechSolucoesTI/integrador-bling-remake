-- Corrige descrições dos perfis padrão que foram persistidas com mojibake.
UPDATE "saas_access_profile"
SET
  "description" = CASE "name"
    WHEN 'Administrador' THEN 'Acesso completo à empresa, configurações e usuários.'
    WHEN 'Operador' THEN 'Opera rotinas fiscais, cadastros, documentos e sincronizações.'
    WHEN 'Visualizador' THEN 'Consulta módulos operacionais sem permissão de alteração.'
  END,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "name" IN ('Administrador', 'Operador', 'Visualizador');
