-- =============================================================================
-- Senha forte — migração completa (ordem segura, idempotente)
-- Execute no Postgres: psql "$DATABASE_URL" -f db/migrate_senha_forte_all.sql
-- =============================================================================

-- 1) Atividade
INSERT INTO activities (activity_name, activity_description, activity_objective, activity_type, activity_icon, activity_version)
SELECT 'Senha forte', 'Crie uma senha fictícia que cumpra restrições de complexidade.', 'Praticar criação de senhas fortes.', 'senha_forte', '🔐', '1.0'
WHERE NOT EXISTS (SELECT 1 FROM activities WHERE activity_type = 'senha_forte');

-- 2) Parâmetros de nível 1
INSERT INTO activity_params (activity_id, level, level_params, level_down_params, level_up_params, active)
SELECT
  a.activity_id,
  1,
  '{
    "min_length": 8,
    "require_uppercase": true,
    "require_lowercase": true,
    "require_digit": true,
    "require_symbol": false,
    "require_password_confirmation": false,
    "confirmation_must_match": true,
    "symbol_class": "ascii_punctuation",
    "specificity_count": 1,
    "rounds_total": 3
  }'::jsonb,
  '{
    "sessions_count": 5,
    "min_successful_sessions": 3,
    "min_median_duration_ms": 180000
  }'::jsonb,
  '{
    "sessions_count": 5,
    "min_successful_sessions": 3,
    "max_median_duration_ms": 90000
  }'::jsonb,
  TRUE
FROM activities a
WHERE a.activity_type = 'senha_forte'
  AND NOT EXISTS (
    SELECT 1
    FROM activity_params ap
    WHERE ap.activity_id = a.activity_id
      AND ap.level = 1
      AND ap.active = TRUE
  );

-- 3) Vínculos utilizador ↔ nível 1 (todos os utilizadores sem nível ativo nesta atividade)
INSERT INTO user_activity_params (activity_param_id, user_id, active)
SELECT sub.activity_param_id, u.user_id, TRUE
FROM users u
CROSS JOIN (
  SELECT DISTINCT ON (ap.activity_id) ap.activity_param_id, ap.activity_id
  FROM activity_params ap
  INNER JOIN activities a ON a.activity_id = ap.activity_id
  WHERE a.activity_type = 'senha_forte'
    AND ap.level = 1
    AND ap.active = TRUE
  ORDER BY ap.activity_id, ap.created_at DESC
) sub
WHERE NOT EXISTS (
  SELECT 1
  FROM user_activity_params uap
  INNER JOIN activity_params ap2 ON uap.activity_param_id = ap2.activity_param_id
  WHERE uap.user_id = u.user_id
    AND ap2.activity_id = sub.activity_id
    AND uap.active = TRUE
);

-- 4) Corrigir level_params antigos (sem rounds_total / specificity_count)
UPDATE activity_params ap
SET level_params =
  ap.level_params
  || CASE
    WHEN ap.level_params ? 'rounds_total' THEN '{}'::jsonb
    ELSE '{"rounds_total": 3}'::jsonb
  END
  || CASE
    WHEN ap.level_params ? 'specificity_count' THEN '{}'::jsonb
    ELSE '{"specificity_count": 1}'::jsonb
  END
FROM activities a
WHERE ap.activity_id = a.activity_id
  AND a.activity_type = 'senha_forte'
  AND ap.active = TRUE
  AND (
    NOT (ap.level_params ? 'rounds_total')
    OR NOT (ap.level_params ? 'specificity_count')
  );

-- 5) Quest (exemplo): descomente e ajuste created_by e step_order após criar a quest.
-- INSERT INTO quests (quest_name, quest_description, quest_objective, enforce_sequence, created_by)
-- VALUES ('Introdução', 'Inclui Senha forte', NULL, TRUE, 1)
-- RETURNING quest_id;
-- INSERT INTO quest_steps (quest_id, activity_id, step_order)
-- SELECT <quest_id>, a.activity_id, 1
-- FROM activities a WHERE a.activity_type = 'senha_forte';
