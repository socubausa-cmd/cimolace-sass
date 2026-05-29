/**
 * Page admin — gestion des lives de l'école.
 * Route : /t/:tenantSlug/admin/lives
 * Protégée par TenantProtectedRoute.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { livesApi } from '@/lib/api-v2';

const C = {
  bg: '#0d1117', panel: '#161b22', border: '#21262d',
  violet: '#7c3aed', green: '#10b981', orange: '#f59e0b',
  red: '#ef4444', text: '#f0f6fc', muted: '#8b949e',
};

const STATUS_CONFIG = {
  scheduled: { label: 'Planifié',  color: C.orange },
  live:       { label: 'En direct', color: C.green  },
  ended:      { label: 'Terminé',   color: C.muted  },
  cancelled:  { label: 'Annulé',    color: C.red    },
};

function CreateLiveModal({ onClose, onCreated, tenantSlug }) {
  const [form, setForm] = useState({
    title: '', description: '',
    scheduled_at: '', duration_minutes: 60,
    price_cents: 0, currency: 'EUR', is_public: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const live = await livesApi.create({
        ...form,
        price_cents: parseInt(form.price_cents, 10) || 0,
        duration_minutes: parseInt(form.duration_minutes, 10) || 60,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
        is_public: form.is_public === true || form.is_public === 'true',
      });
      onCreated(live);
      onClose();
    } catch (err) {
      setError(err?.message ?? 'Erreur lors de la création du live');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '9px 12px', borderRadius: '8px',
    border: `1px solid ${C.border}`, background: C.bg,
    color: C.text, fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = { color: C.muted, fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderTop: `3px solid ${C.violet}`, borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '500px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
          <h2 style={{ color: C.text, fontSize: '16px', fontWeight: 800, margin: 0 }}>Nouveau live</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '18px' }}>✕</button>
        </div>

        {error && (
          <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Titre du live *</label>
            <input type="text" value={form.title} onChange={set('title')} placeholder="Ex : Cours de mathématiques — Module 3" required style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea value={form.description} onChange={set('description')} placeholder="Présentation du cours…" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={labelStyle}>Date et heure</label>
              <input type="datetime-local" value={form.scheduled_at} onChange={set('scheduled_at')} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Durée (min)</label>
              <input type="number" value={form.duration_minutes} onChange={set('duration_minutes')} min={15} max={480} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={labelStyle}>Prix (centimes)</label>
              <input type="number" value={form.price_cents} onChange={set('price_cents')} min={0} placeholder="0 = Gratuit" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Devise</label>
              <select value={form.currency} onChange={set('currency')} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="EUR">EUR €</option>
                <option value="XOF">XOF CFA</option>
                <option value="USD">USD $</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input type="checkbox" id="is_public" checked={form.is_public} onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))} />
            <label htmlFor="is_public" style={{ color: C.muted, fontSize: '13px', cursor: 'pointer' }}>Live public (visible dans le catalogue)</label>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
              Annuler
            </button>
            <button type="submit" disabled={loading} style={{ flex: 2, padding: '10px', borderRadius: '8px', border: 'none', background: loading ? C.violet + '60' : C.violet, color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700 }}>
              {loading ? 'Création…' : 'Créer le live'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TenantAdminLivesPage() {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const [lives, setLives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    livesApi.list(50, 0)
      .then((data) => setLives(Array.isArray(data) ? data : []))
      .catch(() => setLives([]))
      .finally(() => setLoading(false));
  }, [tenantSlug]);

  const handleCreated = (live) => {
    setLives((prev) => [live, ...prev]);
  };

  const formatDate = (iso) => iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const formatPrice = (cents, currency) => cents > 0 ? `${(cents / 100).toFixed(0)} ${currency?.toUpperCase() ?? '€'}` : 'Gratuit';

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '32px 24px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {showCreate && <CreateLiveModal onClose={() => setShowCreate(false)} onCreated={handleCreated} tenantSlug={tenantSlug} />}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div>
            <h1 style={{ color: C.text, fontSize: '20px', fontWeight: 800, margin: '0 0 4px' }}>Sessions Live</h1>
            <p style={{ color: C.muted, fontSize: '13px', margin: 0 }}>Gérez vos lives, planifiez et lancez des sessions</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: C.violet, color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}
          >
            + Nouveau live
          </button>
        </div>

        {/* Table */}
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 120px', gap: '12px', padding: '10px 20px', background: C.bg, borderBottom: `1px solid ${C.border}` }}>
            {['Titre', 'Date', 'Durée', 'Prix', 'Actions'].map((h) => (
              <div key={h} style={{ color: C.muted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <div style={{ width: '24px', height: '24px', border: `2px solid ${C.violet}33`, borderTopColor: C.violet, borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
            </div>
          ) : lives.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: C.muted, fontSize: '14px' }}>
              Aucun live créé — commencez par créer votre premier live !
            </div>
          ) : (
            lives.map((live) => {
              const cfg = STATUS_CONFIG[live.status] ?? STATUS_CONFIG.scheduled;
              return (
                <div
                  key={live.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 120px',
                    gap: '12px', padding: '14px 20px', borderBottom: `1px solid ${C.border}`,
                    alignItems: 'center', transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#1c2128'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <div>
                    <div style={{ color: C.text, fontSize: '13px', fontWeight: 600 }}>{live.title}</div>
                    <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, background: `${cfg.color}20`, color: cfg.color }}>
                      {cfg.label}
                    </span>
                  </div>
                  <div style={{ color: C.muted, fontSize: '12px' }}>{formatDate(live.scheduled_at)}</div>
                  <div style={{ color: C.muted, fontSize: '12px' }}>{live.duration_minutes ?? '—'} min</div>
                  <div style={{ color: C.muted, fontSize: '12px' }}>{formatPrice(live.price_cents, live.currency)}</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {live.status === 'scheduled' && (
                      <button
                        onClick={() => navigate(`/live/host/${live.id}`)}
                        style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', background: C.green, color: '#fff', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}
                      >
                        Lancer
                      </button>
                    )}
                    {live.status === 'live' && (
                      <button
                        onClick={() => navigate(`/live/host/${live.id}`)}
                        style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', background: C.red, color: '#fff', cursor: 'pointer', fontSize: '11px', fontWeight: 700, animation: 'pulse 1s infinite' }}
                      >
                        Rejoindre
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/lives/${live.id}`)}
                      style={{ padding: '5px 10px', borderRadius: '6px', border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                    >
                      Détail
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
