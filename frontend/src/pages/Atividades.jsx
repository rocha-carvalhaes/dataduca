function Atividades({ onAbrirAtividade }) {
  // TODO: Carregar atividades do backend
  const atividades = [
    {
      id: 1,
      titulo: 'Digitação com Bolhas',
      descricao: 'Pratique digitação enquanto estoura bolhas de sabão!',
      tipo: 'digitacao',
      icone: '💭',
    },
  ]

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-[#333333] mb-2">
          Atividades
        </h1>
        <p className="text-[#777777]">
          Escolha uma atividade para começar a aprender
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

      {/* Cards de atividades */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {atividades.map((atividade) => (
          <div
            key={atividade.id}
            onClick={() => onAbrirAtividade && onAbrirAtividade(atividade.id, atividade.tipo)}
            className="bg-white rounded-lg shadow border border-[#D9D9D9] p-6 cursor-pointer hover:shadow-lg transition-all hover:border-[#E6A8D7] group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="text-4xl">{atividade.icone}</div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-[#333333] group-hover:text-[#E6A8D7] transition-colors">
                  {atividade.titulo}
                </h3>
              </div>
            </div>
            <p className="text-sm text-[#777777] mb-4">
              {atividade.descricao}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#6E6E6E] bg-[#F5F6F7] px-2 py-1 rounded">
                {atividade.tipo}
              </span>
              <svg
                className="w-5 h-5 text-[#6E6E6E] group-hover:text-[#E6A8D7] transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Atividades

