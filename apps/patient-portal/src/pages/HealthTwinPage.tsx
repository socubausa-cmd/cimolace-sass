import { useEffect, useMemo, useState } from 'react';
import { Activity, Info, TrendingUp } from 'lucide-react';
import { patientApi, type MyTwinState } from '../lib/api';

// Couleurs par sévérité (badges d'alerte).
const SEVERITY_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  low:      { bg: '#f0fdf4', fg: '#166534', border: '#bbf7d0' },
  medium:   { bg: '#fefce8', fg: '#854d0e', border: '#fef08a' },
  high:     { bg: '#fff7ed', fg: '#9a3412', border: '#fed7aa' },
  critical: { bg: '#fef2f2', fg: '#991b1b', border: '#fecaca' },
};

// Couleur d'organe : on respecte ce que le serveur renvoie ; sinon palette
// par fourchette de score (vert > 70, jaune 40-70, rouge < 40).
function organColor(score: number | null, hint: string | null): string {
  if (hint) return hint;
  if (score == null) return '#d8d2ca';
  if (score >= 70) return '#16a34a';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

const WHEEL_LABELS: Record<string, string> = {
  digestion: 'Digestion',
  sleep: 'Sommeil',
  stress: 'Stress',
  energy: 'Énergie',
  inflammation: 'Inflammation',
  immunity: 'Immunité',
  metabolism: 'Métabolisme',
  hormones: 'Hormones',
  physical_activity: 'Activité',
  cognition: 'Cognition',
  environment: 'Environnement',
  emotions: 'Émotions',
};

export function HealthTwinPage() {
  const [state, setState] = useState<MyTwinState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    patientApi
      .getMyTwin()
      .then((d) => {
        if (!cancelled) setState(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || 'Erreur de chargement');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <div style={{ padding: 24, color: '#8a8580' }}>Chargement de votre jumeau santé…</div>;
  }
  if (error) {
    return (
      <div style={{ padding: 16, background: '#fef2f2', color: '#991b1b', borderRadius: 8 }}>
        {error}
      </div>
    );
  }
  if (!state) return null;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Mon corps</h2>
        <p style={{ color: '#8a8580', marginTop: 6 }}>
          Vue d'ensemble de votre santé : organes, équilibres, événements et repères.
        </p>
      </div>

      {/* Bandeau permanent non-diagnostic */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
          padding: '12px 14px',
          background: 'var(--brand-primary-soft)',
          border: '1px solid var(--brand-primary)',
          borderRadius: 10,
          color: 'var(--brand-primary)',
          fontSize: 12.5,
          lineHeight: 1.5,
          marginBottom: 20,
        }}
      >
        <Info size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Ces repères ne sont <strong>pas un diagnostic</strong> et ne remplacent pas un avis médical.
          Ils vous aident à suivre votre santé et à préparer vos échanges avec votre praticien.
        </span>
      </div>

      <OrgansSection organs={state.organs_scores} />
      <WheelSection wheel={state.wheel} />
      <TimelineSection events={state.events} />
      <AlertsSection alerts={state.alerts} />
      <Disclaimer text={state.disclaimer} />
    </div>
  );
}

// ── Section organes ───────────────────────────────────────────────────
function OrgansSection({ organs }: { organs: MyTwinState['organs_scores'] }) {
  return (
    <section style={sectionStyle}>
      <h3 style={sectionTitle}>Mes organes</h3>
      {organs.length === 0 ? (
        <p style={{ color: '#b0aaa2', fontSize: 13 }}>
          Aucun score d'organe enregistré pour l'instant.
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          {organs.map((o) => {
            const color = organColor(o.score, o.color);
            return (
              <div
                key={o.organ_code}
                style={{
                  background: '#fff',
                  border: '1px solid #ece7e1',
                  borderRadius: 12,
                  padding: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: color,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {o.score != null ? Math.round(o.score) : '—'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e1e1e' }}>
                    {o.label}
                  </div>
                  <div style={{ fontSize: 11, color: '#b0aaa2', textTransform: 'uppercase' }}>
                    {o.organ_code}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Section roue (SVG radar simple) ───────────────────────────────────
function WheelSection({ wheel }: { wheel: MyTwinState['wheel'] }) {
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 40;

  const points = useMemo(() => {
    if (wheel.length === 0) return '';
    return wheel
      .map((d, i) => {
        const angle = (i / wheel.length) * Math.PI * 2 - Math.PI / 2;
        const score = d.score ?? 0;
        const ratio = Math.max(0, Math.min(1, score / 100));
        const x = cx + Math.cos(angle) * r * ratio;
        const y = cy + Math.sin(angle) * r * ratio;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [wheel, cx, cy, r]);

  // Au moins un axe nourri par le suivi du patient ? → on affiche une légende
  // bienveillante sous la roue (et un petit repère sur les libellés concernés).
  const hasHealthEntry = wheel.some(
    (d) => d.source === 'health_entry' && d.score != null,
  );

  return (
    <section style={sectionStyle}>
      <h3 style={sectionTitle}>Ma roue d'équilibre</h3>
      {wheel.every((d) => d.score == null) ? (
        <p style={{ color: '#b0aaa2', fontSize: 13 }}>
          Aucune mesure enregistrée. Votre praticien pourra remplir votre roue lors d'une consultation.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <svg width={size} height={size} role="img" aria-label="Roue d'équilibre">
            {/* Cercles de référence */}
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <circle
                key={f}
                cx={cx}
                cy={cy}
                r={r * f}
                fill="none"
                stroke="#ece7e1"
                strokeWidth={1}
              />
            ))}
            {/* Axes */}
            {wheel.map((d, i) => {
              const angle = (i / wheel.length) * Math.PI * 2 - Math.PI / 2;
              const x = cx + Math.cos(angle) * r;
              const y = cy + Math.sin(angle) * r;
              return (
                <line
                  key={d.domain}
                  x1={cx}
                  y1={cy}
                  x2={x}
                  y2={y}
                  stroke="#ece7e1"
                  strokeWidth={1}
                />
              );
            })}
            {/* Polygone des scores — teinté de la couleur de marque du tenant. */}
            <polygon
              points={points}
              fill="var(--brand-primary-soft)"
              stroke="var(--brand-primary)"
              strokeWidth={2}
            />
            {/* Labels — les axes nourris par le suivi du patient sont teintés
                de la couleur de marque + portent un petit point repère. */}
            {wheel.map((d, i) => {
              const angle = (i / wheel.length) * Math.PI * 2 - Math.PI / 2;
              const lx = cx + Math.cos(angle) * (r + 16);
              const ly = cy + Math.sin(angle) * (r + 16);
              const isHealth = d.source === 'health_entry' && d.score != null;
              return (
                <g key={`l-${d.domain}`}>
                  {isHealth && (
                    <circle
                      cx={cx + Math.cos(angle) * (r + 6)}
                      cy={cy + Math.sin(angle) * (r + 6)}
                      r={2.5}
                      fill="var(--brand-primary)"
                    />
                  )}
                  <text
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={10}
                    fontWeight={isHealth ? 600 : 400}
                    fill={isHealth ? 'var(--brand-primary)' : '#475569'}
                  >
                    {WHEEL_LABELS[d.domain] || d.domain}
                  </text>
                </g>
              );
            })}
          </svg>
          {hasHealthEntry && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 999,
                background: 'var(--brand-primary-soft)',
                color: 'var(--brand-primary)',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              <TrendingUp size={13} aria-hidden="true" />
              Les axes en couleur sont enrichis par votre suivi santé.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── Section timeline ──────────────────────────────────────────────────
function TimelineSection({ events }: { events: MyTwinState['events'] }) {
  return (
    <section style={sectionStyle}>
      <h3 style={sectionTitle}>Ma timeline santé</h3>
      {events.length === 0 ? (
        <p style={{ color: '#b0aaa2', fontSize: 13 }}>Aucun événement enregistré.</p>
      ) : (
        <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {events.map((e) => (
            <li
              key={e.id}
              style={{
                display: 'flex',
                gap: 12,
                padding: '10px 0',
                borderBottom: '1px solid #f4f0ea',
              }}
            >
              <div style={{ marginTop: 4 }}>
                <Activity size={16} color="var(--brand-primary)" aria-hidden="true" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#1e1e1e' }}>{e.title}</div>
                <div style={{ fontSize: 12, color: '#8a8580' }}>
                  {new Date(e.occurred_at).toLocaleDateString('fr')} · {e.event_type}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ── Section repères (anciennement « alertes ») ────────────────────────
// Présentés comme des REPÈRES de prévention non-diagnostiques, jamais comme
// des diagnostics. Le libellé de sévérité est reformulé en intention douce.
const SEVERITY_LABELS: Record<string, string> = {
  low: 'À garder en tête',
  medium: 'À surveiller',
  high: 'À signaler à votre praticien',
  critical: 'À signaler sans tarder',
};

function AlertsSection({ alerts }: { alerts: MyTwinState['alerts'] }) {
  return (
    <section style={sectionStyle}>
      <h3 style={sectionTitle}>Mes repères de prévention</h3>
      {alerts.length === 0 ? (
        <p style={{ color: '#b0aaa2', fontSize: 13 }}>Aucun repère particulier en ce moment.</p>
      ) : (
        <>
          <p style={{ color: '#8a8580', fontSize: 12.5, margin: '0 0 10px', lineHeight: 1.5 }}>
            Ces repères ne sont pas un diagnostic. Ils signalent une mesure à surveiller ou à
            partager avec votre praticien.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alerts.map((a) => {
              const palette = SEVERITY_COLORS[a.severity] || SEVERITY_COLORS.medium;
              return (
                <div
                  key={a.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: 12,
                    background: palette.bg,
                    color: palette.fg,
                    border: `1px solid ${palette.border}`,
                    borderRadius: 10,
                  }}
                >
                  <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                  <div style={{ fontSize: 13 }}>
                    <div style={{ fontWeight: 600, fontSize: 11.5 }}>
                      {SEVERITY_LABELS[a.severity] || 'À surveiller'}
                    </div>
                    <div>{a.message}</div>
                    <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                      {new Date(a.created_at).toLocaleDateString('fr')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function Disclaimer({ text }: { text: string }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        padding: 12,
        background: '#fafaf8',
        border: '1px solid #ece7e1',
        borderRadius: 10,
        color: '#475569',
        fontSize: 12,
        marginTop: 12,
      }}
    >
      <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        {text ||
          "Ces données sont indicatives. Elles ne constituent pas un diagnostic et ne remplacent pas l'avis d'un professionnel de santé."}
      </div>
    </div>
  );
}

const sectionStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #ece7e1',
  padding: 20,
  marginBottom: 16,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  marginTop: 0,
  marginBottom: 12,
  color: '#1e1e1e',
};
