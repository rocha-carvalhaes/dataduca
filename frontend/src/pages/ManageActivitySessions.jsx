import { useCallback } from 'react';
import api from '../config/api';
import { useFetch } from '../hooks/useFetch';
import { formatDate, formatResults } from '../utils/format';
import { LoadingState, ErrorAlert, DataTable } from '../components/ui';

const activitySessionColumns = [
  { key: 'activity_session_id', label: 'ID' },
  {
    key: 'user_name',
    label: 'Usuário',
    className: 'font-medium text-[#333333]',
  },
  { key: 'activity_name', label: 'Atividade' },
  {
    key: 'results',
    label: 'Resultados',
    wrap: true,
    className: 'text-[#6E6E6E] max-w-xs',
    render: (row) => {
      const text = formatResults(row.results);
      return (
        <div className="truncate" title={text}>
          {text}
        </div>
      );
    },
  },
  {
    key: 'initiated_at',
    label: 'Iniciada em',
    className: 'text-[#6E6E6E]',
    render: (row) => formatDate(row.initiated_at),
  },
  {
    key: 'ended_at',
    label: 'Encerrada em',
    className: 'text-[#6E6E6E]',
    render: (row) => formatDate(row.ended_at),
  },
];

function ManageActivitySessions() {
  const loadSessions = useCallback(() => api.activitySessions.list(), []);
  const { data: sessions, loading, error } = useFetch(loadSessions);

  if (loading) {
    return <LoadingState message="Carregando sessões de atividades..." />;
  }

  return (
    <div>
      <ErrorAlert message={error} />

      <DataTable
        columns={activitySessionColumns}
        data={sessions || []}
        rowKey={(row) => row.activity_session_id}
        emptyMessage="Nenhuma sessão de atividade encontrada"
      />
    </div>
  );
}

export default ManageActivitySessions;
