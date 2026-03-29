-- Parâmetros de nível 1 para a atividade «Senha forte» (idempotente).
-- Executar depois de migrate_senha_forte_activity.sql (atividade tem de existir).
--
-- level_params: regras da senha (GET params, POST validate, finalize na sessão).
-- level_up_params / level_down_params: medianas de duration_primary_field_keydown_ms
--   em sessões com validation_passed (ver app.core.level_evaluator.evaluate_strong_password_activity).

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
