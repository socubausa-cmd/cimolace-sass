import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { masterclassApi } from '@/lib/api-v2';

/**
 * MasterclassesListPage — hub des MASTERCLASSES (/masterclasses).
 * Surface first-class les masterclasses (entité propre, table masterclasses) qui
 * n'étaient jusqu'ici joignables par aucune UI. Chaque carte ouvre le lecteur
 * MasterclassRoomPage (/masterclass/:id). Directive artistique LIRI : chaud/coral.
 */
const COL = {
  coral: '#d97757',
  coralDim: 'rgba(217,119,87,0.10)',
  coralMid: 'rgba(217,119,87,0.28)',
  cream: '#f5f1e9',
  t2: 'rgba(245,241,233,0.66)',
  t3: 'rgba(245,241,233,0.42)',
  line: 'rgba(245,241,233,0.10)',
  mono: "'JetBrains Mono','Fira Code',monospace",
};

export default function MasterclassesListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    masterclassApi
      .list()
      .then((d) => { if (alive) setItems(Array.isArray(d) ? d : []); })
      .catch((e) => { if (alive) setErr(e?.message || 'Erreur de chargement'); });
    return () => { alive = false; };
  }, []);

  return (
    <div style={{ maxWidth: 940, margin: '0 auto', padding: '8px 16px 60px' }}>
      <div style={{ fontFamily: COL.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.10em', color: COL.coral, textTransform: 'uppercase', marginBottom: 6 }}>
        Salle de cours · Masterclasses
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: COL.cream, margin: 0, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
        Masterclasses
      </h1>
      <p style={{ marginTop: 10, fontSize: 14.5, lineHeight: 1.6, color: COL.t2, maxWidth: 560 }}>
        Des sessions écrites structurées, à lire à ton rythme.
      </p>

      {err ? (
        <div style={{ marginTop: 28, padding: '22px 20px', textAlign: 'center', color: COL.t3, border: `1px solid ${COL.line}`, borderRadius: 12 }}>{err}</div>
      ) : items === null ? (
        <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: COL.mono, fontSize: 10, letterSpacing: '0.12em', color: COL.t3 }}>CHARGEMENT…</div>
      ) : items.length === 0 ? (
        <div style={{ marginTop: 28, padding: '30px 20px', textAlign: 'center', color: COL.t3, border: `1px dashed ${COL.line}`, borderRadius: 14 }}>
          Aucune masterclass pour l'instant.
        </div>
      ) : (
        <div style={{ marginTop: 26, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(248px, 1fr))', gap: 14 }}>
          {items.map((m) => (
            <button
              key={m.id}
              onClick={() => navigate(`/masterclass/${m.id}`)}
              style={{
                textAlign: 'left', cursor: 'pointer', padding: '18px 18px 16px', borderRadius: 14,
                background: 'rgba(245,241,233,0.02)', border: `1px solid ${COL.line}`,
                display: 'flex', flexDirection: 'column', gap: 10, transition: 'border-color 160ms, background 160ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = COL.coralMid; e.currentTarget.style.background = COL.coralDim; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = COL.line; e.currentTarget.style.background = 'rgba(245,241,233,0.02)'; }}
            >
              <span style={{ display: 'inline-flex', width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: COL.coralDim, border: `1px solid ${COL.coralMid}`, color: COL.coral, fontSize: 18 }}>◆</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: COL.cream, lineHeight: 1.25 }}>{m.title || 'Masterclass'}</span>
              <span style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 11.5, fontFamily: COL.mono, color: COL.t3 }}>
                  {m.module_count != null ? `${m.module_count} module${m.module_count > 1 ? 's' : ''}` : 'Masterclass'}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: COL.coral }}>Lire →</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
