function Sidebar({ isCollapsed, onToggle, currentPage, onPageChange }) {
  const menuItems = [
    {
      id: 'inicio',
      label: 'Início',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      id: 'atividades',
      label: 'Atividades',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    // Adicione mais itens do menu aqui no futuro
  ]

  return (
    <div
      className="bg-white text-[#333333] transition-all duration-300 flex flex-col border-r border-[#D9D9D9]"
      style={{ width: isCollapsed ? '64px' : '256px' }}
    >
      {/* Header do Sidebar */}
      <div className="flex items-center justify-between p-4 border-b border-[#D9D9D9]">
        {!isCollapsed && (
          <h2 className="text-xl font-bold text-[#333333]">Dataduca</h2>
        )}
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-[#F5F6F7] transition-colors focus:outline-none focus:ring-2 focus:ring-[#E6A8D7]"
          aria-label={isCollapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <svg
            className={`w-5 h-5 transition-transform text-[#6E6E6E] ${isCollapsed ? '' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = currentPage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-[#E6A8D7] text-white'
                  : 'text-[#333333] hover:bg-[#B8E3C0]'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title={isCollapsed ? item.label : ''}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!isCollapsed && (
                <span className="font-medium">{item.label}</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Footer do Sidebar */}
      <div className="p-4 border-t border-[#D9D9D9]">
        {!isCollapsed && (
          <p className="text-xs text-[#777777] text-center">
            © 2025 Dataduca
          </p>
        )}
      </div>
    </div>
  )
}

export default Sidebar

