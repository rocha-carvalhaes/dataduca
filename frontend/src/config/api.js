// Configuração da API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export const api = {
  baseURL: API_BASE_URL,
  
  // Função auxiliar para fazer requisições
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    }

    // Criar um timeout de 5 segundos
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    config.signal = controller.signal

    try {
      const response = await fetch(url, config)
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        // Tenta obter a mensagem de erro do servidor
        let errorMessage = `Erro HTTP ${response.status}`
        try {
          const errorData = await response.json()
          if (errorData.detail) {
            errorMessage = errorData.detail
          } else if (errorData.message) {
            errorMessage = errorData.message
          }
        } catch {
          // Se não conseguir parsear JSON, usa a mensagem padrão
          errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }
      
      return await response.json()
    } catch (error) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        console.error('Requisição timeout após 5 segundos')
        throw new Error('Timeout: Servidor não respondeu')
      }
      console.error('Erro na requisição:', error)
      throw error
    }
  },

  // Endpoints específicos
  atividades: {
    async obterParamsDigitacao() {
      return api.request('/api/atividades/digitacao/params')
    },
  },
  usuarios: {
    async listar() {
      return api.request('/api/usuarios/')
    },
    async obter(userId) {
      return api.request(`/api/usuarios/${userId}`)
    },
    async criar(dados) {
      return api.request('/api/usuarios/', {
        method: 'POST',
        body: JSON.stringify(dados),
      })
    },
    async atualizar(userId, dados) {
      return api.request(`/api/usuarios/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(dados),
      })
    },
    async deletar(userId) {
      return api.request(`/api/usuarios/${userId}`, {
        method: 'DELETE',
      })
    },
  },
}

export default api

