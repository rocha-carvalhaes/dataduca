import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../config/api';
import { LoadingState, BackButton } from '../components/ui';

function WritingActivity({ onBack, activityId }) {
  const [phrase, setPhrase] = useState('');
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [activitySessionId, setActivitySessionId] = useState(null);
  const [typedKeys, setTypedKeys] = useState([]);
  const [isComplete, setIsComplete] = useState(false);
  const inputRef = useRef(null);
  const loadedRef = useRef(false);

  // Função para carregar parâmetros da API
  const loadParams = useCallback(async () => {
    try {
      setLoading(true);
      const params = await api.activities.getWritingParams(activityId);

      if (!params?.phrase || typeof params.phrase !== 'string') {
        throw new Error('Frase não disponível ou inválida');
      }

      setPhrase(params.phrase);
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

  // Iniciar jogo
  const startGame = useCallback(async () => {
    try {
      // Criar sessão de atividade
      const session = await api.activitySessions.create({
        activity_id: activityId,
        results: {
          typed_keys: [],
        },
      });
      setActivitySessionId(session.activity_session_id);

      // Resetar estados
      setUserInput('');
      setTypedKeys([]);
      setIsComplete(false);
      setGameStarted(true);

      // Focar no input
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    } catch (err) {
      console.error('Erro ao iniciar jogo:', err);
      setError('Erro ao iniciar atividade');
    }
  }, [activityId]);

  // Função para verificar se um caractere está correto
  const isCharCorrect = (index) => {
    if (index >= phrase.length || index >= userInput.length) {
      return false;
    }
    return userInput[index] === phrase[index];
  };

  // Função para encontrar o primeiro caractere errado
  const getFirstWrongIndex = () => {
    for (let i = 0; i < userInput.length; i++) {
      if (i >= phrase.length || userInput[i] !== phrase[i]) {
        return i;
      }
    }
    return -1; // Todos estão corretos até agora
  };

  // Handler para mudanças no input
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    const previousValue = userInput;

    // Se o usuário está deletando (backspace já foi tratado no onKeyDown)
    if (newValue.length < previousValue.length) {
      setUserInput(newValue);
      return;
    }

    // Se o usuário está adicionando caracteres
    if (newValue.length > previousValue.length) {
      const addedChars = newValue.slice(previousValue.length);
      // Adicionar cada caractere aos typed_keys
      addedChars.split('').forEach((char, index) => {
        const charIndex = previousValue.length + index;
        const isCorrect =
          charIndex < phrase.length && char === phrase[charIndex];
        // Usar timestamp com pequeno incremento para manter ordem e garantir unicidade
        const charTimestamp = new Date(Date.now() + index).toISOString();

        setTypedKeys((prev) => [
          ...prev,
          {
            key: char,
            correct_key: isCorrect,
            hit_time: charTimestamp,
          },
        ]);
      });
    }

    setUserInput(newValue);

    // Verificar se completou
    if (newValue === phrase) {
      setIsComplete(true);
      // Aguardar um pouco antes de finalizar para garantir que todos os timestamps foram salvos
      setTimeout(() => {
        handleGameEnd();
      }, 100);
    }
  };

  // Handler para teclas especiais (evitar comportamento padrão)
  const handleKeyDown = (e) => {
    // Bloquear outras teclas especiais (Ctrl, Alt, etc.) exceto as permitidas
    if (e.ctrlKey || e.altKey || e.metaKey) {
      // Permitir Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'a' || e.key === 'c' || e.key === 'v' || e.key === 'x')
      ) {
        return; // Permitir atalhos de edição
      }
      e.preventDefault();
      return;
    }

    // Rastrear backspace individualmente
    if (e.key === 'Backspace') {
      const timestamp = new Date().toISOString();
      setTypedKeys((prev) => [
        ...prev,
        {
          key: 'Backspace',
          correct_key: false,
          hit_time: timestamp,
        },
      ]);
      return; // Permitir comportamento padrão
    }

    // Permitir apenas backspace, delete e caracteres normais
    if (
      e.key === 'Backspace' ||
      e.key === 'Delete' ||
      e.key.length === 1 ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight' ||
      e.key === 'Home' ||
      e.key === 'End'
    ) {
      return; // Permitir comportamento padrão
    }

    // Bloquear outras teclas
    e.preventDefault();
  };

  // Finalizar jogo
  const handleGameEnd = useCallback(async () => {
    if (activitySessionId) {
      try {
        // Atualizar sessão com resultados finais e data de término
        await api.activitySessions.update(activitySessionId, {
          results: {
            typed_keys: typedKeys,
          },
          ended_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Erro ao finalizar sessão:', err);
      }
    }
  }, [activitySessionId, typedKeys]);

  // Função para reiniciar o jogo
  const restartGame = useCallback(async () => {
    // Resetar todos os estados do jogo
    setGameStarted(false);
    setIsComplete(false);
    setUserInput('');
    setTypedKeys([]);
    setActivitySessionId(null);

    // Recarregar parâmetros para pegar possíveis mudanças de nível
    await loadParams();
  }, [loadParams]);

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
            <h1 className="text-3xl font-bold text-[#333333] mb-2">Escrita</h1>
            <p className="text-[#777777]">
              Digite a frase exatamente como aparece acima
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-[#D9D9D9] p-6 max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <p className="text-lg text-[#333333] mb-4">
              Você precisará digitar a frase exatamente como mostrada, incluindo
              maiúsculas, minúsculas e acentuação.
            </p>
            <div className="flex items-center justify-center">
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
          </div>
        </div>
      </div>
    );
  }

  const firstWrongIndex = getFirstWrongIndex();

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <BackButton onClick={onBack} />
          <h1 className="text-3xl font-bold text-[#333333] mb-2">Escrita</h1>
        </div>
      </div>

      {/* Área de Jogo */}
      <div className="bg-white rounded-lg shadow border border-[#D9D9D9] p-8 max-w-4xl mx-auto">
        {/* Frase de referência */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-[#333333] mb-4">
            Digite a frase abaixo:
          </h3>
          <div className="bg-gray-50 border-2 border-[#D9D9D9] rounded-lg p-6">
            <p className="text-2xl font-medium text-[#333333] text-center">
              {phrase}
            </p>
          </div>
        </div>

        {/* Campo de digitação */}
        <div className="mb-6">
          <label
            htmlFor="user-typing-input"
            className="block text-sm font-medium text-[#333333] mb-2"
          >
            Sua digitação:
          </label>
          <div className="relative">
            {/* Fundo branco atrás */}
            <div
              className="absolute inset-0 bg-white rounded-lg pointer-events-none"
              style={{ zIndex: 0 }}
            />

            {/* Overlay para destacar caracteres corretos (atrás do texto) */}
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
                  const isCorrect = isCharCorrect(index);
                  const showHighlight =
                    firstWrongIndex === -1 || index < firstWrongIndex;

                  return (
                    <span
                      key={index}
                      style={{
                        backgroundColor:
                          showHighlight && isCorrect
                            ? '#B8E3C0'
                            : 'transparent',
                      }}
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
              className="w-full min-h-[120px] p-4 text-2xl font-mono border-2 border-[#D9D9D9] rounded-lg focus:outline-none focus:border-[#E6A8D7] resize-none relative"
              placeholder="Comece a digitar..."
              style={{
                caretColor: firstWrongIndex === -1 ? '#333333' : 'transparent',
                backgroundColor: 'transparent',
                zIndex: 2,
                position: 'relative',
              }}
            />
          </div>
        </div>

        {/* Mensagem de sucesso */}
        {isComplete && (
          <div className="mb-6 text-center">
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
                Parabéns! Você completou a frase corretamente!
              </span>
            </div>
          </div>
        )}

        {/* Botão de reiniciar */}
        {isComplete && (
          <div className="flex justify-center">
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
      </div>
    </div>
  );
}

export default WritingActivity;
