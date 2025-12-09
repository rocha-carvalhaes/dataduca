-- ======================================
-- MIGRAÇÃO: activity_params e user_activity_params
-- Descrição: Cria tabela activity_params e modifica user_activity_params
-- ======================================

-- ======================================
-- Criar tabela activity_params
-- ======================================
CREATE TABLE IF NOT EXISTS activity_params (
    activity_param_id SERIAL PRIMARY KEY,
    activity_id INT NOT NULL REFERENCES activities(activity_id) ON DELETE CASCADE,
    level INT NOT NULL,
    level_params JSONB NOT NULL,
    level_down_params JSONB,
    level_up_params JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_activity_params_activity_id ON activity_params(activity_id);
CREATE INDEX idx_activity_params_level ON activity_params(activity_id, level);
CREATE INDEX idx_activity_params_active ON activity_params(activity_id, level, active) WHERE active = TRUE;

-- ======================================
-- Modificar tabela user_activity_params
-- ======================================

-- Primeiro, adicionar a nova coluna activity_param_id (permitindo NULL temporariamente)
ALTER TABLE user_activity_params 
ADD COLUMN IF NOT EXISTS activity_param_id INT REFERENCES activity_params(activity_param_id) ON DELETE CASCADE;

-- Remover índices que dependem de activity_id
DROP INDEX IF EXISTS idx_user_activity_params_activity_id;
DROP INDEX IF EXISTS idx_user_activity_params_active;

-- Remover colunas antigas
ALTER TABLE user_activity_params 
DROP COLUMN IF EXISTS activity_id,
DROP COLUMN IF EXISTS params;

-- Criar novos índices
CREATE INDEX idx_user_activity_params_activity_param_id ON user_activity_params(activity_param_id);
CREATE INDEX idx_user_activity_params_active ON user_activity_params(user_id, activity_param_id, active) WHERE active = TRUE;

-- Tornar activity_param_id NOT NULL (após migração de dados, se necessário)
-- ALTER TABLE user_activity_params ALTER COLUMN activity_param_id SET NOT NULL;


