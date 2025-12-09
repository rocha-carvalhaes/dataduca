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
  const [activityParams, setActivityParams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    user_id: '',
    activity_id: '',
    level: '',
  });

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
      const [usersData, activitiesData, activityParamsData, paramsData] =
        await Promise.all([
          api.users.list(),
          api.activities.list(),
          api.activityParams.list(null, false),
          api.userActivityParams.list(null, null, false),
        ]);
      setUsers(usersData);
      setActivities(activitiesData);
      setActivityParams(activityParamsData);
      setParamsList(paramsData);
    } catch (err) {
      setError(err.message || 'Erro ao carregar dados. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      // Buscar o activity_param_id correspondente à atividade e nível selecionados
      const selectedActivityParam = activityParams.find(
        (ap) =>
          ap.activity_id === parseInt(formData.activity_id) &&
          ap.level === parseInt(formData.level) &&
          ap.active
      );

      if (!selectedActivityParam) {
        setError('Parâmetro de nível não encontrado para a atividade e nível selecionados.');
        return;
      }

      const payload = {
        activity_param_id: selectedActivityParam.activity_param_id,
        activity_id: parseInt(formData.activity_id),
      };
      // Se for administrador/professor e selecionou um usuário, incluir user_id
      // Se for aluno, não enviar user_id (backend usa current_user)
      if (isAdminOrProfessor(currentUser?.user_type) && formData.user_id) {
        payload.user_id = parseInt(formData.user_id);
      }
      await api.userActivityParams.create(payload);
      setShowForm(false);
      resetForm();
      loadData();
    } catch (err) {
      setError(err.message || 'Erro ao salvar parâmetros. Tente novamente.');
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormData({
      user_id: '',
      activity_id: '',
      level: '',
    });
  };

  // Filtrar níveis disponíveis para a atividade selecionada
  const getAvailableLevels = () => {
    if (!formData.activity_id) return [];
    return activityParams
      .filter(
        (ap) =>
          ap.activity_id === parseInt(formData.activity_id) && ap.active
      )
      .map((ap) => ap.level)
      .sort((a, b) => a - b);
  };

  const handleCancel = () => {
    setShowForm(false);
    resetForm();
    setError(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getUserName = (userId) => {
    const user = users.find((u) => u.user_id === userId);
    return user ? user.user_name : `ID: ${userId}`;
  };

  const getActivityLevel = (activityParamId) => {
    const activityParam = activityParams.find(
      (ap) => ap.activity_param_id === activityParamId
    );
    if (!activityParam) {
      return '-';
    }
    return activityParam.level;
  };

  const getActivityName = (activityParamId) => {
    const activityParam = activityParams.find(
      (ap) => ap.activity_param_id === activityParamId
    );
    if (!activityParam) {
      return '-';
    }
    const activity = activities.find(
      (a) => a.activity_id === activityParam.activity_id
    );
    return activity ? activity.activity_name : `ID: ${activityParam.activity_id}`;
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
          Níveis de Atividades por Usuário
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
            Novos Parâmetros
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
                    setFormData({
                      ...formData,
                      activity_id: e.target.value,
                      level: '', // Reset level when activity changes
                    })
                  }
                  className="w-full px-3 py-2 border border-[#D9D9D9] rounded focus:outline-none focus:ring-2 focus:ring-[#E6A8D7]"
                  required
                >
                  <option value="">Selecione uma atividade</option>
                  {activities.map((activity) => (
                    <option key={activity.activity_id} value={activity.activity_id}>
                      {activity.activity_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="level"
                  className="block text-sm font-medium text-[#333333] mb-2"
                >
                  Nível *
                </label>
                <select
                  id="level"
                  value={formData.level}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      level: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-[#D9D9D9] rounded focus:outline-none focus:ring-2 focus:ring-[#E6A8D7]"
                  required
                  disabled={!formData.activity_id}
                >
                  <option value="">
                    {formData.activity_id
                      ? 'Selecione um nível'
                      : 'Selecione uma atividade primeiro'}
                  </option>
                  {getAvailableLevels().map((level) => (
                    <option key={level} value={level}>
                      Nível {level}
                    </option>
                  ))}
                </select>
                {!formData.activity_id && (
                  <p className="mt-1 text-xs text-[#6E6E6E]">
                    Selecione uma atividade primeiro
                  </p>
                )}
              </div>
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
                  Nível
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
                      {getActivityName(param.activity_param_id)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#333333]">
                      {getActivityLevel(param.activity_param_id)}
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
