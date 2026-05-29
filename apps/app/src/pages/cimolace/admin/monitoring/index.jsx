import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { cimolaceBackofficeApi } from '@/lib/api-v2';

const C = {
  bg: '#0d1117', panel: '#161b22', border: '#21262d',
  violet: '#7c3aed', green: '#10b981', orange: '#f59e0b',
  red: '#ef4444', muted: '#8b949e', text: '#f0f6fc',
  blue: '#3b82f6',
};

const STATUS_CONFIG = {
  ok:      { color: C.green,  label: 'OK',       dot: '#10b981' },
  warn:    { color: C.orange, label: 'WARN',      dot: '#f59e0b' },
  fail:    { color: C.red,    label: 'FAIL',      dot: '#ef4444' },
  unknown: { color: C.muted,  label: '—',         dot: '#4b5563' },
};

const PROVIDERS = ['supabase', 'livekit', 'ai', 'payment', 'email_sms_optional'];
const PROVIDER_LABELS = {
  supabase: 'Supabase', livekit: 'LiveKit', ai: 'AI',
  payment: 'Paiement', email_sms_optional: 'Email/SMS',
};

function StatusDot({ status, latency, checkedAt, errorMessage, evidence }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;
  const [hover, setHover] = useState(false);

  const tooltip = [
    status === 'unknown' ? 'Jamais vérifié' : cfg.label,
    latency ? `${latency}ms` : null,
    checkedAt ? new Date(checkedAt).toLocaleTimeString('fr-FR') : null,
    evidence?.source === 'environment' ? 'preuve env' : null,
    errorMessage,
  ].filter(Boolean).join(' · ');

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{
        width: '10px', height: '10px', borderRadius: '50%',
        background: cfg.dot,
        boxShadow: status === 'ok' ? `0 0 6px ${cfg.dot}88` : status === 'fail' ? `0 0 6px ${cfg.dot}66` : 'none',
        cursor: 'default',
        transition: 'transform 0.15s',
        transform: hover ? 'scale(1.4)' : 'scale(1)',
      }} />
      {hover && (
        <div style={{
          position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
          background: '#0d1117', border: `1px solid ${C.border}`,
          padding: '4px 8px', borderRadius: '6px', whiteSpace: 'normal',
          minWidth: '180px', maxWidth: '280px',
          fontSize: '11px', color: C.text, zIndex: 100,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          {tooltip}
        </div>
      )}
    </div>
  );
}

function OverallBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;
  return (
    <span style={{
      padding: '2px 10px', borderRadius: '999px',
      background: `${cfg.dot}20`, color: cfg.dot,
      fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em',
    }}>
      {cfg.label}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '200px 80px repeat(5, 1fr) 120px',
      gap: '12px', alignItems: 'center', padding: '12px 16px',
      borderBottom: `1px solid ${C.border}`,
    }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{
          height: '14px', borderRadius: '4px',
          background: 'linear-gradient(90deg, #161b22 25%, #21262d 50%, #161b22 75%)',
          backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
        }} />
      ))}
    </div>
  );
}

export default function MonitoringPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [clientLoading, setClientLoading] = useState({});
  const [lastRefresh, setLastRefresh] = useState(null);
  const [countdown, setCountdown] = useState(300);

  const fetchOverview = useCallback(async () => {
    try {
      const result = await cimolaceBackofficeApi.getMonitoringOverview();
      setData(result);
      setLastRefresh(new Date());
      setCountdown(300);
    } catch {
      // garde l'état précédent en cas d'erreur
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 300_000);
    return () => clearInterval(interval);
  }, [fetchOverview]);

  // Countdown avant prochain refresh auto
  useEffect(() => {
    const tick = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(tick);
  }, []);

  const handleRunAll = async () => {
    setRunning(true);
    try {
      await cimolaceBackofficeApi.runAllHealthChecks();
      await fetchOverview();
    } finally {
      setRunning(false);
    }
  };

  const handleRunClient = async (clientId) => {
    setClientLoading((p) => ({ ...p, [clientId]: true }));
    try {
      for (const provider of PROVIDERS) {
        await cimolaceBackofficeApi.runProviderHealthCheck(clientId, provider);
      }
      await fetchOverview();
    } finally {
      setClientLoading((p) => ({ ...p, [clientId]: false }));
    }
  };

  const summary = data?.summary ?? {};
  const clients = data?.clients ?? [];

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '0' }}>
      <style>{`
        @keyframes shimmer { to { background-position: -200% 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '24px 32px', borderBottom: `1px solid ${C.border}`,
        background: C.panel,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <button
                onClick={() => navigate('/cimolace/admin')}
                style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '13px', padding: 0 }}
              >
                ← Dashboard
              </button>
              <span style={{ color: C.border }}>›</span>
              <span style={{ color: C.violet, fontSize: '13px', fontWeight: 600 }}>Monitoring</span>
            </div>
            <h1 style={{ color: C.text, fontSize: '20px', fontWeight: 800, margin: 0 }}>
              Monitoring Infrastructure
            </h1>
            <p style={{ color: C.muted, fontSize: '13px', marginTop: '4px' }}>
              État des providers pour toutes les écoles
              {lastRefresh && (
                <span> · dernière màj {lastRefresh.toLocaleTimeString('fr-FR')} · prochain dans {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}</span>
              )}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={fetchOverview}
              style={{
                padding: '8px 14px', borderRadius: '8px', border: `1px solid ${C.border}`,
                background: 'transparent', color: C.text, cursor: 'pointer',
                fontSize: '13px', fontWeight: 600,
              }}
            >
              Rafraîchir
            </button>
            <button
              onClick={handleRunAll}
              disabled={running}
              style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none',
                background: running ? C.violet + '60' : C.violet,
                color: '#fff', cursor: running ? 'not-allowed' : 'pointer',
                fontSize: '13px', fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: '6px',
              }}
            >
              {running ? (
                <>
                  <div style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Checks en cours…
                </>
              ) : 'Lancer tous les checks'}
            </button>
          </div>
        </div>
      </div>

      {/* Summary */}
      {!loading && summary.total !== undefined && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1px', background: C.border,
          borderBottom: `1px solid ${C.border}`,
        }}>
          {[
            { label: 'Total écoles', value: summary.total, color: C.text },
            { label: 'Saines', value: summary.ok ?? 0, color: C.green },
            { label: 'Avertissements', value: summary.warn ?? 0, color: C.orange },
            { label: 'Critiques', value: summary.fail ?? 0, color: C.red },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: C.panel, padding: '16px 24px' }}>
              <div style={{ color, fontSize: '24px', fontWeight: 900 }}>{value}</div>
              <div style={{ color: C.muted, fontSize: '12px', marginTop: '2px' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ padding: '0' }}>
        {/* Header row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '200px 80px repeat(5, 1fr) 120px',
          gap: '12px', alignItems: 'center',
          padding: '10px 24px',
          background: '#0d1117',
          borderBottom: `1px solid ${C.border}`,
          position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div style={{ color: C.muted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>École</div>
          <div style={{ color: C.muted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>État</div>
          {PROVIDERS.map((p) => (
            <div key={p} style={{ color: C.muted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>
              {PROVIDER_LABELS[p]}
            </div>
          ))}
          <div />
        </div>

        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
        ) : clients.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: C.muted, fontSize: '14px' }}>
            Aucune école provisionnée
          </div>
        ) : (
          clients.map((client) => (
            <div
              key={client.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '200px 80px repeat(5, 1fr) 120px',
                gap: '12px', alignItems: 'center',
                padding: '12px 24px',
                borderBottom: `1px solid ${C.border}`,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#161b22'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Name */}
              <div>
                <div
                  style={{ color: C.text, fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                  onClick={() => navigate(`/cimolace/admin/clients/${client.id}`)}
                >
                  {client.name ?? '—'}
                </div>
                <div style={{ color: C.muted, fontSize: '11px', fontFamily: 'monospace', marginTop: '2px' }}>
                  {client.slug}
                </div>
              </div>

              {/* Overall status */}
              <OverallBadge status={client.overallStatus} />

              {/* Per-provider dots */}
              {PROVIDERS.map((providerKey) => {
                const p = client.providers?.find((x) => x.key === providerKey) ?? {};
                return (
                  <div key={providerKey} style={{ display: 'flex', justifyContent: 'center' }}>
                    <StatusDot
                      status={p.status ?? 'unknown'}
                      latency={p.latency_ms}
                      checkedAt={p.checked_at}
                      errorMessage={p.error_message}
                      evidence={p.evidence}
                    />
                  </div>
                );
              })}

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => handleRunClient(client.id)}
                  disabled={!!clientLoading[client.id]}
                  style={{
                    padding: '5px 10px', borderRadius: '6px',
                    border: `1px solid ${C.border}`, background: 'transparent',
                    color: clientLoading[client.id] ? C.muted : C.violet,
                    cursor: clientLoading[client.id] ? 'not-allowed' : 'pointer',
                    fontSize: '11px', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}
                >
                  {clientLoading[client.id] ? (
                    <div style={{ width: '10px', height: '10px', border: '1.5px solid rgba(124,58,237,0.3)', borderTopColor: C.violet, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  ) : '⚡'}
                  Tester
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Legend */}
      <div style={{
        padding: '16px 24px', borderTop: `1px solid ${C.border}`,
        display: 'flex', gap: '20px', alignItems: 'center',
        background: C.panel,
      }}>
        <span style={{ color: C.muted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Légende :</span>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.dot }} />
            <span style={{ color: C.muted, fontSize: '11px' }}>{cfg.label}</span>
          </div>
        ))}
        <span style={{ color: C.muted, fontSize: '11px', marginLeft: 'auto' }}>
          Refresh auto toutes les 5 minutes
        </span>
      </div>
    </div>
  );
}
