-- Quests: sequências de atividades. Execute em bancos já existentes.

CREATE TABLE IF NOT EXISTS quests (
    quest_id SERIAL PRIMARY KEY,
    quest_name VARCHAR(200) NOT NULL,
    quest_description TEXT,
    quest_objective TEXT,
    enforce_sequence BOOLEAN NOT NULL DEFAULT TRUE,
    created_by INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quest_steps (
    quest_step_id SERIAL PRIMARY KEY,
    quest_id INT NOT NULL REFERENCES quests(quest_id) ON DELETE CASCADE,
    activity_id INT NOT NULL REFERENCES activities(activity_id) ON DELETE RESTRICT,
    step_order INT NOT NULL,
    UNIQUE (quest_id, step_order),
    UNIQUE (quest_id, activity_id)
);

CREATE INDEX IF NOT EXISTS idx_quest_steps_quest_id ON quest_steps(quest_id);

CREATE TABLE IF NOT EXISTS user_quest_progress (
    user_quest_progress_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    quest_id INT NOT NULL REFERENCES quests(quest_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    completed_activity_ids JSONB NOT NULL DEFAULT '[]',
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    UNIQUE (user_id, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_user_quest_progress_user ON user_quest_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quest_progress_quest ON user_quest_progress(quest_id);

