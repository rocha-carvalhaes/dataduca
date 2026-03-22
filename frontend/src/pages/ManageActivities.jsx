import { useState, useCallback } from 'react';
import api from '../config/api';
import { useFetch } from '../hooks/useFetch';
import { formatDate } from '../utils/format';
import {
  LoadingState,
  ErrorAlert,
  DataTable,
  AddButton,
  Card,
  FormField,
  Input,
  Textarea,
} from '../components/ui';
import { EditButton, DeleteButton } from '../components/ui';

function ManageActivities() {
  const loadActivities = useCallback(() => api.activities.list(), []);
  const {
    data: activities,
    loading,
    error,
    setError,
    refetch,
  } = useFetch(loadActivities);

  const [showForm, setShowForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [formData, setFormData] = useState({
    activity_name: '',
    activity_description: '',
    activity_objective: '',
    activity_type: '',
    activity_icon: '',
    activity_version: '0.0',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      if (editingActivity) {
        await api.activities.update(editingActivity.activity_id, formData);
      } else {
        await api.activities.create(formData);
      }
      setShowForm(false);
      setEditingActivity(null);
      setFormData({
        activity_name: '',
        activity_description: '',
        activity_objective: '',
        activity_type: '',
        activity_icon: '',
        activity_version: '0.0',
      });
      refetch();
    } catch (err) {
      setError(err.message || 'Erro ao salvar atividade. Tente novamente.');
      console.error(err);
    }
  };

  const handleEdit = (activity) => {
    setEditingActivity(activity);
    setFormData({
      activity_name: activity.activity_name,
      activity_description: activity.activity_description || '',
      activity_objective: activity.activity_objective || '',
      activity_type: activity.activity_type,
      activity_icon: activity.activity_icon,
      activity_version: activity.activity_version,
    });
    setShowForm(true);
  };

  const handleDelete = async (activityId) => {
    if (!window.confirm('Tem certeza que deseja deletar esta atividade?')) {
      return;
    }
    try {
      setError(null);
      await api.activities.delete(activityId);
      refetch();
    } catch (err) {
      setError(err.message || 'Erro ao deletar atividade. Tente novamente.');
      console.error(err);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingActivity(null);
    setFormData({
      activity_name: '',
      activity_description: '',
      activity_objective: '',
      activity_version: '1.0',
    });
    setError(null);
  };

  const rows = activities || [];

  const columns = [
    { key: 'activity_id', label: 'ID' },
    {
      key: 'activity_name',
      label: 'Nome',
      className: 'font-medium text-[#333333]',
      render: (row) => row.activity_name,
    },
    {
      key: 'activity_description',
      label: 'Descrição',
      wrap: true,
      className: 'text-[#6E6E6E]',
      render: (row) => row.activity_description || '-',
    },
    { key: 'activity_version', label: 'Versão' },
    {
      key: 'updated_at',
      label: 'Atualizado em',
      className: 'text-[#6E6E6E]',
      render: (row) => formatDate(row.updated_at),
    },
    {
      key: 'actions',
      label: 'Ações',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-2">
          <EditButton onClick={() => handleEdit(row)} />
          <DeleteButton onClick={() => handleDelete(row.activity_id)} />
        </div>
      ),
    },
  ];

  if (loading) {
    return <LoadingState message="Carregando atividades..." />;
  }

  return (
    <div>
      <ErrorAlert message={error} />

      {!showForm && (
        <div className="mb-6 flex justify-end">
          <AddButton onClick={() => setShowForm(true)}>
            Nova Atividade
          </AddButton>
        </div>
      )}

      {showForm && (
        <Card className="mb-6">
          <h2 className="text-xl font-semibold text-[#333333] mb-4">
            {editingActivity ? 'Editar Atividade' : 'Nova Atividade'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Nome da Atividade *" id="activity_name">
              <Input
                id="activity_name"
                type="text"
                required
                value={formData.activity_name}
                onChange={(e) =>
                  setFormData({ ...formData, activity_name: e.target.value })
                }
                placeholder="Digite o nome da atividade"
              />
            </FormField>
            <FormField label="Descrição" id="activity_description">
              <Textarea
                id="activity_description"
                value={formData.activity_description}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    activity_description: e.target.value,
                  })
                }
                placeholder="Digite a descrição da atividade"
                rows={3}
              />
            </FormField>
            <FormField label="Objetivo" id="activity_objective">
              <Textarea
                id="activity_objective"
                value={formData.activity_objective}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    activity_objective: e.target.value,
                  })
                }
                placeholder="Digite o objetivo da atividade"
                rows={3}
              />
            </FormField>
            <FormField
              label="Tipo de Atividade *"
              id="activity_type"
              hint="Define qual componente/script será usado para esta atividade"
            >
              <Input
                id="activity_type"
                type="text"
                required
                value={formData.activity_type}
                onChange={(e) =>
                  setFormData({ ...formData, activity_type: e.target.value })
                }
                placeholder="Ex: digitacao, memoria, raciocinio"
              />
            </FormField>
            <FormField
              label="Ícone (Emoji) *"
              id="activity_icon"
              hint="Digite um emoji para o ícone da atividade (ex: 💭, 🎮, 📚)"
            >
              <Input
                id="activity_icon"
                type="text"
                required
                value={formData.activity_icon}
                onChange={(e) =>
                  setFormData({ ...formData, activity_icon: e.target.value })
                }
                className="text-2xl"
                placeholder="💭"
                maxLength={2}
              />
            </FormField>
            <FormField label="Versão *" id="activity_version">
              <Input
                id="activity_version"
                type="text"
                required
                value={formData.activity_version}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    activity_version: e.target.value,
                  })
                }
                placeholder="Ex: 1.0"
              />
            </FormField>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 border border-[#D9D9D9] rounded-lg hover:bg-[#F5F6F7] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-[#E6A8D7] text-white rounded-lg hover:bg-[#D89BC8] transition-colors"
              >
                {editingActivity ? 'Atualizar' : 'Criar'}
              </button>
            </div>
          </form>
        </Card>
      )}

      <DataTable
        columns={columns}
        data={rows}
        rowKey={(row) => row.activity_id}
        emptyMessage="Nenhuma atividade encontrada"
      />
    </div>
  );
}

export default ManageActivities;
