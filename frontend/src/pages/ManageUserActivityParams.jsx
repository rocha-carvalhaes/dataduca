import { useState, useEffect, useCallback } from 'react';
import api from '../config/api';
import { authStorage } from '../utils/auth';
import { useFetch } from '../hooks/useFetch';
import { formatDate } from '../utils/format';
import {
  LoadingState,
  ErrorAlert,
  Card,
  FormField,
  Select,
} from '../components/ui';

const isAdminOrProfessor = (userType) => {
  return userType === 'professor' || userType === 'administrador';
};

function ManageUserActivityParams() {
  const [currentUser, setCurrentUser] = useState(null);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [showForm, setShowForm] = useState(false);
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
  }, []);

  const loadData = useCallback(async () => {
    const [usersData, activitiesData, activityParamsData, paramsData] =
      await Promise.all([
        api.users.list(),
        api.activities.list(),
        api.activityParams.list(null, false),
        api.userActivityParams.list(null, null, false),
      ]);
    return {
      users: usersData,
      activities: activitiesData,
      activityParams: activityParamsData,
      paramsList: paramsData,
    };
  }, []);

  const { data, loading, error, setError, refetch } = useFetch(loadData);

  const users = data?.users || [];
  const activities = data?.activities || [];
  const activityParams = data?.activityParams || [];
  const paramsList = data?.paramsList || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const selectedActivityParam = activityParams.find(
        (ap) =>
          ap.activity_id === parseInt(formData.activity_id) &&
          ap.level === parseInt(formData.level) &&
          ap.active
      );

      if (!selectedActivityParam) {
        setError(
          'Parâmetro de nível não encontrado para a atividade e nível selecionados.'
        );
        return;
      }

      const payload = {
        activity_param_id: selectedActivityParam.activity_param_id,
        activity_id: parseInt(formData.activity_id),
      };
      if (isAdminOrProfessor(currentUser?.user_type) && formData.user_id) {
        payload.user_id = parseInt(formData.user_id);
      }
      await api.userActivityParams.create(payload);
      setShowForm(false);
      resetForm();
      refetch();
    } catch (err) {
      setError(err.message || 'Erro ao salvar parâmetros. Tente novamente.');
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormData({ user_id: '', activity_id: '', level: '' });
  };

  const getAvailableLevels = () => {
    if (!formData.activity_id) return [];
    return activityParams
      .filter(
        (ap) => ap.activity_id === parseInt(formData.activity_id) && ap.active
      )
      .map((ap) => ap.level)
      .sort((a, b) => a - b);
  };

  const handleCancel = () => {
    setShowForm(false);
    resetForm();
    setError(null);
  };

  const handleEvaluateLevel = async (userId, activityId) => {
    try {
      setEvaluating(true);
      setError(null);
      setEvaluationResult(null);
      const result = await api.userLevels.evaluate(userId, activityId);
      setEvaluationResult(result);
      if (result.updated) {
        await refetch();
      }
    } catch (err) {
      setError(err.message || 'Erro ao avaliar nível. Tente novamente.');
      console.error(err);
    } finally {
      setEvaluating(false);
    }
  };

  const handleEvaluateAllLevels = async (userId) => {
    try {
      setEvaluating(true);
      setError(null);
      setEvaluationResult(null);
      const result = await api.userLevels.evaluateAll(userId);
      setEvaluationResult(result);
      await refetch();
    } catch (err) {
      setError(err.message || 'Erro ao avaliar níveis. Tente novamente.');
      console.error(err);
    } finally {
      setEvaluating(false);
    }
  };

  const getUserName = (userId) => {
    const user = users.find((u) => u.user_id === userId);
    return user ? user.user_name : `ID: ${userId}`;
  };

  const getActivityIdFromParam = (activityParamId) => {
    const activityParam = activityParams.find(
      (ap) => ap.activity_param_id === activityParamId
    );
    return activityParam ? activityParam.activity_id : null;
  };

  const getActivityLevel = (activityParamId) => {
    const activityParam = activityParams.find(
      (ap) => ap.activity_param_id === activityParamId
    );
    return activityParam ? activityParam.level : '-';
  };

  const getActivityName = (activityParamId) => {
    const activityParam = activityParams.find(
      (ap) => ap.activity_param_id === activityParamId
    );
    if (!activityParam) return '-';
    const activity = activities.find(
      (a) => a.activity_id === activityParam.activity_id
    );
    return activity
      ? activity.activity_name
      : `ID: ${activityParam.activity_id}`;
  };

  if (loading) {
    return <LoadingState message="Carregando..." />;
  }

  return (
    <div>
      <ErrorAlert message={error} />

      {evaluationResult && (
        <div
          className={`mb-4 p-4 border rounded ${
            evaluationResult.updated
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}
        >
          <p className="font-semibold">{evaluationResult.message}</p>
          {evaluationResult.updated && (
            <p className="text-sm mt-1">
              Nível {evaluationResult.old_level} → {evaluationResult.new_level}
            </p>
          )}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-[#333333]">
          Níveis de Atividades por Usuário
        </h2>
        <div className="flex gap-4">
          {isAdminOrProfessor(currentUser?.user_type) &&
            currentUser?.user_id && (
              <button
                onClick={() => handleEvaluateAllLevels(currentUser.user_id)}
                className={`px-4 py-2 rounded transition-colors ${
                  evaluating
                    ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                disabled={evaluating}
              >
                {evaluating ? 'Avaliando...' : 'Atualizar Todos os Níveis'}
              </button>
            )}
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-[#E6A8D7] text-white rounded hover:bg-[#D997C7] transition-colors"
          >
            + Adicionar Parâmetros
          </button>
        </div>
      </div>

      {showForm && (
        <Card className="mb-6">
          <h3 className="text-xl font-semibold text-[#333333] mb-4">
            Novos Parâmetros
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <FormField
                label={`Usuário ${isAdminOrProfessor(currentUser?.user_type) ? '*' : '(você)'}`}
                id="user_id"
              >
                <Select
                  id="user_id"
                  value={formData.user_id}
                  onChange={(e) =>
                    setFormData({ ...formData, user_id: e.target.value })
                  }
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
                </Select>
                {!isAdminOrProfessor(currentUser?.user_type) && (
                  <p className="mt-1 text-xs text-[#6E6E6E]">
                    Alunos só podem criar parâmetros para si mesmos
                  </p>
                )}
              </FormField>
              <FormField label="Atividade *" id="activity_id">
                <Select
                  id="activity_id"
                  value={formData.activity_id}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      activity_id: e.target.value,
                      level: '',
                    })
                  }
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
                </Select>
              </FormField>
              <FormField label="Nível *" id="level">
                <Select
                  id="level"
                  value={formData.level}
                  onChange={(e) =>
                    setFormData({ ...formData, level: e.target.value })
                  }
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
                </Select>
                {!formData.activity_id && (
                  <p className="mt-1 text-xs text-[#6E6E6E]">
                    Selecione uma atividade primeiro
                  </p>
                )}
              </FormField>
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
        </Card>
      )}

      <div className="bg-white rounded-lg shadow border border-[#D9D9D9] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-[#D9D9D9]">
              <tr>
                {[
                  'ID',
                  'Usuário',
                  'Atividade',
                  'Nível',
                  'Iniciado em',
                  'Finalizado em',
                  'Status',
                  'Ações',
                ].map((label) => (
                  <th
                    key={label}
                    className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-[#D9D9D9]">
              {paramsList.length === 0 ? (
                <tr>
                  <td
                    colSpan="8"
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {param.active && (
                        <button
                          onClick={() => {
                            const activityId = getActivityIdFromParam(
                              param.activity_param_id
                            );
                            if (activityId) {
                              handleEvaluateLevel(param.user_id, activityId);
                            }
                          }}
                          disabled={evaluating}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                          title="Avaliar e atualizar nível"
                        >
                          {evaluating ? '...' : 'Atualizar'}
                        </button>
                      )}
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
