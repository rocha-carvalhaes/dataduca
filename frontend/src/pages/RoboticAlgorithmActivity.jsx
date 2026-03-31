import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import api from '../config/api';
import { LoadingState, BackButton } from '../components/ui';
import { CMD, PALETTE, runProgram, sleep } from '../utils/roboticAlgorithm';

const DIR_ICONS = ['⬆️', '➡️', '⬇️', '⬅️'];

function RoboticAlgorithmActivity({
  onBack,
  activityId,
  onQuestActivityFinished,
  allowReplayAfterComplete = true,
}) {
  const [params, setParams] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activitySessionId, setActivitySessionId] = useState(null);
  const [sessionResults, setSessionResults] = useState(null);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [program, setProgram] = useState([]);
  const [robot, setRobot] = useState({ x: 0, y: 0, direction: 0 });
  const [collectedStars, setCollectedStars] = useState(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const [banner, setBanner] = useState(null);
  const [roundComplete, setRoundComplete] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [dragFromPalette, setDragFromPalette] = useState(null);

  const loadedRef = useRef(false);
  /** Espelho síncrono de sessionResults para o PUT final (evita estado desatualizado). */
  const sessionResultsRef = useRef(null);
  const gridAreaRef = useRef(null);
  const [gridAreaSize, setGridAreaSize] = useState({ w: 0, h: 0 });
  const loadParams = useCallback(async () => {
    try {
      setLoading(true);
      const p = await api.activities.getRoboticAlgorithmParams(activityId);
      if (!p?.scenarios?.length) {
        throw new Error('Nenhum cenário disponível para esta atividade');
      }
      setParams(p);
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

  const roundsTotal = sessionResults?.rounds_total ?? params?.rounds_total ?? 3;

  const currentScenario = (() => {
    if (!params?.scenarios?.length) return null;
    const si = sessionResults?.rounds?.[currentRoundIndex]?.scenario_index ?? 0;
    return params.scenarios[si] || params.scenarios[0];
  })();

  const resetRobotFromScenario = useCallback((scenario) => {
    if (!scenario) return;
    const rs = scenario.robot_start || scenario.robotStart || {};
    setRobot({
      x: Number(rs.x ?? 0),
      y: Number(rs.y ?? 0),
      direction: Number(rs.direction ?? 0) % 4,
    });
    setCollectedStars(new Set());
  }, []);

  useEffect(() => {
    if (currentScenario && gameStarted) {
      resetRobotFromScenario(currentScenario);
    }
  }, [currentScenario, gameStarted, resetRobotFromScenario]);

  const startGame = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const session = await api.activitySessions.create({
        activity_id: activityId,
        results: {},
      });
      setActivitySessionId(session.activity_session_id);
      setSessionResults(session.results);
      sessionResultsRef.current = session.results ?? null;
      setCurrentRoundIndex(0);
      setProgram([]);
      setRoundComplete(false);
      setSessionComplete(false);
      setBanner(null);
      setGameStarted(true);
    } catch (err) {
      setError(err.message || 'Erro ao iniciar sessão');
    } finally {
      setSubmitting(false);
    }
  }, [activityId, submitting]);

  const persistAttempt = async (attempt) => {
    if (!activitySessionId) return;
    const prev = sessionResultsRef.current || sessionResults || {};
    const rounds = [...(prev.rounds || [])];
    while (rounds.length <= currentRoundIndex) {
      rounds.push({ scenario_index: 0, attempts: [] });
    }
    const r = { ...rounds[currentRoundIndex] };
    r.attempts = [...(r.attempts || []), attempt];
    rounds[currentRoundIndex] = r;
    const next = {
      ...prev,
      json_format_version: 1,
      rounds,
      current_round: currentRoundIndex + 1,
      rounds_total: roundsTotal,
    };
    sessionResultsRef.current = next;
    setSessionResults(next);
  };

  const finalizeSession = async () => {
    if (!activitySessionId) return;
    const merged = sessionResultsRef.current || sessionResults || {};
    const next = {
      ...merged,
      json_format_version: 1,
      rounds_total: roundsTotal,
      current_round:
        merged.rounds?.length ?? merged.current_round ?? roundsTotal,
    };
    await api.activitySessions.update(activitySessionId, {
      results: next,
      ended_at: new Date().toISOString(),
    });
    setSessionComplete(true);
    if (onQuestActivityFinished) {
      try {
        await onQuestActivityFinished();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleRun = async () => {
    if (!currentScenario || program.length === 0 || isRunning) return;
    const startedAt = new Date().toISOString();
    setIsRunning(true);
    setBanner(null);

    const scenario = currentScenario;
    const rs = scenario.robot_start || scenario.robotStart || {};
    let x = Number(rs.x ?? 0);
    let y = Number(rs.y ?? 0);
    let direction = Number(rs.direction ?? 0) % 4;
    const gridSize = Number(scenario.grid_size || 3);
    const starsRaw = scenario.stars || [];
    let starsLeft = new Set(starsRaw.map((s) => `${s.x},${s.y}`));
    const obstacles = scenario.obstacles || [];
    const obsSet = new Set(obstacles.map((o) => `${o.x},${o.y}`));

    setRobot({ x, y, direction });
    setCollectedStars(new Set());

    let failed = false;

    for (const raw of program) {
      const c = String(raw).trim().toLowerCase();
      const cmd =
        Object.values(CMD).find((v) => v === c) ||
        (c === 'forward' ? CMD.WALK : null);
      if (!cmd) continue;

      if (cmd === CMD.LEFT) {
        direction = (direction + 3) % 4;
      } else if (cmd === CMD.RIGHT) {
        direction = (direction + 1) % 4;
      } else if (cmd === CMD.WALK) {
        let nx = x;
        let ny = y;
        if (direction === 0) ny -= 1;
        else if (direction === 1) nx += 1;
        else if (direction === 2) ny += 1;
        else nx -= 1;
        if (nx < 0 || nx >= gridSize || ny < 0 || ny >= gridSize) {
          failed = true;
          break;
        }
        if (obsSet.has(`${nx},${ny}`)) {
          failed = true;
          break;
        }
        x = nx;
        y = ny;
      } else if (cmd === CMD.COLLECT) {
        const key = `${x},${y}`;
        if (starsLeft.has(key)) {
          starsLeft.delete(key);
        }
      }
      setRobot({ x, y, direction });
      setCollectedStars(
        new Set(
          starsRaw
            .filter((s) => !starsLeft.has(`${s.x},${s.y}`))
            .map((s) => `${s.x},${s.y}`)
        )
      );
      await sleep(320);
    }

    const success = !failed && starsLeft.size === 0;
    const endedAt = new Date().toISOString();
    const { events: ev2 } = runProgram(program, scenario);
    setIsRunning(false);

    await persistAttempt({
      started_at: startedAt,
      ended_at: endedAt,
      success,
      final_program: [...program],
      events: ev2,
    });

    if (success) {
      setBanner({ type: 'success', text: 'Rodada concluída com sucesso!' });
      setRoundComplete(true);
    } else {
      setBanner({
        type: 'error',
        text: 'Tente outra sequência de comandos.',
      });
    }
    resetRobotFromScenario(currentScenario);
  };

  const clearProgram = () => {
    setProgram([]);
    setBanner(null);
  };

  const resetRound = () => {
    clearProgram();
    setRoundComplete(false);
    resetRobotFromScenario(currentScenario);
    setBanner(null);
  };

  const goNextRound = () => {
    if (currentRoundIndex + 1 >= roundsTotal) {
      finalizeSession();
      return;
    }
    setCurrentRoundIndex((i) => i + 1);
    setProgram([]);
    setRoundComplete(false);
    setBanner(null);
  };

  const restartGame = async () => {
    setGameStarted(false);
    setActivitySessionId(null);
    setSessionResults(null);
    sessionResultsRef.current = null;
    setProgram([]);
    setSessionComplete(false);
    setRoundComplete(false);
    setBanner(null);
    await loadParams();
  };

  const handleDragStartPalette = (e, cmdId) => {
    setDragFromPalette(cmdId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragStartProgram = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = draggedIndex != null ? 'move' : 'copy';
    setDragOverIndex(index);
  };

  const handleDropOnProgram = (e, targetIndex) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragFromPalette) {
      setProgram((p) => {
        const next = [...p];
        next.splice(targetIndex, 0, dragFromPalette);
        return next;
      });
      setDragFromPalette(null);
    } else if (draggedIndex != null && draggedIndex !== targetIndex) {
      setProgram((p) => {
        const next = [...p];
        const [item] = next.splice(draggedIndex, 1);
        next.splice(targetIndex, 0, item);
        return next;
      });
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  /** Soltar na área do editor sem tocar numa linha: anexa ao fim (linhas usam stopPropagation). */
  const handleDropOnProgramAreaBackground = (e) => {
    e.preventDefault();
    if (e.target.closest('[data-program-block]')) return;
    if (dragFromPalette) {
      setProgram((p) => [...p, dragFromPalette]);
      setDragFromPalette(null);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const removeAt = (index) => {
    setProgram((p) => p.filter((_, i) => i !== index));
  };

  const gridSize = currentScenario ? Number(currentScenario.grid_size || 3) : 3;
  const stars = currentScenario?.stars || [];
  const obstacleSet = new Set(
    (currentScenario?.obstacles || []).map((o) => `${o.x},${o.y}`)
  );
  const cellPx = useMemo(() => {
    const gapPx = 2;
    const padPx = 4;
    /** Teto por célula: grelhas pequenas (ex. 3×3) não ficam com quadrados enormes. */
    const maxCellForGrid =
      gridSize <= 3
        ? 46
        : gridSize <= 4
          ? 42
          : gridSize <= 5
            ? 38
            : gridSize <= 7
              ? 34
              : 29;
    const { w, h } = gridAreaSize;
    const side = w > 0 && h > 0 ? Math.min(w, h) : 0;
    if (side > 0 && gridSize > 0) {
      const raw = Math.floor(
        (side - 2 * padPx - (gridSize - 1) * gapPx) / gridSize
      );
      return Math.max(14, Math.min(raw, maxCellForGrid));
    }
    return Math.max(
      14,
      Math.min(gridSize <= 5 ? 52 : gridSize <= 7 ? 42 : 34, maxCellForGrid)
    );
  }, [gridAreaSize, gridSize]);

  useLayoutEffect(() => {
    const el = gridAreaRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setGridAreaSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [gridSize, currentRoundIndex, gameStarted, sessionComplete]);

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
      <div className="px-3 pb-4 max-h-[100dvh] overflow-auto">
        <div className="sticky top-0 z-10 bg-[#F5F6F7] pt-3 pb-2 mb-2 flex items-center justify-between gap-2">
          <BackButton onClick={onBack} />
          <span className="text-2xl" aria-hidden>
            🤖
          </span>
        </div>
        <div className="bg-white rounded-lg shadow border border-[#D9D9D9] p-4 max-w-lg mx-auto">
          <h1 className="text-xl font-bold text-[#333333] mb-1">
            Algoritmo robótico
          </h1>
          <p className="text-sm text-[#666666] mb-4">
            Arraste blocos para o programa, execute e recolha todas as estrelas.
            {roundsTotal} rodadas por sessão.
          </p>
          <button
            type="button"
            onClick={startGame}
            disabled={submitting}
            className="w-full py-3 rounded-lg bg-[#E6A8D7] hover:bg-[#d897c8] text-white font-semibold disabled:opacity-50"
          >
            {submitting ? 'A iniciar…' : 'Começar'}
          </button>
        </div>
      </div>
    );
  }

  if (sessionComplete) {
    return (
      <div className="px-3 pb-4">
        <div className="sticky top-0 z-10 bg-[#F5F6F7] pt-3 pb-2 mb-2">
          <BackButton onClick={onBack} />
        </div>
        <div className="bg-white rounded-lg shadow border border-[#D9D9D9] p-6 max-w-md mx-auto text-center">
          <div className="text-4xl mb-2">🤖</div>
          <h2 className="text-xl font-bold text-[#333333] mb-2">
            Sessão concluída
          </h2>
          <p className="text-[#666666] text-sm mb-4">
            Completou as {roundsTotal} rodadas.
          </p>
          {allowReplayAfterComplete && (
            <button
              type="button"
              onClick={restartGame}
              className="px-4 py-2 rounded-lg bg-[#E6A8D7] text-white font-medium"
            >
              Jogar novamente
            </button>
          )}
        </div>
      </div>
    );
  }

  const block3dPalette =
    'border border-slate-800/80 bg-gradient-to-b from-slate-600 to-slate-800 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_3px_6px_rgba(0,0,0,0.25)]';
  const block3dProgram =
    'border border-slate-300/90 bg-gradient-to-b from-slate-100 to-[#d8e0ea] text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_2px_4px_rgba(15,23,42,0.12)]';

  return (
    <div className="px-2 pb-3 min-h-[min(87dvh,100dvh)] max-h-[100dvh] overflow-hidden flex flex-col">
      <div className="shrink-0 sticky top-0 z-10 bg-[#F5F6F7] pt-2 pb-1 flex items-center">
        <BackButton onClick={onBack} />
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2 lg:gap-3">
        <div className="shrink-0 w-full lg:basis-[232px] lg:min-w-[220px] lg:max-w-[268px] flex flex-col min-h-0 lg:min-h-0 lg:self-stretch border border-slate-300/80 rounded-lg bg-[#f4f4f5] p-2.5 font-mono text-sm">
          <div className="text-[11px] uppercase tracking-wide text-slate-600 font-semibold shrink-0">
            Blocos
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            {PALETTE.map((b) => (
              <div
                key={b.id}
                draggable
                onDragStart={(e) => handleDragStartPalette(e, b.id)}
                className={`cursor-grab active:cursor-grabbing flex items-center gap-2 px-2.5 py-2 rounded-md text-sm select-none ${block3dPalette}`}
              >
                <span className="text-xl leading-none">{b.icon}</span>
                <span>{b.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-auto flex flex-col gap-2 pt-3 border-t border-slate-300/60 shrink-0">
            <button
              type="button"
              disabled={isRunning}
              onClick={handleRun}
              className="w-full py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm disabled:opacity-40"
            >
              Executar
            </button>
            <button
              type="button"
              disabled={isRunning}
              onClick={clearProgram}
              className="w-full py-2.5 rounded-md bg-pink-500 hover:bg-pink-600 text-white text-sm font-semibold shadow-sm disabled:opacity-40"
            >
              Limpar
            </button>
            <button
              type="button"
              disabled={isRunning}
              onClick={resetRound}
              className="w-full py-2.5 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-200/80 text-sm font-semibold disabled:opacity-40"
            >
              Reiniciar
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col min-w-0 lg:flex-[0.68] lg:max-w-[min(100%,480px)] border border-slate-300/80 rounded-lg bg-white p-2 shadow-sm">
          <div className="text-[11px] uppercase tracking-wide text-slate-600 font-semibold mb-1 shrink-0">
            Programa
          </div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect =
                draggedIndex != null ? 'move' : 'copy';
            }}
            onDrop={handleDropOnProgramAreaBackground}
            className="program-drop-area flex-1 min-h-0 overflow-y-auto border border-dashed border-slate-400 rounded-md bg-slate-50/90 p-2"
          >
            {program.length === 0 && (
              <p className="text-sm text-slate-500 px-1 py-4 text-center">
                Arraste blocos para aqui ou para uma linha abaixo
              </p>
            )}
            {program.map((cmd, index) => (
              <div
                key={`${index}-${cmd}`}
                data-program-block
                draggable
                onDragStart={(e) => handleDragStartProgram(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDropOnProgram(e, index)}
                className={`relative flex items-center gap-2 px-2.5 py-2 mb-2 rounded-md text-sm cursor-grab last:mb-0 ${block3dProgram} ${
                  dragOverIndex === index
                    ? 'ring-2 ring-blue-400 ring-offset-1'
                    : ''
                }`}
              >
                <span className="text-lg leading-none">
                  {PALETTE.find((p) => p.id === cmd)?.icon ?? '•'}
                </span>
                <span className="flex-1">
                  {PALETTE.find((p) => p.id === cmd)?.label ?? cmd}
                </span>
                <button
                  type="button"
                  className="shrink-0 text-xs leading-none w-6 h-6 rounded-full bg-rose-500 text-white shadow-sm hover:bg-rose-600"
                  onClick={() => removeAt(index)}
                  aria-label="Remover"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col min-w-0 overflow-hidden border border-[#D9D9D9] rounded-lg bg-white p-2 shadow-sm lg:flex-[1.32]">
          {currentScenario && (
            <>
              <div className="mb-2 grid w-full shrink-0 grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] items-center gap-1 px-1 pt-1">
                <div aria-hidden className="min-w-0" />
                <p className="min-w-0 text-center text-sm font-semibold uppercase tracking-[0.14em] text-slate-700 sm:text-base">
                  Colete as Estrelas
                </p>
                <div className="flex justify-end">
                  <span
                    className="text-5xl leading-none select-none"
                    aria-hidden
                  >
                    🤖
                  </span>
                </div>
              </div>
              <div
                ref={gridAreaRef}
                className="flex min-h-0 w-full min-w-0 flex-1 items-center justify-center"
              >
                <div
                  className="inline-grid gap-0.5 bg-[#dddddd] p-0.5 rounded"
                  style={{
                    gridTemplateColumns: `repeat(${gridSize}, ${cellPx}px)`,
                  }}
                >
                  {Array.from({ length: gridSize * gridSize }).map((_, i) => {
                    const x = i % gridSize;
                    const y = Math.floor(i / gridSize);
                    const starHere = stars.some((s) => s.x === x && s.y === y);
                    const hasStarLeft =
                      starHere && !collectedStars.has(`${x},${y}`);
                    const robotHere = robot.x === x && robot.y === y;
                    const isObs = obstacleSet.has(`${x},${y}`);
                    return (
                      <div
                        key={`${x}-${y}`}
                        className={`flex items-center justify-center rounded-sm border border-white/30 ${
                          isObs ? 'bg-[#6c757d]' : 'bg-[#f8f9fa]'
                        }`}
                        style={{
                          width: cellPx,
                          height: cellPx,
                          fontSize: Math.max(14, cellPx * 0.48),
                        }}
                      >
                        {isObs ? (
                          <span className="text-[1.15em]">🧱</span>
                        ) : robotHere ? (
                          <span className="text-[1.1em]">
                            {DIR_ICONS[robot.direction]}
                          </span>
                        ) : hasStarLeft ? (
                          <span className="text-[1.1em]">⭐</span>
                        ) : (
                          <span className="opacity-20">·</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {banner && (
        <div
          className={`mt-2 text-center text-sm px-2 py-2 rounded-md ${
            banner.type === 'success'
              ? 'bg-green-100 text-green-900 border border-green-300'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {banner.text}
        </div>
      )}

      {roundComplete && (
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={goNextRound}
            className="px-4 py-2 rounded-lg bg-[#E6A8D7] text-white font-medium text-sm"
          >
            {currentRoundIndex + 1 >= roundsTotal
              ? 'Finalizar sessão'
              : 'Continuar'}
          </button>
        </div>
      )}
    </div>
  );
}

export default RoboticAlgorithmActivity;
