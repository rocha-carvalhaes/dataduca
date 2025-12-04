-- Script para criar a tabela user_activity_params
-- Execute este script no seu banco de dados PostgreSQL

-- ======================================
-- Parâmetros de atividade por usuário (SCD Tipo 2)
-- ======================================
CREATE TABLE IF NOT EXISTS user_activity_params (
    user_activity_params_id SERIAL PRIMARY KEY,
    activity_id INT NOT NULL REFERENCES activities(activity_id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    params JSONB NOT NULL,
    initiated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_user_activity_params_user_id ON user_activity_params(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_params_activity_id ON user_activity_params(activity_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_params_active ON user_activity_params(user_id, activity_id, active) WHERE active = TRUE;

