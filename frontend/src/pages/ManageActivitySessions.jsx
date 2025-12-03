import { useState, useEffect } from 'react'
import api from '../config/api'

function ManageActivitySessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.activitySessions.list()
      setSessions(data)
    } catch (err) {
      setError(err.message || 'Erro ao carregar sessões de atividades. Tente novamente.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('pt-BR')
  }

  const formatResults = (results) => {
    if (!results || typeof results !== 'object') return '-'
    try {
      return JSON.stringify(results, null, 2)
    } catch {
      return String(results)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-[#6E6E6E]">Carregando sessões de atividades...</div>
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow border border-[#D9D9D9] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F5F6F7] border-b border-[#D9D9D9]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  Atividade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  Resultados
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  Iniciada em
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  Encerrada em
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9D9D9]">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-[#6E6E6E]">
                    Nenhuma sessão de atividade encontrada
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr key={session.activity_session_id} className="hover:bg-[#F5F6F7]">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#333333]">
                      {session.activity_session_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#333333]">
                      {session.user_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#333333]">
                      {session.activity_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#6E6E6E] max-w-xs">
                      <div className="truncate" title={formatResults(session.results)}>
                        {formatResults(session.results)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#6E6E6E]">
                      {formatDate(session.initiated_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#6E6E6E]">
                      {formatDate(session.ended_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default ManageActivitySessions

