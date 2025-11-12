import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import api from '../config/api'

function AtividadeDigitacao({ onBack }) {
  const [caracteres, setCaracteres] = useState([])
  const [totalBolhas, setTotalBolhas] = useState(0)
  const [velocidade, setVelocidade] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [caracteresGerados, setCaracteresGerados] = useState([])
  const [loopAtivo, setLoopAtivo] = useState(false)
  const [bolhas, setBolhas] = useState([])
  const [jogoIniciado, setJogoIniciado] = useState(false)
  const [bolhasGeradas, setBolhasGeradas] = useState([]) // Rastrear todas as bolhas geradas no jogo
  const [bolhasAcertadas, setBolhasAcertadas] = useState([]) // Rastrear bolhas que o usuário acertou
  const bolhasAcertadasRef = useRef(new Set()) // Usar Set para evitar duplicatas
  const intervaloRef = useRef(null)
  const animacaoRef = useRef(null)
  const containerRef = useRef(null)
  const tempoInicialRef = useRef({})
  const carregouRef = useRef(false)
  const jogoFinalizadoRef = useRef(false) // Evitar múltiplos eventos de fim de jogo

  // Calcular status do jogo
  const statusJogo = useMemo(() => {
    if (bolhasGeradas.length === 0) {
      return 'Não iniciado'
    }
    
    if (bolhasGeradas.length > 0 && bolhasGeradas.length < totalBolhas && bolhas.length > 0) {
      return 'Em andamento'
    }
    
    if (bolhasGeradas.length === totalBolhas && bolhas.length === 0) {
      return 'Finalizado'
    }
    
    // Status intermediário (todas as bolhas foram geradas mas ainda há bolhas na tela)
    return 'Em andamento'
  }, [bolhasGeradas.length, totalBolhas, bolhas.length])

  // Função para gerar um caractere aleatório baseado nos caracteres disponíveis
  const gerarCaractereAleatorio = () => {
    if (caracteres.length === 0) {
      return null
    }
    const indiceAleatorio = Math.floor(Math.random() * caracteres.length)
    return caracteres[indiceAleatorio]
  }

  // Função para adicionar um novo caractere à lista e criar uma bolha
  const adicionarCaractere = useCallback(() => {
    const novoCaractere = gerarCaractereAleatorio()
    if (novoCaractere !== null) {
      setCaracteresGerados(prev => [...prev, novoCaractere])
      
      // Criar uma nova bolha
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth
        const containerHeight = containerRef.current.offsetHeight
        const bolhaId = Date.now() + Math.random()
        
        // Posição inicial: parte inferior do container, posição x aleatória
        const xInicial = Math.random() * (containerWidth - 80) + 40 // Margem de 40px de cada lado
        const yInicial = containerHeight - 40 // 40px do fundo
        
        const novaBolha = {
          id: bolhaId,
          caractere: novoCaractere,
          x: xInicial,
          y: yInicial,
          xInicial: xInicial,
          offsetHorizontal: Math.random() * Math.PI, // Fase aleatória para movimento horizontal
          tempoGeracao: Date.now() // Timestamp de quando foi gerada
        }
        
        setBolhas(prev => [...prev, novaBolha])
        
        // Rastrear bolha gerada
        setBolhasGeradas(prev => [...prev, {
          id: bolhaId,
          caractere: novoCaractere,
          tempoGeracao: novaBolha.tempoGeracao
        }])
        
        // Registrar tempo inicial para esta bolha
        tempoInicialRef.current[bolhaId] = Date.now()
      }
    }
  }, [caracteres])

  // Função para iniciar o jogo
  const iniciarJogo = useCallback(() => {
    if (totalBolhas <= 0 || caracteres.length === 0) return
    
    setJogoIniciado(true)
    setBolhas([])
    setCaracteresGerados([])
    setBolhasGeradas([]) // Resetar rastreamento de bolhas geradas
    setBolhasAcertadas([]) // Resetar rastreamento de bolhas acertadas
    bolhasAcertadasRef.current = new Set() // Resetar Set de IDs acertados
    jogoFinalizadoRef.current = false // Resetar flag de jogo finalizado
    tempoInicialRef.current = {}
    
    // Gerar todas as bolhas espaçadas no tempo baseado na velocidade
    for (let i = 0; i < totalBolhas; i++) {
      setTimeout(() => {
        adicionarCaractere()
      }, i * (velocidade * 1000)) // Espaçar as bolhas baseado na velocidade
    }
  }, [totalBolhas, caracteres.length, velocidade, adicionarCaractere])

  // Função para reiniciar o jogo
  const reiniciarJogo = useCallback(() => {
    setJogoIniciado(false)
    setBolhas([])
    setCaracteresGerados([])
    setBolhasGeradas([])
    setBolhasAcertadas([])
    bolhasAcertadasRef.current = new Set()
    jogoFinalizadoRef.current = false
    tempoInicialRef.current = {}
    
    // Limpar intervalos
    if (intervaloRef.current) {
      clearInterval(intervaloRef.current)
      intervaloRef.current = null
    }
    if (animacaoRef.current) {
      cancelAnimationFrame(animacaoRef.current)
      animacaoRef.current = null
    }
  }, [])

  // Evento de fim de jogo
  const handleFimJogo = useCallback(() => {
    // Evitar múltiplos eventos
    if (jogoFinalizadoRef.current) return
    jogoFinalizadoRef.current = true

    // Preparar dados do jogo para envio ao backend
    const dadosJogo = {
      totalBolhas: totalBolhas,
      bolhasGeradas: bolhasGeradas.length,
      bolhasAcertadas: bolhasAcertadas.length,
      taxaAcerto: bolhasGeradas.length > 0 
        ? (bolhasAcertadas.length / bolhasGeradas.length) * 100 
        : 0,
      detalhesBolhasGeradas: bolhasGeradas, // Lista completa de todas as bolhas geradas
      detalhesBolhasAcertadas: bolhasAcertadas, // Lista completa de bolhas acertadas
      timestampFim: Date.now()
    }

    // Log para debug (no futuro, enviar para o backend)
    if (import.meta.env.DEV) {
      console.log('🎮 Jogo Finalizado! Dados para salvar:', dadosJogo)
    }

    // TODO: Aqui será feita a chamada à API para salvar os dados no banco
    // Exemplo futuro:
    // await api.atividades.salvarResultado(dadosJogo)
  }, [totalBolhas, bolhasGeradas, bolhasAcertadas])

  // Detectar quando o jogo é finalizado
  useEffect(() => {
    if (statusJogo === 'Finalizado' && !jogoFinalizadoRef.current) {
      handleFimJogo()
    }
  }, [statusJogo, handleFimJogo])

  // Função para iniciar/parar o loop de geração automática
  const toggleLoop = () => {
    if (loopAtivo) {
      // Parar o loop
      if (intervaloRef.current) {
        clearInterval(intervaloRef.current)
        intervaloRef.current = null
      }
      setLoopAtivo(false)
    } else {
      // Iniciar o loop
      setLoopAtivo(true)
    }
  }

  // Efeito para controlar o loop de geração automática
  useEffect(() => {
    if (loopAtivo && velocidade !== null && caracteres.length > 0) {
      // Converter velocidade (em segundos) para milissegundos
      const intervaloMs = velocidade * 1000
      
      // Criar intervalo para gerar caracteres automaticamente
      intervaloRef.current = setInterval(() => {
        adicionarCaractere()
      }, intervaloMs)
    } else {
      // Limpar intervalo se o loop não estiver ativo
      if (intervaloRef.current) {
        clearInterval(intervaloRef.current)
        intervaloRef.current = null
      }
    }

    // Limpar intervalo ao desmontar ou quando dependências mudarem
    return () => {
      if (intervaloRef.current) {
        clearInterval(intervaloRef.current)
        intervaloRef.current = null
      }
    }
  }, [loopAtivo, velocidade, caracteres.length, adicionarCaractere])

  // Função para remover a primeira ocorrência de um caractere da lista
  const removerCaractere = (caractere) => {
    setCaracteresGerados(prev => {
      const indice = prev.findIndex(char => char === caractere)
      if (indice !== -1) {
        return prev.filter((_, i) => i !== indice)
      }
      return prev
    })
  }

  // Listener para capturar teclas pressionadas
  useEffect(() => {
    const bolhasProcessadas = new Set() // Set local para evitar processamento duplo no mesmo frame
    
    const handleKeyPress = (event) => {
      const teclaPressionada = event.key.toLowerCase()
      const timestamp = Date.now()
      
      // Verificar se a tecla pressionada existe na lista de caracteres gerados
      setCaracteresGerados(prev => {
        const indice = prev.findIndex(char => char.toLowerCase() === teclaPressionada)
        if (indice !== -1) {
          // Remover a primeira ocorrência
          return prev.filter((_, i) => i !== indice)
        }
        return prev
      })
      
      // Remover a primeira bolha com o caractere correspondente
      setBolhas(prev => {
        const indice = prev.findIndex(bolha => bolha.caractere.toLowerCase() === teclaPressionada)
        if (indice !== -1) {
          const bolhaRemovida = prev[indice]
          
          // Criar uma chave única para este evento (ID + timestamp aproximado)
          const chaveEvento = `${bolhaRemovida.id}-${Math.floor(timestamp / 100)}`
          
          // Verificar se este evento já foi processado (evitar duplicatas do StrictMode)
          if (bolhasProcessadas.has(chaveEvento)) {
            if (import.meta.env.DEV) {
              console.warn('Evento duplicado ignorado:', chaveEvento)
            }
            return prev
          }
          bolhasProcessadas.add(chaveEvento)
          
          // Verificar se esta bolha já foi contabilizada (evitar duplicatas)
          if (!bolhasAcertadasRef.current.has(bolhaRemovida.id)) {
            // Adicionar ao Set primeiro
            bolhasAcertadasRef.current.add(bolhaRemovida.id)
            
            // Depois adicionar ao array de estado
            const novaBolhaAcertada = {
              id: bolhaRemovida.id,
              caractere: bolhaRemovida.caractere,
              tempoAcerto: timestamp,
              tempoGeracao: bolhaRemovida.tempoGeracao
            }
            
            setBolhasAcertadas(prevAcertadas => {
              // Verificação adicional: garantir que não há duplicatas no array
              const jaExiste = prevAcertadas.some(b => b.id === bolhaRemovida.id)
              if (jaExiste) {
                if (import.meta.env.DEV) {
                  console.warn('Tentativa de adicionar bolha duplicada:', bolhaRemovida.id)
                }
                return prevAcertadas
              }
              return [...prevAcertadas, novaBolhaAcertada]
            })
          } else {
            if (import.meta.env.DEV) {
              console.warn('Bolha já foi contabilizada:', bolhaRemovida.id)
            }
          }
          
          delete tempoInicialRef.current[bolhaRemovida.id]
          return prev.filter((_, i) => i !== indice)
        }
        return prev
      })
    }

    // Adicionar listener apenas quando não estiver carregando e não houver erro
    if (!carregando && !erro) {
      window.addEventListener('keydown', handleKeyPress)
    }

    // Limpar listener ao desmontar ou quando estados mudarem
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [carregando, erro])

  // Animação das bolhas
  useEffect(() => {
    if (!containerRef.current || velocidade === null || bolhas.length === 0) {
      return
    }

    const animar = () => {
      const agora = Date.now()
      const containerHeight = containerRef.current.offsetHeight
      
      setBolhas(prev => {
        const bolhasAtualizadas = prev
          .map(bolha => {
            const tempoInicial = tempoInicialRef.current[bolha.id]
            if (!tempoInicial) return null
            
            const tempoVida = (agora - tempoInicial) / 1000 // em segundos
            
            // Movimento vertical: subir com a velocidade (velocidade em pixels por segundo)
            // A posição inicial y é no fundo, então subtraímos a distância percorrida
            const distanciaVertical = velocidade * 50 * tempoVida // 50 pixels por unidade de velocidade por segundo
            const novaY = containerHeight - 40 - distanciaVertical // 40px do fundo é a posição inicial
            
            // Se a bolha já saiu da tela, retornar null para ser filtrada
            if (novaY < 0) {
              delete tempoInicialRef.current[bolha.id]
              // Remover o caractere correspondente do array caracteresGerados
              setCaracteresGerados(prevChars => {
                const indice = prevChars.findIndex(char => char === bolha.caractere)
                if (indice !== -1) {
                  return prevChars.filter((_, i) => i !== indice)
                }
                return prevChars
              })
              return null
            }
            
            // Movimento horizontal: flutuação usando seno
            const amplitude = 30 // amplitude do movimento horizontal em pixels
            const frequencia = 0.3 // frequência do movimento (ciclos por segundo)
            const offsetX = Math.sin(bolha.offsetHorizontal + tempoVida * frequencia * Math.PI * 2) * amplitude
            const novaX = bolha.xInicial + offsetX
            
            return {
              ...bolha,
              x: novaX,
              y: novaY
            }
          })
          .filter(bolha => bolha !== null) // Remover bolhas que foram marcadas como null
        
        return bolhasAtualizadas
      })
      
      animacaoRef.current = requestAnimationFrame(animar)
    }

    animacaoRef.current = requestAnimationFrame(animar)

    return () => {
      if (animacaoRef.current) {
        cancelAnimationFrame(animacaoRef.current)
      }
    }
  }, [velocidade, bolhas.length])

  // Carregar parâmetros da API
  useEffect(() => {
    // Proteção contra execução dupla do StrictMode
    if (carregouRef.current) return
    carregouRef.current = true

    const carregarParams = async () => {
      try {
        const params = await api.atividades.obterParamsDigitacao()
        
        // Validar dados recebidos da API
        if (!Array.isArray(params?.caracteres) || params.caracteres.length === 0) {
          throw new Error('Caracteres inválidos recebidos da API')
        }
        
        if (typeof params?.velocidade !== 'number' || params.velocidade <= 0) {
          throw new Error('Velocidade inválida recebida da API')
        }
        
        if (typeof params?.total_bolhas !== 'number' || params.total_bolhas <= 0) {
          throw new Error('Total de bolhas inválido recebido da API')
        }
        
        setCaracteres(params.caracteres)
        setVelocidade(params.velocidade)
        setTotalBolhas(params.total_bolhas)
        setErro(null)
        
        // Log apenas em desenvolvimento
        if (import.meta.env.DEV) {
          console.log('Parâmetros carregados:', params.caracteres, params.velocidade)
        }
      } catch (error) {
        // Definir erro para exibir na UI
        const mensagemErro = error.message || 'Não foi possível carregar os parâmetros da atividade'
        setErro(mensagemErro)
        
        if (import.meta.env.DEV) {
          console.error('Erro ao carregar parâmetros:', error)
        }
      } finally {
        // Sempre atualizar estado de carregamento
        setCarregando(false)
      }
    }

    carregarParams()
  }, [])

  if (carregando) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E6A8D7] mx-auto mb-4"></div>
            <p className="text-[#777777]">Carregando atividade...</p>
          </div>
        </div>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-[#6E6E6E] hover:text-[#333333] transition-colors mb-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Voltar
            </button>
            <h1 className="text-3xl font-bold text-[#333333] mb-2">
              Digitação com Bolhas
            </h1>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-[#F2B8C6] p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-[#F2B8C6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-[#333333] mb-2">Erro ao carregar atividade</h3>
              <p className="text-[#777777] mb-4">{erro}</p>
              <button
                onClick={() => window.location.reload()}
                className="bg-[#E6A8D7] hover:bg-[#d897c8] text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#6E6E6E] hover:text-[#333333] transition-colors mb-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar
          </button>
          <h1 className="text-3xl font-bold text-[#333333] mb-2">
            Digitação com Bolhas
          </h1>
        </div>
      </div>

      {/* Canvas de Bolhas */}
      <div
        ref={containerRef}
        className="relative bg-gradient-to-b from-blue-50 to-indigo-50 rounded-lg border-2 border-[#D9D9D9] overflow-hidden"
        style={{ minHeight: '500px', height: '500px' }}
      >
          {/* Barra de Progresso - Canto Superior Esquerdo */}
          {jogoIniciado && totalBolhas > 0 && (
            <div className="absolute top-4 left-4 z-20">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-[#333333]">
                  {bolhasAcertadas.length} / {totalBolhas}
                </span>
              </div>
              <div className="w-32 bg-gray-200 rounded-full h-1.5">
                <div 
                  className="bg-[#E6A8D7] h-1.5 rounded-full transition-all duration-300 ease-out"
                  style={{ 
                    width: `${Math.min((bolhasAcertadas.length / totalBolhas) * 100, 100)}%` 
                  }}
                ></div>
              </div>
            </div>
          )}
          
          {!jogoIniciado && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <button
                onClick={iniciarJogo}
                className="flex items-center justify-center w-20 h-20 rounded-full bg-[#E6A8D7] hover:bg-[#d897c8] text-white shadow-lg transition-all hover:scale-110"
              >
                <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            </div>
          )}

          {statusJogo === 'Finalizado' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-white/90 backdrop-blur-sm">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#B8E3C0] mb-4">
                  <svg className="w-10 h-10 text-[#333333]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[#333333] mb-2">Jogo Finalizado!</h2>
                <p className="text-[#777777] mb-2">
                  Você acertou {bolhasAcertadas.length} de {totalBolhas} bolhas
                </p>
                <p className="text-[#777777]">
                  Taxa de acerto: {totalBolhas > 0 ? ((bolhasAcertadas.length / totalBolhas) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <button
                onClick={reiniciarJogo}
                className="flex items-center justify-center w-20 h-20 rounded-full bg-[#E6A8D7] hover:bg-[#d897c8] text-white shadow-lg transition-all hover:scale-110"
              >
                <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
                </svg>
              </button>
            </div>
          )}
          
          {bolhas.map(bolha => (
            <div
              key={bolha.id}
              className="absolute flex items-center justify-center rounded-full bg-white border-2 border-[#E6A8D7] shadow-lg"
              style={{
                left: `${bolha.x}px`,
                top: `${bolha.y}px`,
                width: '60px',
                height: '60px',
                transform: 'translate(-50%, -50%)',
                willChange: 'transform'
              }}
            >
              <span className="text-2xl font-bold text-[#333333]">
                {bolha.caractere}
              </span>
            </div>
          ))}
        </div>

      {caracteresGerados.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-[#333333] mb-3">
            Caracteres Gerados ({caracteresGerados.length}):
          </h3>
          <div className="flex flex-wrap gap-2">
            {caracteresGerados.map((char, index) => (
              <span
                key={index}
                className="bg-[#B8E3C0] text-[#333333] font-semibold py-2 px-4 rounded-lg text-lg"
              >
                {char}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Informações de rastreamento (apenas para debug/desenvolvimento) */}
      {import.meta.env.DEV && jogoIniciado && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-sm font-semibold text-[#333333] mb-2">Rastreamento do Jogo:</h3>
            <div className="text-xs text-[#777777] space-y-2">
              <div>
                <p className="font-semibold mb-1">Parâmetros Carregados:</p>
                <p>Total de caracteres: {caracteres.length}</p>
                <p>Velocidade: {velocidade}</p>
                <p>Caracteres disponíveis: {caracteres.join(', ')}</p>
              </div>
              
              <div>
                <p className="font-semibold mb-1">Status do Jogo:</p>
                <p className={`font-bold ${
                  statusJogo === 'Não iniciado' 
                    ? 'text-gray-600'
                    : statusJogo === 'Em andamento'
                    ? 'text-blue-600'
                    : 'text-green-600'
                }`}>
                  {statusJogo}
                </p>
              </div>
              
              <div>
                <p className="font-semibold">Resumo:</p>
                <p>Bolhas geradas: {bolhasGeradas.length}</p>
                <p>Bolhas acertadas: {bolhasAcertadas.length}</p>
                <p>Taxa de acerto: {bolhasGeradas.length > 0 ? ((bolhasAcertadas.length / bolhasGeradas.length) * 100).toFixed(1) : 0}%</p>
              </div>
              
              <div className="mt-3">
                <p className="font-semibold mb-1">Bolhas Acertadas (detalhado):</p>
                <div className="max-h-32 overflow-y-auto bg-white p-2 rounded border">
                  {bolhasAcertadas.length === 0 ? (
                    <p className="text-gray-400">Nenhuma bolha acertada ainda</p>
                  ) : (
                    <div className="space-y-1">
                      {bolhasAcertadas.map((bolha, index) => (
                        <div key={bolha.id || index} className="text-xs border-b pb-1">
                          <p>ID: {bolha.id?.toString().slice(-6)} | Char: {bolha.caractere} | Tempo resposta: {bolha.tempoGeracao && bolha.tempoAcerto ? ((bolha.tempoAcerto - bolha.tempoGeracao) / 1000).toFixed(2) : 'N/A'}s</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-2">
                <p className="font-semibold mb-1">IDs únicos no Set: {bolhasAcertadasRef.current?.size || 0}</p>
                <p className="text-red-600">Array length: {bolhasAcertadas.length} | Set size: {bolhasAcertadasRef.current?.size || 0}</p>
                {bolhasAcertadas.length !== (bolhasAcertadasRef.current?.size || 0) && (
                  <p className="text-red-600 font-bold">⚠️ ATENÇÃO: Há duplicatas no array!</p>
                )}
                <div className="mt-1 text-xs">
                  <p>IDs no Set: {Array.from(bolhasAcertadasRef.current || []).join(', ').slice(0, 100) || 'Nenhum'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}

export default AtividadeDigitacao
