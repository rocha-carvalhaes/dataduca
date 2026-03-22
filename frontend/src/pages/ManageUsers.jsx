import { useState, useCallback } from 'react';
import api from '../config/api';
import { useFetch } from '../hooks/useFetch';
import {
  LoadingState,
  ErrorAlert,
  DataTable,
  AddButton,
  Card,
  FormField,
  Input,
  Select,
  EditButton,
  DeleteButton,
} from '../components/ui';
import { confirmAction } from '../utils/format';

function ManageUsers() {
  const loadUsers = useCallback(() => api.users.list(), []);
  const {
    data: users,
    loading,
    error,
    setError,
    refetch,
  } = useFetch(loadUsers);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    user_name: '',
    user_type: 'aluno',
    password: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      if (editingUser) {
        // Update user
        await api.users.update(editingUser.user_id, formData);
      } else {
        // Create new user
        await api.users.create(formData);
      }
      setShowForm(false);
      setEditingUser(null);
      setFormData({ user_name: '', user_type: 'aluno', password: '' });
      refetch();
    } catch (err) {
      setError(err.message || 'Erro ao salvar usuário. Tente novamente.');
      console.error(err);
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      user_name: user.user_name,
      user_type: user.user_type,
      password: '', // Don't fill password for security
    });
    setShowForm(true);
  };

  const handleDelete = async (userId) => {
    if (!confirmAction('Tem certeza que deseja deletar este usuário?')) {
      return;
    }
    try {
      setError(null);
      await api.users.delete(userId);
      refetch();
    } catch (err) {
      setError('Erro ao deletar usuário. Tente novamente.');
      console.error(err);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingUser(null);
    setFormData({ user_name: '', user_type: 'aluno', password: '' });
    setError(null);
  };

  if (loading) {
    return <LoadingState message="Carregando usuários..." />;
  }

  return (
    <div>
      <ErrorAlert message={error} />

      {!showForm && (
        <div className="mb-6 flex justify-end">
          <AddButton onClick={() => setShowForm(true)}>Novo Usuário</AddButton>
        </div>
      )}

      {showForm && (
        <Card className="mb-6">
          <h2 className="text-xl font-semibold text-[#333333] mb-4">
            {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Nome de Usuário" id="user_name">
              <Input
                id="user_name"
                type="text"
                required
                value={formData.user_name}
                onChange={(e) =>
                  setFormData({ ...formData, user_name: e.target.value })
                }
                placeholder="Digite o nome do usuário"
              />
            </FormField>
            <FormField label="Tipo de Usuário" id="user_type">
              <Select
                id="user_type"
                required
                value={formData.user_type}
                onChange={(e) =>
                  setFormData({ ...formData, user_type: e.target.value })
                }
              >
                <option value="aluno">Aluno</option>
                <option value="professor">Professor</option>
                <option value="administrador">Administrador</option>
              </Select>
            </FormField>
            <FormField
              label={
                editingUser
                  ? 'Nova Senha (deixe em branco para manter a atual)'
                  : 'Senha'
              }
              id="password"
            >
              <Input
                id="password"
                type="password"
                required={!editingUser}
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="Digite a senha"
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
                {editingUser ? 'Atualizar' : 'Criar'}
              </button>
            </div>
          </form>
        </Card>
      )}

      <DataTable
        columns={[
          { key: 'user_id', label: 'ID' },
          {
            key: 'user_name',
            label: 'Nome',
            className: 'font-medium text-[#333333]',
          },
          {
            key: 'user_type',
            label: 'Tipo',
            render: (row) => (
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  row.user_type === 'professor' ||
                  row.user_type === 'administrador'
                    ? 'bg-[#E6A8D7] text-white'
                    : 'bg-[#B8E3C0] text-[#333333]'
                }`}
              >
                {row.user_type === 'administrador'
                  ? 'Administrador'
                  : row.user_type === 'professor'
                    ? 'Professor'
                    : 'Aluno'}
              </span>
            ),
          },
          {
            key: 'created_at',
            label: 'Data de Criação',
            className: 'text-[#6E6E6E]',
            render: (row) =>
              new Date(row.created_at).toLocaleDateString('pt-BR'),
          },
          {
            key: 'actions',
            label: 'Ações',
            align: 'right',
            className: 'font-medium text-[#333333]',
            render: (row) => (
              <div className="flex justify-end gap-2">
                <EditButton onClick={() => handleEdit(row)} />
                <DeleteButton onClick={() => handleDelete(row.user_id)} />
              </div>
            ),
          },
        ]}
        data={users || []}
        rowKey={(row) => row.user_id}
        emptyMessage="Nenhum usuário encontrado"
      />
    </div>
  );
}

export default ManageUsers;
