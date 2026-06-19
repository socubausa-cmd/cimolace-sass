import { useMemo, useState } from 'react';
import { X, Sparkles, Check } from 'lucide-react';
import { COLOR_HEX } from './api';
import {
  QUESTIONS, FUNCTIONAL_AXES, scoreResponses, answeredCount, SCORED_TOTAL,
  type Answers,
} from './transformation';

const GREY = '#c9bdab';
export const scoreColor = (s: number | null | undefined) =>
  s == null ? GREY : s >= 80 ? COLOR_HEX.green : s >= 60 ? COLOR_HEX.yellow : s >= 40 ? COLOR_HEX.orange : COLOR_HEX.red;

// ── Géométrie secteurs ─────────────────────────────────────────────────────
const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};
function annulus(cx: number, cy: number, ri: number, ro: number, a0: number, a1: number) {
  const large = a1 - a0 > 180 ? 1 : 0;
  const o0 = polar(cx, cy, ro, a0), o1 = polar(cx, cy, ro, a1);
  const i1 = polar(cx, cy, ri, a1), i0 = polar(cx, cy, ri, a0);
  return `M${o0.x} ${o0.y} A${ro} ${ro} 0 ${large} 1 ${o1.x} ${o1.y} L${i1.x} ${i1.y} A${ri} ${ri} 0 ${large} 0 ${i0.x} ${i0.y} Z`;
}

/** Roue de transformation — matrice fonctionnelle (7 systèmes + 5 processus). */
export function FunctionalWheel({ scores, onSelect, selected }: {
  scores: Record<string, number>;
  onSelect?: (key: string) => void;
  selected?: string | null;
}) {
  const C = 200;
  const systems = FUNCTIONAL_AXES.filter((a) => a.group === 'system');
  const processes = FUNCTIONAL_AXES.filter((a) => a.group === 'process');
  const vals = FUNCTIONAL_AXES.map((a) => scores[a.key]).filter((v) => v != null) as number[];
  const global = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;

  const ring = (axes: typeof FUNCTIONAL_AXES, ri: number, ro: number) => {
    const step = 360 / axes.length;
    return axes.map((ax, i) => {
      const a0 = i * step + 1, a1 = (i + 1) * step - 1;
      const sc = scores[ax.key];
      const mid = polar(C, C, (ri + ro) / 2, (a0 + a1) / 2);
      const active = selected === ax.key;
      return (
        <g key={ax.key} style={{ cursor: onSelect ? 'pointer' : 'default' }} onClick={() => onSelect?.(ax.key)}>
          <path d={annulus(C, C, ri, ro, a0, a1)} fill={scoreColor(sc)} fillOpacity={sc == null ? 0.5 : 0.92}
            stroke={active ? '#2b1b1f' : '#fff'} strokeWidth={active ? 2.5 : 2} style={{ transition: 'fill-opacity .2s' }} />
          <text x={mid.x} y={mid.y + 4} textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff" style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,.35)' }}>
            {sc == null ? '–' : sc}
          </text>
        </g>
      );
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg viewBox="0 0 400 400" style={{ width: '100%', maxWidth: 380 }} role="img" aria-label="Roue de transformation fonctionnelle">
        <circle cx={C} cy={C} r={186} fill="none" stroke="var(--zw-border)" strokeWidth="1" />
        {ring(processes, 122, 176)}
        {ring(systems, 50, 118)}
        {/* moyeu */}
        <circle cx={C} cy={C} r={48} fill="#fffaf2" stroke="var(--zw-border)" strokeWidth="1.5" />
        <text x={C} y={C - 6} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--zw-text-muted)">Transformation</text>
        <text x={C} y={C + 18} textAnchor="middle" fontSize="22" fontWeight="800" fill={scoreColor(global)}>{global ?? '–'}</text>
      </svg>

      {/* Légende = mapping secteurs → axes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '4px 14px', width: '100%', marginTop: 10 }}>
        {FUNCTIONAL_AXES.map((ax) => {
          const sc = scores[ax.key];
          return (
            <button key={ax.key} onClick={() => onSelect?.(ax.key)} title={ax.desc}
              style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, background: selected === ax.key ? 'var(--zw-bg-subtle)' : 'transparent', border: 'none', borderRadius: 6, padding: '3px 5px', cursor: onSelect ? 'pointer' : 'default', textAlign: 'left' }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: scoreColor(sc), flexShrink: 0 }} />
              <span style={{ flex: 1, color: 'var(--zw-text-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ax.label}</span>
              <span style={{ fontWeight: 700, color: scoreColor(sc) }}>{sc ?? '–'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Modal de remplissage du bilan → renvoie les réponses + scores calculés. */
export function BilanModal({ initial, onClose, onComplete }: {
  initial?: Answers;
  onClose: () => void;
  onComplete: (answers: Answers) => void;
}) {
  const [answers, setAnswers] = useState<Answers>(initial || {});
  const done = answeredCount(answers);
  const pct = Math.round((done / SCORED_TOTAL) * 100);
  const preview = useMemo(() => scoreResponses(answers), [answers]);

  const setChoice = (id: string, v: string) => setAnswers((s) => ({ ...s, [id]: v }));
  const toggleMulti = (id: string, v: string) => setAnswers((s) => {
    const cur = Array.isArray(s[id]) ? (s[id] as string[]) : [];
    return { ...s, [id]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
  });

  return (
    <div className="bil-overlay" onClick={onClose}>
      <div className="bil-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bil-head">
          <div>
            <h3>🌱 Bilan de transformation</h3>
            <span>Questionnaire Détox Zahir — {done}/{SCORED_TOTAL} questions clés</span>
          </div>
          <button onClick={onClose} className="bil-x"><X size={18} /></button>
        </div>
        <div className="bil-progress"><span style={{ width: `${pct}%` }} /></div>

        <div className="bil-body">
          {QUESTIONS.map((q) => {
            const a = answers[q.id];
            return (
              <div className="bil-q" key={q.id}>
                <div className="bil-q-label">{q.label}{q.type === 'multi' && <em> · plusieurs choix</em>}</div>
                <div className="bil-opts">
                  {q.options.map((o) => {
                    const on = q.type === 'multi' ? Array.isArray(a) && a.includes(o) : a === o;
                    return (
                      <button key={o} type="button" className={`bil-opt ${on ? 'on' : ''}`}
                        onClick={() => (q.type === 'multi' ? toggleMulti(q.id, o) : setChoice(q.id, o))}>
                        <span className={`bil-mark ${q.type === 'multi' ? 'sq' : ''}`}>{on && <Check size={11} strokeWidth={3} />}</span>
                        {o}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="bil-foot">
          <div className="bil-foot-info">{done} question(s) renseignée(s)</div>
          <button className="bil-go" disabled={done === 0} onClick={() => onComplete(answers)}>
            <Sparkles size={15} /> Calculer ma roue ({Object.keys(preview.functional).length} axes)
          </button>
        </div>
        <style>{CSS}</style>
      </div>
    </div>
  );
}

const CSS = `
.bil-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.55); backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; z-index:1100; padding:20px; animation:bilFade .18s ease; }
@keyframes bilFade { from { opacity:0 } to { opacity:1 } }
.bil-modal { background:var(--zw-bg, #f6efe6); width:min(620px,100%); max-height:90vh; border-radius:18px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 30px 60px -20px rgba(0,0,0,.45); animation:bilPop .22s cubic-bezier(.2,.7,.3,1); }
@keyframes bilPop { from { opacity:0; transform:translateY(10px) scale(.98) } to { opacity:1; transform:none } }
.bil-head { display:flex; align-items:flex-start; justify-content:space-between; padding:16px 18px 12px; background:#fff; border-bottom:1px solid var(--zw-border); }
.bil-head h3 { margin:0; font-size:17px; font-weight:800; color:var(--zw-text); }
.bil-head span { font-size:12px; color:var(--zw-text-muted); }
.bil-x { background:none; border:none; cursor:pointer; color:var(--zw-text-muted); }
.bil-progress { height:4px; background:var(--zw-bg-subtle); }
.bil-progress span { display:block; height:100%; background:var(--brand-primary, #7c3aed); transition:width .3s cubic-bezier(.2,.7,.3,1); }
.bil-body { padding:16px 18px; overflow-y:auto; display:flex; flex-direction:column; gap:18px; }
.bil-q-label { font-size:13.5px; font-weight:700; color:var(--zw-text); margin-bottom:8px; }
.bil-q-label em { font-weight:500; font-style:normal; color:var(--zw-text-faint); font-size:11.5px; }
.bil-opts { display:flex; flex-direction:column; gap:6px; }
.bil-opt { display:flex; align-items:center; gap:9px; text-align:left; font-size:13px; padding:9px 12px; border:1px solid var(--zw-border); border-radius:10px; background:#fff; color:var(--zw-text-soft); cursor:pointer; transition:all .14s; }
.bil-opt:hover { border-color:color-mix(in srgb, var(--brand-primary, #7c3aed) 40%, var(--zw-border)); }
.bil-opt.on { border-color:var(--brand-primary, #7c3aed); background:color-mix(in srgb, var(--brand-primary, #7c3aed) 7%, #fff); color:var(--zw-text); font-weight:600; }
.bil-mark { width:18px; height:18px; border-radius:50%; border:2px solid var(--zw-border); display:flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0; transition:all .14s; }
.bil-mark.sq { border-radius:5px; }
.bil-opt.on .bil-mark { background:var(--brand-primary, #7c3aed); border-color:var(--brand-primary, #7c3aed); }
.bil-foot { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 18px; background:#fff; border-top:1px solid var(--zw-border); }
.bil-foot-info { font-size:12px; color:var(--zw-text-muted); }
.bil-go { display:inline-flex; align-items:center; gap:7px; background:var(--brand-primary, #7c3aed); color:#fff; border:none; border-radius:10px; padding:11px 18px; font-size:13.5px; font-weight:700; cursor:pointer; transition:transform .14s, opacity .2s; }
.bil-go:hover:not(:disabled) { transform:translateY(-1px); }
.bil-go:disabled { opacity:.5; cursor:default; }
`;
