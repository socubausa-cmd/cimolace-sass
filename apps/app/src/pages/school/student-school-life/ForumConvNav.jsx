import React from 'react';

/**
 * ForumConvNav — navigation DANS la conversation (colonne de droite, discrète, figée).
 * Mini-timeline façon Claude : Question / Formateur / Solution / Réponses → clic = saut au message.
 */

const MONO = "'JetBrains Mono','Fira Code',monospace";

const NAVTYPE = {
  question: { dot: '#D4AF37', label: 'Question', glow: true },
  instructor: { dot: '#D4AF37', label: 'Formateur' },
  solution: { dot: '#22C55E', label: 'Solution', glow: true },
  reply: { dot: 'rgba(245,245,247,0.42)', label: 'Réponse' },
};

const jump = (key) => {
  const el = document.getElementById('fmsg-' + key);
  if (!el) return;
  let pane = el.parentElement;
  while (pane && pane !== document.body) {
    const cs = getComputedStyle(pane);
    if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && pane.scrollHeight > pane.clientHeight + 4) break;
    pane = pane.parentElement;
  }
  if (pane && pane !== document.body) {
    const target = pane.scrollTop + (el.getBoundingClientRect().top - pane.getBoundingClientRect().top) - 14;
    try { pane.scrollTo({ top: Math.max(0, target), behavior: 'smooth' }); } catch { /* ignore */ }
    pane.scrollTop = Math.max(0, target); // fallback instantané garanti
  } else {
    el.scrollIntoView({ block: 'start' });
  }
};

export default function ForumConvNav({ items = [] }) {
  // largeur réservée même vide → pas de saut de mise en page
  if (!items.length) return <aside style={{ width: 210, flexShrink: 0 }} aria-hidden />;
  return (
    <aside style={{ width: 210, flexShrink: 0, maxHeight: '100%', overflowY: 'auto', paddingTop: 2 }}>
      <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: 'rgba(245,245,247,0.4)', letterSpacing: '0.12em', padding: '6px 6px 14px' }}>
        CETTE CONVERSATION
      </div>
      <div style={{ position: 'relative' }}>
        {/* ligne de timeline */}
        <div style={{ position: 'absolute', left: 10, top: 8, bottom: 10, width: 1, background: 'rgba(255,255,255,0.08)' }} />
        {items.map((it) => {
          const ty = NAVTYPE[it.type] || NAVTYPE.reply;
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => jump(it.key)}
              style={{
                display: 'flex', gap: 11, width: '100%', textAlign: 'left',
                padding: '6px 6px', border: 'none', background: 'transparent',
                cursor: 'pointer', position: 'relative', borderRadius: 8,
              }}
            >
              <span style={{
                marginTop: 3, width: 9, height: 9, borderRadius: '50%', background: ty.dot,
                flexShrink: 0, zIndex: 1, outline: '3px solid #0a0b12',
                boxShadow: ty.glow ? `0 0 7px ${ty.dot}` : 'none',
              }} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontFamily: MONO, fontSize: 8.5, fontWeight: 600, color: ty.dot, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                  {ty.label}
                </span>
                <span style={{ display: 'block', fontSize: 10.5, color: 'rgba(245,245,247,0.42)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.snippet}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
