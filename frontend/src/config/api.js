// Configuração da API
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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

    // Criar um timeout de 5 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    config.signal = controller.signal;

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);

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
        console.error('Requisição timeout após 5 segundos');
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
  userActivityParams: {
    async list(activityId = null, userId = null, activeOnly = true) {
      const params = new URLSearchParams();
      if (activityId) params.append('activity_id', activityId);
      if (userId) params.append('user_id', userId);
      params.append('active_only', activeOnly);
      return api.request(`/api/user-activity-params/?${params.toString()}`);
    },
    async getCurrent(activityId) {
      return api.request(`/api/user-activity-params/current/${activityId}`);
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
};

export default api;
