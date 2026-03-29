import { useState, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';
import Home from '../pages/Home';
import Activities from '../pages/Activities';
import Quest from '../pages/Quest';
import TypingActivity from '../pages/TypingActivity';
import UnscramblePhrases from '../pages/UnscramblePhrases';
import WritingActivity from '../pages/WritingActivity';
import StrongPasswordActivity from '../pages/StrongPasswordActivity';
import Manage from '../pages/Manage';
import Documents from '../pages/Documents';
import { authStorage } from '../utils/auth';
import { BackButton } from './ui';
import api from '../config/api';

function normalizeActivityType(t) {
  return (t || '').toLowerCase().trim();
}

function Layout({ onLogout }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState('home');
  const [currentActivity, setCurrentActivity] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [questContext, setQuestContext] = useState(null);
  const [questResumeQuestId, setQuestResumeQuestId] = useState(null);

  useEffect(() => {
    const user = authStorage.getUser();
    setCurrentUser(user);
  }, []);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const handleBackToActivities = useCallback(() => {
    setCurrentActivity(null);
    setCurrentPage('activities');
  }, []);

  const handlePageChange = useCallback((pageId) => {
    setCurrentPage(pageId);
    setCurrentActivity(null);
    setQuestContext(null);
    setQuestResumeQuestId(null);
  }, []);

  const handleOpenActivity = useCallback((activityId, type) => {
    setCurrentActivity({ id: activityId, type });
  }, []);

  const handleStartQuestActivity = useCallback((payload) => {
    setQuestContext({
      questId: payload.questId,
      steps: payload.steps,
      enforceSequence: payload.enforceSequence,
      currentStepIndex: payload.currentStepIndex ?? 0,
    });
    setCurrentActivity({
      id: payload.activityId,
      type: normalizeActivityType(payload.activityType),
    });
  }, []);

  const handleQuestResumeConsumed = useCallback(() => {
    setQuestResumeQuestId(null);
  }, []);

  const handleQuestActivityFinished = useCallback(async () => {
    const ctx = questContext;
    const act = currentActivity;
    if (!ctx || !act) return;
    const step = ctx.steps[ctx.currentStepIndex];
    if (!step) return;
    try {
      await api.quests.completeStep(ctx.questId, {
        quest_step_id: step.quest_step_id,
      });
    } catch (e) {
      console.error(e);
      return;
    }
    // Fluxo linear conforme quest_steps; exploração livre (mapa) virá depois.
    const idx = ctx.currentStepIndex;
    const next = ctx.steps[idx + 1];
    if (next) {
      setQuestContext((prev) =>
        prev ? { ...prev, currentStepIndex: idx + 1 } : null
      );
      setCurrentActivity({
        id: next.activity_id,
        type: normalizeActivityType(next.activity_type),
      });
    } else {
      setQuestContext(null);
      setCurrentActivity(null);
      setQuestResumeQuestId(ctx.questId);
    }
  }, [questContext, currentActivity]);

  const handleBackFromActivity = useCallback(() => {
    if (questContext) {
      const qid = questContext.questId;
      setQuestContext(null);
      setCurrentActivity(null);
      setQuestResumeQuestId(qid);
      setCurrentPage('quest');
    } else {
      handleBackToActivities();
    }
  }, [questContext, handleBackToActivities]);

  const questFinishedCallback = questContext
    ? handleQuestActivityFinished
    : undefined;
  const activityOnBack = questContext
    ? handleBackFromActivity
    : handleBackToActivities;
  const allowReplayAfterComplete = questContext == null;

  const renderPage = () => {
    if (currentActivity) {
      const activityType = currentActivity.type?.toLowerCase()?.trim();

      switch (activityType) {
        case 'digitacao':
          return (
            <TypingActivity
              onBack={activityOnBack}
              activityId={currentActivity.id}
              onQuestActivityFinished={questFinishedCallback}
              allowReplayAfterComplete={allowReplayAfterComplete}
            />
          );
        case 'desembaralhar_frases':
          return (
            <UnscramblePhrases
              onBack={activityOnBack}
              activityId={currentActivity.id}
              onQuestActivityFinished={questFinishedCallback}
              allowReplayAfterComplete={allowReplayAfterComplete}
            />
          );
        case 'escrita':
          return (
            <WritingActivity
              onBack={activityOnBack}
              activityId={currentActivity.id}
              onQuestActivityFinished={questFinishedCallback}
              allowReplayAfterComplete={allowReplayAfterComplete}
            />
          );
        case 'senha_forte':
          return (
            <StrongPasswordActivity
              onBack={activityOnBack}
              activityId={currentActivity.id}
              onQuestActivityFinished={questFinishedCallback}
              allowReplayAfterComplete={allowReplayAfterComplete}
            />
          );
        default:
          console.warn('Tipo de atividade não reconhecido:', activityType);
          return (
            <div className="p-6">
              <div className="mb-6 flex items-center justify-between">
                <BackButton onClick={activityOnBack} />
              </div>
              <div className="max-w-2xl mx-auto bg-white rounded-lg shadow border border-[#D9D9D9] p-8">
                <div className="text-center mb-6">
                  <div className="text-6xl mb-4">🚧</div>
                  <h2 className="text-2xl font-bold text-[#333333] mb-2">
                    Atividade em Desenvolvimento
                  </h2>
                  <p className="text-[#777777]">
                    Esta atividade ainda não está disponível
                  </p>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-yellow-800">
                    <strong>Tipo:</strong> &quot;
                    {activityType || 'não especificado'}
                    &quot;
                  </p>
                  <p className="text-sm text-yellow-800 mt-1">
                    <strong>ID:</strong> {currentActivity.id}
                  </p>
                </div>
                <div className="text-center">
                  <button
                    onClick={activityOnBack}
                    className="px-6 py-2 bg-[#E6A8D7] text-white rounded-lg hover:bg-[#D997C7] transition-colors font-medium"
                  >
                    Voltar para Atividades
                  </button>
                </div>
              </div>
            </div>
          );
      }
    }

    switch (currentPage) {
      case 'quest':
        return (
          <Quest
            onStartQuestActivity={handleStartQuestActivity}
            resumeQuestId={questResumeQuestId}
            onResumeConsumed={handleQuestResumeConsumed}
          />
        );
      case 'activities':
        return <Activities onOpenActivity={handleOpenActivity} />;
      case 'manage':
        return <Manage />;
      case 'documents':
        return <Documents />;
      case 'home':
      default:
        return <Home />;
    }
  };

  const headerTitle = () => {
    if (currentActivity) return 'Atividade';
    if (currentPage === 'home') return 'Início';
    if (currentPage === 'quest') return 'Quest';
    if (currentPage === 'activities') return 'Atividades';
    if (currentPage === 'manage') return 'Gerenciar';
    if (currentPage === 'documents') return 'Documentação';
    return '';
  };

  return (
    <div className="flex h-screen bg-[#F5F6F7] overflow-hidden">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={handleToggleSidebar}
        currentPage={currentPage}
        onPageChange={handlePageChange}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-[#D9D9D9]">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold text-[#333333]">
                {headerTitle()}
              </h2>
            </div>
            <div className="flex items-center gap-4">
              {currentUser && (
                <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[#F5F6F7]">
                  <div className="text-sm">
                    <p className="font-medium text-[#333333]">
                      {currentUser.user_name}
                    </p>
                    <p className="text-xs text-[#6E6E6E]">
                      {currentUser.user_type === 'administrador'
                        ? 'Administrador'
                        : currentUser.user_type === 'professor'
                          ? 'Professor'
                          : 'Aluno'}
                    </p>
                  </div>
                </div>
              )}
              <button
                onClick={onLogout}
                className="p-2 rounded-lg hover:bg-[#F5F6F7] transition-colors"
                title="Sair"
              >
                <svg
                  className="w-5 h-5 text-[#6E6E6E]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{renderPage()}</main>
      </div>
    </div>
  );
}

export default Layout;
