-- Script para remover a constraint CHECK do campo user_type
-- Execute este script no PostgreSQL para permitir qualquer tipo de usuário

-- Remover a constraint CHECK se existir
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_user_type_check;

-- Verificar se foi removida (opcional - apenas para confirmar)
SELECT 
    conname AS constraint_name,
    contype AS constraint_type
FROM pg_constraint con
INNER JOIN pg_class rel ON rel.oid = con.conrelid
INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE rel.relname = 'users' 
  AND con.contype = 'c'
  AND conname LIKE '%user_type%';
