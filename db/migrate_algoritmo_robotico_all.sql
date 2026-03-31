-- =============================================================================
-- Algoritmo robótico — migração completa (idempotente)
-- Execute: psql "$DATABASE_URL" -f db/migrate_algoritmo_robotico_all.sql
-- Cenários padrão: app/data/robotic_scenarios.json (API/sessão fazem merge se vazio)
-- =============================================================================

INSERT INTO activities (activity_name, activity_description, activity_objective, activity_type, activity_icon, activity_version)
SELECT 'Algoritmo robótico',
       'Programe um robô com blocos para coletar estrelas num grelha.',
       'Praticar sequenciamento e lógica de controlo.',
       'algoritmo_robotico',
       '🤖',
       '1.0'
WHERE NOT EXISTS (SELECT 1 FROM activities WHERE activity_type = 'algoritmo_robotico');

-- Nível 1
INSERT INTO activity_params (activity_id, level, level_params, level_down_params, level_up_params, active)
SELECT
  a.activity_id,
  1,
  '{"rounds_total": 3, "scenarios": [], "commands": ["walk", "turn_left", "turn_right", "collect"]}'::jsonb,
  '{"games_count": 5, "required_games": 3}'::jsonb,
  '{"games_count": 5, "required_games": 3, "max_avg_moves_per_round": 4}'::jsonb,
  TRUE
FROM activities a
WHERE a.activity_type = 'algoritmo_robotico'
  AND NOT EXISTS (
    SELECT 1 FROM activity_params ap
    WHERE ap.activity_id = a.activity_id AND ap.level = 1 AND ap.active = TRUE
  );

-- Níveis 2–10 (parâmetros de evolução; cenários via ficheiro JSON em runtime)
INSERT INTO activity_params (activity_id, level, level_params, level_down_params, level_up_params, active)
SELECT a.activity_id, v.level,
  '{"rounds_total": 3, "scenarios": [], "commands": ["walk", "turn_left", "turn_right", "collect"]}'::jsonb,
  v.down::jsonb,
  v.up::jsonb,
  TRUE
FROM activities a
CROSS JOIN (VALUES
  (2,
   '{"games_count": 5, "required_games": 3, "min_avg_moves_per_round": 20}'::jsonb,
   '{"games_count": 5, "required_games": 3, "max_avg_moves_per_round": 5}'::jsonb),
  (3,
   '{"games_count": 5, "required_games": 3, "min_avg_moves_per_round": 20}'::jsonb,
   '{"games_count": 5, "required_games": 3, "max_avg_moves_per_round": 7}'::jsonb),
  (4,
   '{"games_count": 5, "required_games": 3, "min_avg_moves_per_round": 20}'::jsonb,
   '{"games_count": 5, "required_games": 3, "max_avg_moves_per_round": 10}'::jsonb),
  (5,
   '{"games_count": 5, "required_games": 3, "min_avg_moves_per_round": 22}'::jsonb,
   '{"games_count": 5, "required_games": 3, "max_avg_moves_per_round": 12}'::jsonb),
  (6,
   '{"games_count": 5, "required_games": 3, "min_avg_moves_per_round": 24}'::jsonb,
   '{"games_count": 5, "required_games": 3, "max_avg_moves_per_round": 14}'::jsonb),
  (7,
   '{"games_count": 5, "required_games": 3, "min_avg_moves_per_round": 26}'::jsonb,
   '{"games_count": 5, "required_games": 3, "max_avg_moves_per_round": 16}'::jsonb),
  (8,
   '{"games_count": 5, "required_games": 3, "min_avg_moves_per_round": 28}'::jsonb,
   '{"games_count": 5, "required_games": 3, "max_avg_moves_per_round": 18}'::jsonb),
  (9,
   '{"games_count": 5, "required_games": 3, "min_avg_moves_per_round": 30}'::jsonb,
   '{"games_count": 5, "required_games": 3, "max_avg_moves_per_round": 20}'::jsonb),
  (10,
   '{"games_count": 5, "required_games": 3, "min_avg_moves_per_round": 32}'::jsonb,
   '{"games_count": 5, "required_games": 3, "max_avg_moves_per_round": 22}'::jsonb)
) AS v(level, down, up)
WHERE a.activity_type = 'algoritmo_robotico'
  AND NOT EXISTS (
    SELECT 1 FROM activity_params ap
    WHERE ap.activity_id = a.activity_id AND ap.level = v.level AND ap.active = TRUE
  );
