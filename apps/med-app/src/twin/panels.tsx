import { useState, useEffect } from 'react';
import { twinApi, WHEEL_LABELS, COLOR_HEX, type OrganColor } from './api';
import {
  Loader2, Sparkles, Users, FlaskConical, FileText, GitBranch, Clock, TrendingUp, Beaker, Search,
} from 'lucide-react';

const panel: React.CSSProperties = { background: '#fff', borderRadius: 14, border: '1px solid #e8eaf0', padding: 18 };
const head: React.CSSProperties = { fontSize: 14, fontWeight: 700, margin: 0, marginBottom: 12, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 7 };
const colorFor = (s: number): string => COLOR_HEX[(s >= 80 ? 'green' : s >= 60 ? 'yellow' : s >= 40 ? 'orange' : 'red') as OrganColor];

// ─── Roue de transformation (Module 2) ─────────────────────────────────────
export function WheelPanel({ patientId }: { patientId: string }) {
  const [domains, setDomains] = useState<Array<{ domain: string; score: number | null }>>([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { twinApi.getWheel(patientId).then((d) => setDomains(d.domains || [])).catch(() => {}); }, [patientId]);

  const cx = 150, cy = 150, R = 120;
  const pts = domains.map((d, i) => {
    const a = (Math.PI * 2 * i) / domains.length - Math.PI / 2;
    const r = ((d.score ?? 0) / 100) * R;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), ax: cx + R * Math.cos(a), ay: cy + R * Math.sin(a), label: WHEEL_LABELS[d.domain] || d.domain, score: d.score };
  });
  const poly = pts.map((p) => `${p.x},${p.y}`).join(' ');

  async function save() {
    setBusy(true);
    try { await twinApi.saveWheel(patientId, domains.map((d) => ({ domain: d.domain, score: d.score ?? 0 }))); setEditing(false); }
    finally { setBusy(false); }
  }

  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={head}>🌱 Roue de transformation</h3>
        <button onClick={() => (editing ? save() : setEditing(true))} disabled={busy} style={{ fontSize: 12, padding: '5px 12px', background: editing ? 'var(--brand-primary)' : '#f1f5f9', color: editing ? '#fff' : '#475569', border: 'none', borderRadius: 7, cursor: 'pointer' }}>
          {busy ? '…' : editing ? 'Enregistrer' : 'Éditer'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'center' }}>
        <svg width="300" height="300" viewBox="0 0 300 300">
          {[0.25, 0.5, 0.75, 1].map((f) => <circle key={f} cx={cx} cy={cy} r={R * f} fill="none" stroke="#e2e8f0" strokeWidth="1" />)}
          {pts.map((p, i) => <line key={i} x1={cx} y1={cy} x2={p.ax} y2={p.ay} stroke="#e2e8f0" strokeWidth="1" />)}
          <polygon points={poly} fill="rgba(124,58,237,0.18)" stroke="#7c3aed" strokeWidth="2" />
          {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#7c3aed" />)}
        </svg>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {domains.map((d, i) => (
            <div key={d.domain} style={{ fontSize: 12, color: '#475569', display: 'flex', justifyContent: 'space-between', gap: 6 }}>
              <span>{WHEEL_LABELS[d.domain] || d.domain}</span>
              {editing ? (
                <input type="number" min="0" max="100" value={d.score ?? 0} onChange={(e) => { const v = [...domains]; v[i] = { ...d, score: Number(e.target.value) }; setDomains(v); }} style={{ width: 50, fontSize: 12, padding: '1px 4px', border: '1px solid #e2e8f0', borderRadius: 4 }} />
              ) : (
                <strong style={{ color: d.score != null ? colorFor(d.score) : '#cbd5e1' }}>{d.score ?? '—'}</strong>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Mindmap biologique + corrélations (Modules 8/9/17/22) ──────────────────
export function MindmapPanel({ patientId }: { patientId: string }) {
  const [graph, setGraph] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const [corr, setCorr] = useState<any>(null);
  useEffect(() => {
    twinApi.graph().then(setGraph).catch(() => {});
    twinApi.correlations(patientId).then(setCorr).catch(() => {});
  }, [patientId]);

  const nodes = graph.nodes.slice(0, 16);
  const cx = 250, cy = 170, R = 140;
  const pos = new Map<string, { x: number; y: number }>();
  nodes.forEach((n, i) => {
    const a = (Math.PI * 2 * i) / nodes.length;
    pos.set(n.ref_code, { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
  });
  const typeColor: Record<string, string> = { organ: '#0ea5e9', symptom: '#f59e0b', condition: '#ef4444', hormone: '#7c3aed', biomarker: '#10b981', system: '#64748b' };

  return (
    <div style={panel}>
      <h3 style={head}><GitBranch size={15} color="#7c3aed" /> Mindmap biologique & corrélations</h3>
      <svg width="100%" height="340" viewBox="0 0 500 340">
        {graph.edges.map((e: any, i: number) => {
          const a = pos.get(e.from_code), b = pos.get(e.to_code);
          if (!a || !b) return null;
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#cbd5e1" strokeWidth={Math.max(1, (e.weight || 0.5) * 3)} opacity="0.6" />;
        })}
        {nodes.map((n: any) => {
          const p = pos.get(n.ref_code); if (!p) return null;
          return (
            <g key={n.id}>
              <circle cx={p.x} cy={p.y} r="7" fill={typeColor[n.node_type] || '#64748b'} />
              <text x={p.x} y={p.y - 11} fontSize="9" textAnchor="middle" fill="#334155">{n.label_fr}</text>
            </g>
          );
        })}
      </svg>
      {corr && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Corrélations détectées (données patient)</div>
          {(corr.biomarker_organ || []).length === 0 ? (
            <p style={{ fontSize: 12, color: '#94a3b8' }}>Aucune valeur anormale — saisissez des biomarqueurs.</p>
          ) : (
            (corr.biomarker_organ || []).slice(0, 12).map((c: any, i: number) => (
              <div key={i} style={{ fontSize: 12, color: '#475569', padding: '2px 0' }}>
                <strong>{c.from_label}</strong> ({c.flag}) → {c.to}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Timeline santé 360 (Module 21) ─────────────────────────────────────────
const EVENT_TYPES = [
  { v: 'illness', l: 'Maladie' }, { v: 'surgery', l: 'Chirurgie' }, { v: 'vaccination', l: 'Vaccination' },
  { v: 'pregnancy', l: 'Grossesse' }, { v: 'stress', l: 'Stress majeur' }, { v: 'diet_change', l: 'Changement alimentaire' }, { v: 'medication', l: 'Médication' },
];
export function TimelinePanel({ patientId }: { patientId: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [form, setForm] = useState({ event_type: 'illness', title: '', occurred_at: '' });
  const reload = () => twinApi.listEvents(patientId).then(setEvents).catch(() => {});
  useEffect(() => { reload(); }, [patientId]);
  async function add() {
    if (!form.title || !form.occurred_at) return;
    await twinApi.createEvent(patientId, form);
    setForm({ event_type: 'illness', title: '', occurred_at: '' });
    reload();
  }
  return (
    <div style={panel}>
      <h3 style={head}><Clock size={15} color="#0ea5e9" /> Timeline santé 360°</h3>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12 }}>
          {EVENT_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
        <input placeholder="Titre" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ flex: 1, minWidth: 120, padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12 }} />
        <input type="date" value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12 }} />
        <button onClick={add} style={{ padding: '6px 12px', background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>+ Ajouter</button>
      </div>
      {events.length === 0 ? <p style={{ fontSize: 12, color: '#94a3b8' }}>Aucun événement.</p> : (
        <div style={{ borderLeft: '2px solid #e2e8f0', paddingLeft: 14 }}>
          {events.map((e) => (
            <div key={e.id} style={{ position: 'relative', marginBottom: 12 }}>
              <span style={{ position: 'absolute', left: -19, top: 3, width: 8, height: 8, borderRadius: '50%', background: '#0ea5e9' }} />
              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1e293b' }}>{e.title}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(e.occurred_at).toLocaleDateString('fr')} · {EVENT_TYPES.find((t) => t.v === e.event_type)?.l || e.event_type}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Analyse longitudinale (Module 26) ──────────────────────────────────────
export function LongitudinalPanel({ patientId }: { patientId: string }) {
  const [hist, setHist] = useState<any>(null);
  useEffect(() => { twinApi.history(patientId).then(setHist).catch(() => {}); }, [patientId]);
  const series: Array<[string, Array<{ t: string; score: number }>]> = hist ? Object.entries(hist.organSeries || {}) : [];
  return (
    <div style={panel}>
      <h3 style={head}><TrendingUp size={15} color="#10b981" /> Analyse longitudinale</h3>
      {series.length === 0 ? <p style={{ fontSize: 12, color: '#94a3b8' }}>Pas encore d'historique (recalculez les scores à plusieurs dates).</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 12 }}>
          {series.map(([organ, pts]) => {
            const w = 160, h = 40, max = 100;
            const step = pts.length > 1 ? w / (pts.length - 1) : 0;
            const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${h - (p.score / max) * h}`).join(' ');
            const last = pts[pts.length - 1]?.score ?? 0;
            return (
              <div key={organ} style={{ background: '#f8fafc', borderRadius: 8, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: '#475569' }}>{organ}</span>
                  <strong style={{ color: colorFor(last) }}>{last}</strong>
                </div>
                <svg width={w} height={h}><path d={path} fill="none" stroke={colorFor(last)} strokeWidth="2" /></svg>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Simulateur d'intervention (Module 23) ──────────────────────────────────
export function SimulatorPanel({ patientId }: { patientId: string }) {
  const [interventions, setInterventions] = useState<any[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  async function run(keys: string[]) {
    setBusy(true);
    try { const r = await twinApi.simulate(patientId, keys); setInterventions(r.interventions || []); setResult(r); } finally { setBusy(false); }
  }
  useEffect(() => { run([]); /* charge le catalogue */ }, [patientId]);
  function toggle(k: string) { const s = new Set(picked); s.has(k) ? s.delete(k) : s.add(k); setPicked(s); run([...s]); }

  return (
    <div style={panel}>
      <h3 style={head}><Beaker size={15} color="#f97316" /> Simulateur d'intervention</h3>
      <p style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 0 }}>Scénario probabiliste — estimation, jamais une promesse de résultat.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {interventions.map((i) => (
          <button key={i.key} onClick={() => toggle(i.key)} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 20, border: '1px solid', cursor: 'pointer', background: picked.has(i.key) ? '#7c3aed' : '#fff', color: picked.has(i.key) ? '#fff' : '#475569', borderColor: picked.has(i.key) ? '#7c3aed' : '#e2e8f0' }}>
            {i.label_fr}
          </button>
        ))}
      </div>
      {busy && <Loader2 size={16} className="spin" />}
      {result?.global_indices && picked.size > 0 && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            {[['Vitalité', result.global_indices.vitality], ['Inflammation', -result.global_indices.inflammation_load], ['Métabolisme', result.global_indices.metabolic_health]].map(([l, v]: any) => (
              <div key={l} style={{ flex: 1, background: '#f8fafc', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: v > 0 ? '#10b981' : v < 0 ? '#ef4444' : '#64748b' }}>{v > 0 ? '+' : ''}{v}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{l}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', gap: 8 }}>
            {(result.organ_deltas || []).filter((d: any) => d.delta !== 0).map((d: any) => (
              <div key={d.organ_code} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', background: '#f8fafc', borderRadius: 6, padding: '5px 8px' }}>
                <span style={{ color: '#475569' }}>{d.organ_code}</span>
                <span style={{ color: '#10b981', fontWeight: 600 }}>{d.before}→{d.after} (+{d.delta})</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Lecteur de bilan / ordonnance (Module 3) ───────────────────────────────
export function LabReaderPanel({ patientId, onChange }: { patientId: string; onChange: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function run() {
    if (!text.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const doc = await twinApi.createDocument(patientId, text.trim());
      const res = await twinApi.extractDocument(patientId, doc.id);
      setMsg(`${res.extracted ?? 0} biomarqueur(s) extrait(s) et intégré(s).`);
      setText('');
      onChange();
    } catch (e: any) { setMsg(e?.message || 'Extraction indisponible (IA).'); }
    finally { setBusy(false); }
  }
  return (
    <div style={panel}>
      <h3 style={head}><FileText size={15} color="#0ea5e9" /> Lecteur de bilan / ordonnance (IA)</h3>
      <p style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 0 }}>Collez le texte d'un compte-rendu de laboratoire — l'IA extrait les biomarqueurs.</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Ex: CRP 4.1 mg/L, TSH 3.3 mUI/L, Vitamine D 21 ng/mL…" style={{ width: '100%', boxSizing: 'border-box', padding: 10, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit' }} />
      <button onClick={run} disabled={busy} style={{ marginTop: 8, width: '100%', padding: 9, background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}>
        {busy ? 'Extraction…' : 'Extraire les biomarqueurs'}
      </button>
      {msg && <div style={{ marginTop: 8, fontSize: 12, color: '#475569' }}>{msg}</div>}
    </div>
  );
}

// ─── Carte métabolique (Module 8) — regroupement par système ────────────────
export function MetabolicMapPanel({ state, refs }: { state: any; refs: any }) {
  const byCode = new Map<string, any>((refs.biomarkers || []).map((b: any) => [b.code, b]));
  const groups: Record<string, any[]> = {};
  for (const b of state?.biomarkers || []) {
    const ref = byCode.get(b.biomarker_code);
    const cat = ref?.category || 'autre';
    (groups[cat] = groups[cat] || []).push({ ...b, ref });
  }
  const flagColor = (f: string) => (f === 'normal' ? '#10b981' : f === 'critical' ? '#ef4444' : '#f59e0b');
  return (
    <div style={panel}>
      <h3 style={head}><FlaskConical size={15} color="#7c3aed" /> Carte métabolique</h3>
      {Object.keys(groups).length === 0 ? <p style={{ fontSize: 12, color: '#94a3b8' }}>Aucune donnée.</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 12 }}>
          {Object.entries(groups).map(([cat, items]) => (
            <div key={cat} style={{ background: '#f8fafc', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>{cat}</div>
              {items.map((b) => (
                <div key={b.biomarker_code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
                  <span style={{ color: '#475569' }}>{b.ref?.name_fr || b.biomarker_code}</span>
                  <span><strong>{b.value}</strong> <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: flagColor(b.flag), marginLeft: 4 }} /></span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Copilote IA : Root cause + Conseil multi-agents + Science (M15/16/33) ──
export function CopilotPanel({ patientId }: { patientId: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [rootCauses, setRootCauses] = useState<any[]>([]);
  const [council, setCouncil] = useState<any>(null);
  const [query, setQuery] = useState('');
  const [science, setScience] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  async function go(kind: 'root' | 'council' | 'science') {
    setBusy(kind); setErr(null);
    try {
      if (kind === 'root') setRootCauses((await twinApi.rootCause(patientId)).root_causes || []);
      if (kind === 'council') setCouncil(await twinApi.council(patientId));
      if (kind === 'science') setScience(await twinApi.scientific(query));
    } catch (e: any) { setErr(e?.message || 'Indisponible (IA)'); }
    finally { setBusy(null); }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 16 }}>
      {/* Root Cause */}
      <div style={panel}>
        <h3 style={head}><Sparkles size={15} color="#7c3aed" /> Root Cause Explorer</h3>
        <button onClick={() => go('root')} disabled={!!busy} style={{ width: '100%', padding: 9, background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 10 }}>
          {busy === 'root' ? <Loader2 size={14} className="spin" /> : 'Identifier les causes racines'}
        </button>
        {rootCauses.map((c, i) => (
          <div key={i} style={{ padding: 10, background: '#faf5ff', borderRadius: 8, marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong style={{ fontSize: 13, color: '#1e293b' }}>{c.label_fr}</strong>{c.probability != null && <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>{Math.round(c.probability * 100)}%</span>}</div>
            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>{c.reasoning_fr}</div>
          </div>
        ))}
      </div>

      {/* Conseil multi-agents */}
      <div style={panel}>
        <h3 style={head}><Users size={15} color="#0ea5e9" /> Conseil multi-agents</h3>
        <button onClick={() => go('council')} disabled={!!busy} style={{ width: '100%', padding: 9, background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 10 }}>
          {busy === 'council' ? <Loader2 size={14} className="spin" /> : 'Réunir le conseil d\'experts IA'}
        </button>
        {council && (
          <div>
            <div style={{ padding: 10, background: '#eff6ff', borderRadius: 8, marginBottom: 8, fontSize: 12.5, color: '#1e293b' }}><strong>Consensus :</strong> {council.consensus_fr}</div>
            {(council.experts || []).map((e: any, i: number) => (
              <div key={i} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                <strong style={{ color: '#0ea5e9' }}>{e.specialty_fr}</strong> — {e.key_recommendation_fr}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Moteur scientifique */}
      <div style={panel}>
        <h3 style={head}><Search size={15} color="#10b981" /> Moteur scientifique (PubMed)</h3>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ex: insulin resistance inflammation" style={{ flex: 1, padding: '7px 9px', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12.5 }} />
          <button onClick={() => go('science')} disabled={!!busy || !query} style={{ padding: '7px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer' }}>{busy === 'science' ? '…' : 'Rechercher'}</button>
        </div>
        {(science?.results || []).map((r: any) => (
          <a key={r.pmid} href={r.url} target="_blank" rel="noreferrer" style={{ display: 'block', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12, color: '#1e293b', textDecoration: 'none' }}>
            {r.title} <span style={{ color: '#94a3b8' }}>· {r.source} {r.year}</span>
          </a>
        ))}
      </div>
      {err && <div style={{ gridColumn: '1/-1', fontSize: 12, color: '#991b1b' }}>{err}</div>}
    </div>
  );
}
