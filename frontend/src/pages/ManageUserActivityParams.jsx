import { useState, useEffect } from 'react';
import api from '../config/api';
import { authStorage } from '../utils/auth';

// Helper function para verificar se o usuário tem permissões administrativas
const isAdminOrProfessor = (userType) => {
  return userType === 'professor' || userType === 'administrador';
};

function ManageUserActivityParams() {
  const [paramsList, setParamsList] = useState([]);
  const [users, setUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    user_id: '',
    activity_id: '',
    params: JSON.stringify(
      {
        characters: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
        total_bubbles: 15,
        speed: 1.5,
      },
      null,
      2
    ),
  });
  const [jsonError, setJsonError] = useState(null);
  const [jsonExpanded, setJsonExpanded] = useState(false); // Por padrão, JSON recolhido
  const [expandedRows, setExpandedRows] = useState(new Set()); // Linhas individuais expandidas

  useEffect(() => {
    const user = authStorage.getUser();
    setCurrentUser(user);
    if (user && !isAdminOrProfessor(user.user_type)) {
      setFormData((prev) => ({
        ...prev,
        user_id: user.user_id.toString(),
      }));
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersData, activitiesData, paramsData] = await Promise.all([
        api.users.list(),
        api.activities.list(),
        api.userActivityParams.list(null, null, false),
      ]);
      setUsers(usersData);
      setActivities(activitiesData);
      setParamsList(paramsData);
    } catch (err) {
      setError(err.message || 'Erro ao carregar dados. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const validateJSON = (jsonString) => {
    try {
      const parsed = JSON.parse(jsonString);
      // Apenas validar se é um objeto JSON válido, sem restringir estrutura
      if (typeof parsed !== 'object' || parsed === null) {
        return { valid: false, error: 'JSON deve ser um objeto' };
      }
      return { valid: true, parsed };
    } catch (e) {
      return { valid: false, error: `JSON inválido: ${e.message}` };
    }
  };

  const handleParamsChange = (e) => {
    const value = e.target.value;
    setFormData({ ...formData, params: value });
    const validation = validateJSON(value);
    if (validation.valid) {
      setJsonError(null);
    } else {
      setJsonError(validation.error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validar JSON antes de enviar
    const validation = validateJSON(formData.params);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    try {
      const payload = {
        activity_id: parseInt(formData.activity_id),
        params: validation.parsed,
      };
      // Se for administrador/professor e selecionou um usuário, incluir user_id
      // Se for aluno, não enviar user_id (backend usa current_user)
      if (isAdminOrProfessor(currentUser?.user_type) && formData.user_id) {
        payload.user_id = parseInt(formData.user_id);
      }
      await api.userActivityParams.create(payload);
      setShowForm(false);
      setFormData({
        user_id: '',
        activity_id: '',
        params: JSON.stringify(
          {
            characters: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
            total_bubbles: 15,
            speed: 1.5,
          },
          null,
          2
        ),
      });
      setJsonError(null);
      loadData();
    } catch (err) {
      setError(err.message || 'Erro ao salvar parâmetros. Tente novamente.');
      console.error(err);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setFormData({
      user_id: '',
      activity_id: '',
      params: JSON.stringify(
        {
          characters: ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
          total_bubbles: 15,
          speed: 1.5,
        },
        null,
        2
      ),
    });
    setError(null);
    setJsonError(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getUserName = (userId) => {
    const user = users.find((u) => u.user_id === userId);
    return user ? user.user_name : `ID: ${userId}`;
  };

  const getActivityName = (activityId) => {
    const activity = activities.find((a) => a.activity_id === activityId);
    return activity ? activity.activity_name : `ID: ${activityId}`;
  };

  const toggleJsonExpanded = () => {
    setJsonExpanded(!jsonExpanded);
    if (!jsonExpanded) {
      // Se está expandindo todos, adiciona todas as linhas ao Set
      const allIds = new Set(paramsList.map((p) => p.user_activity_params_id));
      setExpandedRows(allIds);
    } else {
      // Se está recolhendo todos, limpa o Set
      setExpandedRows(new Set());
    }
  };

  const toggleRowExpanded = (id) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const isRowExpanded = (id) => {
    if (jsonExpanded) {
      return true; // Se todos estão expandidos, esta linha também está
    }
    return expandedRows.has(id);
  };

  const getJsonPreview = (jsonObj) => {
    const jsonString = JSON.stringify(jsonObj);
    if (jsonString.length > 50) {
      return jsonString.substring(0, 50) + '...';
    }
    return jsonString;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-[#6E6E6E]">Carregando...</div>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-[#333333]">
          Parâmetros de Atividade por Usuário
        </h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-[#E6A8D7] text-white rounded hover:bg-[#D997C7] transition-colors"
        >
          + Adicionar Parâmetros
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow border border-[#D9D9D9] p-6 mb-6">
          <h3 className="text-xl font-semibold text-[#333333] mb-4">
            {formData.user_id && formData.activity_id
              ? 'Editar Parâmetros'
              : 'Novos Parâmetros'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label
                  htmlFor="user_id"
                  className="block text-sm font-medium text-[#333333] mb-2"
                >
                  Usuário{' '}
                  {isAdminOrProfessor(currentUser?.user_type) ? '*' : '(você)'}
                </label>
                <select
                  id="user_id"
                  value={formData.user_id}
                  onChange={(e) =>
                    setFormData({ ...formData, user_id: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#D9D9D9] rounded focus:outline-none focus:ring-2 focus:ring-[#E6A8D7]"
                  required={isAdminOrProfessor(currentUser?.user_type)}
                  disabled={!isAdminOrProfessor(currentUser?.user_type)}
                >
                  {!isAdminOrProfessor(currentUser?.user_type) ? (
                    <option value={currentUser?.user_id}>
                      {currentUser?.user_name} (você)
                    </option>
                  ) : (
                    <>
                      <option value="">Selecione um usuário</option>
                      {users.map((user) => (
                        <option key={user.user_id} value={user.user_id}>
                          {user.user_name} ({user.user_type})
                        </option>
                      ))}
                    </>
                  )}
                </select>
                {!isAdminOrProfessor(currentUser?.user_type) && (
                  <p className="mt-1 text-xs text-[#6E6E6E]">
                    Alunos só podem criar parâmetros para si mesmos
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="activity_id"
                  className="block text-sm font-medium text-[#333333] mb-2"
                >
                  Atividade *
                </label>
                <select
                  id="activity_id"
                  value={formData.activity_id}
                  onChange={(e) =>
                    setFormData({ ...formData, activity_id: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#D9D9D9] rounded focus:outline-none focus:ring-2 focus:ring-[#E6A8D7]"
                  required
                >
                  <option value="">Selecione uma atividade</option>
                  {activities.map((activity) => (
                    <option
                      key={activity.activity_id}
                      value={activity.activity_id}
                    >
                      {activity.activity_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label
                htmlFor="params"
                className="block text-sm font-medium text-[#333333] mb-2"
              >
                Parâmetros (JSON) *
              </label>
              <textarea
                id="params"
                value={formData.params}
                onChange={handleParamsChange}
                rows={12}
                className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#E6A8D7] font-mono text-sm ${
                  jsonError ? 'border-red-300 bg-red-50' : 'border-[#D9D9D9]'
                }`}
                required
              />
              {jsonError && (
                <p className="mt-1 text-sm text-red-600">{jsonError}</p>
              )}
              <p className="mt-1 text-xs text-[#6E6E6E]">
                Digite um objeto JSON válido. A estrutura é livre e pode variar
                conforme a atividade.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-[#E6A8D7] text-white rounded hover:bg-[#D997C7] transition-colors"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow border border-[#D9D9D9] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-[#D9D9D9]">
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
                  <div className="flex items-center gap-2">
                    <span>Parâmetros</span>
                    <button
                      onClick={toggleJsonExpanded}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      title={jsonExpanded ? 'Recolher todos' : 'Expandir todos'}
                    >
                      {jsonExpanded ? (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 15l7-7 7 7"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  Iniciado em
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  Finalizado em
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-[#D9D9D9]">
              {paramsList.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="px-6 py-4 text-center text-[#6E6E6E]"
                  >
                    Nenhum parâmetro encontrado
                  </td>
                </tr>
              ) : (
                paramsList.map((param) => (
                  <tr
                    key={param.user_activity_params_id}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#333333]">
                      {param.user_activity_params_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#333333]">
                      {getUserName(param.user_id)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#333333]">
                      {getActivityName(param.activity_id)}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#333333]">
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() =>
                            toggleRowExpanded(param.user_activity_params_id)
                          }
                          className="p-1 hover:bg-gray-200 rounded transition-colors mt-1"
                          title={
                            isRowExpanded(param.user_activity_params_id)
                              ? 'Recolher'
                              : 'Expandir'
                          }
                        >
                          {isRowExpanded(param.user_activity_params_id) ? (
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 15l7-7 7 7"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          )}
                        </button>
                        {isRowExpanded(param.user_activity_params_id) ? (
                          <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto max-w-xs flex-1">
                            {JSON.stringify(param.params, null, 2)}
                          </pre>
                        ) : (
                          <span className="bg-gray-50 p-2 rounded text-xs text-[#6E6E6E] max-w-xs flex-1">
                            {getJsonPreview(param.params)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#333333]">
                      {formatDate(param.initiated_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#333333]">
                      {formatDate(param.ended_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          param.active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {param.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ManageUserActivityParams;
