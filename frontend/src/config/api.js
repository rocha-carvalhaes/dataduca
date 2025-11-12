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
        throw new Error(`HTTP error! status: ${response.status}`)
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
}

export default api

