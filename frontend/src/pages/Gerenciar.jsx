import { useState } from 'react'
import GerenciarUsuarios from './GerenciarUsuarios'

function Gerenciar() {
  const [submenuAtivo, setSubmenuAtivo] = useState('usuarios')

  const submenuItems = [
    {
      id: 'usuarios',
      label: 'Usuários',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    // Futuramente: atividades, configurações, etc.
  ]

  const renderSubmenu = () => {
    switch (submenuAtivo) {
      case 'usuarios':
        return <GerenciarUsuarios />
      default:
        return <GerenciarUsuarios />
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#333333] mb-2">
          Gerenciar
        </h1>
        <p className="text-[#777777]">
          Gerencie usuários, atividades e outras entidades do sistema
        </p>
      </div>

      {/* Submenu */}
      <div className="bg-white rounded-lg shadow border border-[#D9D9D9] mb-6">
        <div className="flex border-b border-[#D9D9D9]">
          {submenuItems.map((item) => {
            const isActive = submenuAtivo === item.id
            return (
              <button
                key={item.id}
                onClick={() => setSubmenuAtivo(item.id)}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                  isActive
                    ? 'text-[#E6A8D7] border-b-2 border-[#E6A8D7]'
                    : 'text-[#6E6E6E] hover:text-[#333333]'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Conteúdo do submenu */}
      {renderSubmenu()}
    </div>
  )
}

export default Gerenciar

