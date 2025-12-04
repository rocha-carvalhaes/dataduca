import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import api from '../config/api';

function TypingActivity({ onBack, activityId }) {
  const [characters, setCharacters] = useState([]);
  const [totalBubbles, setTotalBubbles] = useState(0);
  const [speed, setSpeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatedCharacters, setGeneratedCharacters] = useState([]);
  const [bubbles, setBubbles] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [generatedBubbles, setGeneratedBubbles] = useState([]); // Track all bubbles generated in the game
  const [hitBubbles, setHitBubbles] = useState([]); // Track bubbles that the user hit
  const [activitySessionId, setActivitySessionId] = useState(null); // ID da sessão de atividade
  const hitBubblesRef = useRef(new Set()); // Use Set to avoid duplicates
  const intervalRef = useRef(null);
  const animationRef = useRef(null);
  const containerRef = useRef(null);
  const initialTimeRef = useRef({});
  const loadedRef = useRef(false);
  const gameFinishedRef = useRef(false); // Avoid multiple game end events

  // Calculate game status
  const gameStatus = useMemo(() => {
    if (generatedBubbles.length === 0) {
      return 'Não iniciado';
    }

    if (
      generatedBubbles.length > 0 &&
      generatedBubbles.length < totalBubbles &&
      bubbles.length > 0
    ) {
      return 'Em andamento';
    }

    if (generatedBubbles.length === totalBubbles && bubbles.length === 0) {
      return 'Finalizado';
    }

    // Intermediate status (all bubbles were generated but there are still bubbles on screen)
    return 'Em andamento';
  }, [generatedBubbles.length, totalBubbles, bubbles.length]);

  // Function to generate a random character based on available characters
  const generateRandomCharacter = useCallback(() => {
    if (characters.length === 0) {
      return null;
    }
    const randomIndex = Math.floor(Math.random() * characters.length);
    return characters[randomIndex];
  }, [characters]);

  // Function to add a new character to the list and create a bubble
  const addCharacter = useCallback(() => {
    const newCharacter = generateRandomCharacter();
    if (newCharacter !== null) {
      setGeneratedCharacters((prev) => [...prev, newCharacter]);

      // Create a new bubble
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const containerHeight = containerRef.current.offsetHeight;
        const bubbleId = Date.now() + Math.random();

        // Initial position: bottom of container, random x position
        const initialX = Math.random() * (containerWidth - 80) + 40; // 40px margin on each side
        const initialY = containerHeight - 40; // 40px from bottom

        const newBubble = {
          id: bubbleId,
          character: newCharacter,
          x: initialX,
          y: initialY,
          initialX: initialX,
          horizontalOffset: Math.random() * Math.PI, // Random phase for horizontal movement
          generationTime: Date.now(), // Timestamp of when it was generated
        };

        setBubbles((prev) => [...prev, newBubble]);

        // Track generated bubble
        setGeneratedBubbles((prev) => [
          ...prev,
          {
            id: bubbleId,
            character: newCharacter,
            generationTime: newBubble.generationTime,
          },
        ]);

        // Register initial time for this bubble
        initialTimeRef.current[bubbleId] = Date.now();
      }
    }
  }, [generateRandomCharacter]);

  // Function to start the game
  const startGame = useCallback(async () => {
    if (totalBubbles <= 0 || characters.length === 0) return;

    // Criar sessão de atividade no backend
    try {
      const session = await api.activitySessions.create({
        activity_id: activityId,
        results: {}, // Inicialmente vazio, será preenchido no fim
      });
      setActivitySessionId(session.activity_session_id);
    } catch (err) {
      console.error('Erro ao criar sessão de atividade:', err);
      // Continua o jogo mesmo se falhar ao criar a sessão
    }

    setGameStarted(true);
    setBubbles([]);
    setGeneratedCharacters([]);
    setGeneratedBubbles([]); // Reset generated bubbles tracking
    setHitBubbles([]); // Reset hit bubbles tracking
    hitBubblesRef.current = new Set(); // Reset Set of hit IDs
    gameFinishedRef.current = false; // Reset game finished flag
    initialTimeRef.current = {};

    // Generate all bubbles spaced in time based on speed
    for (let i = 0; i < totalBubbles; i++) {
      setTimeout(
        () => {
          addCharacter();
        },
        i * (speed * 1000)
      ); // Space bubbles based on speed
    }
  }, [totalBubbles, characters.length, speed, addCharacter, activityId]);

  // Function to restart the game
  const restartGame = useCallback(() => {
    setGameStarted(false);
    setBubbles([]);
    setGeneratedCharacters([]);
    setGeneratedBubbles([]);
    setHitBubbles([]);
    setActivitySessionId(null); // Reset session ID
    hitBubblesRef.current = new Set();
    gameFinishedRef.current = false;
    initialTimeRef.current = {};

    // Clear intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  // Game end event
  const handleGameEnd = useCallback(async () => {
    // Avoid multiple events
    if (gameFinishedRef.current) return;
    gameFinishedRef.current = true;

    // Prepare game data for backend submission
    const gameData = {
      totalBubbles: totalBubbles,
      generatedBubbles: generatedBubbles.length,
      hitBubbles: hitBubbles.length,
      hitRate:
        generatedBubbles.length > 0
          ? (hitBubbles.length / generatedBubbles.length) * 100
          : 0,
      generatedBubblesDetails: generatedBubbles, // Complete list of all generated bubbles
      hitBubblesDetails: hitBubbles, // Complete list of hit bubbles
      endTimestamp: Date.now(),
    };

    // Log for debug
    if (import.meta.env.DEV) {
      console.log('🎮 Game Finished! Data to save:', gameData);
    }

    // Atualizar sessão de atividade com os resultados
    if (activitySessionId) {
      try {
        await api.activitySessions.update(activitySessionId, {
          results: gameData,
        });
        if (import.meta.env.DEV) {
          console.log('✅ Sessão de atividade atualizada com sucesso');
        }
      } catch (err) {
        console.error('Erro ao atualizar sessão de atividade:', err);
      }
    } else {
      console.warn('⚠️ Nenhuma sessão de atividade encontrada para atualizar');
    }
  }, [totalBubbles, generatedBubbles, hitBubbles, activitySessionId]);

  // Detect when game is finished
  useEffect(() => {
    if (gameStatus === 'Finalizado' && !gameFinishedRef.current) {
      handleGameEnd();
    }
  }, [gameStatus, handleGameEnd]);

  // // Função para remover a primeira ocorrência de um caractere da lista
  // const removerCaractere = (caractere) => {
  //   setCaracteresGerados(prev => {
  //     const indice = prev.findIndex(char => char === caractere)
  //     if (indice !== -1) {
  //       return prev.filter((_, i) => i !== indice)
  //     }
  //     return prev
  //   })
  // }

  // Listener to capture pressed keys
  useEffect(() => {
    const processedBubbles = new Set(); // Local Set to avoid double processing in the same frame

    const handleKeyPress = (event) => {
      const pressedKey = event.key.toLowerCase();
      const timestamp = Date.now();

      // Check if pressed key exists in generated characters list
      setGeneratedCharacters((prev) => {
        const index = prev.findIndex(
          (char) => char.toLowerCase() === pressedKey
        );
        if (index !== -1) {
          // Remove first occurrence
          return prev.filter((_, i) => i !== index);
        }
        return prev;
      });

      // Remove first bubble with corresponding character
      setBubbles((prev) => {
        const index = prev.findIndex(
          (bubble) => bubble.character.toLowerCase() === pressedKey
        );
        if (index !== -1) {
          const removedBubble = prev[index];

          // Create unique key for this event (ID + approximate timestamp)
          const eventKey = `${removedBubble.id}-${Math.floor(timestamp / 100)}`;

          // Check if this event was already processed (avoid StrictMode duplicates)
          if (processedBubbles.has(eventKey)) {
            if (import.meta.env.DEV) {
              console.warn('Duplicate event ignored:', eventKey);
            }
            return prev;
          }
          processedBubbles.add(eventKey);

          // Check if this bubble was already counted (avoid duplicates)
          if (!hitBubblesRef.current.has(removedBubble.id)) {
            // Add to Set first
            hitBubblesRef.current.add(removedBubble.id);

            // Then add to state array
            const newHitBubble = {
              id: removedBubble.id,
              character: removedBubble.character,
              hitTime: timestamp,
              generationTime: removedBubble.generationTime,
            };

            setHitBubbles((prevHit) => {
              // Additional check: ensure no duplicates in array
              const alreadyExists = prevHit.some(
                (b) => b.id === removedBubble.id
              );
              if (alreadyExists) {
                if (import.meta.env.DEV) {
                  console.warn(
                    'Attempt to add duplicate bubble:',
                    removedBubble.id
                  );
                }
                return prevHit;
              }
              return [...prevHit, newHitBubble];
            });
          } else {
            if (import.meta.env.DEV) {
              console.warn('Bubble already counted:', removedBubble.id);
            }
          }

          delete initialTimeRef.current[removedBubble.id];
          return prev.filter((_, i) => i !== index);
        }
        return prev;
      });
    };

    // Add listener only when not loading and no error
    if (!loading && !error) {
      window.addEventListener('keydown', handleKeyPress);
    }

    // Clear listener on unmount or when states change
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [loading, error]);

  // Bubble animation
  useEffect(() => {
    if (!containerRef.current || speed === null || bubbles.length === 0) {
      return;
    }

    const animate = () => {
      const now = Date.now();
      const containerHeight = containerRef.current.offsetHeight;

      setBubbles((prev) => {
        const updatedBubbles = prev
          .map((bubble) => {
            const initialTime = initialTimeRef.current[bubble.id];
            if (!initialTime) return null;

            const lifetime = (now - initialTime) / 1000; // in seconds

            // Vertical movement: rise with speed (speed in pixels per second)
            // Initial y position is at bottom, so we subtract distance traveled
            const verticalDistance = speed * 50 * lifetime; // 50 pixels per speed unit per second
            const newY = containerHeight - 40 - verticalDistance; // 40px from bottom is initial position

            // If bubble already left screen, return null to be filtered
            if (newY < 0) {
              delete initialTimeRef.current[bubble.id];
              // Remove corresponding character from generatedCharacters array
              setGeneratedCharacters((prevChars) => {
                const index = prevChars.findIndex(
                  (char) => char === bubble.character
                );
                if (index !== -1) {
                  return prevChars.filter((_, i) => i !== index);
                }
                return prevChars;
              });
              return null;
            }

            // Horizontal movement: floating using sine
            const amplitude = 30; // horizontal movement amplitude in pixels
            const frequency = 0.3; // movement frequency (cycles per second)
            const offsetX =
              Math.sin(
                bubble.horizontalOffset + lifetime * frequency * Math.PI * 2
              ) * amplitude;
            const newX = bubble.initialX + offsetX;

            return {
              ...bubble,
              x: newX,
              y: newY,
            };
          })
          .filter((bubble) => bubble !== null); // Remove bubbles marked as null

        return updatedBubbles;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [speed, bubbles.length]);

  // Load API parameters
  useEffect(() => {
    // Protection against StrictMode double execution
    if (loadedRef.current) return;
    loadedRef.current = true;

    const loadParams = async () => {
      try {
        const params = await api.activities.getTypingParams(activityId);

        // Validate data received from API
        if (
          !Array.isArray(params?.characters) ||
          params.characters.length === 0
        ) {
          throw new Error('Invalid characters received from API');
        }

        if (typeof params?.speed !== 'number' || params.speed <= 0) {
          throw new Error('Invalid speed received from API');
        }

        if (
          typeof params?.total_bubbles !== 'number' ||
          params.total_bubbles <= 0
        ) {
          throw new Error('Invalid total bubbles received from API');
        }

        setCharacters(params.characters);
        setSpeed(params.speed);
        setTotalBubbles(params.total_bubbles);
        setError(null);

        // Log only in development
        if (import.meta.env.DEV) {
          console.log('Parameters loaded:', params.characters, params.speed);
        }
      } catch (error) {
        // Set error to display in UI
        const errorMessage =
          error.message ||
          'Não foi possível carregar os parâmetros da atividade';
        setError(errorMessage);

        if (import.meta.env.DEV) {
          console.error('Error loading parameters:', error);
        }
      } finally {
        // Always update loading state
        setLoading(false);
      }
    };

    loadParams();
  }, [activityId]);

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
              Digitação com Bolhas
            </h1>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-[#F2B8C6] p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg
                className="w-6 h-6 text-[#F2B8C6]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-[#333333] mb-2">
                Erro ao carregar atividade
              </h3>
              <p className="text-[#777777] mb-4">{error}</p>
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
    );
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
            Digitação com Bolhas
          </h1>
        </div>
      </div>

      {/* Canvas de Bolhas */}
      <div
        ref={containerRef}
        className="relative bg-white rounded-lg border-2 border-[#D9D9D9] overflow-hidden"
        style={{ minHeight: '500px', height: '500px' }}
      >
        {/* Progress Bar - Top Left Corner */}
        {gameStarted && totalBubbles > 0 && (
          <div className="absolute top-4 left-4 z-20">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-[#333333]">
                {hitBubbles.length} / {totalBubbles}
              </span>
            </div>
            <div className="w-32 bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-[#E6A8D7] h-1.5 rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${Math.min((hitBubbles.length / totalBubbles) * 100, 100)}%`,
                }}
              ></div>
            </div>
          </div>
        )}

        {!gameStarted && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <button
              onClick={startGame}
              className="flex items-center justify-center w-20 h-20 rounded-full bg-[#E6A8D7] hover:bg-[#d897c8] text-white shadow-lg transition-all hover:scale-110"
            >
              <svg
                className="w-10 h-10"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
        )}

        {gameStatus === 'Finalizado' && (
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
                Jogo Finalizado!
              </h2>
              <p className="text-[#777777] mb-2">
                Você acertou {hitBubbles.length} de {totalBubbles} bolhas
              </p>
              <p className="text-[#777777]">
                Taxa de acerto:{' '}
                {totalBubbles > 0
                  ? ((hitBubbles.length / totalBubbles) * 100).toFixed(1)
                  : 0}
                %
              </p>
            </div>
            <button
              onClick={restartGame}
              className="flex items-center justify-center w-20 h-20 rounded-full bg-[#E6A8D7] hover:bg-[#d897c8] text-white shadow-lg transition-all hover:scale-110"
            >
              <svg
                className="w-10 h-10"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
              </svg>
            </button>
          </div>
        )}

        {bubbles.map((bubble) => (
          <div
            key={bubble.id}
            className="absolute flex items-center justify-center rounded-full bg-white border-2 border-[#E6A8D7] shadow-lg"
            style={{
              left: `${bubble.x}px`,
              top: `${bubble.y}px`,
              width: '60px',
              height: '60px',
              transform: 'translate(-50%, -50%)',
              willChange: 'transform',
            }}
          >
            <span className="text-2xl font-bold text-[#333333]">
              {bubble.character}
            </span>
          </div>
        ))}
      </div>

      {generatedCharacters.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-[#333333] mb-3">
            Caracteres Gerados ({generatedCharacters.length}):
          </h3>
          <div className="flex flex-wrap gap-2">
            {generatedCharacters.map((char, index) => (
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

      {/* Tracking information (only for debug/development) */}
      {import.meta.env.DEV && gameStarted && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-[#333333] mb-2">
            Rastreamento do Jogo:
          </h3>
          <div className="text-xs text-[#777777] space-y-2">
            <div>
              <p className="font-semibold mb-1">Parâmetros Carregados:</p>
              <p>Total de caracteres: {characters.length}</p>
              <p>Velocidade: {speed}</p>
              <p>Caracteres disponíveis: {characters.join(', ')}</p>
            </div>

            <div>
              <p className="font-semibold mb-1">Status do Jogo:</p>
              <p
                className={`font-bold ${
                  gameStatus === 'Não iniciado'
                    ? 'text-gray-600'
                    : gameStatus === 'Em andamento'
                      ? 'text-blue-600'
                      : 'text-green-600'
                }`}
              >
                {gameStatus}
              </p>
            </div>

            <div>
              <p className="font-semibold">Resumo:</p>
              <p>Bolhas geradas: {generatedBubbles.length}</p>
              <p>Bolhas acertadas: {hitBubbles.length}</p>
              <p>
                Taxa de acerto:{' '}
                {generatedBubbles.length > 0
                  ? (
                      (hitBubbles.length / generatedBubbles.length) *
                      100
                    ).toFixed(1)
                  : 0}
                %
              </p>
            </div>

            <div className="mt-3">
              <p className="font-semibold mb-1">
                Bolhas Acertadas (detalhado):
              </p>
              <div className="max-h-32 overflow-y-auto bg-white p-2 rounded border">
                {hitBubbles.length === 0 ? (
                  <p className="text-gray-400">Nenhuma bolha acertada ainda</p>
                ) : (
                  <div className="space-y-1">
                    {hitBubbles.map((bubble, index) => (
                      <div
                        key={bubble.id || index}
                        className="text-xs border-b pb-1"
                      >
                        <p>
                          ID: {bubble.id?.toString().slice(-6)} | Char:{' '}
                          {bubble.character} | Tempo resposta:{' '}
                          {bubble.generationTime && bubble.hitTime
                            ? (
                                (bubble.hitTime - bubble.generationTime) /
                                1000
                              ).toFixed(2)
                            : 'N/A'}
                          s
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2">
              <p className="font-semibold mb-1">
                IDs únicos no Set: {hitBubblesRef.current?.size || 0}
              </p>
              <p className="text-red-600">
                Array length: {hitBubbles.length} | Set size:{' '}
                {hitBubblesRef.current?.size || 0}
              </p>
              {hitBubbles.length !== (hitBubblesRef.current?.size || 0) && (
                <p className="text-red-600 font-bold">
                  ⚠️ ATENÇÃO: Há duplicatas no array!
                </p>
              )}
              <div className="mt-1 text-xs">
                <p>
                  IDs no Set:{' '}
                  {Array.from(hitBubblesRef.current || [])
                    .join(', ')
                    .slice(0, 100) || 'Nenhum'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TypingActivity;
