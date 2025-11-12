import { useState } from 'react'
import Sidebar from './Sidebar'
import Inicio from '../pages/Inicio'
import Atividades from '../pages/Atividades'
import AtividadeDigitacao from '../pages/AtividadeDigitacao'

function Layout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [currentPage, setCurrentPage] = useState('inicio')
  const [atividadeAtual, setAtividadeAtual] = useState(null)

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed)
  }

  const handlePageChange = (pageId) => {
    setCurrentPage(pageId)
    setAtividadeAtual(null)
  }

  const handleAbrirAtividade = (atividadeId, tipo) => {
    setAtividadeAtual({ id: atividadeId, tipo })
  }

  const handleVoltarAtividades = () => {
    setAtividadeAtual(null)
    setCurrentPage('atividades')
  }

  const renderPage = () => {
    if (atividadeAtual) {
      switch (atividadeAtual.tipo) {
        case 'digitacao':
          return <AtividadeDigitacao onBack={handleVoltarAtividades} />
        default:
          return <Atividades onAbrirAtividade={handleAbrirAtividade} />
      }
    }

    switch (currentPage) {
      case 'atividades':
        return <Atividades onAbrirAtividade={handleAbrirAtividade} />
      case 'inicio':
      default:
        return <Inicio />
    }
  }

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
                {atividadeAtual ? 'Atividade' : currentPage === 'inicio' && 'Início'}
                {!atividadeAtual && currentPage === 'atividades' && 'Atividades'}
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <button className="p-2 rounded-lg hover:bg-[#F5F6F7] transition-colors">
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
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </button>
              <button className="p-2 rounded-lg hover:bg-[#F5F6F7] transition-colors">
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
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Área de Conteúdo */}
        <main className="flex-1 overflow-y-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}

export default Layout

