import { useState, useEffect } from 'react'
import api from '../config/api'

function GerenciarUsuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState(null)
  const [formData, setFormData] = useState({
    user_name: '',
    user_type: 'aluno',
    password: '',
  })

  useEffect(() => {
    carregarUsuarios()
  }, [])

  const carregarUsuarios = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.usuarios.listar()
      setUsuarios(data)
    } catch (err) {
      setError('Erro ao carregar usuários. Tente novamente.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setError(null)
      if (usuarioEditando) {
        // Atualizar usuário
        await api.usuarios.atualizar(usuarioEditando.user_id, formData)
      } else {
        // Criar novo usuário
        await api.usuarios.criar(formData)
      }
      setMostrarFormulario(false)
      setUsuarioEditando(null)
      setFormData({ user_name: '', user_type: 'aluno', password: '' })
      carregarUsuarios()
    } catch (err) {
      setError(err.message || 'Erro ao salvar usuário. Tente novamente.')
      console.error(err)
    }
  }

  const handleEditar = (usuario) => {
    setUsuarioEditando(usuario)
    setFormData({
      user_name: usuario.user_name,
      user_type: usuario.user_type,
      password: '', // Não preenche a senha por segurança
    })
    setMostrarFormulario(true)
  }

  const handleDeletar = async (userId) => {
    if (!window.confirm('Tem certeza que deseja deletar este usuário?')) {
      return
    }
    try {
      setError(null)
      await api.usuarios.deletar(userId)
      carregarUsuarios()
    } catch (err) {
      setError('Erro ao deletar usuário. Tente novamente.')
      console.error(err)
    }
  }

  const handleCancelar = () => {
    setMostrarFormulario(false)
    setUsuarioEditando(null)
    setFormData({ user_name: '', user_type: 'aluno', password: '' })
    setError(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-[#6E6E6E]">Carregando usuários...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Mensagem de erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Botão de adicionar */}
      {!mostrarFormulario && (
        <div className="mb-6 flex justify-end">
          <button
            onClick={() => setMostrarFormulario(true)}
            className="bg-[#E6A8D7] text-white px-6 py-2 rounded-lg hover:bg-[#D89BC8] transition-colors font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Usuário
          </button>
        </div>
      )}

      {/* Formulário */}
      {mostrarFormulario && (
        <div className="bg-white rounded-lg shadow border border-[#D9D9D9] p-6 mb-6">
          <h2 className="text-xl font-semibold text-[#333333] mb-4">
            {usuarioEditando ? 'Editar Usuário' : 'Novo Usuário'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#333333] mb-2">
                Nome de Usuário
              </label>
              <input
                type="text"
                required
                value={formData.user_name}
                onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                className="w-full px-4 py-2 border border-[#D9D9D9] rounded-lg focus:ring-2 focus:ring-[#E6A8D7] focus:border-transparent outline-none"
                placeholder="Digite o nome do usuário"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#333333] mb-2">
                Tipo de Usuário
              </label>
              <select
                required
                value={formData.user_type}
                onChange={(e) => setFormData({ ...formData, user_type: e.target.value })}
                className="w-full px-4 py-2 border border-[#D9D9D9] rounded-lg focus:ring-2 focus:ring-[#E6A8D7] focus:border-transparent outline-none"
              >
                <option value="aluno">Aluno</option>
                <option value="professor">Professor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#333333] mb-2">
                {usuarioEditando ? 'Nova Senha (deixe em branco para manter a atual)' : 'Senha'}
              </label>
              <input
                type="password"
                required={!usuarioEditando}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 border border-[#D9D9D9] rounded-lg focus:ring-2 focus:ring-[#E6A8D7] focus:border-transparent outline-none"
                placeholder="Digite a senha"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleCancelar}
                className="px-6 py-2 border border-[#D9D9D9] rounded-lg hover:bg-[#F5F6F7] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-[#E6A8D7] text-white rounded-lg hover:bg-[#D89BC8] transition-colors"
              >
                {usuarioEditando ? 'Atualizar' : 'Criar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabela de usuários */}
      <div className="bg-white rounded-lg shadow border border-[#D9D9D9] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F5F6F7] border-b border-[#D9D9D9]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  Data de Criação
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9D9D9]">
              {usuarios.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-[#6E6E6E]">
                    Nenhum usuário encontrado
                  </td>
                </tr>
              ) : (
                usuarios.map((usuario) => (
                  <tr key={usuario.user_id} className="hover:bg-[#F5F6F7]">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#333333]">
                      {usuario.user_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#333333]">
                      {usuario.user_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#333333]">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        usuario.user_type === 'professor'
                          ? 'bg-[#E6A8D7] text-white'
                          : 'bg-[#B8E3C0] text-[#333333]'
                      }`}>
                        {usuario.user_type === 'professor' ? 'Professor' : 'Aluno'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#6E6E6E]">
                      {new Date(usuario.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEditar(usuario)}
                          className="text-[#E6A8D7] hover:text-[#D89BC8] transition-colors"
                          title="Editar"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeletar(usuario.user_id)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                          title="Deletar"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
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

export default GerenciarUsuarios

