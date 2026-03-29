-- Atualiza level_params já existentes na atividade «Senha forte» para incluir
-- rounds_total e specificity_count quando faltam (INSERT idempotente anterior
-- não altera linhas que já existiam sem estes campos).
--
-- Execute no Postgres após deploy: psql "$DATABASE_URL" -f db/migrate_senha_forte_patch_level_params_rounds.sql

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
