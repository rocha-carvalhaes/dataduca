import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../config/api';
import { LoadingState, BackButton, ErrorAlert } from '../components/ui';

const ASCII_SYMBOLS = new Set('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~');

function classifyChar(ch) {
  if (!ch || ch.length !== 1) return null;
  if (ch === ' ') return 'space';
  if (ch >= 'A' && ch <= 'Z') return 'upper';
  if (ch >= 'a' && ch <= 'z') return 'lower';
  if (ch >= '0' && ch <= '9') return 'number';
  if (ASCII_SYMBOLS.has(ch)) return 'symbol';
  return null;
}

function countChar(s, ch) {
  let n = 0;
  for (const c of s) if (c === ch) n += 1;
  return n;
}

function EyeToggleButton({ visible, onToggle, disabled }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6E6E6E] hover:text-[#333333] focus:outline-none focus:ring-2 focus:ring-[#E6A8D7] rounded"
      disabled={disabled}
      aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
    >
      {visible ? (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
          />
        </svg>
      ) : (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
      )}
    </button>
  );
}

function StrongPasswordActivity({
  onBack,
  activityId,
  onQuestActivityFinished,
  allowReplayAfterComplete = true,
}) {
  const [params, setParams] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [activitySessionId, setActivitySessionId] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [testMessage, setTestMessage] = useState(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const [roundsTotal, setRoundsTotal] = useState(1);
  const [currentRound, setCurrentRound] = useState(1);
  const [roundsSummary, setRoundsSummary] = useState([]);

  const eventsRef = useRef([]);
  const accumulatedEventsRef = useRef([]);
  const firstKeydownMsRef = useRef(null);
  const lastKeydownMsRef = useRef(null);
  const loadedRef = useRef(false);

  const recordPrimaryKeydown = useCallback(() => {
    const t = Date.now();
    if (firstKeydownMsRef.current === null) firstKeydownMsRef.current = t;
    lastKeydownMsRef.current = t;
  }, []);

  const pushEvent = useCallback(
    (ev) => {
      eventsRef.current = [
        ...eventsRef.current,
        { ...ev, round: currentRound },
      ];
    },
    [currentRound]
  );

  const onPrimaryChange = useCallback(
    (e) => {
      const neu = e.target.value;
      const old = password;
      if (neu.length > old.length) {
        let i = 0;
        while (i < old.length && old[i] === neu[i]) i += 1;
        const ch = neu[i];
        if (ch === undefined) {
          setPassword(neu);
          return;
        }
        const cat = classifyChar(ch);
        if (!cat) {
          setPassword(neu);
          return;
        }
        const before = countChar(old, ch);
        const unique = before === 0;
        pushEvent({
          type: 'insertion',
          category: cat,
          unique,
          at: new Date().toISOString(),
        });
      } else if (neu.length < old.length) {
        let i = 0;
        while (i < neu.length && old[i] === neu[i]) i += 1;
        const removed = old[i];
        if (removed === undefined) {
          setPassword(neu);
          return;
        }
        const cat = classifyChar(removed);
        if (cat) {
          pushEvent({
            type: 'delete',
            category: cat,
            unique: false,
            at: new Date().toISOString(),
          });
        }
      }
      setPassword(neu);
    },
    [password, pushEvent]
  );

  const resetLocalState = useCallback(() => {
    setPassword('');
    setConfirmPassword('');
    setAttempts(0);
    setTestMessage(null);
    setDone(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setChallenge(null);
    setRoundsTotal(1);
    setCurrentRound(1);
    setRoundsSummary([]);
    eventsRef.current = [];
    accumulatedEventsRef.current = [];
    firstKeydownMsRef.current = null;
    lastKeydownMsRef.current = null;
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const p = await api.activities.getSenhaForteParams(activityId);
      setParams(p);
      const session = await api.activitySessions.create({
        activity_id: activityId,
        results: {},
      });
      setActivitySessionId(session.activity_session_id);
      const sr = session.results || {};
      setChallenge(sr.challenge ?? null);
      const rt = Math.max(1, Number(sr.rounds_total ?? p.rounds_total ?? 1));
      setRoundsTotal(rt);
      setCurrentRound(1);
      setRoundsSummary([]);
      accumulatedEventsRef.current = [];
      setError(null);
    } catch (err) {
      setError(err.message || 'Erro ao carregar atividade');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    load();
  }, [load]);

  const handleRestart = async () => {
    resetLocalState();
    await load();
  };

  const handleTest = async () => {
    setTestMessage(null);
    setSubmitting(true);
    const nextAttempt = attempts + 1;
    setAttempts(nextAttempt);
    const finalRound = roundsTotal <= 1 || currentRound === roundsTotal;
    try {
      const res = await api.activities.validateSenhaForte({
        activity_id: activityId,
        activity_session_id: activitySessionId,
        round: currentRound,
        password,
        password_confirm:
          params?.require_password_confirmation && finalRound
            ? confirmPassword
            : undefined,
      });
      if (!res.valid) {
        setTestMessage(res.message || 'Senha não cumpre as regras.');
        return;
      }
      const firstMs = firstKeydownMsRef.current;
      const lastMs = lastKeydownMsRef.current;
      let durationMs = 0;
      if (firstMs != null && lastMs != null)
        durationMs = Math.max(0, lastMs - firstMs);

      const summaryRow = {
        round: currentRound,
        duration_primary_field_keydown_ms: durationMs,
      };
      const mergedEvents = [
        ...accumulatedEventsRef.current,
        ...eventsRef.current.map((e) =>
          typeof e === 'object' && e !== null && !Array.isArray(e)
            ? { ...e, round: currentRound }
            : e
        ),
      ];

      if (roundsTotal > 1 && currentRound < roundsTotal) {
        accumulatedEventsRef.current = mergedEvents;
        setRoundsSummary((prev) => [...prev, summaryRow]);
        setTestMessage(
          `Rodada ${currentRound} concluída. Avance para a rodada ${currentRound + 1}.`
        );
        setCurrentRound((r) => r + 1);
        setPassword('');
        setConfirmPassword('');
        setShowPassword(false);
        setShowConfirmPassword(false);
        eventsRef.current = [];
        firstKeydownMsRef.current = null;
        lastKeydownMsRef.current = null;
        return;
      }

      let totalDuration = durationMs;
      if (roundsSummary.length > 0) {
        totalDuration =
          roundsSummary.reduce(
            (acc, row) => acc + (row.duration_primary_field_keydown_ms || 0),
            0
          ) + durationMs;
      }

      const basePayload = {
        validation_passed: true,
        attempts_in_session: nextAttempt,
        duration_primary_field_keydown_ms: totalDuration,
        events: mergedEvents,
        _password: password,
        _confirm:
          params?.require_password_confirmation && finalRound
            ? confirmPassword
            : '',
      };

      await api.activitySessions.update(activitySessionId, {
        results:
          roundsTotal > 1
            ? {
                ...basePayload,
                senha_forte_version: 2,
                rounds_completed: roundsTotal,
                current_round: roundsTotal,
                rounds_summary: [...roundsSummary, summaryRow],
                challenge,
              }
            : basePayload,
        ended_at: new Date().toISOString(),
      });
      setDone(true);
      setTestMessage('Senha aceite.');
      if (onQuestActivityFinished) onQuestActivityFinished();
    } catch (err) {
      setTestMessage(err.message || 'Erro ao validar');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !params) {
    return (
      <div className="p-6">
        <BackButton onClick={onBack} />
        <LoadingState message="Carregando…" />
      </div>
    );
  }

  const req = [];
  req.push(`${params.min_length}+ caracteres`);
  if (params.require_uppercase) req.push('Maiúscula (A–Z)');
  if (params.require_lowercase) req.push('Minúscula (a–z)');
  if (params.require_digit) req.push('Número');
  if (params.require_symbol) req.push('Símbolo permitido');
  const showConfirmField =
    params.require_password_confirmation &&
    (roundsTotal <= 1 || currentRound === roundsTotal);
  if (params.require_password_confirmation && roundsTotal <= 1) {
    req.push('Confirmação igual');
  }
  if (params.require_password_confirmation && roundsTotal > 1) {
    req.push('Confirmação igual (última rodada)');
  }

  return (
    <div className="p-6 max-w-lg mx-auto relative">
      <div className="mb-6 flex items-center gap-4">
        <BackButton onClick={onBack} />
        <h1 className="text-2xl font-bold text-[#333333]">Senha forte</h1>
      </div>
      <ErrorAlert message={error} />
      {params.using_defaults && (
        <div
          className="mb-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3"
          role="status"
        >
          Ainda não tem parâmetros de nível atribuídos a si para esta atividade:
          as regras abaixo são genéricas e a validação pode falhar até um
          professor associar o nível (ou após «Reavaliar Níveis» em Gerenciar).
        </div>
      )}
      <p className="text-sm text-[#666666] mb-4">
        Invente uma senha fictícia que cumpra as regras. Use «Testar senha»
        quando estiver pronto.
      </p>
      <ul className="text-sm text-[#555555] mb-4 list-disc pl-5 space-y-1">
        {req.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {roundsTotal > 1 && (
        <p className="text-sm font-semibold text-[#333333] mb-2">
          Rodada {currentRound} de {roundsTotal}
        </p>
      )}
      {challenge && roundsTotal >= 2 && currentRound >= 2 && (
        <div className="text-sm text-[#444444] mb-4 space-y-1 border border-[#D9D9D9] rounded-lg p-3 bg-[#FAFAFA]">
          <p>
            <span className="font-medium">Letras obrigatórias:</span>{' '}
            {(challenge.round2_letters || []).join(', ') || '—'}
          </p>
          {currentRound >= 3 && (
            <>
              <p>
                <span className="font-medium">Dígitos obrigatórios:</span>{' '}
                {(challenge.round3_digits || []).join(', ') || '—'}
              </p>
              {(challenge.round3_symbols || []).length > 0 && (
                <p>
                  <span className="font-medium">Símbolos obrigatórios:</span>{' '}
                  {(challenge.round3_symbols || []).join(', ')}
                </p>
              )}
            </>
          )}
        </div>
      )}
      <div className="space-y-3 mb-6">
        <label
          className="block text-sm font-medium text-[#333333]"
          htmlFor="sp-primary"
        >
          Senha
        </label>
        <div className="relative">
          <input
            id="sp-primary"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            disabled={done}
            className="w-full border border-[#D9D9D9] rounded-lg px-3 py-2 pr-12"
            value={password}
            onKeyDown={() => {
              recordPrimaryKeydown();
            }}
            onChange={onPrimaryChange}
          />
          <EyeToggleButton
            visible={showPassword}
            onToggle={() => setShowPassword((v) => !v)}
            disabled={done}
          />
        </div>
        {showConfirmField && (
          <>
            <label
              className="block text-sm font-medium text-[#333333]"
              htmlFor="sp-confirm"
            >
              Confirmar senha
            </label>
            <div className="relative">
              <input
                id="sp-confirm"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                disabled={done}
                className="w-full border border-[#D9D9D9] rounded-lg px-3 py-2 pr-12"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <EyeToggleButton
                visible={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((v) => !v)}
                disabled={done}
              />
            </div>
          </>
        )}
      </div>
      {testMessage && !done && (
        <p className="text-sm mb-4 text-[#333333]">{testMessage}</p>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={done || submitting}
          onClick={handleTest}
          className="px-5 py-2 bg-[#B8E3C0] text-[#333333] rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'A validar…' : 'Testar senha'}
        </button>
      </div>

      {done && (
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
              Atividade finalizada
            </h2>
            <p className="text-[#777777]">{testMessage}</p>
            {!allowReplayAfterComplete && !submitting && (
              <p className="text-sm text-[#6E6E6E] mt-2">Continuando…</p>
            )}
          </div>
          {allowReplayAfterComplete && (
            <button
              type="button"
              onClick={handleRestart}
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
          )}
        </div>
      )}
    </div>
  );
}

export default StrongPasswordActivity;
