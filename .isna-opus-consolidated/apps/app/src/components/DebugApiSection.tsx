import { useCallback, useMemo, useState } from 'react';
import { getApiBaseUrl } from '../lib/apiBase';

type LoadState = 'idle' | 'loading' | 'done';

const TOKEN_STORAGE_KEY = 'isna-v2-debug-api-bearer';

function formatBody(text: string): string {
  try {
    const parsed: unknown = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return text;
  }
}

export function DebugApiSection() {
  const apiBase = useMemo(() => getApiBaseUrl(), []);
  const [token, setToken] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) ?? '' : '',
  );

  const [healthState, setHealthState] = useState<LoadState>('idle');
  const [healthStatus, setHealthStatus] = useState<number | null>(null);
  const [healthBody, setHealthBody] = useState<string>('');
  const [healthError, setHealthError] = useState<string>('');

  const [meState, setMeState] = useState<LoadState>('idle');
  const [meStatus, setMeStatus] = useState<number | null>(null);
  const [meBody, setMeBody] = useState<string>('');
  const [meError, setMeError] = useState<string>('');

  const persistToken = useCallback((value: string) => {
    setToken(value);
    if (typeof window !== 'undefined') {
      if (value.trim()) {
        localStorage.setItem(TOKEN_STORAGE_KEY, value.trim());
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    setHealthError('');
    setHealthState('loading');
    setHealthStatus(null);
    setHealthBody('');
    try {
      const res = await fetch(`${apiBase}/health`, {
        headers: { Accept: 'application/json' },
      });
      const text = await res.text();
      setHealthStatus(res.status);
      setHealthBody(formatBody(text || '{}'));
      if (!res.ok) {
        setHealthError(`HTTP ${res.status}`);
      }
    } catch (e) {
      setHealthError(e instanceof Error ? e.message : 'Erreur réseau');
    } finally {
      setHealthState('done');
    }
  }, [apiBase]);

  const fetchMe = useCallback(async () => {
    setMeError('');
    setMeState('loading');
    setMeStatus(null);
    setMeBody('');
    const auth = token.trim();
    if (!auth) {
      setMeError('Collez un access token (Bearer) depuis Supabase Auth pour tester /auth/me.');
      setMeState('done');
      return;
    }
    try {
      const res = await fetch(`${apiBase}/auth/me`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${auth}`,
        },
      });
      const text = await res.text();
      setMeStatus(res.status);
      setMeBody(formatBody(text || '{}'));
      if (res.status === 401) {
        setMeError('401 — token invalide ou expiré.');
      } else if (!res.ok) {
        setMeError(`HTTP ${res.status}`);
      }
    } catch (e) {
      setMeError(e instanceof Error ? e.message : 'Erreur réseau');
    } finally {
      setMeState('done');
    }
  }, [apiBase, token]);

  const runBoth = useCallback(async () => {
    await fetchHealth();
    await fetchMe();
  }, [fetchHealth, fetchMe]);

  return (
    <section className="debug-api" aria-labelledby="debug-api-title">
      <h2 id="debug-api-title">Debug API</h2>
      <p className="debug-api__meta">
        Base URL : <code>{apiBase}</code>
      </p>

      <label className="debug-api__label">
        Access token Supabase (Bearer, optionnel)
        <textarea
          className="debug-api__token"
          rows={3}
          placeholder="eyJhbGciOiJIUzI1NiIs..."
          value={token}
          onChange={(e) => persistToken(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
      </label>

      <div className="debug-api__actions">
        <button type="button" onClick={() => void fetchHealth()} disabled={healthState === 'loading'}>
          {healthState === 'loading' ? 'GET /health…' : 'GET /health'}
        </button>
        <button type="button" onClick={() => void fetchMe()} disabled={meState === 'loading'}>
          {meState === 'loading' ? 'GET /auth/me…' : 'GET /auth/me'}
        </button>
        <button type="button" onClick={() => void runBoth()} disabled={healthState === 'loading' || meState === 'loading'}>
          Lancer les deux
        </button>
      </div>

      <div className="debug-api__panels">
        <div className="debug-api__panel">
          <h3>/health</h3>
          {healthStatus !== null && (
            <p className={`debug-api__status ${healthStatus >= 400 ? 'debug-api__status--bad' : ''}`}>
              Statut : {healthStatus}
            </p>
          )}
          {healthError && <p className="debug-api__err">{healthError}</p>}
          {healthBody ? <pre className="debug-api__pre">{healthBody}</pre> : null}
        </div>
        <div className="debug-api__panel">
          <h3>/auth/me</h3>
          {meStatus !== null && (
            <p
              className={`debug-api__status ${meStatus === 401 || meStatus >= 500 ? 'debug-api__status--bad' : ''}`}
            >
              Statut : {meStatus}
            </p>
          )}
          {meError && <p className="debug-api__err">{meError}</p>}
          {meBody ? <pre className="debug-api__pre">{meBody}</pre> : null}
        </div>
      </div>
    </section>
  );
}
