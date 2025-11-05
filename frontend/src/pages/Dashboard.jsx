function Dashboard() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#333333] mb-2">
          Início
        </h1>
        <p className="text-[#777777]">
          Bem-vindo à plataforma Dataduca
        </p>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Progresso Recente */}
        <div className="bg-white rounded-lg shadow p-6 border border-[#D9D9D9]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-[#777777] mb-1">
                Progresso Recente
              </p>
              <p className="text-2xl font-bold text-[#333333]">
                0%
              </p>
            </div>
            <div className="bg-[#B8E3C0] rounded-full p-3">
              <svg
                className="w-6 h-6 text-white"
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
            </div>
          </div>
          <div className="w-full bg-[#F5F6F7] rounded-full h-2">
            <div 
              className="bg-[#A4D4AE] h-2 rounded-full transition-all duration-300"
              style={{ width: '0%' }}
            ></div>
          </div>
        </div>

        {/* Esperanzas */}
        <div className="bg-white rounded-lg shadow p-6 border border-[#D9D9D9]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#777777] mb-1">
                Esperanzas
              </p>
              <p className="text-2xl font-bold text-[#333333]">
                0
              </p>
              <p className="text-xs text-[#777777] mt-1">
                Moeda virtual
              </p>
            </div>
            <div className="bg-[#E6A8D7] rounded-full p-3">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Seção de conteúdo principal */}
      <div className="bg-white rounded-lg shadow p-6 border border-[#D9D9D9]">
        <h2 className="text-xl font-semibold text-[#333333] mb-4">
          Visão Geral
        </h2>
        <p className="text-[#777777]">
          Acompanhe seu progresso e continue aprendendo! Complete atividades para ganhar Esperanzas e avançar no seu aprendizado.
        </p>
      </div>
    </div>
  )
}

export default Dashboard

