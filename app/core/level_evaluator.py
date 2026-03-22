"""
Módulo para avaliação de progressão de níveis de usuários.
Avalia histórico de sessões e determina se o usuário deve subir ou descer de nível.
"""

from typing import Optional, List
from psycopg2.extras import RealDictCursor
from datetime import datetime
import logging
import json

from app.routes.auth import get_db_connection

logger = logging.getLogger(__name__)


class LevelEvaluator:
    """
    Avalia se o usuário deve subir/descer de nível baseado nos resultados
    das últimas N sessões
    """

    @staticmethod
    def get_recent_sessions(
        user_id: int,
        activity_id: int,
        limit: int = 10,
        min_date: Optional[datetime] = None,
    ) -> List[dict]:
        """
        Busca as N últimas sessões completas do usuário para uma atividade.
        Retorna apenas sessões com ended_at (finalizadas).

        Args:
            user_id: ID do usuário
            activity_id: ID da atividade
            limit: Número máximo de sessões a retornar
            min_date: Data mínima para filtrar sessões (considera apenas sessões após esta data)
        """
        conn = None
        try:
            conn = get_db_connection()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                query = """
                    SELECT
                        asess.activity_session_id,
                        asess.results,
                        asess.ended_at,
                        asess.initiated_at,
                        a.activity_type
                    FROM activity_sessions asess
                    JOIN user_sessions us ON asess.user_session_id = us.user_session_id
                    JOIN activities a ON asess.activity_id = a.activity_id
                    WHERE us.user_id = %s
                        AND asess.activity_id = %s
                        AND asess.ended_at IS NOT NULL
                """
                params = [user_id, activity_id]

                # Adicionar filtro de data mínima se fornecido
                if min_date:
                    query += " AND asess.initiated_at >= %s"
                    params.append(min_date)

                query += " ORDER BY asess.ended_at DESC LIMIT %s"
                params.append(limit)

                cur.execute(query, params)
                sessions = cur.fetchall()
                return [dict(session) for session in sessions]
        except Exception as e:
            logger.error(f"Erro ao buscar sessões recentes: {str(e)}", exc_info=True)
            return []
        finally:
            if conn:
                conn.close()

    @staticmethod
    def _extract_hit_rates(sessions: List[dict], required_games: int) -> List[float]:
        """
        Extrai hit_rates válidos das sessões (apenas sessões com pelo menos 1 bolha).
        Retorna lista limitada a required_games.
        """
        hit_rates = []
        for session in sessions:
            results = session.get("results", {})
            if isinstance(results, str):
                results = json.loads(results)

            hit_rate = results.get("hitRate", 0)
            total_bubbles = results.get("totalBubbles", 0)

            if total_bubbles > 0:  # Apenas sessões com pelo menos 1 bolha
                hit_rates.append(hit_rate)
                if len(hit_rates) >= required_games:
                    break  # Já temos o suficiente

        return hit_rates[:required_games]

    @staticmethod
    def evaluate_typing_activity(
        recent_sessions: List[dict], level_up_params: dict, level_down_params: dict
    ) -> Optional[dict]:
        """
        Avalia resultados da atividade de digitação.

        Sobe de nível se: média de hit_rate das últimas N sessões >= parâmetro
        Desce de nível se: média de hit_rate das últimas N sessões < parâmetro
        """
        if not recent_sessions:
            logger.warning("Nenhuma sessão recente para avaliar")
            return None

        logger.info(
            f"Avaliando digitação: {len(recent_sessions)} sessões, "
            f"level_up_params={level_up_params}, level_down_params={level_down_params}"
        )

        # Parâmetros para subir de nível
        up_games_count = level_up_params.get("games_count", len(recent_sessions))
        up_required_games = level_up_params.get("required_games", up_games_count)
        min_avg_hit_rate_threshold = level_up_params.get("min_avg_hit_rate", 90)

        logger.info(
            f"Parâmetros UP: games_count={up_games_count}, "
            f"required_games={up_required_games}, min_avg_hit_rate={min_avg_hit_rate_threshold}"
        )

        # Parâmetros para descer de nível
        down_games_count = level_down_params.get("games_count", len(recent_sessions))
        down_required_games = level_down_params.get("required_games", down_games_count)
        max_avg_hit_rate_threshold = level_down_params.get("max_avg_hit_rate", 50)

        logger.info(
            f"Parâmetros DOWN: games_count={down_games_count}, "
            f"required_games={down_required_games}, max_avg_hit_rate={max_avg_hit_rate_threshold}"
        )

        up_sessions = recent_sessions[:up_games_count]
        down_sessions = recent_sessions[:down_games_count]

        # Verificar se deve subir de nível
        if level_up_params and up_sessions:
            hit_rates = LevelEvaluator._extract_hit_rates(
                up_sessions, up_required_games
            )

            logger.info(
                f"UP: {len(hit_rates)} hit_rates encontrados (limitado a {up_required_games}), "
                f"hit_rates={hit_rates}"
            )
            if len(hit_rates) >= up_required_games:
                avg_hit_rate = sum(hit_rates) / len(hit_rates)
                logger.info(
                    f"UP: avg_hit_rate={avg_hit_rate:.2f}, threshold={min_avg_hit_rate_threshold}"
                )
                if avg_hit_rate >= min_avg_hit_rate_threshold:
                    logger.info("UP: Critério atendido, subindo de nível")
                    return {
                        "action": "level_up",
                        "reason": "avg_hit_rate_above_threshold",
                        "avg_hit_rate": avg_hit_rate,
                        "threshold": min_avg_hit_rate_threshold,
                        "games_evaluated": len(hit_rates),
                    }

        # Verificar se deve descer de nível
        if level_down_params and down_sessions:
            hit_rates = LevelEvaluator._extract_hit_rates(
                down_sessions, down_required_games
            )

            logger.info(
                f"DOWN: {len(hit_rates)} hit_rates encontrados (limitado a {down_required_games}), "
                f"hit_rates={hit_rates}"
            )
            if len(hit_rates) >= down_required_games:
                avg_hit_rate = sum(hit_rates) / len(hit_rates)
                logger.info(
                    f"DOWN: avg_hit_rate={avg_hit_rate:.2f}, threshold={max_avg_hit_rate_threshold}"
                )
                if avg_hit_rate < max_avg_hit_rate_threshold:
                    logger.info("DOWN: Critério atendido, descendo de nível")
                    return {
                        "action": "level_down",
                        "reason": "avg_hit_rate_below_threshold",
                        "avg_hit_rate": avg_hit_rate,
                        "threshold": max_avg_hit_rate_threshold,
                        "games_evaluated": len(hit_rates),
                    }

        return None

    @staticmethod
    def evaluate_unscramble_phrases(  # noqa: C901
        recent_sessions: List[dict], level_up_params: dict, level_down_params: dict
    ) -> Optional[dict]:
        """
        Avalia resultados da atividade de desembaralhar frases.

        Sobe de nível se: média de movimentos < X% da média de palavras
        Desce de nível se: média de movimentos > Y% da média de palavras
        """
        if not recent_sessions:
            return None

        # Parâmetros para subir de nível
        up_games_count = level_up_params.get("games_count", len(recent_sessions))
        up_required_games = level_up_params.get("required_games", up_games_count)
        max_movements_percentage = level_up_params.get("max_movements_percentage", 80)

        logger.info(
            f"Parâmetros UP: games_count={up_games_count}, "
            f"required_games={up_required_games}, "
            f"max_movements_percentage={max_movements_percentage}"
        )

        # Parâmetros para descer de nível
        down_games_count = level_down_params.get("games_count", len(recent_sessions))
        down_required_games = level_down_params.get("required_games", down_games_count)
        min_movements_percentage = level_down_params.get(
            "min_movements_percentage", 120
        )

        logger.info(
            f"Parâmetros DOWN: games_count={down_games_count}, "
            f"required_games={down_required_games}, "
            f"min_movements_percentage={min_movements_percentage}"
        )

        up_sessions = recent_sessions[:up_games_count]
        down_sessions = recent_sessions[:down_games_count]

        def calculate_avg_movements_percentage(sessions, required_games):
            """
            Calcula a média de movimentos como percentual da média de palavras.
            Retorna (avg_movements_percentage, valid_sessions_count, total_phrases)
            Considera apenas sessões válidas (com pelo menos uma frase completada).
            """
            total_movements = 0
            total_words = 0
            total_phrases = 0
            valid_sessions = []

            for session in sessions:
                results = session.get("results", {})
                if isinstance(results, str):
                    results = json.loads(results)

                phrases = results.get("phrases", [])
                movement_history = results.get("movement_history", {})

                if not phrases or not movement_history:
                    continue

                # Contar frases e movimentos desta sessão
                session_movements = 0
                session_words = 0
                session_phrases = 0

                for phrase_index, phrase in enumerate(phrases):
                    # Obter histórico de movimentos desta frase
                    phrase_movements = movement_history.get(str(phrase_index), [])

                    # Quantidade de movimentos = tamanho do array - 1 (primeiro é estado inicial)
                    movements_count = max(0, len(phrase_movements) - 1)

                    # Quantidade de palavras na frase
                    words_count = len(phrase.split())

                    if words_count > 0:
                        session_movements += movements_count
                        session_words += words_count
                        session_phrases += 1

                # Se a sessão tem pelo menos uma frase, é válida
                if session_phrases > 0:
                    valid_sessions.append(
                        {
                            "movements": session_movements,
                            "words": session_words,
                            "phrases": session_phrases,
                        }
                    )

            # Limitar a required_games (apenas as sessões mais recentes)
            valid_sessions = valid_sessions[:required_games]

            if len(valid_sessions) < required_games:
                return None, len(valid_sessions), 0

            # Calcular totais das sessões válidas
            for session_data in valid_sessions:
                total_movements += session_data["movements"]
                total_words += session_data["words"]
                total_phrases += session_data["phrases"]

            if total_phrases == 0:
                return None, len(valid_sessions), 0

            # Calcular percentual: (média de movimentos / média de palavras) * 100
            avg_movements = total_movements / total_phrases
            avg_words = total_words / total_phrases
            percentage = (avg_movements / avg_words) * 100 if avg_words > 0 else 0

            return percentage, len(valid_sessions), total_phrases

        # Verificar se deve subir de nível
        if level_up_params and up_sessions:
            percentage, valid_sessions_count, total_phrases = (
                calculate_avg_movements_percentage(up_sessions, up_required_games)
            )

            logger.info(
                f"UP: percentage={percentage}, valid_sessions={valid_sessions_count}, "
                f"total_phrases={total_phrases}, required={up_required_games}, "
                f"threshold={max_movements_percentage}"
            )
            if percentage is not None and valid_sessions_count >= up_required_games:
                if percentage < max_movements_percentage:
                    logger.info("UP: Critério atendido, subindo de nível")
                    return {
                        "action": "level_up",
                        "reason": "low_movements_average",
                        "avg_movements_percentage": percentage,
                        "max_allowed_percentage": max_movements_percentage,
                        "sessions_evaluated": valid_sessions_count,
                        "phrases_evaluated": total_phrases,
                    }

        # Verificar se deve descer de nível
        if level_down_params and down_sessions:
            percentage, valid_sessions_count, total_phrases = (
                calculate_avg_movements_percentage(down_sessions, down_required_games)
            )

            logger.info(
                f"DOWN: percentage={percentage}, valid_sessions={valid_sessions_count}, "
                f"total_phrases={total_phrases}, required={down_required_games}, "
                f"threshold={min_movements_percentage}"
            )
            if percentage is not None and valid_sessions_count >= down_required_games:
                if percentage > min_movements_percentage:
                    logger.info("DOWN: Critério atendido, descendo de nível")
                    return {
                        "action": "level_down",
                        "reason": "high_movements_average",
                        "avg_movements_percentage": percentage,
                        "min_allowed_percentage": min_movements_percentage,
                        "sessions_evaluated": valid_sessions_count,
                        "phrases_evaluated": total_phrases,
                    }

        return None

    @staticmethod
    def _calc_session_accuracy(results: dict) -> Optional[float]:
        """
        Calcula a acurácia de uma sessão de escrita.
        Formato esperado: results.phrases_typed_keys = { "0": [...], "1": [...] }
        Cada entrada é {key, correct_key, hit_time}.
        Acurácia = teclas corretas / total de teclas (excluindo Backspace) * 100.
        """
        phrases_typed_keys = results.get("phrases_typed_keys", {})
        if not phrases_typed_keys:
            return None

        total_keys = 0
        correct_keys = 0

        for typed_keys in phrases_typed_keys.values():
            if not isinstance(typed_keys, list):
                continue
            for key_data in typed_keys:
                if key_data.get("key") == "Backspace":
                    continue
                total_keys += 1
                if key_data.get("correct_key", False):
                    correct_keys += 1

        if total_keys == 0:
            return None
        return (correct_keys / total_keys) * 100

    @staticmethod
    def _collect_writing_accuracies(sessions, required):
        """Coleta acurácias de sessões de escrita até atingir required."""
        accs = []
        for s in sessions:
            results = s.get("results", {})
            if isinstance(results, str):
                results = json.loads(results)
            acc = LevelEvaluator._calc_session_accuracy(results)
            if acc is not None:
                accs.append(acc)
                if len(accs) >= required:
                    break
        return accs

    @staticmethod
    def _check_writing_level(
        sessions, required, threshold, direction
    ) -> Optional[dict]:
        """Verifica se deve subir ou descer de nível na escrita."""
        if not sessions:
            return None
        accs = LevelEvaluator._collect_writing_accuracies(sessions, required)
        logger.info(f"Writing {direction}: accuracies={accs}")
        if len(accs) < required:
            return None
        avg = sum(accs) / len(accs)
        if direction == "UP" and avg >= threshold:
            logger.info(f"Writing UP: avg={avg:.1f}% >= {threshold}%")
            return {
                "action": "level_up",
                "reason": "high_accuracy",
                "avg_accuracy": avg,
                "threshold": threshold,
                "sessions_evaluated": len(accs),
            }
        if direction == "DOWN" and avg < threshold:
            logger.info(f"Writing DOWN: avg={avg:.1f}% < {threshold}%")
            return {
                "action": "level_down",
                "reason": "low_accuracy",
                "avg_accuracy": avg,
                "threshold": threshold,
                "sessions_evaluated": len(accs),
            }
        return None

    @staticmethod
    def evaluate_writing_activity(
        recent_sessions: List[dict],
        level_up_params: dict,
        level_down_params: dict,
    ) -> Optional[dict]:
        """
        Avalia resultados da atividade de escrita baseado em acurácia.

        Sobe de nível se: média de acurácia >= min_avg_accuracy
        Desce de nível se: média de acurácia < max_avg_accuracy
        """
        if not recent_sessions:
            return None

        n = len(recent_sessions)
        up_count = level_up_params.get("games_count", n)
        up_required = level_up_params.get("required_games", up_count)
        min_acc = level_up_params.get("min_avg_accuracy", 90)

        down_count = level_down_params.get("games_count", n)
        down_required = level_down_params.get("required_games", down_count)
        max_acc = level_down_params.get("max_avg_accuracy", 40)

        logger.info(f"Writing UP: required={up_required}, min={min_acc}")
        logger.info(f"Writing DOWN: required={down_required}, max={max_acc}")

        result = LevelEvaluator._check_writing_level(
            recent_sessions[:up_count], up_required, min_acc, "UP"
        )
        if result:
            return result

        return LevelEvaluator._check_writing_level(
            recent_sessions[:down_count], down_required, max_acc, "DOWN"
        )
