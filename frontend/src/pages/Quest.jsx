import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../config/api';
import { authStorage } from '../utils/auth';
import { LoadingState, ErrorAlert, BackButton } from '../components/ui';

const STAFF_TYPES = new Set(['administrador', 'professor']);

function normalizeActivityType(t) {
  return (t || '').toLowerCase().trim();
}

function Quest({ onStartQuestActivity, resumeQuestId, onResumeConsumed }) {
  const user = authStorage.getUser();
  const isStaff = user && STAFF_TYPES.has(user.user_type);

  const [view, setView] = useState('list');
  const [detailQuestId, setDetailQuestId] = useState(null);
  /** Ao "editar", guarda o id da quest base; ao salvar, POST cria nova versão (fork). */
  const [forkFromQuestId, setForkFromQuestId] = useState(null);

  const [quests, setQuests] = useState([]);
  const [detail, setDetail] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formObjective, setFormObjective] = useState('');
  const [formSteps, setFormSteps] = useState([]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.quests.list();
      setQuests(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Erro ao carregar quests');
      setQuests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadActivities = useCallback(async () => {
    try {
      const data = await api.activities.list();
      setActivities(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (isStaff) loadActivities();
  }, [isStaff, loadActivities]);

  const loadDetail = useCallback(async (questId) => {
    setDetailLoading(true);
    setError(null);
    try {
      const data = await api.quests.get(questId);
      setDetail(data);
    } catch (e) {
      setError(e.message || 'Erro ao carregar quest');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const onResumeConsumedRef = useRef(onResumeConsumed);
  onResumeConsumedRef.current = onResumeConsumed;

  useEffect(() => {
    if (!resumeQuestId) return;
    setDetailQuestId(resumeQuestId);
    setView('detail');
    loadDetail(resumeQuestId);
    onResumeConsumedRef.current?.();
  }, [resumeQuestId, loadDetail]);

  const openDetail = (questId) => {
    setDetailQuestId(questId);
    setView('detail');
    loadDetail(questId);
  };

  const openNewForm = () => {
    setForkFromQuestId(null);
    setFormName('');
    setFormDescription('');
    setFormObjective('');
    setFormSteps([]);
    setFormError(null);
    setView('form');
  };

  const openEditForm = (questId) => {
    setForkFromQuestId(questId);
    setFormError(null);
    setView('form');
    loadDetail(questId);
  };

  useEffect(() => {
    if (view !== 'form' || forkFromQuestId == null) return;
    if (!detail || detail.quest.quest_id !== forkFromQuestId) return;
    const q = detail.quest;
    setFormName(q.quest_name);
    setFormDescription(q.quest_description || '');
    setFormObjective(q.quest_objective || '');
    setFormSteps(
      q.steps.map((s) => ({
        activity_id: s.activity_id,
        activity_name: s.activity_name,
        activity_type: s.activity_type,
      }))
    );
  }, [view, forkFromQuestId, detail]);

  const addStepFromSelect = (e) => {
    const id = Number(e.target.value);
    if (!id) return;
    const act = activities.find((a) => a.activity_id === id);
    if (!act) return;
    setFormSteps((prev) => [
      ...prev,
      {
        activity_id: act.activity_id,
        activity_name: act.activity_name,
        activity_type: act.activity_type,
      },
    ]);
    e.target.value = '';
  };

  const moveStep = (index, dir) => {
    setFormSteps((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const removeStep = (index) => {
    setFormSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const submitForm = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!formName.trim()) {
      setFormError('Informe o nome da quest');
      return;
    }
    if (formSteps.length === 0) {
      setFormError('Adicione pelo menos uma atividade à sequência');
      return;
    }
    const steps = formSteps.map((s, i) => ({
      activity_id: s.activity_id,
      step_order: i + 1,
    }));
    const body = {
      quest_name: formName.trim(),
      quest_description: formDescription.trim() || null,
      quest_objective: formObjective.trim() || null,
      enforce_sequence: true,
      steps,
      ...(forkFromQuestId != null
        ? { fork_from_quest_id: forkFromQuestId }
        : {}),
    };
    setSaving(true);
    try {
      await api.quests.create(body);
      await loadList();
      setView('list');
      setDetailQuestId(null);
      setDetail(null);
      setForkFromQuestId(null);
    } catch (err) {
      setFormError(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const deleteQuest = async (questId) => {
    if (!window.confirm('Excluir esta quest?')) return;
    try {
      await api.quests.delete(questId);
      await loadList();
      if (detailQuestId === questId) {
        setView('list');
        setDetailQuestId(null);
        setDetail(null);
      }
    } catch (e) {
      setError(e.message || 'Erro ao excluir');
    }
  };

  const completedSet = detail?.progress
    ? new Set(detail.progress.completed_quest_step_ids || [])
    : new Set();
  const orderedSteps = detail?.quest
    ? [...detail.quest.steps].sort((a, b) => a.step_order - b.step_order)
    : [];
  const nextEnforced = orderedSteps.find(
    (s) => !completedSet.has(s.quest_step_id)
  );
  const hasProgress = Boolean(detail?.progress);
  const questDone =
    orderedSteps.length > 0 &&
    orderedSteps.every((s) => completedSet.has(s.quest_step_id));

  const beginQuest = async (resetProgress) => {
    if (!detail?.quest) return;
    const q = detail.quest;
    const steps = q.steps || [];
    if (steps.length === 0) return;
    if (resetProgress) {
      try {
        await api.quests.start(q.quest_id);
        await loadDetail(q.quest_id);
      } catch (e) {
        setError(e.message || 'Erro ao iniciar');
        return;
      }
    }
    const ordered = [...steps].sort((a, b) => a.step_order - b.step_order);
    const first = ordered[0];
    onStartQuestActivity({
      questId: q.quest_id,
      steps: ordered.map((s) => ({
        quest_step_id: s.quest_step_id,
        activity_id: s.activity_id,
        activity_type: s.activity_type,
        step_order: s.step_order,
      })),
      enforceSequence: true,
      activityId: first.activity_id,
      activityType: normalizeActivityType(first.activity_type),
      currentStepIndex: 0,
    });
  };

  const continueQuest = () => {
    if (!detail?.quest || !nextEnforced) return;
    const q = detail.quest;
    const ordered = [...(q.steps || [])].sort(
      (a, b) => a.step_order - b.step_order
    );
    onStartQuestActivity({
      questId: q.quest_id,
      steps: ordered.map((s) => ({
        quest_step_id: s.quest_step_id,
        activity_id: s.activity_id,
        activity_type: s.activity_type,
        step_order: s.step_order,
      })),
      enforceSequence: true,
      activityId: nextEnforced.activity_id,
      activityType: normalizeActivityType(nextEnforced.activity_type),
      currentStepIndex: ordered.findIndex(
        (s) => s.quest_step_id === nextEnforced.quest_step_id
      ),
    });
  };

  if (view === 'form') {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-6 flex items-center gap-4">
          <BackButton
            onClick={() => {
              setView('list');
              setForkFromQuestId(null);
            }}
          />
          <h1 className="text-2xl font-bold text-[#333333]">
            {forkFromQuestId != null ? 'Nova versão da quest' : 'Nova quest'}
          </h1>
        </div>

        <form
          onSubmit={submitForm}
          className="bg-white rounded-lg shadow border border-[#D9D9D9] p-6 space-y-4"
        >
          <ErrorAlert message={formError} />
          {forkFromQuestId != null && (
            <p className="text-sm text-[#555555] bg-[#F5F6F7] border border-[#E8E8E8] rounded-lg p-3">
              Será criada uma <strong>nova</strong> quest. Quem já iniciou a
              versão anterior mantém o progresso nela até concluir.
            </p>
          )}
          <div>
            <label
              htmlFor="quest-form-name"
              className="block text-sm font-medium text-[#333333] mb-1"
            >
              Nome
            </label>
            <input
              id="quest-form-name"
              className="w-full border border-[#D9D9D9] rounded-lg px-3 py-2"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
          </div>
          <div>
            <label
              htmlFor="quest-form-description"
              className="block text-sm font-medium text-[#333333] mb-1"
            >
              Descrição (opcional)
            </label>
            <textarea
              id="quest-form-description"
              className="w-full border border-[#D9D9D9] rounded-lg px-3 py-2 min-h-[80px]"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="quest-form-objective"
              className="block text-sm font-medium text-[#333333] mb-1"
            >
              Objetivo (opcional)
            </label>
            <textarea
              id="quest-form-objective"
              className="w-full border border-[#D9D9D9] rounded-lg px-3 py-2 min-h-[60px]"
              value={formObjective}
              onChange={(e) => setFormObjective(e.target.value)}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-[#333333] mb-2">
              Sequência de atividades (ordem de execução)
            </p>
            <select
              className="w-full border border-[#D9D9D9] rounded-lg px-3 py-2 mb-2"
              defaultValue=""
              onChange={addStepFromSelect}
            >
              <option value="">Adicionar atividade…</option>
              {activities.map((a) => (
                <option key={a.activity_id} value={a.activity_id}>
                  {a.activity_name} ({a.activity_type})
                </option>
              ))}
            </select>
            <ul className="space-y-2">
              {formSteps.map((s, i) => (
                <li
                  key={`${s.activity_id}-${i}`}
                  className="flex items-center gap-2 border border-[#E8E8E8] rounded-lg px-3 py-2 bg-[#FAFAFA]"
                >
                  <span className="text-sm text-[#6E6E6E] w-6">{i + 1}.</span>
                  <span className="flex-1 text-sm text-[#333333]">
                    {s.activity_name}
                  </span>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 border rounded"
                    onClick={() => moveStep(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 border rounded"
                    onClick={() => moveStep(i, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="text-xs text-red-600"
                    onClick={() => removeStep(i)}
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-[#E6A8D7] text-white rounded-lg hover:bg-[#D997C7] disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </form>
      </div>
    );
  }

  if (view === 'detail' && detailQuestId) {
    return (
      <div className="p-6">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <BackButton onClick={() => setView('list')} />
          <h1 className="text-2xl font-bold text-[#333333]">
            {detail?.quest?.quest_name || 'Quest'}
          </h1>
          {isStaff && detail?.quest && (
            <>
              <button
                type="button"
                onClick={() => openEditForm(detail.quest.quest_id)}
                className="ml-auto px-4 py-2 border border-[#D9D9D9] rounded-lg text-sm"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => deleteQuest(detail.quest.quest_id)}
                className="px-4 py-2 text-red-600 border border-red-200 rounded-lg text-sm"
              >
                Excluir
              </button>
            </>
          )}
        </div>

        <ErrorAlert message={error} />

        {detailLoading || !detail ? (
          <LoadingState message="Carregando…" />
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow border border-[#D9D9D9] p-6">
              {detail.quest.quest_description && (
                <p className="text-[#555555] mb-2">
                  {detail.quest.quest_description}
                </p>
              )}
              {detail.quest.quest_objective && (
                <p className="text-sm text-[#777777] mb-2">
                  <strong>Objetivo:</strong> {detail.quest.quest_objective}
                </p>
              )}
              <p className="text-sm text-[#6E6E6E]">
                As atividades seguem a ordem definida ao criar a quest. Use
                Continuar ou Começar quest para seguir.
              </p>
              {detail.progress?.status === 'completed' && (
                <p className="mt-3 text-[#2E7D32] font-medium">
                  Quest concluída!
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              {nextEnforced && hasProgress && !questDone && (
                <button
                  type="button"
                  onClick={continueQuest}
                  className="px-6 py-2 bg-[#E6A8D7] text-white rounded-lg hover:bg-[#D997C7]"
                >
                  Continuar
                </button>
              )}
              {(!hasProgress || questDone) && (
                <button
                  type="button"
                  onClick={() => beginQuest(true)}
                  className="px-6 py-2 bg-[#B8E3C0] text-[#333333] rounded-lg hover:opacity-90"
                >
                  {questDone ? 'Jogar novamente' : 'Começar quest'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#333333] mb-2">Quest</h1>
          <p className="text-[#777777]">
            Percorra sequências de atividades criadas pelos professores
          </p>
        </div>
        {isStaff && (
          <button
            type="button"
            onClick={openNewForm}
            className="px-4 py-2 bg-[#E6A8D7] text-white rounded-lg hover:bg-[#D997C7]"
          >
            Nova quest
          </button>
        )}
      </div>

      <ErrorAlert message={error} />

      {loading ? (
        <LoadingState message="Carregando quests…" />
      ) : quests.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#D9D9D9] p-8 text-center text-[#777777]">
          Nenhuma quest cadastrada.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quests.map((q) => (
            <div
              key={q.quest_id}
              className="bg-white rounded-lg shadow border border-[#D9D9D9] p-6 flex flex-col"
            >
              <h3 className="text-xl font-semibold text-[#333333] mb-2">
                {q.quest_name}
              </h3>
              <p className="text-sm text-[#777777] mb-4 flex-1">
                {q.quest_description || 'Sem descrição'}
              </p>
              <div className="text-xs text-[#6E6E6E] mb-4">
                {q.step_count} passo(s) em sequência
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openDetail(q.quest_id)}
                  className="flex-1 py-2 bg-[#B8E3C0] text-[#333333] rounded-lg font-medium hover:opacity-90"
                >
                  Abrir
                </button>
                {isStaff && (
                  <>
                    <button
                      type="button"
                      onClick={() => openEditForm(q.quest_id)}
                      className="px-3 py-2 border border-[#D9D9D9] rounded-lg text-sm"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteQuest(q.quest_id)}
                      className="px-3 py-2 text-red-600 border border-red-100 rounded-lg text-sm"
                    >
                      Excluir
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Quest;
