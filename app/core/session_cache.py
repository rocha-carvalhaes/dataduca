"""
Cache em memória para rastrear sessões de atividades completadas.
Evita consultas ao banco para verificar quantas sessões um usuário completou.
"""
from threading import Lock
from typing import Dict, Tuple, Optional
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class SessionCompletionCache:
    """
    Cache thread-safe para rastrear sessões completadas por usuário/atividade.

    Estruturas:
    - session_map: {activity_session_id: (user_id, activity_id)} - mapeia sessão para usuário/atividade
    - completion_count: {(user_id, activity_id): count} - contador de sessões completadas
    """

    def __init__(self, ttl_hours: int = 24):
        """
        Args:
            ttl_hours: Tempo de vida do cache em horas (padrão: 24h)
        """
        # Mapeia activity_session_id -> (user_id, activity_id)
        self._session_map: Dict[int, Tuple[int, int]] = {}

        # Contador de sessões completadas: (user_id, activity_id) -> count
        self._completion_count: Dict[Tuple[int, int], int] = {}

        # Timestamps para TTL
        self._session_timestamps: Dict[int, datetime] = {}
        self._count_timestamps: Dict[Tuple[int, int], datetime] = {}

        self._lock = Lock()
        self._ttl = timedelta(hours=ttl_hours)

    def register_session(
        self, activity_session_id: int, user_id: int, activity_id: int
    ):
        """
        Registra uma nova sessão no cache quando ela é criada.
        Permite buscar user_id e activity_id sem consultar o banco.
        """
        with self._lock:
            self._session_map[activity_session_id] = (user_id, activity_id)
            self._session_timestamps[activity_session_id] = datetime.now()
            logger.debug(
                f"Sessão registrada no cache: session_id={activity_session_id}, "
                f"user_id={user_id}, activity_id={activity_id}"
            )

    def complete_session(self, activity_session_id: int) -> Optional[Tuple[int, int]]:
        """
        Marca uma sessão como completada e incrementa o contador.
        Retorna (user_id, activity_id, new_count) se encontrado, None caso contrário.
        """
        with self._lock:
            # Buscar user_id e activity_id do cache
            session_info = self._session_map.get(activity_session_id)

            if not session_info:
                logger.warning(
                    f"Sessão {activity_session_id} não encontrada no cache. "
                    "Pode ter expirado ou não foi registrada."
                )
                return None

            user_id, activity_id = session_info
            key = (user_id, activity_id)

            # Incrementar contador
            current_count = self._completion_count.get(key, 0)
            new_count = current_count + 1
            self._completion_count[key] = new_count
            self._count_timestamps[key] = datetime.now()

            # Remover do mapeamento (não precisamos mais)
            del self._session_map[activity_session_id]
            if activity_session_id in self._session_timestamps:
                del self._session_timestamps[activity_session_id]

            logger.info(
                f"Sessão completada: session_id={activity_session_id}, "
                f"user_id={user_id}, activity_id={activity_id}, "
                f"total_completadas={new_count}"
            )
            return (user_id, activity_id, new_count)

    def get_count(self, user_id: int, activity_id: int) -> int:
        """
        Retorna o número de sessões completadas do cache.
        Retorna 0 se não houver dados ou se expirou.
        """
        key = (user_id, activity_id)
        with self._lock:
            if key not in self._completion_count:
                return 0

            # Verificar se expirou
            timestamp = self._count_timestamps.get(key)
            if timestamp and datetime.now() - timestamp > self._ttl:
                del self._completion_count[key]
                del self._count_timestamps[key]
                logger.debug(f"Cache expirado para {key}, removido")
                return 0

            return self._completion_count[key]

    def has_minimum_sessions(
        self, user_id: int, activity_id: int, minimum: int = 3
    ) -> bool:
        """
        Verifica se o usuário completou pelo menos 'minimum' sessões.
        Retorna True se o cache indica que sim, False caso contrário.
        """
        count = self.get_count(user_id, activity_id)
        return count >= minimum

    def reset_count(self, user_id: int, activity_id: int):
        """
        Reseta o contador de sessões completadas para um usuário/atividade.
        Útil quando o nível do usuário muda.
        """
        key = (user_id, activity_id)
        with self._lock:
            if key in self._completion_count:
                del self._completion_count[key]
            if key in self._count_timestamps:
                del self._count_timestamps[key]
            logger.info(
                f"Contador resetado no cache: user_id={user_id}, activity_id={activity_id}"
            )

    def clear_expired(self):
        """Remove entradas expiradas do cache."""
        now = datetime.now()
        with self._lock:
            # Limpar sessões expiradas
            expired_sessions = [
                session_id
                for session_id, timestamp in self._session_timestamps.items()
                if now - timestamp > self._ttl
            ]
            for session_id in expired_sessions:
                if session_id in self._session_map:
                    del self._session_map[session_id]
                del self._session_timestamps[session_id]

            # Limpar contadores expirados
            expired_counts = [
                key
                for key, timestamp in self._count_timestamps.items()
                if now - timestamp > self._ttl
            ]
            for key in expired_counts:
                del self._completion_count[key]
                del self._count_timestamps[key]

            if expired_sessions or expired_counts:
                logger.debug(
                    f"Removidas {len(expired_sessions)} sessões e "
                    f"{len(expired_counts)} contadores expirados"
                )


# Instância global do cache
_session_cache = SessionCompletionCache(ttl_hours=24)


def get_cache() -> SessionCompletionCache:
    """Retorna a instância global do cache."""
    return _session_cache


def register_session(
    activity_session_id: int, user_id: int, activity_id: int
):
    """Registra uma nova sessão no cache quando ela é criada."""
    get_cache().register_session(activity_session_id, user_id, activity_id)


def complete_session(activity_session_id: int) -> Optional[Tuple[int, int, int]]:
    """
    Marca uma sessão como completada.
    Retorna (user_id, activity_id, new_count) se encontrado, None caso contrário.
    """
    return get_cache().complete_session(activity_session_id)


def get_session_count(user_id: int, activity_id: int) -> int:
    """Retorna o número de sessões completadas do cache."""
    return get_cache().get_count(user_id, activity_id)


def has_minimum_sessions(
    user_id: int, activity_id: int, minimum: int = 3
) -> bool:
    """Verifica se o usuário completou pelo menos 'minimum' sessões."""
    return get_cache().has_minimum_sessions(user_id, activity_id, minimum)


def reset_count(user_id: int, activity_id: int):
    """Reseta o contador de sessões completadas no cache."""
    get_cache().reset_count(user_id, activity_id)
