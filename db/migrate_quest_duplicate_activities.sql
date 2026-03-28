-- Permite a mesma activity_id várias vezes na mesma quest e migra progresso para IDs de passo.

-- 1) Remove unicidade (quest_id, activity_id) em quest_steps
ALTER TABLE quest_steps DROP CONSTRAINT IF EXISTS quest_steps_quest_id_activity_id_key;

-- 2) Renomeia coluna e converte JSON: eram activity_id, passam a ser quest_step_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_quest_progress'
      AND column_name = 'completed_activity_ids'
  ) THEN
    UPDATE user_quest_progress uqp
    SET completed_activity_ids = migrated.new_json
    FROM (
      SELECT
        uqp_inner.user_quest_progress_id,
        COALESCE(
          (
            SELECT jsonb_agg(qs.quest_step_id ORDER BY t.ord)
            FROM jsonb_array_elements_text(uqp_inner.completed_activity_ids)
              WITH ORDINALITY AS t(val, ord)
            INNER JOIN quest_steps qs
              ON qs.quest_id = uqp_inner.quest_id
             AND qs.activity_id = t.val::int
          ),
          '[]'::jsonb
        ) AS new_json
      FROM user_quest_progress uqp_inner
    ) migrated
    WHERE uqp.user_quest_progress_id = migrated.user_quest_progress_id;

    ALTER TABLE user_quest_progress
      RENAME COLUMN completed_activity_ids TO completed_quest_step_ids;
  END IF;
END $$;
