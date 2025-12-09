-- ======================================
-- SCHEMA: dataduca
-- Criado por: Gabriel
-- Descrição: Estrutura inicial do banco
-- ======================================

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- ======================================
-- Tabela de usuários
-- ======================================
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    user_name VARCHAR(100) NOT NULL,
    user_type VARCHAR(20) NOT NULL,
    hash_password TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ======================================
-- Sessão de login (user_session)
-- ======================================
CREATE TABLE user_sessions (
    user_session_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    initiated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP
);

-- ======================================
-- Cadastro de atividades
-- ======================================
CREATE TABLE activities (
    activity_id SERIAL PRIMARY KEY,
    activity_name VARCHAR(200) NOT NULL,
    activity_description TEXT,
    activity_objective TEXT,
    activity_type VARCHAR(50) NOT NULL,
    activity_icon VARCHAR(10),
    activity_version VARCHAR(50) NOT NULL DEFAULT '1.0',
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ======================================
-- Sessões dentro de atividades
-- ======================================
CREATE TABLE activity_sessions (
    activity_session_id SERIAL PRIMARY KEY,
    user_session_id INT NOT NULL REFERENCES user_sessions(user_session_id) ON DELETE CASCADE,
    activity_id INT NOT NULL REFERENCES activities(activity_id),
    results JSONB NOT NULL,
    initiated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP
);


CREATE INDEX idx_activity_sessions_user_session_id ON activity_sessions(user_session_id);
CREATE INDEX idx_activity_sessions_activity_id ON activity_sessions(activity_id);

-- ======================================
-- Tabela de documentos
-- ======================================
CREATE TABLE documents (
    document_id SERIAL PRIMARY KEY,
    document_name VARCHAR(200) NOT NULL DEFAULT 'Sem título',
    document_content TEXT NOT NULL,
    created_by INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_documents_created_by ON documents(created_by);

-- ======================================
-- Parâmetros de níveis de atividades (SCD Tipo 2)
-- ======================================
CREATE TABLE activity_params (
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
-- Parâmetros de atividade por usuário (SCD Tipo 2)
-- ======================================
CREATE TABLE user_activity_params (
    user_activity_params_id SERIAL PRIMARY KEY,
    activity_param_id INT NOT NULL REFERENCES activity_params(activity_param_id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    initiated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_user_activity_params_user_id ON user_activity_params(user_id);
CREATE INDEX idx_user_activity_params_activity_param_id ON user_activity_params(activity_param_id);
CREATE INDEX idx_user_activity_params_active ON user_activity_params(user_id, activity_param_id, active) WHERE active = TRUE;
