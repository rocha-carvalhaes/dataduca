import { useState, useEffect, useCallback } from 'react';
import api from '../config/api';
import {
  LoadingState,
  ErrorAlert,
  Card,
  FormField,
  Input,
  Select,
} from '../components/ui';

const OPERATORS = [
  { id: 'eq', label: 'Igual' },
  { id: 'neq', label: 'Diferente' },
  { id: 'contains', label: 'Contém' },
  { id: 'gt', label: 'Maior' },
  { id: 'gte', label: 'Maior ou igual' },
  { id: 'lt', label: 'Menor' },
  { id: 'lte', label: 'Menor ou igual' },
];

const EMPTY_FILTER = { column: '', operator: 'eq', value: '', connector: null };

const CRUD_TABLES = {
  users: { label: 'Novo Usuário', idKey: 'user_id' },
  activity_params: { label: 'Novo Nível', idKey: 'activity_param_id' },
};

const INITIAL_USER_FORM = { user_name: '', user_type: 'aluno', password: '' };
const INITIAL_PARAMS_FORM = {
  activity_id: '',
  level: '',
  level_params: JSON.stringify({}, null, 2),
  level_down_params: JSON.stringify({}, null, 2),
  level_up_params: JSON.stringify({}, null, 2),
};

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function UserForm({ formData, setFormData, editing }) {
  return (
    <>
      <FormField label="Nome de Usuário *" id="crud-user-name">
        <Input
          id="crud-user-name"
          type="text"
          required
          value={formData.user_name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, user_name: e.target.value }))
          }
          placeholder="Digite o nome do usuário"
        />
      </FormField>
      <FormField label="Tipo de Usuário *" id="crud-user-type">
        <Select
          id="crud-user-type"
          required
          value={formData.user_type}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, user_type: e.target.value }))
          }
        >
          <option value="aluno">Aluno</option>
          <option value="professor">Professor</option>
          <option value="administrador">Administrador</option>
        </Select>
      </FormField>
      <FormField
        label={editing ? 'Nova Senha (deixe em branco para manter)' : 'Senha *'}
        id="crud-password"
      >
        <Input
          id="crud-password"
          type="password"
          required={!editing}
          value={formData.password}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, password: e.target.value }))
          }
          placeholder="Digite a senha"
        />
      </FormField>
    </>
  );
}

function ActivityParamsForm({
  formData,
  setFormData,
  activitiesList,
  jsonErrors,
  onJsonChange,
}) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Atividade *" id="crud-activity-id">
          <Select
            id="crud-activity-id"
            required
            value={formData.activity_id}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, activity_id: e.target.value }))
            }
          >
            <option value="">Selecione uma atividade</option>
            {activitiesList.map((a) => (
              <option key={a.activity_id} value={a.activity_id}>
                {a.activity_name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Nível *" id="crud-level">
          <Input
            id="crud-level"
            type="number"
            required
            min="1"
            value={formData.level}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, level: e.target.value }))
            }
            placeholder="Ex: 1"
          />
        </FormField>
      </div>
      <FormField label="Parâmetros do Nível (JSON) *" id="crud-level-params">
        <textarea
          id="crud-level-params"
          value={formData.level_params}
          onChange={(e) => onJsonChange(e, 'level_params')}
          rows={6}
          required
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#E6A8D7] font-mono text-sm ${
            jsonErrors.level_params
              ? 'border-red-300 bg-red-50'
              : 'border-[#D9D9D9]'
          }`}
        />
        {jsonErrors.level_params && (
          <p className="mt-1 text-sm text-red-600">{jsonErrors.level_params}</p>
        )}
      </FormField>
      <FormField
        label="Parâmetros para Subir de Nível (JSON)"
        id="crud-level-up"
      >
        <textarea
          id="crud-level-up"
          value={formData.level_up_params}
          onChange={(e) => onJsonChange(e, 'level_up_params')}
          rows={4}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#E6A8D7] font-mono text-sm ${
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
      <FormField
        label="Parâmetros para Descer de Nível (JSON)"
        id="crud-level-down"
      >
        <textarea
          id="crud-level-down"
          value={formData.level_down_params}
          onChange={(e) => onJsonChange(e, 'level_down_params')}
          rows={4}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-[#E6A8D7] font-mono text-sm ${
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
    </>
  );
}

function Manage() {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [columns, setColumns] = useState([]);
  const [filters, setFilters] = useState([{ ...EMPTY_FILTER }]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingTables, setLoadingTables] = useState(true);
  const [error, setError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [userForm, setUserForm] = useState({ ...INITIAL_USER_FORM });
  const [paramsForm, setParamsForm] = useState({ ...INITIAL_PARAMS_FORM });
  const [jsonErrors, setJsonErrors] = useState({
    level_params: null,
    level_up_params: null,
    level_down_params: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [activitiesList, setActivitiesList] = useState([]);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [evaluatingLevels, setEvaluatingLevels] = useState(false);
  const [levelResult, setLevelResult] = useState(null);

  const hasCrud = CRUD_TABLES[selectedTable] !== undefined;

  useEffect(() => {
    api.manage
      .tables()
      .then((data) => {
        setTables(data);
        if (data.length > 0) setSelectedTable(data[0].id);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingTables(false));
  }, []);

  useEffect(() => {
    if (!selectedTable) return;
    setShowForm(false);
    setEditingRecord(null);
    api.manage
      .columns(selectedTable)
      .then((cols) => {
        setColumns(cols);
        setFilters([{ ...EMPTY_FILTER, column: cols[0] || '' }]);
      })
      .catch(() => setColumns([]));

    if (selectedTable === 'activity_params') {
      api.activities
        .list()
        .then(setActivitiesList)
        .catch(() => setActivitiesList([]));
    }
  }, [selectedTable]);

  const handleQuery = useCallback(async () => {
    if (!selectedTable) return;
    setLoading(true);
    setError(null);
    try {
      const activeFilters = filters
        .filter((f) => f.column && f.value)
        .map((f, i) => ({
          column: f.column,
          operator: f.operator,
          value: f.value,
          connector: i === 0 ? null : f.connector || 'AND',
        }));
      const data = await api.manage.query({
        table: selectedTable,
        limit: 10,
        filters: activeFilters,
      });
      setResult(data);
      setExpandedRows(new Set());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedTable, filters]);

  const updateFilter = (index, field, value) => {
    setFilters((prev) =>
      prev.map((f, i) => (i === index ? { ...f, [field]: value } : f))
    );
  };

  const addFilter = () => {
    setFilters((prev) => [
      ...prev,
      { ...EMPTY_FILTER, column: columns[0] || '', connector: 'AND' },
    ]);
  };

  const removeFilter = (index) => {
    setFilters((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0) next[0] = { ...next[0], connector: null };
      return next.length === 0
        ? [{ ...EMPTY_FILTER, column: columns[0] || '' }]
        : next;
    });
  };

  const toggleRow = (rowIdx) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIdx)) next.delete(rowIdx);
      else next.add(rowIdx);
      return next;
    });
  };

  const formatCellValue = (val) => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'object') return JSON.stringify(val, null, 2);
    return String(val);
  };

  // --- CRUD logic ---

  const validateJSON = (str) => {
    try {
      if (!str || str.trim() === '') return { valid: true, parsed: null };
      const parsed = JSON.parse(str);
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

  const handleJsonChange = (e, fieldName) => {
    const value = e.target.value;
    setParamsForm((prev) => ({ ...prev, [fieldName]: value }));
    const validation = validateJSON(value);
    setJsonErrors((prev) => ({
      ...prev,
      [fieldName]: validation.valid ? null : validation.error,
    }));
  };

  const openNewForm = () => {
    setEditingRecord(null);
    if (selectedTable === 'users') setUserForm({ ...INITIAL_USER_FORM });
    if (selectedTable === 'activity_params') {
      setParamsForm({ ...INITIAL_PARAMS_FORM });
      setJsonErrors({
        level_params: null,
        level_up_params: null,
        level_down_params: null,
      });
    }
    setShowForm(true);
    setError(null);
  };

  const openEditForm = (row) => {
    setEditingRecord(row);
    if (selectedTable === 'users') {
      setUserForm({
        user_name: row.user_name || '',
        user_type: row.user_type || 'aluno',
        password: '',
      });
    }
    if (selectedTable === 'activity_params') {
      setParamsForm({
        activity_id: String(row.activity_id || ''),
        level: String(row.level || ''),
        level_params: row.level_params
          ? JSON.stringify(row.level_params, null, 2)
          : '{}',
        level_up_params: row.level_up_params
          ? JSON.stringify(row.level_up_params, null, 2)
          : JSON.stringify({}, null, 2),
        level_down_params: row.level_down_params
          ? JSON.stringify(row.level_down_params, null, 2)
          : JSON.stringify({}, null, 2),
      });
      setJsonErrors({
        level_params: null,
        level_up_params: null,
        level_down_params: null,
      });
    }
    setShowForm(true);
    setError(null);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingRecord(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      if (selectedTable === 'users') {
        const payload = { ...userForm };
        if (editingRecord && !payload.password) delete payload.password;
        if (editingRecord) {
          await api.users.update(editingRecord.user_id, payload);
        } else {
          await api.users.create(payload);
        }
      }

      if (selectedTable === 'activity_params') {
        const lpV = validateJSON(paramsForm.level_params);
        const luV = validateJSON(paramsForm.level_up_params);
        const ldV = validateJSON(paramsForm.level_down_params);
        if (!lpV.valid || !luV.valid || !ldV.valid) {
          setError('Corrija os erros de JSON antes de salvar.');
          setSubmitting(false);
          return;
        }
        await api.activityParams.create({
          activity_id: parseInt(paramsForm.activity_id),
          level: parseInt(paramsForm.level),
          level_params: lpV.parsed || {},
          level_down_params: ldV.parsed || null,
          level_up_params: luV.parsed || null,
        });
      }

      setShowForm(false);
      setEditingRecord(null);
      await handleQuery();
    } catch (err) {
      setError(err.message || 'Erro ao salvar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEvaluateAllLevels = async () => {
    if (evaluatingLevels) return;
    setEvaluatingLevels(true);
    setLevelResult(null);
    setError(null);
    try {
      const data = await api.userLevels.evaluateAllUsers();
      setLevelResult(data);
    } catch (err) {
      setError(err.message || 'Erro ao reavaliar níveis');
    } finally {
      setEvaluatingLevels(false);
    }
  };

  // --- Render ---

  if (loadingTables) return <LoadingState message="Carregando tabelas..." />;

  const crudConfig = CRUD_TABLES[selectedTable];
  const showActions = hasCrud && result && result.data.length > 0;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#333333] mb-1">Gerenciar</h1>
          <p className="text-[#777777] text-sm">
            Consulte as tabelas do sistema com filtros personalizados.
            <span className="block mt-1 text-xs text-[#9a9a9a]">
              «Reavaliar Níveis» pode demorar vários minutos com muitos
              utilizadores.
            </span>
          </p>
        </div>
        <button
          onClick={handleEvaluateAllLevels}
          disabled={evaluatingLevels}
          className="mt-1 px-4 py-2 bg-[#7BC47F] text-white text-sm font-medium rounded-md hover:bg-[#5ea663] transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
        >
          {evaluatingLevels ? (
            <>
              <Spinner /> Avaliando...
            </>
          ) : (
            'Reavaliar Níveis'
          )}
        </button>
      </div>

      {levelResult && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-green-800">
              <span className="font-semibold">Reavaliação concluída:</span>{' '}
              {levelResult.total_evaluated === 0
                ? 'nenhuma avaliação executada'
                : `${levelResult.total_evaluated} ${
                    levelResult.total_evaluated > 1 ? 'avaliações' : 'avaliação'
                  }`}
              {levelResult.total_evaluated > 0 ? (
                <>
                  {', '}
                  <span className="font-semibold text-green-700">
                    {levelResult.updated} atualizado
                    {levelResult.updated !== 1 ? 's' : ''}
                  </span>
                </>
              ) : null}
              {levelResult.assigned_level_one > 0 && (
                <span className="text-blue-600">
                  , {levelResult.assigned_level_one} nível 1 atribuído
                  {levelResult.assigned_level_one !== 1 ? 's' : ''}
                </span>
              )}
              {levelResult.errors > 0 && (
                <span className="text-red-600">
                  , {levelResult.errors} erro
                  {levelResult.errors !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <button
              onClick={() => setLevelResult(null)}
              className="text-green-600 hover:text-green-800 text-lg leading-none"
            >
              &times;
            </button>
          </div>
          {levelResult.hint && (
            <p className="mt-2 text-sm text-[#2d5a32] border-l-4 border-[#7BC47F] pl-3">
              {levelResult.hint}
            </p>
          )}
          {levelResult.results && levelResult.results.length > 0 && (
            <details className="mt-3">
              <summary className="text-xs font-medium text-green-800 cursor-pointer select-none">
                Ver todas as mensagens ({levelResult.results.length})
              </summary>
              <ul className="mt-2 text-xs text-[#333333] space-y-1 max-h-48 overflow-y-auto list-disc pl-5">
                {levelResult.results.map((r, i) => (
                  <li key={i}>
                    <span className="font-medium">U{r.user_id}</span> / At.
                    {r.activity_id}
                    {r.updated ? ' — atualizado' : ''}: {r.message ?? '—'}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Seleção de tabela + Consultar + Novo */}
      <div className="bg-white rounded-lg shadow border border-[#D9D9D9] p-4 mb-4">
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-xs">
            <label
              htmlFor="table-select"
              className="block text-xs font-medium text-[#6E6E6E] uppercase tracking-wider mb-1"
            >
              Tabela
            </label>
            <select
              id="table-select"
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="w-full border border-[#D9D9D9] rounded-md px-3 py-2 text-sm text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#E6A8D7] focus:border-transparent"
            >
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleQuery}
            disabled={loading}
            className="px-5 py-2 bg-[#E6A8D7] text-white font-medium rounded-md hover:bg-[#d48ec5] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Spinner />}
            Consultar
          </button>
          {crudConfig && (
            <button
              onClick={openNewForm}
              className="px-4 py-2 border-2 border-[#E6A8D7] text-[#E6A8D7] font-medium rounded-md hover:bg-[#E6A8D7] hover:text-white transition-colors"
            >
              + {crudConfig.label}
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow border border-[#D9D9D9] p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
            Filtros
          </span>
          <button
            onClick={addFilter}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-[#E6A8D7] text-white hover:bg-[#d48ec5] transition-colors text-lg font-bold leading-none"
            title="Adicionar filtro"
          >
            +
          </button>
        </div>
        <div className="space-y-2">
          {filters.map((filter, index) => (
            <div key={index} className="flex items-center gap-2 flex-wrap">
              {index > 0 ? (
                <select
                  value={filter.connector || 'AND'}
                  onChange={(e) =>
                    updateFilter(index, 'connector', e.target.value)
                  }
                  className="w-20 border border-[#D9D9D9] rounded-md px-2 py-1.5 text-sm text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#E6A8D7]"
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
              ) : (
                <div className="w-20" />
              )}
              <select
                value={filter.column}
                onChange={(e) => updateFilter(index, 'column', e.target.value)}
                className="flex-1 min-w-[140px] border border-[#D9D9D9] rounded-md px-3 py-1.5 text-sm text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#E6A8D7]"
              >
                <option value="">Selecione a coluna</option>
                {columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
              <select
                value={filter.operator}
                onChange={(e) =>
                  updateFilter(index, 'operator', e.target.value)
                }
                className="w-40 border border-[#D9D9D9] rounded-md px-3 py-1.5 text-sm text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#E6A8D7]"
              >
                {OPERATORS.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={filter.value}
                onChange={(e) => updateFilter(index, 'value', e.target.value)}
                placeholder="Valor"
                className="flex-1 min-w-[120px] border border-[#D9D9D9] rounded-md px-3 py-1.5 text-sm text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#E6A8D7]"
              />
              <button
                onClick={() => removeFilter(index)}
                className="w-7 h-7 flex items-center justify-center rounded-full text-[#999] hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Remover filtro"
              >
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Formulário inline */}
      {showForm && (
        <Card className="mb-4">
          <h2 className="text-lg font-semibold text-[#333333] mb-4">
            {editingRecord
              ? `Editar ${selectedTable === 'users' ? 'Usuário' : 'Nível de Atividade'}`
              : crudConfig?.label}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {selectedTable === 'users' && (
              <UserForm
                formData={userForm}
                setFormData={setUserForm}
                editing={!!editingRecord}
              />
            )}
            {selectedTable === 'activity_params' && (
              <ActivityParamsForm
                formData={paramsForm}
                setFormData={setParamsForm}
                activitiesList={activitiesList}
                jsonErrors={jsonErrors}
                onJsonChange={handleJsonChange}
              />
            )}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={cancelForm}
                className="px-6 py-2 border border-[#D9D9D9] rounded-md hover:bg-[#F5F6F7] transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-[#E6A8D7] text-white rounded-md hover:bg-[#d48ec5] transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
              >
                {submitting && <Spinner />}
                {editingRecord ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Erro */}
      {error && <ErrorAlert message={error} />}

      {/* Resultados */}
      {result && (
        <div className="bg-white rounded-lg shadow border border-[#D9D9D9] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#D9D9D9] bg-[#F5F6F7]">
            <span className="text-sm text-[#6E6E6E]">
              {result.total} registro{result.total !== 1 ? 's' : ''} encontrado
              {result.total !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F5F6F7] border-b border-[#D9D9D9]">
                <tr>
                  {result.columns.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-xs font-medium text-[#6E6E6E] uppercase tracking-wider text-left whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                  {showActions && (
                    <th className="px-4 py-3 text-xs font-medium text-[#6E6E6E] uppercase tracking-wider text-right">
                      Ações
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D9D9D9]">
                {result.data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={result.columns.length + (showActions ? 1 : 0)}
                      className="px-4 py-8 text-center text-[#6E6E6E]"
                    >
                      Nenhum registro encontrado
                    </td>
                  </tr>
                ) : (
                  result.data.map((row, rowIdx) => {
                    const isExpanded = expandedRows.has(rowIdx);
                    return (
                      <tr
                        key={rowIdx}
                        className="hover:bg-[#F5F6F7] cursor-pointer"
                        onClick={() => toggleRow(rowIdx)}
                      >
                        {result.columns.map((col) => (
                          <td
                            key={col}
                            className={`px-4 py-3 text-sm text-[#333333] ${
                              isExpanded
                                ? 'whitespace-pre-wrap break-all'
                                : 'whitespace-nowrap max-w-[300px] truncate'
                            }`}
                            title={
                              isExpanded ? undefined : formatCellValue(row[col])
                            }
                          >
                            {formatCellValue(row[col])}
                          </td>
                        ))}
                        {showActions && (
                          <td className="px-4 py-3 text-right">
                            {(selectedTable === 'users' ||
                              (selectedTable === 'activity_params' &&
                                row.active === true)) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditForm(row);
                                }}
                                className="p-1.5 text-[#6E6E6E] hover:text-[#E6A8D7] hover:bg-[#F5F6F7] rounded transition-colors"
                                title="Editar"
                              >
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
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default Manage;
