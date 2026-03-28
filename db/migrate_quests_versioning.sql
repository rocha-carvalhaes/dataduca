-- Versionamento de quests: fork ao "editar" — quem já iniciou mantém o quest_id antigo.
-- Execute uma vez em bancos que já possuem a tabela quests sem estas colunas.

ALTER TABLE quests ADD COLUMN IF NOT EXISTS forked_from_quest_id INT NULL
  REFERENCES quests(quest_id) ON DELETE SET NULL;

ALTER TABLE quests ADD COLUMN IF NOT EXISTS superseded_by_quest_id INT NULL
  REFERENCES quests(quest_id) ON DELETE SET NULL;
