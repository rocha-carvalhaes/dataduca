import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Home from '../pages/Home';
import Activities from '../pages/Activities';
import TypingActivity from '../pages/TypingActivity';
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
    setCurrentActivity({ id: activityId, type });
  };

  const handleBackToActivities = () => {
    setCurrentActivity(null);
    setCurrentPage('activities');
  };

  const renderPage = () => {
    if (currentActivity) {
      switch (currentActivity.type) {
        case 'digitacao':
          return <TypingActivity onBack={handleBackToActivities} />;
        default:
          return <Activities onOpenActivity={handleOpenActivity} />;
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
                      {currentUser.user_type === 'professor'
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
