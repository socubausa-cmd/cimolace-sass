import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { masterclassApi } from '@/lib/api-v2';

/**
 * MasterclassRoomPage — lecteur d'une MASTERCLASS (Phase 2, hub adaptatif).
 * Une masterclass est une entité PROPRE (table masterclasses → masterclass_modules
 * → masterclass_lessons), distincte des cours. Son contenu de leçon est du TEXTE
 * (cours écrit structuré) → le « player » est un lecteur de lecture sobre, pas
 * une vidéo. Lit via masterclassApi.get(id) (GET /masterclass-factory/:id).
 * Directive artistique LIRI : chaud/coral, fond du shell, lisibilité prose.
 */
const COL = {
  coral: '#d97757',
  cream: '#f5f1e9',
  t2: 'rgba(245,241,233,0.66)',
  t3: 'rgba(245,241,233,0.42)',
  line: 'rgba(245,241,233,0.10)',
  mono: "'JetBrains Mono','Fira Code',monospace",
};

const byOrder = (a, b) => (a?.order_index ?? 0) - (b?.order_index ?? 0);

export default function MasterclassRoomPage() {
  const { masterclassId } = useParams();
  const navigate = useNavigate();

  const [mc, setMc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    if (!masterclassId) return;
    let alive = true;
    setLoading(true);
    setErr('');
    masterclassApi
      .get(masterclassId)
      .then((data) => {
        if (!alive) return;
        setMc(data || null);
        const first = (data?.modules || []).slice().sort(byOrder)[0];
        setOpenId(first?.id || null);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setErr(e?.message || 'Masterclass introuvable');
        setLoading(false);
      });
    return () => { alive = false; };
  }, [masterclassId]);

  const modules = (mc?.modules || []).slice().sort(byOrder);
  const lessonCount = modules.reduce((n, m) => n + (m.masterclass_lessons?.length || 0), 0);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '6px 16px 60px' }}>
      {/* En-tête */}
      <button
        onClick={() => navigate(-1)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20,
          padding: '7px 13px', borderRadius: 9, cursor: 'pointer',
          background: 'rgba(217,119,87,0.10)', border: '1px solid rgba(217,119,87,0.28)',
          color: COL.coral, fontSize: 12.5, fontWeight: 600,
        }}
      >← Retour</button>

      <div style={{ fontFamily: COL.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.10em', color: COL.coral, textTransform: 'uppercase', marginBottom: 6 }}>
        Masterclass
      </div>
      <h1 style={{ fontSize: 30, fontWeight: 700, color: COL.cream, margin: 0, lineHeight: 1.12, letterSpacing: '-0.02em', textWrap: 'balance' }}>
        {mc?.title || (loading ? '…' : 'Masterclass')}
      </h1>
      {!loading && !err ? (
        <div style={{ marginTop: 12, fontSize: 13, color: COL.t3, fontFamily: COL.mono }}>
          {modules.length} module{modules.length > 1 ? 's' : ''} · {lessonCount} leçon{lessonCount > 1 ? 's' : ''}
        </div>
      ) : null}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: COL.mono, fontSize: 10, letterSpacing: '0.12em', color: COL.t3 }}>CHARGEMENT…</div>
      ) : err ? (
        <div style={{ marginTop: 28, padding: '24px 20px', textAlign: 'center', color: COL.t3, border: `1px solid ${COL.line}`, borderRadius: 12 }}>{err}</div>
      ) : (
        <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {modules.map((m, mi) => {
            const open = openId === m.id;
            const lessons = (m.masterclass_lessons || []).slice().sort(byOrder);
            return (
              <div key={m.id} style={{ borderRadius: 14, border: `1px solid ${COL.line}`, overflow: 'hidden', background: 'rgba(245,241,233,0.02)' }}>
                <button
                  onClick={() => setOpenId(open ? null : m.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                    padding: '15px 18px', cursor: 'pointer', background: 'transparent', border: 'none',
                  }}
                >
                  <span style={{ fontFamily: COL.mono, fontSize: 12, fontWeight: 700, color: COL.coral, flexShrink: 0 }}>
                    {String(mi + 1).padStart(2, '0')}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 600, color: COL.cream }}>{m.title || `Module ${mi + 1}`}</span>
                  <span style={{ fontSize: 11.5, color: COL.t3, fontFamily: COL.mono, flexShrink: 0 }}>{lessons.length} leçon{lessons.length > 1 ? 's' : ''}</span>
                  <span style={{ color: COL.t3, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 160ms' }}>›</span>
                </button>
                {open ? (
                  <div style={{ padding: '2px 18px 18px' }}>
                    {lessons.length === 0 ? (
                      <div style={{ fontSize: 13.5, color: COL.t3, padding: '8px 0' }}>Aucune leçon dans ce module.</div>
                    ) : lessons.map((l) => (
                      <div key={l.id} style={{ paddingTop: 14, marginTop: 14, borderTop: `1px solid ${COL.line}` }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: COL.coral, marginBottom: 8 }}>{l.title || 'Leçon'}</div>
                        <div style={{ fontSize: 15, lineHeight: 1.72, color: COL.cream, whiteSpace: 'pre-wrap' }}>{l.content || ''}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
          {modules.length === 0 ? (
            <div style={{ padding: '24px 20px', textAlign: 'center', color: COL.t3, border: `1px solid ${COL.line}`, borderRadius: 12 }}>
              Cette masterclass n'a pas encore de contenu.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
