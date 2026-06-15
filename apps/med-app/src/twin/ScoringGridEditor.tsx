import { useMemo, useState } from 'react';
import { X, RotateCcw, Check, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { getScoringRows, FUNCTIONAL_AXES, LIFESTYLE_KEYS, type ScoringOverride, type ScoringRow } from './transformation';
import { WHEEL_LABELS } from './api';
import { saveScoringConfig, resetScoringConfig } from './scoring-config';

const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
const rowChanged = (r: ScoringRow, d: ScoringRow) =>
  (r.kind === 'ordinal' && JSON.stringify(r.values) !== JSON.stringify(d.values)) || !sameSet(r.life, d.life) || !sameSet(r.fn, d.fn);

/** Éditeur de la grille de scoring (back-office praticien). */
export function ScoringGridEditor({ override, onClose, onSaved }: {
  override: ScoringOverride;
  onClose: () => void;
  onSaved: (o: ScoringOverride) => void;
}) {
  const defaults = useMemo(() => getScoringRows({}), []);
  const defById = useMemo(() => new Map(defaults.map((d) => [d.id, d])), [defaults]);
  const [rows, setRows] = useState<ScoringRow[]>(() => getScoringRows(override));
  const [open, setOpen] = useState<string | null>(null);

  const patch = (id: string, p: Partial<ScoringRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const toggle = (id: string, kind: 'fn' | 'life', key: string) =>
    setRows((rs) => rs.map((r) => {
      if (r.id !== id) return r;
      const arr = kind === 'fn' ? r.fn : r.life;
      const next = arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key];
      return kind === 'fn' ? { ...r, fn: next } : { ...r, life: next };
    }));

  function computeOverride(): ScoringOverride {
    const ov: ScoringOverride = {};
    for (const r of rows) {
      const d = defById.get(r.id);
      if (!d || !rowChanged(r, d)) continue;
      const entry: { values?: number[]; life?: string[]; fn?: string[] } = {};
      if (r.kind === 'ordinal' && r.values) entry.values = r.values;
      entry.life = r.life;
      entry.fn = r.fn;
      ov[r.id] = entry;
    }
    return ov;
  }
  function save() { const ov = computeOverride(); saveScoringConfig(ov); onSaved(ov); }
  function reset() { resetScoringConfig(); setRows(getScoringRows({})); }

  const changedCount = rows.filter((r) => { const d = defById.get(r.id); return d && rowChanged(r, d); }).length;

  return (
    <div className="sg-overlay" onClick={onClose}>
      <div className="sg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sg-head">
          <div>
            <h3><SlidersHorizontal size={16} /> Grille de scoring — Roue</h3>
            <span>Configure quel(s) axe(s) chaque question alimente et le poids de chaque réponse. {changedCount > 0 ? `${changedCount} question(s) personnalisée(s).` : 'Valeurs par défaut.'}</span>
          </div>
          <button className="sg-x" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="sg-body">
          {rows.map((r) => {
            const d = defById.get(r.id)!;
            const changed = rowChanged(r, d);
            const isOpen = open === r.id;
            return (
              <div className={`sg-q${changed ? ' changed' : ''}`} key={r.id}>
                <button className="sg-q-head" onClick={() => setOpen(isOpen ? null : r.id)}>
                  <ChevronDown size={15} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }} />
                  <span className="sg-q-label">{r.label}</span>
                  {changed && <span className="sg-badge">modifié</span>}
                  <span className="sg-q-axes">{[...r.fn, ...r.life].length} axe(s)</span>
                </button>
                {isOpen && (
                  <div className="sg-q-body">
                    {r.kind === 'ordinal' && r.values && (
                      <div className="sg-weights">
                        <div className="sg-sub">Poids par réponse (0–100)</div>
                        {r.options.map((opt, i) => (
                          <div className="sg-w" key={i}>
                            <span className="sg-w-opt" title={opt}>{opt}</span>
                            <input type="number" min={0} max={100} value={r.values![i] ?? 0}
                              onChange={(e) => patch(r.id, { values: r.values!.map((v, idx) => (idx === i ? Math.max(0, Math.min(100, Number(e.target.value))) : v)) })} />
                          </div>
                        ))}
                      </div>
                    )}
                    {r.kind === 'signs' && <div className="sg-sub">Score = 100 − % de signes cochés (axes seulement).</div>}

                    <div className="sg-sub" style={{ marginTop: 10 }}>Axes — matrice fonctionnelle</div>
                    <div className="sg-chips">
                      {FUNCTIONAL_AXES.map((ax) => (
                        <button key={ax.key} className={`sg-chip${r.fn.includes(ax.key) ? ' on' : ''}`} onClick={() => toggle(r.id, 'fn', ax.key)}>{ax.label}</button>
                      ))}
                    </div>
                    <div className="sg-sub" style={{ marginTop: 8 }}>Axes — hygiène de vie</div>
                    <div className="sg-chips">
                      {LIFESTYLE_KEYS.map((k) => (
                        <button key={k} className={`sg-chip life${r.life.includes(k) ? ' on' : ''}`} onClick={() => toggle(r.id, 'life', k)}>{WHEEL_LABELS[k] || k}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="sg-foot">
          <button className="sg-reset" onClick={reset}><RotateCcw size={14} /> Réinitialiser (défauts)</button>
          <div style={{ flex: 1 }} />
          <button className="sg-cancel" onClick={onClose}>Fermer</button>
          <button className="sg-save" onClick={save}><Check size={15} /> Enregistrer la grille</button>
        </div>
        <style>{CSS}</style>
      </div>
    </div>
  );
}

const CSS = `
.sg-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.55); backdrop-filter:blur(3px); display:flex; align-items:center; justify-content:center; z-index:1200; padding:20px; }
.sg-modal { background:var(--zw-bg, #f6efe6); width:min(680px,100%); max-height:90vh; border-radius:18px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 30px 60px -20px rgba(0,0,0,.45); }
.sg-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:16px 18px; background:#fff; border-bottom:1px solid var(--zw-border); }
.sg-head h3 { margin:0; font-size:16px; font-weight:800; color:var(--zw-text); display:flex; align-items:center; gap:7px; }
.sg-head span { font-size:12px; color:var(--zw-text-muted); display:block; margin-top:3px; max-width:520px; }
.sg-x { background:none; border:none; cursor:pointer; color:var(--zw-text-muted); }
.sg-body { padding:12px 14px; overflow-y:auto; display:flex; flex-direction:column; gap:6px; }
.sg-q { border:1px solid var(--zw-border); border-radius:10px; background:#fff; overflow:hidden; }
.sg-q.changed { border-color:color-mix(in srgb, var(--brand-primary, #7c3aed) 45%, var(--zw-border)); }
.sg-q-head { width:100%; display:flex; align-items:center; gap:9px; padding:11px 12px; background:none; border:none; cursor:pointer; text-align:left; }
.sg-q-label { flex:1; font-size:13px; font-weight:600; color:var(--zw-text); }
.sg-badge { font-size:10px; font-weight:800; color:var(--brand-primary, #7c3aed); background:color-mix(in srgb, var(--brand-primary, #7c3aed) 12%, #fff); padding:2px 8px; border-radius:999px; }
.sg-q-axes { font-size:11px; color:var(--zw-text-faint); white-space:nowrap; }
.sg-q-body { padding:4px 14px 14px; border-top:1px solid var(--zw-bg-subtle); }
.sg-sub { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.03em; color:var(--zw-text-faint); margin:8px 0 6px; }
.sg-weights { display:flex; flex-direction:column; gap:5px; }
.sg-w { display:flex; align-items:center; gap:10px; }
.sg-w-opt { flex:1; font-size:12.5px; color:var(--zw-text-soft); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sg-w input { width:62px; padding:5px 8px; border:1px solid var(--zw-border); border-radius:7px; font-size:13px; text-align:center; }
.sg-chips { display:flex; flex-wrap:wrap; gap:5px; }
.sg-chip { font-size:11.5px; padding:4px 10px; border-radius:7px; border:1px solid var(--zw-border); background:#fff; color:var(--zw-text-muted); cursor:pointer; transition:all .12s; }
.sg-chip:hover { border-color:var(--brand-primary, #7c3aed); }
.sg-chip.on { background:var(--brand-primary, #7c3aed); border-color:var(--brand-primary, #7c3aed); color:#fff; }
.sg-chip.life.on { background:#0ea5e9; border-color:#0ea5e9; }
.sg-foot { display:flex; align-items:center; gap:8px; padding:12px 16px; background:#fff; border-top:1px solid var(--zw-border); }
.sg-reset { display:inline-flex; align-items:center; gap:5px; font-size:12px; background:none; border:1px solid var(--zw-border); border-radius:8px; padding:8px 12px; color:var(--zw-text-soft); cursor:pointer; }
.sg-cancel { font-size:13px; background:#fff; border:1px solid var(--zw-border); border-radius:8px; padding:9px 14px; color:var(--zw-text-soft); cursor:pointer; }
.sg-save { display:inline-flex; align-items:center; gap:6px; font-size:13px; font-weight:700; background:var(--brand-primary, #7c3aed); color:#fff; border:none; border-radius:8px; padding:9px 16px; cursor:pointer; }
`;
