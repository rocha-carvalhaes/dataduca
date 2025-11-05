function Atividades() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#333333] mb-2">
          Atividades
        </h1>
        <p className="text-[#777777]">
          Gerencie e visualize todas as atividades da plataforma
        </p>
      </div>

      {/* Barra de busca */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 border border-[#D9D9D9]">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar atividades..."
            className="w-full px-4 py-2 pl-10 border border-[#D9D9D9] rounded-lg focus:ring-2 focus:ring-[#E6A8D7] focus:border-transparent outline-none bg-white text-[#333333]"
          />
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#6E6E6E]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Área para cards de atividades */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Os cards de atividades serão renderizados aqui */}
        {/* Por enquanto, deixando em branco para quando as atividades forem implementadas */}
      </div>
    </div>
  )
}

export default Atividades

