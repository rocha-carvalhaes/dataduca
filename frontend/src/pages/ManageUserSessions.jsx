import { useCallback } from 'react';
import api from '../config/api';
import { useFetch } from '../hooks/useFetch';
import { formatDate } from '../utils/format';
import { LoadingState, ErrorAlert, DataTable } from '../components/ui';

const userSessionColumns = [
  { key: 'user_session_id', label: 'ID' },
  {
    key: 'user_name',
    label: 'Usuário',
    className: 'font-medium text-[#333333]',
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
  {
    key: 'status',
    label: 'Status',
    render: (row) => (
      <span
        className={`px-2 py-1 rounded text-xs font-medium ${
          row.ended_at
            ? 'bg-gray-200 text-gray-700'
            : 'bg-[#B8E3C0] text-[#333333]'
        }`}
      >
        {row.ended_at ? 'Encerrada' : 'Ativa'}
      </span>
    ),
  },
];

function ManageUserSessions() {
  const loadSessions = useCallback(() => api.userSessions.list(), []);
  const { data: sessions, loading, error } = useFetch(loadSessions);

  if (loading) {
    return <LoadingState message="Carregando sessões..." />;
  }

  return (
    <div>
      <ErrorAlert message={error} />

      <DataTable
        columns={userSessionColumns}
        data={sessions || []}
        rowKey={(row) => row.user_session_id}
        emptyMessage="Nenhuma sessão encontrada"
      />
    </div>
  );
}

export default ManageUserSessions;
