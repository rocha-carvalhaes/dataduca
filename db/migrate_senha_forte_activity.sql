-- Regista a atividade «Senha forte» (idempotente).
INSERT INTO activities (activity_name, activity_description, activity_objective, activity_type, activity_icon, activity_version)
SELECT 'Senha forte', 'Crie uma senha fictícia que cumpra restrições de complexidade.', 'Praticar criação de senhas fortes.', 'senha_forte', '🔐', '1.0'
WHERE NOT EXISTS (SELECT 1 FROM activities WHERE activity_type = 'senha_forte');
