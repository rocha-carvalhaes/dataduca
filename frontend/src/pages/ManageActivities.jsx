import { useState, useEffect } from 'react';
import api from '../config/api';

function ManageActivities() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.activities.list();
      setActivities(data);
    } catch (err) {
      setError(err.message || 'Erro ao carregar atividades. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
      loadActivities();
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
      loadActivities();
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

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-[#6E6E6E]">Carregando atividades...</div>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {!showForm && (
        <div className="mb-6 flex justify-end">
          <button
            onClick={() => setShowForm(true)}
            className="bg-[#E6A8D7] text-white px-6 py-2 rounded-lg hover:bg-[#D89BC8] transition-colors font-medium flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Nova Atividade
          </button>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-lg shadow border border-[#D9D9D9] p-6 mb-6">
          <h2 className="text-xl font-semibold text-[#333333] mb-4">
            {editingActivity ? 'Editar Atividade' : 'Nova Atividade'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="activity_name"
                className="block text-sm font-medium text-[#333333] mb-2"
              >
                Nome da Atividade *
              </label>
              <input
                id="activity_name"
                type="text"
                required
                value={formData.activity_name}
                onChange={(e) =>
                  setFormData({ ...formData, activity_name: e.target.value })
                }
                className="w-full px-4 py-2 border border-[#D9D9D9] rounded-lg focus:ring-2 focus:ring-[#E6A8D7] focus:border-transparent outline-none"
                placeholder="Digite o nome da atividade"
              />
            </div>
            <div>
              <label
                htmlFor="activity_description"
                className="block text-sm font-medium text-[#333333] mb-2"
              >
                Descrição
              </label>
              <textarea
                id="activity_description"
                value={formData.activity_description}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    activity_description: e.target.value,
                  })
                }
                className="w-full px-4 py-2 border border-[#D9D9D9] rounded-lg focus:ring-2 focus:ring-[#E6A8D7] focus:border-transparent outline-none"
                placeholder="Digite a descrição da atividade"
                rows="3"
              />
            </div>
            <div>
              <label
                htmlFor="activity_objective"
                className="block text-sm font-medium text-[#333333] mb-2"
              >
                Objetivo
              </label>
              <textarea
                id="activity_objective"
                value={formData.activity_objective}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    activity_objective: e.target.value,
                  })
                }
                className="w-full px-4 py-2 border border-[#D9D9D9] rounded-lg focus:ring-2 focus:ring-[#E6A8D7] focus:border-transparent outline-none"
                placeholder="Digite o objetivo da atividade"
                rows="3"
              />
            </div>
            <div>
              <label
                htmlFor="activity_type"
                className="block text-sm font-medium text-[#333333] mb-2"
              >
                Tipo de Atividade *
              </label>
              <input
                id="activity_type"
                type="text"
                required
                value={formData.activity_type}
                onChange={(e) =>
                  setFormData({ ...formData, activity_type: e.target.value })
                }
                className="w-full px-4 py-2 border border-[#D9D9D9] rounded-lg focus:ring-2 focus:ring-[#E6A8D7] focus:border-transparent outline-none"
                placeholder="Ex: digitacao, memoria, raciocinio"
              />
              <p className="mt-1 text-xs text-[#6E6E6E]">
                Define qual componente/script será usado para esta atividade
              </p>
            </div>
            <div>
              <label
                htmlFor="activity_icon"
                className="block text-sm font-medium text-[#333333] mb-2"
              >
                Ícone (Emoji) *
              </label>
              <input
                id="activity_icon"
                type="text"
                required
                value={formData.activity_icon}
                onChange={(e) =>
                  setFormData({ ...formData, activity_icon: e.target.value })
                }
                className="w-full px-4 py-2 border border-[#D9D9D9] rounded-lg focus:ring-2 focus:ring-[#E6A8D7] focus:border-transparent outline-none text-2xl"
                placeholder="💭"
                maxLength={2}
              />
              <p className="mt-1 text-xs text-[#6E6E6E]">
                Digite um emoji para o ícone da atividade (ex: 💭, 🎮, 📚)
              </p>
            </div>
            <div>
              <label
                htmlFor="activity_version"
                className="block text-sm font-medium text-[#333333] mb-2"
              >
                Versão *
              </label>
              <input
                id="activity_version"
                type="text"
                required
                value={formData.activity_version}
                onChange={(e) =>
                  setFormData({ ...formData, activity_version: e.target.value })
                }
                className="w-full px-4 py-2 border border-[#D9D9D9] rounded-lg focus:ring-2 focus:ring-[#E6A8D7] focus:border-transparent outline-none"
                placeholder="Ex: 1.0"
              />
            </div>
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
        </div>
      )}

      <div className="bg-white rounded-lg shadow border border-[#D9D9D9] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#F5F6F7] border-b border-[#D9D9D9]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  Descrição
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  Versão
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  Atualizado em
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-[#6E6E6E] uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9D9D9]">
              {activities.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="px-6 py-8 text-center text-[#6E6E6E]"
                  >
                    Nenhuma atividade encontrada
                  </td>
                </tr>
              ) : (
                activities.map((activity) => (
                  <tr key={activity.activity_id} className="hover:bg-[#F5F6F7]">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#333333]">
                      {activity.activity_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#333333]">
                      {activity.activity_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#6E6E6E]">
                      {activity.activity_description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#333333]">
                      {activity.activity_version}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[#6E6E6E]">
                      {formatDate(activity.updated_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(activity)}
                          className="text-[#E6A8D7] hover:text-[#D89BC8] transition-colors"
                          title="Editar"
                        >
                          <svg
                            className="w-5 h-5"
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
                        <button
                          onClick={() => handleDelete(activity.activity_id)}
                          className="text-red-600 hover:text-red-800 transition-colors"
                          title="Deletar"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
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

export default ManageActivities;
