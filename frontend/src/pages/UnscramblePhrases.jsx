import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../config/api';
import { LoadingState, BackButton } from '../components/ui';

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
  const [submitting, setSubmitting] = useState(false);
  const loadedRef = useRef(false);
  const gameEndingRef = useRef(false);

  // Função para carregar parâmetros da API
  const loadParams = useCallback(async () => {
    try {
      setLoading(true);
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
  }, [activityId]);

  // Carregar parâmetros da API na montagem inicial
  useEffect(() => {
    // Protection against StrictMode double execution
    if (loadedRef.current) return;
    loadedRef.current = true;

    loadParams();
  }, [loadParams]);

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
    if (submitting) return;
    setSubmitting(true);
    try {
      const session = await api.activitySessions.create({
        activity_id: activityId,
        results: {
          phrases: [],
          movement_history: {},
        },
      });
      setActivitySessionId(session.activity_session_id);

      const selected = selectRandomPhrases();
      setSelectedPhrases(selected);

      const firstPhrase = selected[0];
      const words = firstPhrase.split(' ');
      const shuffledWords = shuffleArray(words);
      setCorrectOrder(words);
      setCurrentPhraseWords(shuffledWords);
      setCurrentPhraseIndex(0);
      setIsCorrect(false);
      hasUpdatedSessionRef.current = false;
      gameEndingRef.current = false;
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
    } finally {
      setSubmitting(false);
    }
  }, [activityId, selectRandomPhrases, submitting]);

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
              phrases: [...phrasesSoFar, currentPhrase],
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
    movementHistory,
  ]);

  // Finalizar jogo
  const handleGameEnd = useCallback(async () => {
    if (gameEndingRef.current) return;
    gameEndingRef.current = true;
    setSubmitting(true);
    if (activitySessionId) {
      try {
        const session = await api.activitySessions.get(activitySessionId);
        const currentResults = session.results || {
          phrases: [],
          movement_history: {},
        };

        await api.activitySessions.update(activitySessionId, {
          results: currentResults,
          ended_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Erro ao finalizar sessão:', err);
      }
    }
    setSubmitting(false);
    setGameCompleted(true);
  }, [activitySessionId]);

  // Função para reiniciar o jogo
  const restartGame = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setGameStarted(false);
    setGameCompleted(false);
    setSelectedPhrases([]);
    setCurrentPhraseIndex(0);
    setCurrentPhraseWords([]);
    setCorrectOrder([]);
    setIsCorrect(false);
    setActivitySessionId(null);
    setMovementHistory([]);
    hasUpdatedSessionRef.current = false;
    gameEndingRef.current = false;

    try {
      await loadParams();
    } finally {
      setSubmitting(false);
    }
  }, [loadParams, submitting]);

  // Avançar para próxima frase
  const nextPhrase = useCallback(() => {
    if (!isCorrect || submitting) return;

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
  }, [
    isCorrect,
    currentPhraseIndex,
    selectedPhrases,
    handleGameEnd,
    submitting,
  ]);

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
    return <LoadingState message="Carregando atividade..." spinner />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <BackButton onClick={onBack} />
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
            <BackButton onClick={onBack} />
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
            <div className="flex items-center justify-center">
              <button
                onClick={startGame}
                disabled={submitting}
                className="flex items-center justify-center w-20 h-20 rounded-full bg-[#E6A8D7] hover:bg-[#d897c8] text-white shadow-lg transition-all hover:scale-110 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {submitting ? (
                  <svg
                    className="w-8 h-8 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-10 h-10"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isLastPhrase = currentPhraseIndex === selectedPhrases.length - 1;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <BackButton onClick={onBack} />
          <h1 className="text-3xl font-bold text-[#333333] mb-2">
            Desembaralhar Frases
          </h1>
        </div>
      </div>

      {/* Canvas de Jogo */}
      <div className="relative bg-white rounded-lg border-2 border-[#D9D9D9] overflow-hidden min-h-[500px]">
        {/* Área de ordenação com drag and drop */}
        {!gameCompleted && (
          <div className="p-8">
            <div className="mb-6 text-center">
              <div className="text-sm text-[#6E6E6E] mb-2">
                Frase {currentPhraseIndex + 1} de {selectedPhrases.length}
              </div>
            </div>
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
                  className={`px-6 py-4 rounded-lg cursor-move transition-all font-medium text-4xl ${
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

            {/* Botão para próxima frase (só aparece quando correto) */}
            {isCorrect && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={nextPhrase}
                  disabled={submitting}
                  className="px-8 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium text-lg shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <svg
                        className="w-5 h-5 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Salvando...
                    </span>
                  ) : isLastPhrase ? (
                    'Finalizar Atividade'
                  ) : (
                    'Próxima Frase →'
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tela de finalização (overlay) */}
        {gameCompleted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-white/90 backdrop-blur-sm">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#B8E3C0] mb-4">
                <svg
                  className="w-10 h-10 text-[#333333]"
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
              </div>
              <h2 className="text-2xl font-bold text-[#333333] mb-2">
                Atividade Finalizada!
              </h2>
              <p className="text-[#777777] mb-2">
                Você completou {selectedPhrases.length} frases
              </p>
            </div>
            <button
              onClick={restartGame}
              disabled={submitting}
              className="flex items-center justify-center w-20 h-20 rounded-full bg-[#E6A8D7] hover:bg-[#d897c8] text-white shadow-lg transition-all hover:scale-110 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {submitting ? (
                <svg
                  className="w-8 h-8 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-10 h-10"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default UnscramblePhrases;
