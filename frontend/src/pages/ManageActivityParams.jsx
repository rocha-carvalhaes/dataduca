import { useState, useCallback } from 'react';
import api from '../config/api';
import { useFetch } from '../hooks/useFetch';
import { formatDate } from '../utils/format';
import {
  LoadingState,
  ErrorAlert,
  Card,
  FormField,
  Select,
} from '../components/ui';

function ManageActivityParams() {
  const loadData = useCallback(async () => {
    const [activitiesData, paramsData] = await Promise.all([
      api.activities.list(),
      api.activityParams.list(null, false),
    ]);
    return { activities: activitiesData, params: paramsData };
  }, []);

  const { data, loading, error, setError, refetch } = useFetch(loadData);

  const activities = data?.activities || [];
  const paramsList = data?.params || [];

  const [showForm, setShowForm] = useState(false);
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

  const validateJSON = (jsonString) => {
    try {
      if (!jsonString || jsonString.trim() === '') {
        return { valid: true, parsed: null };
      }
      const parsed = JSON.parse(jsonString);
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        return { valid: false, error: 'JSON deve ser um objeto' };
      }
      return { valid: true, parsed };
    } catch (e) {
      return { valid: false, error: `JSON inválido: ${e.message}` };
    }
  };

  const handleJSONChange = (e, fieldName) => {
    const value = e.target.value;
    setFormData({ ...formData, [fieldName]: value });
    const validation = validateJSON(value);
    setJsonErrors((prev) => ({
      ...prev,
      [fieldName]: validation.valid ? null : validation.error,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const levelParamsValidation = validateJSON(formData.level_params);
    const levelDownValidation = validateJSON(formData.level_down_params);
    const levelUpValidation = validateJSON(formData.level_up_params);

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

      await api.activityParams.create(payload);
      setShowForm(false);
      resetForm();
      refetch();
    } catch (err) {
      setError(err.message || 'Erro ao salvar parâmetros. Tente novamente.');
      console.error(err);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
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

  const ChevronIcon = ({ expanded }) => (
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
        d={expanded ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
      />
    </svg>
  );

  const JsonCell = ({ jsonObj, expandKey }) => {
    if (!jsonObj) return <span className="text-[#6E6E6E]">-</span>;

    return (
      <div className="flex items-start gap-2">
        <button
          onClick={() => toggleRowExpanded(expandKey)}
          className="p-1 hover:bg-gray-200 rounded transition-colors mt-1"
        >
          <ChevronIcon expanded={expandedRows.has(expandKey)} />
        </button>
        {expandedRows.has(expandKey) ? (
          <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto max-w-xs flex-1">
            {JSON.stringify(jsonObj, null, 2)}
          </pre>
        ) : (
          <span className="bg-gray-50 p-2 rounded text-xs text-[#6E6E6E] max-w-xs flex-1">
            {getJsonPreview(jsonObj)}
          </span>
        )}
      </div>
    );
  };

  if (loading) {
    return <LoadingState message="Carregando..." />;
  }

  return (
    <div>
      <ErrorAlert message={error} />

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-[#333333]">
          Parâmetros de Níveis de Atividades
        </h2>
        <button
          onClick={() => {
            setShowForm(true);
            resetForm();
          }}
          className="px-4 py-2 bg-[#E6A8D7] text-white rounded hover:bg-[#D997C7] transition-colors"
        >
          + Adicionar Parâmetros
        </button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <h3 className="text-xl font-semibold text-[#333333] mb-4">
            Novos Parâmetros
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <FormField label="Atividade *" id="activity_id">
                <Select
                  id="activity_id"
                  value={formData.activity_id}
                  onChange={(e) =>
                    setFormData({ ...formData, activity_id: e.target.value })
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
              </FormField>
            </div>

            <div className="mb-4">
              <FormField label="Parâmetros do Nível (JSON) *" id="level_params">
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
              </FormField>
            </div>

            <div className="mb-4">
              <FormField
                label="Parâmetros para Subir de Nível (JSON) - Opcional"
                id="level_up_params"
                hint="Condições que devem ser atendidas para o aluno subir de nível"
              >
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
              </FormField>
            </div>

            <div className="mb-4">
              <FormField
                label="Parâmetros para Descer de Nível (JSON) - Opcional"
                id="level_down_params"
                hint="Condições que devem ser atendidas para o aluno descer de nível"
              >
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
                  'Atividade',
                  'Nível',
                  'Parâmetros do Nível',
                  'Parâmetros Subir',
                  'Parâmetros Descer',
                  'Criado em',
                  'Status',
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
                    key={param.activity_param_id}
                    className="hover:bg-gray-50"
                  >
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
                      <JsonCell
                        jsonObj={param.level_params}
                        expandKey={`level_params_${param.activity_param_id}`}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-[#333333]">
                      <JsonCell
                        jsonObj={param.level_up_params}
                        expandKey={`level_up_${param.activity_param_id}`}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-[#333333]">
                      <JsonCell
                        jsonObj={param.level_down_params}
                        expandKey={`level_down_${param.activity_param_id}`}
                      />
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
