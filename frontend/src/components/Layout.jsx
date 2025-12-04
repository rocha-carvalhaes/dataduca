import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Home from '../pages/Home';
import Activities from '../pages/Activities';
import TypingActivity from '../pages/TypingActivity';
import UnscramblePhrases from '../pages/UnscramblePhrases';
import Manage from '../pages/Manage';
import Documents from '../pages/Documents';
import { authStorage } from '../utils/auth';

function Layout({ onLogout }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState('home');
  const [currentActivity, setCurrentActivity] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // Carregar informações do usuário
    const user = authStorage.getUser();
    setCurrentUser(user);
  }, []);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const handlePageChange = (pageId) => {
    setCurrentPage(pageId);
    setCurrentActivity(null);
  };

  const handleOpenActivity = (activityId, type) => {
    console.log('Abrindo atividade:', { activityId, type });
    setCurrentActivity({ id: activityId, type });
  };

  const handleBackToActivities = () => {
    setCurrentActivity(null);
    setCurrentPage('activities');
  };

  const renderPage = () => {
    if (currentActivity) {
      console.log('Renderizando atividade:', currentActivity);
      const activityType = currentActivity.type?.toLowerCase()?.trim();

      switch (activityType) {
        case 'digitacao':
        case 'typing':
          return (
            <TypingActivity
              onBack={handleBackToActivities}
              activityId={currentActivity.id}
            />
          );
        case 'desembaralhar-frases':
        case 'desembaralhar frases':
        case 'desembaralhar_frases':
        case 'desembaralhar frases':
        case 'unscramble-phrases':
        case 'unscramble phrases':
          return (
            <UnscramblePhrases
              onBack={handleBackToActivities}
              activityId={currentActivity.id}
            />
          );
        default:
          console.warn('Tipo de atividade não reconhecido:', activityType);
          return (
            <div className="p-6">
              <div className="mb-6 flex items-center justify-between">
                <button
                  onClick={handleBackToActivities}
                  className="flex items-center gap-2 text-[#6E6E6E] hover:text-[#333333] transition-colors"
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
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Voltar
                </button>
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
                    <strong>Tipo:</strong> "{activityType || 'não especificado'}
                    "
                  </p>
                  <p className="text-sm text-yellow-800 mt-1">
                    <strong>ID:</strong> {currentActivity.id}
                  </p>
                </div>
                <div className="text-center">
                  <button
                    onClick={handleBackToActivities}
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

  return (
    <div className="flex h-screen bg-[#F5F6F7] overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={handleToggleSidebar}
        currentPage={currentPage}
        onPageChange={handlePageChange}
      />

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-[#D9D9D9]">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold text-[#333333]">
                {currentActivity
                  ? 'Atividade'
                  : currentPage === 'home' && 'Início'}
                {!currentActivity &&
                  currentPage === 'activities' &&
                  'Atividades'}
                {!currentActivity && currentPage === 'manage' && 'Gerenciar'}
                {!currentActivity &&
                  currentPage === 'documents' &&
                  'Documentação'}
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

        {/* Área de Conteúdo */}
        <main className="flex-1 overflow-y-auto">{renderPage()}</main>
      </div>
    </div>
  );
}

export default Layout;
