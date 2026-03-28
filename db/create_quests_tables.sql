-- Quests: sequências de atividades. Execute em bancos já existentes.

CREATE TABLE IF NOT EXISTS quests (
    quest_id SERIAL PRIMARY KEY,
    quest_name VARCHAR(200) NOT NULL,
    quest_description TEXT,
    quest_objective TEXT,
    enforce_sequence BOOLEAN NOT NULL DEFAULT TRUE,
    forked_from_quest_id INT NULL REFERENCES quests(quest_id) ON DELETE SET NULL,
    superseded_by_quest_id INT NULL REFERENCES quests(quest_id) ON DELETE SET NULL,
    created_by INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quest_steps (
    quest_step_id SERIAL PRIMARY KEY,
    quest_id INT NOT NULL REFERENCES quests(quest_id) ON DELETE CASCADE,
    activity_id INT NOT NULL REFERENCES activities(activity_id) ON DELETE RESTRICT,
    step_order INT NOT NULL,
    UNIQUE (quest_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_quest_steps_quest_id ON quest_steps(quest_id);

CREATE TABLE IF NOT EXISTS user_quest_progress (
    user_quest_progress_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    quest_id INT NOT NULL REFERENCES quests(quest_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    completed_quest_step_ids JSONB NOT NULL DEFAULT '[]',
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    UNIQUE (user_id, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_user_quest_progress_user ON user_quest_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quest_progress_quest ON user_quest_progress(quest_id);

-- Bancos criados antes das colunas de versionamento:
ALTER TABLE quests ADD COLUMN IF NOT EXISTS forked_from_quest_id INT NULL
  REFERENCES quests(quest_id) ON DELETE SET NULL;
ALTER TABLE quests ADD COLUMN IF NOT EXISTS superseded_by_quest_id INT NULL
  REFERENCES quests(quest_id) ON DELETE SET NULL;

ALTER TABLE quest_steps DROP CONSTRAINT IF EXISTS quest_steps_quest_id_activity_id_key;

-- Se ainda existir completed_activity_ids com valores antigos (activity_id), rode também:
-- db/migrate_quest_duplicate_activities.sql
