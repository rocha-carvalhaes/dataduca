import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../config/api';

function UnscramblePhrases({ onBack, activityId }) {
  const [phrases, setPhrases] = useState([]); // Todas as frases disponíveis
  const [selectedPhrases, setSelectedPhrases] = useState([]); // Frases selecionadas para esta sessão
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [currentPhraseWords, setCurrentPhraseWords] = useState([]); // Palavras embaralhadas (ordem do usuário)
  const [correctOrder, setCorrectOrder] = useState([]); // Ordem correta para validação
  const [phrasesPerSession, setPhrasesPerSession] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [activitySessionId, setActivitySessionId] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isCorrect, setIsCorrect] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [movementHistory, setMovementHistory] = useState([]); // Histórico de movimentos da frase atual
  const loadedRef = useRef(false);

  // Carregar parâmetros da API
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const loadParams = async () => {
      try {
        const params =
          await api.activities.getUnscramblePhrasesParams(activityId);

        if (!Array.isArray(params?.phrases) || params.phrases.length === 0) {
          throw new Error('Nenhuma frase disponível');
        }

        if (
          typeof params?.phrases_per_session !== 'number' ||
          params.phrases_per_session <= 0
        ) {
          throw new Error('Parâmetro phrases_per_session inválido');
        }

        setPhrases(params.phrases);
        setPhrasesPerSession(params.phrases_per_session);
        setError(null);
      } catch (err) {
        setError(err.message || 'Erro ao carregar parâmetros');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadParams();
  }, [activityId]);

  // Função para embaralhar array (Fisher-Yates)
  // Garante que o resultado seja diferente do array original
  const shuffleArray = (array) => {
    if (array.length <= 1) return [...array];

    let shuffled;
    let attempts = 0;
    const maxAttempts = 100; // Evita loop infinito

    do {
      shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      attempts++;

      // Verifica se está diferente do original
      const isDifferent = shuffled.some((word, index) => word !== array[index]);

      if (isDifferent || attempts >= maxAttempts) {
        break;
      }
    } while (attempts < maxAttempts);

    return shuffled;
  };

  // Selecionar frases aleatórias sem repetir
  const selectRandomPhrases = useCallback(() => {
    const availablePhrases = [...phrases];
    const selected = [];
    const count = Math.min(phrasesPerSession, availablePhrases.length);

    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * availablePhrases.length);
      selected.push(availablePhrases[randomIndex]);
      availablePhrases.splice(randomIndex, 1);
    }

    return selected;
  }, [phrases, phrasesPerSession]);

  // Iniciar jogo
  const startGame = useCallback(async () => {
    try {
      // Criar sessão de atividade
      const session = await api.activitySessions.create({
        activity_id: activityId,
        results: {
          phrases: [],
          movement_history: {},
        },
      });
      setActivitySessionId(session.activity_session_id);

      // Selecionar frases aleatórias
      const selected = selectRandomPhrases();
      setSelectedPhrases(selected);

      // Preparar primeira frase
      const firstPhrase = selected[0];
      const words = firstPhrase.split(' ');
      const shuffledWords = shuffleArray(words);
      setCorrectOrder(words);
      setCurrentPhraseWords(shuffledWords);
      setCurrentPhraseIndex(0);
      setIsCorrect(false);
      hasUpdatedSessionRef.current = false;
      // Iniciar histórico com estado inicial
      setMovementHistory([
        {
          timestamp: new Date().toISOString(),
          word_order: [...shuffledWords],
        },
      ]);
      setGameStarted(true);
    } catch (err) {
      console.error('Erro ao iniciar jogo:', err);
      setError('Erro ao iniciar atividade');
    }
  }, [activityId, selectRandomPhrases]);

  // Verificar se a frase está correta (validação automática)
  const hasUpdatedSessionRef = useRef(false);

  useEffect(() => {
    if (currentPhraseWords.length === 0 || correctOrder.length === 0) {
      setIsCorrect(false);
      hasUpdatedSessionRef.current = false;
      return;
    }

    if (currentPhraseWords.length !== correctOrder.length) {
      setIsCorrect(false);
      hasUpdatedSessionRef.current = false;
      return;
    }

    const isPhraseCorrect = correctOrder.every(
      (word, index) => word === currentPhraseWords[index]
    );
    setIsCorrect(isPhraseCorrect);

    // Se estiver correto, atualizar sessão automaticamente (apenas uma vez)
    if (isPhraseCorrect && activitySessionId && !hasUpdatedSessionRef.current) {
      hasUpdatedSessionRef.current = true;
      const currentPhrase = selectedPhrases[currentPhraseIndex];
      // Buscar resultados atuais e atualizar
      api.activitySessions
        .get(activitySessionId)
        .then((session) => {
          const currentResults = session.results || {
            phrases: [],
            movement_history: {},
          };
          // Verificar se a frase já foi adicionada
          const phrasesSoFar = currentResults.phrases || [];
          if (!phrasesSoFar.includes(currentPhrase)) {
            const results = {
              phrases: [
                ...phrasesSoFar,
                currentPhrase,
              ],
              movement_history: {
                ...(currentResults.movement_history || {}),
                [currentPhraseIndex]: movementHistory,
              },
            };
            return api.activitySessions.update(activitySessionId, { results });
          }
        })
        .catch((err) => {
          console.error('Erro ao atualizar sessão:', err);
        });
    } else if (!isPhraseCorrect) {
      hasUpdatedSessionRef.current = false;
    }
  }, [
    currentPhraseWords,
    correctOrder,
    activitySessionId,
    selectedPhrases,
    currentPhraseIndex,
  ]);

  // Finalizar jogo
  const handleGameEnd = useCallback(async () => {
    if (activitySessionId) {
      try {
        await api.activitySessions.update(activitySessionId, {
          ended_at: new Date().toISOString(),
          completed: true,
        });
        setGameCompleted(true);
      } catch (err) {
        console.error('Erro ao finalizar sessão:', err);
        // Mesmo com erro, mostra a tela de finalização
        setGameCompleted(true);
      }
    } else {
      setGameCompleted(true);
    }
  }, [activitySessionId]);

  // Avançar para próxima frase
  const nextPhrase = useCallback(() => {
    if (!isCorrect) return;

    // Se há mais frases
    if (currentPhraseIndex < selectedPhrases.length - 1) {
      const nextIndex = currentPhraseIndex + 1;
      const nextPhrase = selectedPhrases[nextIndex];
      const words = nextPhrase.split(' ');
      const shuffledWords = shuffleArray(words);
      setCorrectOrder(words);
      setCurrentPhraseWords(shuffledWords);
      setCurrentPhraseIndex(nextIndex);
      setIsCorrect(false);
      hasUpdatedSessionRef.current = false;
      // Iniciar histórico para a próxima frase
      setMovementHistory([
        {
          timestamp: new Date().toISOString(),
          word_order: [...shuffledWords],
        },
      ]);
    } else {
      // Última frase completada
      handleGameEnd();
    }
  }, [isCorrect, currentPhraseIndex, selectedPhrases, handleGameEnd]);

  // Drag and Drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newWords = [...currentPhraseWords];
    const draggedWord = newWords[draggedIndex];

    // Remove da posição original
    newWords.splice(draggedIndex, 1);

    // Insere na nova posição
    newWords.splice(targetIndex, 0, draggedWord);

    setCurrentPhraseWords(newWords);

    // Registrar movimento no histórico
    setMovementHistory((prev) => [
      ...prev,
      {
        timestamp: new Date().toISOString(),
        word_order: [...newWords],
      },
    ]);

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E6A8D7] mx-auto mb-4"></div>
            <p className="text-[#777777]">Carregando atividade...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#6E6E6E] hover:text-[#333333] transition-colors mb-2"
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
        <div className="bg-white rounded-lg shadow border border-[#F2B8C6] p-6">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!gameStarted) {
    return (
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-[#6E6E6E] hover:text-[#333333] transition-colors mb-2"
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
            <h1 className="text-3xl font-bold text-[#333333] mb-2">
              Desembaralhar Frases
            </h1>
            <p className="text-[#777777]">
              Organize as palavras para formar frases corretas
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-[#D9D9D9] p-6 max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <p className="text-lg text-[#333333] mb-4">
              Você terá {phrasesPerSession} frases para desembaralhar
            </p>
            <button
              onClick={startGame}
              className="px-8 py-3 bg-[#E6A8D7] text-white rounded-lg hover:bg-[#D997C7] transition-colors font-medium text-lg"
            >
              Iniciar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isLastPhrase = currentPhraseIndex === selectedPhrases.length - 1;

  // Tela de finalização
  if (gameCompleted) {
    return (
      <div className="p-6 bg-white min-h-screen">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow border border-[#D9D9D9] p-8 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold text-[#333333] mb-4">
              Parabéns!
            </h2>
            <p className="text-lg text-[#777777] mb-6">
              Você completou todas as {selectedPhrases.length} frases!
            </p>
            <button
              onClick={onBack}
              className="px-8 py-3 bg-[#E6A8D7] text-white rounded-lg hover:bg-[#D997C7] transition-colors font-medium text-lg"
            >
              Voltar para Atividades
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white min-h-screen">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onBack}
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
        <div className="text-sm text-[#6E6E6E]">
          Frase {currentPhraseIndex + 1} de {selectedPhrases.length}
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Área única de ordenação com drag and drop */}
        <div className="bg-white rounded-lg p-8 mb-6 border-2 border-[#D9D9D9] min-h-[300px]">
          <h3 className="text-lg font-medium text-[#333333] mb-6 text-center">
            Arraste as palavras para ordenar a frase
          </h3>

          <div className="flex flex-wrap gap-3 justify-center items-center min-h-[120px]">
            {currentPhraseWords.map((word, index) => (
              <div
                key={`word-${word}-${index}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`px-5 py-3 rounded-lg cursor-move transition-all font-medium text-lg ${
                  isCorrect
                    ? 'bg-green-500 text-white shadow-lg'
                    : draggedIndex === index
                      ? 'bg-teal-700 text-white scale-105 shadow-md'
                      : dragOverIndex === index
                        ? 'bg-teal-100 border-2 border-teal-500 border-dashed text-teal-800'
                        : 'bg-teal-600 text-white hover:bg-teal-700 shadow'
                }`}
              >
                {word}
              </div>
            ))}
          </div>

          {/* Mensagem de sucesso */}
          {isCorrect && (
            <div className="mt-6 text-center">
              <div className="inline-flex items-center gap-2 bg-green-50 border-2 border-green-200 text-green-700 px-6 py-3 rounded-lg">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="font-semibold text-lg">
                  Parabéns! Frase correta!
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Botão para próxima frase (só aparece quando correto) */}
        {isCorrect && (
          <div className="flex justify-center">
            <button
              onClick={nextPhrase}
              className="px-8 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium text-lg shadow-lg"
            >
              {isLastPhrase ? 'Finalizar Atividade' : 'Próxima Frase →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default UnscramblePhrases;
