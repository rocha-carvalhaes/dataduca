// Configuração da API
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

if (import.meta.env.PROD && !import.meta.env.VITE_API_BASE_URL) {
  console.error(
    '[Dataduca] VITE_API_BASE_URL não foi definida no build. Configure na Vercel (Environment Variables) e faça um novo deploy.'
  );
}

export const api = {
  baseURL: API_BASE_URL,

  // Função auxiliar para fazer requisições
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;

    // Obter token do localStorage se existir
    const token = localStorage.getItem('auth_token');

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    // 20s: produção (Neon/Railway com cold start) costuma ultrapassar 5s ocasionalmente
    const timeoutMs = options.timeout ?? 20000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    config.signal = controller.signal;
    delete config.timeout;

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);

      if (response.status === 204 || response.status === 205) {
        return null;
      }

      if (!response.ok) {
        // Tenta obter a mensagem de erro do servidor
        let errorMessage = `Erro HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            errorMessage = errorData.detail;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // Se não conseguir parsear JSON, usa a mensagem padrão
          errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error(`Requisição timeout após ${timeoutMs / 1000}s`);
        throw new Error('Timeout: Servidor não respondeu');
      }
      console.error('Erro na requisição:', error);
      throw error;
    }
  },

  // Endpoints específicos
  auth: {
    async login(username, password) {
      return api.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
    },
    async logout() {
      return api.request('/api/auth/logout', {
        method: 'POST',
      });
    },
    async verify() {
      return api.request('/api/auth/verify');
    },
    async getCurrentUser() {
      return api.request('/api/auth/me');
    },
  },
  users: {
    async list() {
      return api.request('/api/users/');
    },
    async get(userId) {
      return api.request(`/api/users/${userId}`);
    },
    async create(data) {
      return api.request('/api/users/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    async update(userId, data) {
      return api.request(`/api/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    async delete(userId) {
      return api.request(`/api/users/${userId}`, {
        method: 'DELETE',
      });
    },
  },
  userSessions: {
    async list() {
      return api.request('/api/user-sessions/');
    },
    async getCurrent() {
      return api.request('/api/user-sessions/current');
    },
  },
  activities: {
    async getTypingParams(activityId = null) {
      const url = activityId
        ? `/api/activities/typing/params?activity_id=${activityId}`
        : '/api/activities/typing/params';
      return api.request(url);
    },
    async getUnscramblePhrasesParams(activityId = null) {
      const url = activityId
        ? `/api/activities/unscramble-phrases/params?activity_id=${activityId}`
        : '/api/activities/unscramble-phrases/params';
      return api.request(url);
    },
    async getWritingParams(activityId = null) {
      const url = activityId
        ? `/api/activities/writing/params?activity_id=${activityId}`
        : '/api/activities/writing/params';
      return api.request(url);
    },
    async list() {
      return api.request('/api/activities/list');
    },
    async get(activityId) {
      return api.request(`/api/activities/${activityId}`);
    },
    async create(data) {
      return api.request('/api/activities/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    async update(activityId, data) {
      return api.request(`/api/activities/${activityId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    async delete(activityId) {
      return api.request(`/api/activities/${activityId}`, {
        method: 'DELETE',
      });
    },
  },
  activitySessions: {
    async list() {
      return api.request('/api/activity-sessions/');
    },
    async create(data) {
      return api.request('/api/activity-sessions/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    async get(sessionId) {
      return api.request(`/api/activity-sessions/${sessionId}`);
    },
    async update(sessionId, data) {
      return api.request(`/api/activity-sessions/${sessionId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
  },
  documents: {
    async list() {
      return api.request('/api/documents/');
    },
    async get(documentId) {
      return api.request(`/api/documents/${documentId}`);
    },
    async create(data) {
      return api.request('/api/documents/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    async update(documentId, data) {
      return api.request(`/api/documents/${documentId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    async delete(documentId) {
      return api.request(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });
    },
  },
  activityParams: {
    async list(activityId = null, activeOnly = true) {
      const params = new URLSearchParams();
      if (activityId) params.append('activity_id', activityId);
      params.append('active_only', activeOnly);
      return api.request(`/api/activity-params/?${params.toString()}`);
    },
    async get(id) {
      return api.request(`/api/activity-params/${id}`);
    },
    async create(data) {
      return api.request('/api/activity-params/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    async update(id, data) {
      return api.request(`/api/activity-params/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    async delete(id) {
      return api.request(`/api/activity-params/${id}`, {
        method: 'DELETE',
      });
    },
  },
  userActivityParams: {
    async list(activityParamId = null, userId = null, activeOnly = true) {
      const params = new URLSearchParams();
      if (activityParamId) params.append('activity_param_id', activityParamId);
      if (userId) params.append('user_id', userId);
      params.append('active_only', activeOnly);
      return api.request(`/api/user-activity-params/?${params.toString()}`);
    },
    async getCurrent(activityParamId) {
      return api.request(
        `/api/user-activity-params/current/${activityParamId}`
      );
    },
    async create(data) {
      return api.request('/api/user-activity-params/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    async get(id) {
      return api.request(`/api/user-activity-params/${id}`);
    },
  },
  manage: {
    async tables() {
      return api.request('/api/manage/tables');
    },
    async columns(table) {
      return api.request(`/api/manage/columns?table=${table}`);
    },
    async query(data) {
      return api.request('/api/manage/query', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  },
  quests: {
    async list() {
      return api.request('/api/quests/');
    },
    async get(questId) {
      return api.request(`/api/quests/${questId}`);
    },
    async create(data) {
      return api.request('/api/quests/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    async update(questId, data) {
      return api.request(`/api/quests/${questId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    async delete(questId) {
      return api.request(`/api/quests/${questId}`, {
        method: 'DELETE',
      });
    },
    async start(questId) {
      return api.request(`/api/quests/${questId}/start`, {
        method: 'POST',
      });
    },
    async completeStep(questId, body) {
      return api.request(`/api/quests/${questId}/complete-step`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
  },
  userLevels: {
    async evaluate(userId, activityId) {
      return api.request(`/api/user-levels/evaluate/${userId}/${activityId}`, {
        method: 'POST',
      });
    },
    async evaluateAll(userId) {
      return api.request(`/api/user-levels/evaluate-all/${userId}`, {
        method: 'POST',
      });
    },
    async evaluateAllUsers() {
      return api.request('/api/user-levels/evaluate-all-users', {
        method: 'POST',
        timeout: 30000,
      });
    },
  },
};

export default api;
