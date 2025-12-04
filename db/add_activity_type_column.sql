-- Script para adicionar a coluna activity_type na tabela activities
-- Execute este script se a tabela activities já existir sem a coluna

-- Adicionar coluna activity_type
ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS activity_type VARCHAR(50) NOT NULL DEFAULT 'digitacao';

-- Atualizar atividades existentes para ter o tipo padrão (se necessário)
-- UPDATE activities SET activity_type = 'digitacao' WHERE activity_type IS NULL;

