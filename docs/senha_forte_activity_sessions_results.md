# «Senha forte» — `activity_sessions.results` (persistido)

Após o `PUT` da sessão, o servidor aplica `finalize_senha_forte_results` em [`app/core/strong_password.py`](../app/core/strong_password.py): remove `_password` e `_confirm`, e define **`validation_passed`** com base em `level_params` (não confiar apenas no cliente).

## Campos típicos no JSON gravado

| Campo | Tipo | Descrição |
|--------|------|-----------|
| `validation_passed` | bool | Definido no servidor após validar a senha contra `level_params`. |
| `attempts_in_session` | int | Tentativas de «Testar senha» na sessão (incremento no cliente). |
| `duration_primary_field_keydown_ms` | int | Soma das durações por rodada (campo principal), em ms — usada pelo avaliador de níveis. |
| `events` | array | Eventos de telemetria por categoria (`insertion` / `delete`, `category`, `unique`, `at`, opcionalmente `round`). |
| `senha_forte_version` | int | `2` quando há várias rodadas com desafio gerado no servidor. |
| `rounds_completed` | int | Número de rodadas concluídas (ex.: 3). |
| `rounds_summary` | array | Por rodada: `duration_primary_field_keydown_ms` e `round` (soma das durações = métrica global). |
| `challenge` | object | Desafio da sessão (`round2_letters`, `round3_digits`, `round3_symbols`); gravado no servidor na criação da sessão. |

## Campos transitórios (não persistidos)

Enviados só no corpo do `PUT` e removidos antes de gravar:

- `_password` — senha em claro para validação no servidor.
- `_confirm` — confirmação, se aplicável.

## Opcional

O cliente pode enviar `validation_passed: true` no corpo; o valor **final** é sempre recalculado no servidor.

## `level_params` (em `activity_params`)

| Campo | Descrição |
|--------|-----------|
| `specificity_count` | 1–3: quantos caracteres específicos em R2 (letras) e repartição em R3 (dígitos/símbolos). |
| `rounds_total` | Omitir ou `1` = uma rodada (comportamento antigo). `3` = três rodadas com desafio gerado na sessão. |
| `letter_pool`, `digit_pool`, `symbol_pool` | Opcional; strings de onde sortear os caracteres obrigatórios. |

## Operação e infraestrutura

- Migração única sugerida: [`db/migrate_senha_forte_all.sql`](../db/migrate_senha_forte_all.sql) (atividade, `activity_params`, vínculos `user_activity_params`).
- **Reavaliar Níveis** (Gerenciar) pode demorar; o frontend usa timeout longo. Se ainda falhar em produção, o limite pode ser do **proxy** (Railway, Nginx, etc.) — aumentar o timeout do servidor/proxy ou, no futuro, usar processamento assíncrono.
