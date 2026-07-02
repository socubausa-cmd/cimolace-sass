import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Carte mentale NAVIGABLE (nœuds) — remplace la liste à puces plate.
 * Parse un contenu « • Titre (mm:ss) » (indentation = hiérarchie) en un arbre de nœuds
 * reliés à une racine. Chaque nœud horodaté est cliquable → saut au moment du replay
 * (si le Sujet a une salle de révision). Directive LIRI : coral chaud, épuré.
 */

const C = {
  coral: '#d97757',
  coralSoft: 'rgba(217,119,87,0.10)',
  coralLine: 'rgba(217,119,87,0.34)',
  cream: '#f5f1e9',
  t3: 'rgba(245,241,233,0.5)',
  mono: "'JetBrains Mono','Fira Code',monospace",
};

function parseTs(s) {
  const m = String(s).match(/(\d{1,3}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const a = +m[1], b = +m[2], c = m[3] != null ? +m[3] : null;
  return c != null ? a * 3600 + b * 60 + c : a * 60 + b;
}
function fmtTs(sec) {
  if (sec == null) return null;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

function parseNodes(content) {
  return String(content || '')
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => {
      const indent = (line.match(/^(\s*)/)?.[1] || '').length;
      const depth = Math.min(2, Math.floor(indent / 2));
      let text = line.replace(/^\s*[•\-*·◦▪]\s*/, '').trim();
      const tsM = text.match(/[([]\s*(\d{1,3}:\d{2}(?::\d{2})?)\s*[)\]]\s*$/);
      let seconds = null;
      if (tsM) { seconds = parseTs(tsM[1]); text = text.slice(0, tsM.index).trim(); }
      return { depth, label: text, seconds };
    })
    .filter((n) => n.label);
}

export default function ForumMindMap({ content, rootLabel, seekBase }) {
  const navigate = useNavigate();
  const [hover, setHover] = useState(-1);
  const nodes = useMemo(() => parseNodes(content), [content]);
  if (!nodes.length) return null;

  const seekable = (n) => !!seekBase && n.seconds != null;
  const go = (n) => {
    if (!seekable(n)) return;
    navigate(`${seekBase}${seekBase.includes('?') ? '&' : '?'}t=${n.seconds}`);
  };

  return (
    <div style={{ padding: '2px 0' }}>
      {/* Racine */}
      <div
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 15px',
          borderRadius: 12, background: C.coral, color: '#1c1a17', fontWeight: 700, fontSize: 14,
        }}
      >
        <span aria-hidden>🧠</span>
        <span>{rootLabel || 'Carte mentale'}</span>
      </div>

      {/* Branches (épine verticale coral + connecteurs horizontaux) */}
      <div style={{ marginLeft: 18, marginTop: 2, borderLeft: `2px solid ${C.coralLine}` }}>
        {nodes.map((n, i) => {
          const active = seekable(n);
          const isHover = hover === i;
          return (
            <div
              key={i}
              style={{ display: 'flex', alignItems: 'center', marginLeft: n.depth * 24, paddingTop: i === 0 ? 12 : 9 }}
            >
              <span style={{ width: 18 - n.depth * 0, height: 2, background: C.coralLine, flexShrink: 0 }} />
              <button
                type="button"
                onClick={() => go(n)}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(-1)}
                title={active ? `Aller à ${fmtTs(n.seconds)} dans le replay` : undefined}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 12px', borderRadius: 10,
                  background: isHover && active ? 'rgba(217,119,87,0.20)' : C.coralSoft,
                  border: `1px solid ${isHover && active ? C.coral : C.coralLine}`,
                  color: C.cream, fontSize: 13.5, lineHeight: 1.3, textAlign: 'left',
                  cursor: active ? 'pointer' : 'default', transition: 'background .14s, border-color .14s',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.coral, flexShrink: 0 }} />
                <span>{n.label}</span>
                {n.seconds != null && (
                  <span style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.coral, background: 'rgba(217,119,87,0.13)', borderRadius: 6, padding: '1px 7px', flexShrink: 0 }}>
                    {fmtTs(n.seconds)}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {seekBase && (
        <p style={{ margin: '13px 0 0 18px', fontSize: 11.5, color: C.t3, fontFamily: C.mono }}>
          ↳ clique un nœud pour sauter à ce moment du replay
        </p>
      )}
    </div>
  );
}
