import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../config/api';
import { LoadingState, BackButton } from '../components/ui';

function WritingActivity({ onBack, activityId }) {
  const [phrases, setPhrases] = useState([]);
  const [selectedPhrases, setSelectedPhrases] = useState([]);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [phrasesPerSession, setPhrasesPerSession] = useState(3);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [activitySessionId, setActivitySessionId] = useState(null);
  const [typedKeys, setTypedKeys] = useState([]);
  const [allPhraseKeys, setAllPhraseKeys] = useState({});
  const [isComplete, setIsComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);
  const loadedRef = useRef(false);
  const gameEndingRef = useRef(false);

  const phrase = selectedPhrases[currentPhraseIndex] || '';
  const isLastPhrase = currentPhraseIndex === selectedPhrases.length - 1;

  const loadParams = useCallback(async () => {
    try {
      setLoading(true);
      const params = await api.activities.getWritingParams(activityId);

      if (!Array.isArray(params?.phrases) || params.phrases.length === 0) {
        throw new Error('Nenhuma frase disponível');
      }

      setPhrases(params.phrases);
      setPhrasesPerSession(params.phrases_per_session || 3);
      setError(null);
    } catch (err) {
      setError(err.message || 'Erro ao carregar parâmetros');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadParams();
  }, [loadParams]);

  const selectRandomPhrases = useCallback(() => {
    const available = [...phrases];
    const selected = [];
    const count = Math.min(phrasesPerSession, available.length);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * available.length);
      selected.push(available[idx]);
      available.splice(idx, 1);
    }
    return selected;
  }, [phrases, phrasesPerSession]);

  const startGame = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const session = await api.activitySessions.create({
        activity_id: activityId,
        results: { phrases_typed_keys: {} },
      });
      setActivitySessionId(session.activity_session_id);

      const selected = selectRandomPhrases();
      setSelectedPhrases(selected);
      setCurrentPhraseIndex(0);
      setUserInput('');
      setTypedKeys([]);
      setAllPhraseKeys({});
      setIsComplete(false);
      setGameCompleted(false);
      gameEndingRef.current = false;
      setGameStarted(true);

      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 100);
    } catch (err) {
      console.error('Erro ao iniciar jogo:', err);
      setError('Erro ao iniciar atividade');
    } finally {
      setSubmitting(false);
    }
  }, [activityId, submitting, selectRandomPhrases]);

  const isCharCorrect = (index) => {
    if (index >= phrase.length || index >= userInput.length) return false;
    return userInput[index] === phrase[index];
  };

  const getFirstWrongIndex = () => {
    for (let i = 0; i < userInput.length; i++) {
      if (i >= phrase.length || userInput[i] !== phrase[i]) return i;
    }
    return -1;
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    const previousValue = userInput;

    if (newValue.length < previousValue.length) {
      setUserInput(newValue);
      return;
    }

    if (newValue.length > previousValue.length) {
      const addedChars = newValue.slice(previousValue.length);
      addedChars.split('').forEach((char, index) => {
        const charIndex = previousValue.length + index;
        const correct = charIndex < phrase.length && char === phrase[charIndex];
        const charTimestamp = new Date(Date.now() + index).toISOString();
        setTypedKeys((prev) => [
          ...prev,
          { key: char, correct_key: correct, hit_time: charTimestamp },
        ]);
      });
    }

    setUserInput(newValue);

    if (newValue === phrase) {
      setIsComplete(true);
    }
  };

  const handleKeyDown = (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) {
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'a' || e.key === 'c' || e.key === 'v' || e.key === 'x')
      ) {
        return;
      }
      e.preventDefault();
      return;
    }

    if (e.key === 'Backspace') {
      setTypedKeys((prev) => [
        ...prev,
        {
          key: 'Backspace',
          correct_key: false,
          hit_time: new Date().toISOString(),
        },
      ]);
      return;
    }

    if (
      e.key === 'Backspace' ||
      e.key === 'Delete' ||
      e.key.length === 1 ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key === 'Home' ||
      e.key === 'End'
    ) {
      return;
    }

    e.preventDefault();
  };

  const savePhraseProgress = useCallback(async () => {
    if (!activitySessionId) return;
    const updatedKeys = { ...allPhraseKeys, [currentPhraseIndex]: typedKeys };
    setAllPhraseKeys(updatedKeys);
    try {
      await api.activitySessions.update(activitySessionId, {
        results: { phrases_typed_keys: updatedKeys },
      });
    } catch (err) {
      console.error('Erro ao salvar progresso:', err);
    }
  }, [activitySessionId, allPhraseKeys, currentPhraseIndex, typedKeys]);

  const handleNextPhrase = useCallback(async () => {
    if (submitting || !isComplete) return;
    setSubmitting(true);
    await savePhraseProgress();

    const nextIndex = currentPhraseIndex + 1;
    setCurrentPhraseIndex(nextIndex);
    setUserInput('');
    setTypedKeys([]);
    setIsComplete(false);
    setSubmitting(false);

    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 100);
  }, [submitting, isComplete, savePhraseProgress, currentPhraseIndex]);

  const handleGameEnd = useCallback(async () => {
    if (gameEndingRef.current || submitting) return;
    gameEndingRef.current = true;
    setSubmitting(true);

    const updatedKeys = { ...allPhraseKeys, [currentPhraseIndex]: typedKeys };
    if (activitySessionId) {
      try {
        await api.activitySessions.update(activitySessionId, {
          results: { phrases_typed_keys: updatedKeys },
          ended_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Erro ao finalizar sessão:', err);
      }
    }
    setSubmitting(false);
    setGameCompleted(true);
  }, [
    activitySessionId,
    allPhraseKeys,
    currentPhraseIndex,
    typedKeys,
    submitting,
  ]);

  const restartGame = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setGameStarted(false);
    setGameCompleted(false);
    setIsComplete(false);
    setUserInput('');
    setTypedKeys([]);
    setAllPhraseKeys({});
    setActivitySessionId(null);
    setSelectedPhrases([]);
    setCurrentPhraseIndex(0);
    gameEndingRef.current = false;

    try {
      await loadParams();
    } finally {
      setSubmitting(false);
    }
  }, [loadParams, submitting]);

  if (loading) {
    return <LoadingState message="Carregando atividade..." spinner />;
  }

  if (error) {
    return (
      <div className="px-4 pb-4">
        <div className="sticky top-0 z-10 bg-[#F5F6F7] pt-3 pb-2 mb-2 flex items-center justify-between">
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
      <div className="px-4 pb-4">
        <div className="sticky top-0 z-10 bg-[#F5F6F7] pt-3 pb-2 mb-2 flex items-center justify-between">
          <div>
            <BackButton onClick={onBack} />
            <h1 className="text-2xl font-bold text-[#333333]">Escrita</h1>
            <p className="text-sm text-[#777777]">
              Digite as frases exatamente como aparecem
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-[#D9D9D9] p-6 max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <p className="text-lg text-[#333333] mb-4">
              Você terá {Math.min(phrasesPerSession, phrases.length)} frases
              para digitar, incluindo maiúsculas, minúsculas e acentuação.
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

  const firstWrongIndex = getFirstWrongIndex();

  return (
    <div className="px-4 pb-4">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#F5F6F7] pt-3 pb-2 mb-2 flex items-center justify-between">
        <div>
          <BackButton onClick={onBack} />
          <h1 className="text-2xl font-bold text-[#333333]">Escrita</h1>
        </div>
      </div>

      {/* Área de Jogo */}
      <div className="relative bg-white rounded-lg shadow border border-[#D9D9D9] p-6 max-w-4xl mx-auto min-h-[350px]">
        {/* Contador de frases */}
        {!gameCompleted && (
          <div className="text-sm text-[#6E6E6E] mb-3 text-center">
            Frase {currentPhraseIndex + 1} de {selectedPhrases.length}
          </div>
        )}

        {/* Frase de referência */}
        {!gameCompleted && (
          <>
            <div className="mb-5">
              <h3 className="text-base font-medium text-[#333333] mb-3">
                Digite a frase abaixo:
              </h3>
              <div className="bg-gray-50 border-2 border-[#D9D9D9] rounded-lg p-4">
                <p className="text-xl font-medium text-[#333333] text-center">
                  {phrase}
                </p>
              </div>
            </div>

            {/* Campo de digitação */}
            <div>
              <label
                htmlFor="user-typing-input"
                className="block text-sm font-medium text-[#333333] mb-2"
              >
                Sua digitação:
              </label>
              <div className="relative">
                <div
                  className="absolute inset-0 bg-white rounded-lg pointer-events-none"
                  style={{ zIndex: 0 }}
                />

                {userInput.length > 0 && (
                  <div
                    className="absolute top-4 left-4 pointer-events-none text-2xl font-mono whitespace-pre-wrap break-words"
                    style={{
                      color: 'transparent',
                      width: 'calc(100% - 2rem)',
                      height: 'calc(100% - 2rem)',
                      zIndex: 1,
                    }}
                  >
                    {userInput.split('').map((char, index) => {
                      const correct = isCharCorrect(index);
                      const isFirstWrong = index === firstWrongIndex;
                      const showHighlight =
                        firstWrongIndex === -1 || index < firstWrongIndex;

                      let bgColor = 'transparent';
                      if (isFirstWrong) {
                        bgColor = '#F8B4B4';
                      } else if (showHighlight && correct) {
                        bgColor = '#B8E3C0';
                      }

                      return (
                        <span
                          key={index}
                          style={{ backgroundColor: bgColor }}
                        >
                          {char === ' ' ? '\u00A0' : char}
                        </span>
                      );
                    })}
                  </div>
                )}
                <textarea
                  id="user-typing-input"
                  ref={inputRef}
                  value={userInput}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  disabled={isComplete}
                  className="w-full min-h-[100px] p-4 text-2xl font-mono border-2 border-[#D9D9D9] rounded-lg focus:outline-none focus:border-[#E6A8D7] resize-none relative"
                  placeholder="Comece a digitar..."
                  style={{
                    caretColor:
                      firstWrongIndex === -1 ? '#333333' : 'transparent',
                    backgroundColor: 'transparent',
                    zIndex: 2,
                    position: 'relative',
                  }}
                />
              </div>

              {/* Botão Próxima / Finalizar */}
              {isComplete && (
                <div className="flex justify-end mt-3">
                  <button
                    onClick={isLastPhrase ? handleGameEnd : handleNextPhrase}
                    disabled={submitting}
                    className="px-6 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium text-base shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
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
                      'Finalizar'
                    ) : (
                      'Próxima →'
                    )}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Overlay de conclusão final */}
        {gameCompleted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-white/90 backdrop-blur-sm rounded-lg">
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
              <p className="text-[#777777]">
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

export default WritingActivity;
