-- ======================================
-- SCHEMA: dataduca
-- Criado por: Gabriel
-- Descrição: Estrutura inicial do banco
-- ======================================

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    senha_hash TEXT NOT NULL,
    tipo_usuario VARCHAR(20) CHECK (tipo_usuario IN ('crianca', 'professor', 'admin')),
    criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sessoes (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    iniciada_em TIMESTAMP NOT NULL,
    finalizada_em TIMESTAMP,
    criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE atividades (
    id SERIAL PRIMARY KEY,
    sessao_id INT NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
    descricao VARCHAR(100) NOT NULL,
    iniciada_em TIMESTAMP NOT NULL,
    finalizada_em TIMESTAMP,
    criado_em TIMESTAMP DEFAULT NOW()
);

CREATE TABLE acoes (
    id SERIAL PRIMARY KEY,
    atividade_id INT NOT NULL REFERENCES atividades(id) ON DELETE CASCADE,
    tipo VARCHAR(30),
    descricao VARCHAR(100) NOT NULL,
    coordenada_x DECIMAL(10, 8) NOT NULL,
    coordenada_y DECIMAL(11, 8) NOT NULL,
    duracao_segundos INT NOT NULL,
    iniciada_em TIMESTAMP NOT NULL,
    finalizada_em TIMESTAMP,
    criado_em TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessoes_usuario_id ON sessoes(usuario_id);
CREATE INDEX idx_atividades_sessao_id ON atividades(sessao_id);
CREATE INDEX idx_acoes_atividade_id ON acoes(atividade_id);
