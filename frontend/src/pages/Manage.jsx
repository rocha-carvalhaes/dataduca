import { useState } from 'react';
import ManageUsers from './ManageUsers';
import ManageUserSessions from './ManageUserSessions';
import ManageActivities from './ManageActivities';
import ManageActivitySessions from './ManageActivitySessions';

function Manage() {
  const [activeSubmenu, setActiveSubmenu] = useState('users');

  const submenuItems = [
    {
      id: 'users',
      label: 'Usuários',
      icon: (
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
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ),
    },
    {
      id: 'user-sessions',
      label: 'Sessões de Usuários',
      icon: (
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
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      id: 'activities',
      label: 'Atividades',
      icon: (
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
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      ),
    },
    {
      id: 'activity-sessions',
      label: 'Sessões de Atividades',
      icon: (
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
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
    },
  ];

  const renderSubmenuContent = () => {
    switch (activeSubmenu) {
      case 'users':
        return <ManageUsers />;
      case 'user-sessions':
        return <ManageUserSessions />;
      case 'activities':
        return <ManageActivities />;
      case 'activity-sessions':
        return <ManageActivitySessions />;
      default:
        return <ManageUsers />;
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#333333] mb-2">Gerenciar</h1>
        <p className="text-[#777777]">
          Gerencie usuários, atividades e outras entidades do sistema
        </p>
      </div>

      {/* Submenu */}
      <div className="bg-white rounded-lg shadow border border-[#D9D9D9] mb-6">
        <div className="flex border-b border-[#D9D9D9]">
          {submenuItems.map((item) => {
            const isActive = activeSubmenu === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSubmenu(item.id)}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                  isActive
                    ? 'text-[#E6A8D7] border-b-2 border-[#E6A8D7]'
                    : 'text-[#6E6E6E] hover:text-[#333333]'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Submenu content */}
      {renderSubmenuContent()}
    </div>
  );
}

export default Manage;
