-- Script para criar a tabela documents
-- Execute este script no seu banco de dados PostgreSQL

-- ======================================
-- Tabela de documentos
-- ======================================
CREATE TABLE IF NOT EXISTS documents (
    document_id SERIAL PRIMARY KEY,
    document_content TEXT NOT NULL,
    created_by INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by);

