/**
 * ═══════════════════════════════════════════════════════════════
 * LIRI Embed Studio — Créer/programmer une session depuis n'importe quel site
 *
 * URL : /embed/studio?tenant=SLUG&api_key=lk_live_xxx&theme=dark
 *
 * Flow :
 *   1. Le site externe charge cette page en iframe
 *   2. L'utilisateur remplit le formulaire (titre, type, date)
 *   3. On appelle POST /v1/liri/sessions via l'API key
 *   4. On postMessage {type:'LIRI_SESSION_CREATED', session} au parent
 *   5. Le parent peut alors appeler liri.host(container, { session: id })
 * ═══════════════════════════════════════════════════════════════
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * SÉCURITÉ postMessage : cibler l'origine RÉELLE de la page hôte (via
 * document.referrer), jamais '*' (sinon toute origine peut lire les events de
 * création/hôte de session depuis une iframe cachée). Repli same-origin.
 */
function getParentOrigin() {
  try {
    if (document.referrer) return new URL(document.referrer).origin;
  } catch { /* referrer illisible */ }
  return window.location.origin;
}

const SESSION_TYPES = [
  { id: 'webinar',      icon: '🎙️', label: 'Webinar',         desc: 'Conférence large audience' },
  { id: 'class',        icon: '📚', label: 'Cours en ligne',  desc: 'Classe interactive' },
  { id: 'consultation', icon: '🩺', label: 'Consultation',    desc: 'Rendez-vous 1:1' },
  { id: 'debate',       icon: '⚖️', label: 'Débat',           desc: 'Format panel / débat' },
  { id: 'commercial',   icon: '🛍️', label: 'Live Commerce',   desc: 'Vente en direct' },
  { id: 'masterclass',  icon: '🏆', label: 'Masterclass',     desc: 'Formation premium' },
];

const S = {
  root: {
    width: '100%', minHeight: '100vh',
    background: '#262624', color: '#e1e7ef',
    fontFamily: "'Inter', system-ui, sans-serif",
    padding: '24px', boxSizing: 'border-box',
  },
  title: { fontSize: 20, fontWeight: 700, margin: '0 0 4px', color: '#f0f6fc' },
  sub: { fontSize: 13, color: '#8b949e', margin: '0 0 24px' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#8b949e', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' },
  input: {
    width: '100%', boxSizing: 'border-box',
    background: '#262624', border: '1px solid #30363d', borderRadius: 8,
    color: '#f0f6fc', padding: '10px 14px', fontSize: 14,
    outline: 'none', marginBottom: 16,
  },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 },
  typeCard: (selected, theme) => ({
    background: selected ? '#d9775720' : '#262624',
    border: `1px solid ${selected ? '#d97757' : '#30363d'}`,
    borderRadius: 8, padding: '10px 12px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 10,
    transition: 'all 0.15s',
  }),
  typeIcon: { fontSize: 20 },
  typeLabel: { fontWeight: 600, fontSize: 13, margin: 0 },
  typeDesc: { fontSize: 11, color: '#8b949e', margin: 0 },
  btn: (loading) => ({
    width: '100%', padding: '12px', borderRadius: 8,
    background: loading ? '#d97757' : '#d97757',
    color: '#fff', fontWeight: 700, fontSize: 15,
    border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
    marginTop: 8,
  }),
  success: {
    background: '#052e16', border: '1px solid #16a34a', borderRadius: 12,
    padding: '20px', textAlign: 'center',
  },
  successIcon: { fontSize: 48, display: 'block', marginBottom: 12 },
  successTitle: { fontSize: 18, fontWeight: 700, color: '#4ade80', margin: '0 0 6px' },
  successSub: { fontSize: 13, color: '#86efac', margin: '0 0 16px' },
  sessionId: {
    background: '#021712', border: '1px solid #16a34a', borderRadius: 6,
    padding: '8px 14px', fontFamily: 'monospace', fontSize: 12,
    color: '#4ade80', display: 'block', wordBreak: 'break-all', margin: '0 0 12px',
  },
  startBtn: {
    background: '#d97757', color: '#fff', border: 'none', borderRadius: 8,
    padding: '10px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer',
    marginRight: 8,
  },
  newBtn: {
    background: '#262624', color: '#8b949e', border: '1px solid #30363d',
    borderRadius: 8, padding: '10px 20px', fontWeight: 600, fontSize: 14, cursor: 'pointer',
  },
  err: {
    background: '#2d0c0c', border: '1px solid #f87171', borderRadius: 8,
    padding: '10px 14px', color: '#f87171', fontSize: 13, marginBottom: 12,
  },
};

export default function LiveEmbedStudioPage() {
  const [sp] = useSearchParams();
  const tenant = sp.get('tenant') ?? '';
  const apiKey = sp.get('api_key') ?? sp.get('apiKey') ?? '';
  const apiBase = sp.get('api_base') ?? sp.get('apiBase') ?? '/api';

  const [title, setTitle] = useState('');
  const [type, setType] = useState('webinar');
  const [scheduledAt, setScheduledAt] = useState('');
  const [capacity, setCapacity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setError('Le titre est requis'); return; }
    if (!apiKey) { setError('api_key manquant dans l\'URL'); return; }
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/v1/liri/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Liri-Api-Key': apiKey },
        body: JSON.stringify({
          title: title.trim(),
          session_type: type,
          scheduled_at: scheduledAt || undefined,
          capacity: capacity ? parseInt(capacity, 10) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Erreur ' + res.status);
      const session = json.data || json;
      setCreated(session);

      // Notifier le parent
      window.parent?.postMessage({
        type: 'LIRI_SESSION_CREATED',
        session: {
          id: session.id,
          title: session.title,
          status: session.status,
          session_type: session.session_type,
          scheduled_at: session.scheduled_at,
        },
      }, getParentOrigin());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartNow = () => {
    window.parent?.postMessage({
      type: 'LIRI_HOST_SESSION',
      session_id: created.id,
      session_title: created.title,
    }, getParentOrigin());
  };

  if (created) {
    return (
      <div style={S.root}>
        <div style={S.success}>
          <span style={S.successIcon}>🎉</span>
          <p style={S.successTitle}>Session créée avec succès !</p>
          <p style={S.successSub}>{created.title}</p>
          <span style={S.sessionId}>{created.id}</span>
          <div>
            <button style={S.startBtn} onClick={handleStartNow}>
              🚀 Démarrer maintenant
            </button>
            <button style={S.newBtn} onClick={() => { setCreated(null); setTitle(''); }}>
              + Nouvelle session
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.root}>
      <p style={S.title}>Nouvelle session live</p>
      <p style={S.sub}>Créez et programmez une session vidéo LIRI</p>

      <form onSubmit={handleSubmit}>
        {error && <div style={S.err}>{error}</div>}

        <label style={S.label}>Titre</label>
        <input
          style={S.input}
          type="text"
          placeholder="Ex: Webinar Marketing Automation"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <label style={S.label}>Type de session</label>
        <div style={S.grid}>
          {SESSION_TYPES.map((t) => (
            <div key={t.id} style={S.typeCard(type === t.id)} onClick={() => setType(t.id)}>
              <span style={S.typeIcon}>{t.icon}</span>
              <div>
                <p style={S.typeLabel}>{t.label}</p>
                <p style={S.typeDesc}>{t.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <label style={S.label}>Date & heure (optionnel)</label>
        <input
          style={S.input}
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />

        <label style={S.label}>Capacité max (optionnel)</label>
        <input
          style={S.input}
          type="number"
          placeholder="Ex: 100"
          min="1"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
        />

        <button type="submit" style={S.btn(loading)} disabled={loading}>
          {loading ? 'Création en cours…' : 'Créer la session'}
        </button>
      </form>
    </div>
  );
}
