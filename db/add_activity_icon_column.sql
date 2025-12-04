-- Script para adicionar a coluna activity_icon na tabela activities
-- Execute este script se a tabela activities já existir sem a coluna

-- Adicionar coluna activity_icon
ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS activity_icon VARCHAR(10) DEFAULT '💭';

-- Atualizar atividades existentes para ter o ícone padrão (se necessário)
-- UPDATE activities SET activity_icon = '💭' WHERE activity_icon IS NULL;

