import { useState, useEffect } from 'react';
import api from '../config/api';

function ManageActivityParams() {
  const [paramsList, setParamsList] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    activity_id: '',
    level: '',
    level_params: JSON.stringify({}, null, 2),
    level_down_params: JSON.stringify({}, null, 2),
    level_up_params: JSON.stringify({}, null, 2),
  });
  const [jsonErrors, setJsonErrors] = useState({
    level_params: null,
    level_down_params: null,
    level_up_params: null,
  });
  const [expandedRows, setExpandedRows] = useState(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [activitiesData, paramsData] = await Promise.all([
        api.activities.list(),
        api.activityParams.list(null, false),
      ]);
      setActivities(activitiesData);
      setParamsList(paramsData);
    } catch (err) {
      setError(err.message || 'Erro ao carregar dados. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const validateJSON = (jsonString, fieldName) => {
    try {
      if (!jsonString || jsonString.trim() === '') {
        return { valid: true, parsed: null };
      }
      const parsed = JSON.parse(jsonString);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return {
          valid: false,
          error: 'JSON deve ser um objeto',
        };
      }
      return { valid: true, parsed };
    } catch (e) {
      return { valid: false, error: `JSON inválido: ${e.message}` };
    }
  };

  const handleJSONChange = (e, fieldName) => {
    const value = e.target.value;
    setFormData({ ...formData, [fieldName]: value });
    const validation = validateJSON(value, fieldName);
    setJsonErrors((prev) => ({
      ...prev,
      [fieldName]: validation.valid ? null : validation.error,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validar todos os JSONs
    const levelParamsValidation = validateJSON(formData.level_params, 'level_params');
    const levelDownValidation = validateJSON(
      formData.level_down_params,
      'level_down_params'
    );
    const levelUpValidation = validateJSON(
      formData.level_up_params,
      'level_up_params'
    );

    if (
      !levelParamsValidation.valid ||
      !levelDownValidation.valid ||
      !levelUpValidation.valid
    ) {
      setError('Por favor, corrija os erros de JSON antes de salvar.');
      return;
    }

    try {
      const payload = {
        activity_id: parseInt(formData.activity_id),
        level: parseInt(formData.level),
        level_params: levelParamsValidation.parsed,
        level_down_params: levelDownValidation.parsed || null,
        level_up_params: levelUpValidation.parsed || null,
      };

      if (editingId) {
        await api.activityParams.update(editingId, payload);
      } else {
        await api.activityParams.create(payload);
      }

      setShowForm(false);
      setEditingId(null);
      resetForm();
      loadData();
    } catch (err) {
      setError(err.message || 'Erro ao salvar parâmetros. Tente novamente.');
      console.error(err);
    }
  };

  const handleEdit = (param) => {
    setEditingId(param.activity_param_id);
    setFormData({
      activity_id: param.activity_id.toString(),
      level: param.level.toString(),
      level_params: JSON.stringify(param.level_params, null, 2),
      level_down_params: param.level_down_params
        ? JSON.stringify(param.level_down_params, null, 2)
        : '',
      level_up_params: param.level_up_params
        ? JSON.stringify(param.level_up_params, null, 2)
        : '',
    });
    setJsonErrors({
      level_params: null,
      level_down_params: null,
      level_up_params: null,
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    resetForm();
    setError(null);
    setJsonErrors({
      level_params: null,
      level_down_params: null,
      level_up_params: null,
    });
  };

  const resetForm = () => {
    setFormData({
      activity_id: '',
      level: '',
      level_params: JSON.stringify({}, null, 2),
      level_down_params: JSON.stringify({}, null, 2),
      level_up_params: JSON.stringify({}, null, 2),
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getActivityName = (activityId) => {
    const activity = activities.find((a) => a.activity_id === activityId);
    return activity ? activity.activity_name : `ID: ${activityId}`;
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

  const getJsonPreview = (jsonObj) => {
    if (!jsonObj) return '-';
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
          Parâmetros de Níveis de Atividades
        </h2>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            resetForm();
          }}
          className="px-4 py-2 bg-[#E6A8D7] text-white rounded hover:bg-[#D997C7] transition-colors"
        >
          + Adicionar Parâmetros
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow border border-[#D9D9D9] p-6 mb-6">
          <h3 className="text-xl font-semibold text-[#333333] mb-4">
            {editingId ? 'Editar Parâmetros' : 'Novos Parâmetros'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
              <div>
                <label
                  htmlFor="level"
                  className="block text-sm font-medium text-[#333333] mb-2"
                >
                  Nível *
                </label>
                <input
                  type="number"
                  id="level"
                  value={formData.level}
                  onChange={(e) =>
                    setFormData({ ...formData, level: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-[#D9D9D9] rounded focus:outline-none focus:ring-2 focus:ring-[#E6A8D7]"
                  required
                  min="1"
                />
              </div>
            </div>

            <div className="mb-4">
              <label
                htmlFor="level_params"
                className="block text-sm font-medium text-[#333333] mb-2"
              >
                Parâmetros do Nível (JSON) *
              </label>
              <textarea
                id="level_params"
                value={formData.level_params}
                onChange={(e) => handleJSONChange(e, 'level_params')}
                rows={8}
                className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#E6A8D7] font-mono text-sm ${
                  jsonErrors.level_params
                    ? 'border-red-300 bg-red-50'
                    : 'border-[#D9D9D9]'
                }`}
                required
              />
              {jsonErrors.level_params && (
                <p className="mt-1 text-sm text-red-600">
                  {jsonErrors.level_params}
                </p>
              )}
            </div>

            <div className="mb-4">
              <label
                htmlFor="level_down_params"
                className="block text-sm font-medium text-[#333333] mb-2"
              >
                Parâmetros para Descer de Nível (JSON) - Opcional
              </label>
              <textarea
                id="level_down_params"
                value={formData.level_down_params}
                onChange={(e) => handleJSONChange(e, 'level_down_params')}
                rows={6}
                className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#E6A8D7] font-mono text-sm ${
                  jsonErrors.level_down_params
                    ? 'border-red-300 bg-red-50'
                    : 'border-[#D9D9D9]'
                }`}
              />
              {jsonErrors.level_down_params && (
                <p className="mt-1 text-sm text-red-600">
                  {jsonErrors.level_down_params}
                </p>
              )}
              <p className="mt-1 text-xs text-[#6E6E6E]">
                Condições que devem ser atendidas para o aluno descer de nível
              </p>
            </div>

            <div className="mb-4">
              <label
                htmlFor="level_up_params"
                className="block text-sm font-medium text-[#333333] mb-2"
              >
                Parâmetros para Subir de Nível (JSON) - Opcional
              </label>
              <textarea
                id="level_up_params"
                value={formData.level_up_params}
                onChange={(e) => handleJSONChange(e, 'level_up_params')}
                rows={6}
                className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#E6A8D7] font-mono text-sm ${
                  jsonErrors.level_up_params
                    ? 'border-red-300 bg-red-50'
                    : 'border-[#D9D9D9]'
                }`}
              />
              {jsonErrors.level_up_params && (
                <p className="mt-1 text-sm text-red-600">
                  {jsonErrors.level_up_params}
                </p>
              )}
              <p className="mt-1 text-xs text-[#6E6E6E]">
                Condições que devem ser atendidas para o aluno subir de nível
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-[#E6A8D7] text-white rounded hover:bg-[#D997C7] transition-colors"
              >
                {editingId ? 'Atualizar' : 'Salvar'}
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
                  Atividade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  Nível
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  Parâmetros do Nível
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  Parâmetros Descer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  Parâmetros Subir
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  Criado em
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-[#D9D9D9]">
              {paramsList.length === 0 ? (
                <tr>
                  <td
                    colSpan="9"
                    className="px-6 py-4 text-center text-[#6E6E6E]"
                  >
                    Nenhum parâmetro encontrado
                  </td>
                </tr>
              ) : (
                paramsList.map((param) => (
                  <tr key={param.activity_param_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#333333]">
                      {param.activity_param_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#333333]">
                      {getActivityName(param.activity_id)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#333333]">
                      {param.level}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#333333]">
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() =>
                            toggleRowExpanded(
                              `level_params_${param.activity_param_id}`
                            )
                          }
                          className="p-1 hover:bg-gray-200 rounded transition-colors mt-1"
                        >
                          {expandedRows.has(
                            `level_params_${param.activity_param_id}`
                          ) ? (
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
                        {expandedRows.has(
                          `level_params_${param.activity_param_id}`
                        ) ? (
                          <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto max-w-xs flex-1">
                            {JSON.stringify(param.level_params, null, 2)}
                          </pre>
                        ) : (
                          <span className="bg-gray-50 p-2 rounded text-xs text-[#6E6E6E] max-w-xs flex-1">
                            {getJsonPreview(param.level_params)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#333333]">
                      {param.level_down_params ? (
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() =>
                              toggleRowExpanded(
                                `level_down_${param.activity_param_id}`
                              )
                            }
                            className="p-1 hover:bg-gray-200 rounded transition-colors mt-1"
                          >
                            {expandedRows.has(
                              `level_down_${param.activity_param_id}`
                            ) ? (
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
                          {expandedRows.has(
                            `level_down_${param.activity_param_id}`
                          ) ? (
                            <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto max-w-xs flex-1">
                              {JSON.stringify(param.level_down_params, null, 2)}
                            </pre>
                          ) : (
                            <span className="bg-gray-50 p-2 rounded text-xs text-[#6E6E6E] max-w-xs flex-1">
                              {getJsonPreview(param.level_down_params)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[#6E6E6E]">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#333333]">
                      {param.level_up_params ? (
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() =>
                              toggleRowExpanded(
                                `level_up_${param.activity_param_id}`
                              )
                            }
                            className="p-1 hover:bg-gray-200 rounded transition-colors mt-1"
                          >
                            {expandedRows.has(
                              `level_up_${param.activity_param_id}`
                            ) ? (
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
                          {expandedRows.has(
                            `level_up_${param.activity_param_id}`
                          ) ? (
                            <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto max-w-xs flex-1">
                              {JSON.stringify(param.level_up_params, null, 2)}
                            </pre>
                          ) : (
                            <span className="bg-gray-50 p-2 rounded text-xs text-[#6E6E6E] max-w-xs flex-1">
                              {getJsonPreview(param.level_up_params)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[#6E6E6E]">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#333333]">
                      {formatDate(param.created_at)}
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
                      <button
                        onClick={() => handleEdit(param)}
                        className="text-[#E6A8D7] hover:text-[#D997C7] transition-colors"
                      >
                        Editar
                      </button>
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

export default ManageActivityParams;


