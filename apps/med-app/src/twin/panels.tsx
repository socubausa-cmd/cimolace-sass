import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { twinApi, WHEEL_LABELS, COLOR_HEX, type OrganColor, type LabDocument } from './api';
import {
  Loader2, Sparkles, Users, FlaskConical, FileText, GitBranch, Clock, TrendingUp, Beaker, Search, Camera as CameraIcon,
} from 'lucide-react';
import { useCamera } from '../native/useCamera';
import { BodyViewer } from './BodyViewer';

const panel: React.CSSProperties = { background: '#fff', borderRadius: 14, border: '1px solid var(--zw-border)', padding: 18 };
const head: React.CSSProperties = { fontSize: 14, fontWeight: 700, margin: 0, marginBottom: 12, color: 'var(--zw-text)', display: 'flex', alignItems: 'center', gap: 7 };
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
        <button onClick={() => (editing ? save() : setEditing(true))} disabled={busy} style={{ fontSize: 12, padding: '5px 12px', background: editing ? 'var(--brand-primary)' : 'var(--zw-bg-subtle)', color: editing ? '#fff' : 'var(--zw-text-soft)', border: 'none', borderRadius: 7, cursor: 'pointer' }}>
          {busy ? '…' : editing ? 'Enregistrer' : 'Éditer'}
        </button>
      </div>
      <div className="twin-wheel-grid" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'center' }}>
        <svg className="twin-wheel-svg" width="300" height="300" viewBox="0 0 300 300" preserveAspectRatio="xMidYMid meet" style={{ maxWidth: '100%', height: 'auto' }}>
          {[0.25, 0.5, 0.75, 1].map((f) => <circle key={f} cx={cx} cy={cy} r={R * f} fill="none" stroke="var(--zw-border)" strokeWidth="1" />)}
          {pts.map((p, i) => <line key={i} x1={cx} y1={cy} x2={p.ax} y2={p.ay} stroke="var(--zw-border)" strokeWidth="1" />)}
          <polygon points={poly} fill="rgba(124,58,237,0.18)" stroke="var(--zw-violet)" strokeWidth="2" />
          {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--zw-violet)" />)}
        </svg>
        <div className="twin-wheel-labels" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {domains.map((d, i) => (
            <div key={d.domain} style={{ fontSize: 12, color: 'var(--zw-text-soft)', display: 'flex', justifyContent: 'space-between', gap: 6 }}>
              <span>{WHEEL_LABELS[d.domain] || d.domain}</span>
              {editing ? (
                <input type="number" min="0" max="100" value={d.score ?? 0} onChange={(e) => { const v = [...domains]; v[i] = { ...d, score: Number(e.target.value) }; setDomains(v); }} style={{ width: 50, fontSize: 12, padding: '1px 4px', border: '1px solid var(--zw-border)', borderRadius: 4 }} />
              ) : (
                <strong style={{ color: d.score != null ? colorFor(d.score) : 'var(--zw-border-strong)' }}>{d.score ?? '—'}</strong>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Mindmap biologique + corrélations (Modules 8/9/17/22) — NAVIGABLE ──────
const mmBtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 8, border: '1px solid var(--zw-border)', background: '#fff',
  color: 'var(--zw-text-soft)', fontSize: 15, lineHeight: 1, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
};
const MM_W = 520, MM_H = 400;
const TYPE_COLOR: Record<string, string> = { organ: '#0ea5e9', symptom: '#f59e0b', condition: '#ef4444', hormone: 'var(--zw-violet)', biomarker: '#10b981', system: 'var(--zw-text-muted)' };
const TYPE_LABEL: Record<string, string> = { organ: 'Organe', symptom: 'Symptôme', condition: 'Condition', hormone: 'Hormone', biomarker: 'Biomarqueur', system: 'Système' };

export function MindmapPanel({ patientId }: { patientId: string }) {
  const [graph, setGraph] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const [corr, setCorr] = useState<any>(null);
  useEffect(() => {
    twinApi.graph().then(setGraph).catch(() => {});
    twinApi.correlations(patientId).then(setCorr).catch(() => {});
  }, [patientId]);

  const nodes = useMemo(() => graph.nodes.slice(0, 16), [graph.nodes]);

  // Draggable positions, seeded from a radial layout whenever the node set changes.
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>({});
  useEffect(() => {
    const cx = MM_W / 2, cy = MM_H / 2, R = 150;
    const p: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n, i) => {
      const a = -Math.PI / 2 + (Math.PI * 2 * i) / Math.max(1, nodes.length);
      p[n.ref_code] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
    });
    setPos(p);
  }, [nodes]);

  const [view, setView] = useState({ tx: 0, ty: 0, k: 1 });
  const [sel, setSel] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ mode: 'pan' | 'node' | null; code?: string; lx: number; ly: number; moved: boolean }>({ mode: null, lx: 0, ly: 0, moved: false });

  // screen → viewBox coordinates
  const toVB = (cx: number, cy: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || !r.width) return { x: 0, y: 0 };
    return { x: ((cx - r.left) / r.width) * MM_W, y: ((cy - r.top) / r.height) * MM_H };
  };
  const startPan = (e: React.PointerEvent) => {
    svgRef.current?.setPointerCapture?.(e.pointerId);
    const v = toVB(e.clientX, e.clientY);
    drag.current = { mode: 'pan', lx: v.x, ly: v.y, moved: false };
  };
  const startNode = (e: React.PointerEvent, code: string) => {
    e.stopPropagation();
    svgRef.current?.setPointerCapture?.(e.pointerId);
    const v = toVB(e.clientX, e.clientY);
    drag.current = { mode: 'node', code, lx: v.x, ly: v.y, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.mode) return;
    const v = toVB(e.clientX, e.clientY);
    const dx = v.x - d.lx, dy = v.y - d.ly;
    if (Math.abs(dx) > 1.2 || Math.abs(dy) > 1.2) d.moved = true;
    if (d.mode === 'pan') setView((s) => ({ ...s, tx: s.tx + dx, ty: s.ty + dy }));
    else if (d.code) setPos((p) => ({ ...p, [d.code!]: { x: (p[d.code!]?.x ?? 0) + dx / view.k, y: (p[d.code!]?.y ?? 0) + dy / view.k } }));
    d.lx = v.x; d.ly = v.y;
  };
  const endDrag = () => {
    const d = drag.current;
    if (d.mode === 'node' && !d.moved && d.code) setSel((s) => (s === d.code ? null : d.code!));
    else if (d.mode === 'pan' && !d.moved) setSel(null);
    drag.current = { mode: null, lx: 0, ly: 0, moved: false };
  };
  const onWheel = (e: React.WheelEvent) => {
    const v = toVB(e.clientX, e.clientY);
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setView((s) => {
      const k = Math.min(3, Math.max(0.4, s.k * factor));
      const f = k / s.k;
      return { k, tx: v.x - (v.x - s.tx) * f, ty: v.y - (v.y - s.ty) * f };
    });
  };
  const zoomBy = (f: number) => setView((s) => {
    const k = Math.min(3, Math.max(0.4, s.k * f));
    const cx = MM_W / 2, cy = MM_H / 2, r = k / s.k;
    return { k, tx: cx - (cx - s.tx) * r, ty: cy - (cy - s.ty) * r };
  });

  const conn = useMemo(() => {
    if (!sel) return null;
    const s = new Set<string>([sel]);
    graph.edges.forEach((e: any) => { if (e.from_code === sel) s.add(e.to_code); if (e.to_code === sel) s.add(e.from_code); });
    return s;
  }, [sel, graph.edges]);

  const nodeByCode = useMemo(() => Object.fromEntries(graph.nodes.map((n: any) => [n.ref_code, n])), [graph.nodes]);
  const selNode: any = sel ? nodeByCode[sel] : null;
  const selEdges = useMemo(() => (sel ? graph.edges.filter((e: any) => e.from_code === sel || e.to_code === sel) : []), [sel, graph.edges]);

  return (
    <div style={panel}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
        <h3 style={{ ...head, marginBottom: 0 }}><GitBranch size={15} color="var(--zw-violet)" /> Mindmap biologique & corrélations</h3>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => zoomBy(1.15)} style={mmBtn} title="Zoom avant">+</button>
          <button onClick={() => zoomBy(1 / 1.15)} style={mmBtn} title="Zoom arrière">−</button>
          <button onClick={() => { setView({ tx: 0, ty: 0, k: 1 }); setSel(null); }} style={mmBtn} title="Réinitialiser la vue">⟲</button>
        </div>
      </div>
      <div style={{ position: 'relative', border: '1px solid var(--zw-border)', borderRadius: 12, background: 'var(--zw-bg-subtle)', overflow: 'hidden' }}>
        <svg
          ref={svgRef}
          width="100%"
          viewBox={`0 0 ${MM_W} ${MM_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ display: 'block', width: '100%', height: 'auto', maxHeight: 460, touchAction: 'none', cursor: 'grab' }}
          onPointerDown={startPan}
          onPointerMove={onMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={onWheel}
        >
          <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
            {graph.edges.map((e: any, i: number) => {
              const a = pos[e.from_code], b = pos[e.to_code];
              if (!a || !b) return null;
              const touches = sel && (e.from_code === sel || e.to_code === sel);
              const active = !conn || (conn.has(e.from_code) && conn.has(e.to_code));
              return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={touches ? 'var(--zw-violet)' : 'var(--zw-border-strong)'}
                strokeWidth={touches ? 2.2 : Math.max(1, (e.weight || 0.5) * 3)}
                opacity={active ? (touches ? 0.95 : 0.5) : 0.1} />;
            })}
            {nodes.map((n: any) => {
              const p = pos[n.ref_code]; if (!p) return null;
              const dim = conn ? !conn.has(n.ref_code) : false;
              const isSel = sel === n.ref_code;
              return (
                <g key={n.id} transform={`translate(${p.x} ${p.y})`} opacity={dim ? 0.22 : 1}
                  style={{ cursor: 'pointer' }} onPointerDown={(ev) => startNode(ev, n.ref_code)}>
                  <circle r={isSel ? 11 : 8} fill={TYPE_COLOR[n.node_type] || 'var(--zw-text-muted)'}
                    stroke={isSel ? 'var(--zw-violet)' : '#fff'} strokeWidth={isSel ? 3 : 1.5} />
                  <text y={-14} fontSize={11} fontWeight={isSel ? 700 : 500} textAnchor="middle"
                    fill="var(--zw-text-soft)" style={{ pointerEvents: 'none', userSelect: 'none' }}>{n.label_fr}</text>
                </g>
              );
            })}
          </g>
        </svg>
        {selNode && (
          <div style={{ position: 'absolute', top: 8, right: 8, width: 'min(290px, 84%)', maxHeight: 'calc(100% - 16px)', overflowY: 'auto', background: '#fff', border: '1px solid var(--zw-border)', borderRadius: 12, boxShadow: '0 12px 32px -10px rgba(42,16,23,0.3)', padding: 14, zIndex: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--zw-text-muted)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: TYPE_COLOR[selNode.node_type] || 'var(--zw-text-muted)' }} />
                  {TYPE_LABEL[selNode.node_type] || selNode.node_type}
                </span>
                <h4 style={{ fontFamily: 'var(--zw-font-display)', fontSize: 19, fontWeight: 700, margin: '3px 0 0', color: 'var(--zw-text)', lineHeight: 1.15 }}>{selNode.label_fr}</h4>
              </div>
              <button onClick={() => setSel(null)} title="Fermer" style={{ ...mmBtn, width: 24, height: 24, fontSize: 16, flexShrink: 0 }}>×</button>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--zw-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 12 }}>Connexions ({selEdges.length})</div>
            {selEdges.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--zw-text-faint)', marginTop: 4 }}>Aucune connexion référencée.</p>
            ) : selEdges.map((e: any, i: number) => {
              const otherCode = e.from_code === sel ? e.to_code : e.from_code;
              const incoming = e.to_code === sel;
              return (
                <div key={i} style={{ padding: '8px 0', borderTop: i === 0 ? 'none' : '1px solid var(--zw-border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--zw-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--zw-violet)' }}>{incoming ? '←' : '→'}</span>
                    {nodeByCode[otherCode]?.label_fr || otherCode}
                  </div>
                  {e.label_fr && <div style={{ fontSize: 12, color: 'var(--zw-text-soft)', fontStyle: 'italic', marginTop: 2 }}>{e.label_fr}</div>}
                  <div style={{ fontSize: 10.5, color: 'var(--zw-text-faint)', marginTop: 3 }}>
                    force {Math.round((e.weight || 0) * 100)}%{e.evidence_level ? ` · preuve ${e.evidence_level}` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <p style={{ fontSize: 11, color: 'var(--zw-text-faint)', marginTop: 6 }}>
        Glissez pour déplacer · molette / +− pour zoomer · cliquez un nœud pour isoler ses liens{sel ? ' · cliquez le fond pour tout réafficher' : ''}
      </p>
      {corr && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--zw-text-soft)', marginBottom: 4 }}>Corrélations détectées (données patient)</div>
          {(corr.biomarker_organ || []).length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--zw-text-faint)' }}>Aucune valeur anormale — saisissez des biomarqueurs.</p>
          ) : (
            (corr.biomarker_organ || []).slice(0, 12).map((c: any, i: number) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--zw-text-soft)', padding: '2px 0' }}>
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
      <div className="twin-timeline-form" style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} style={{ padding: '6px 8px', border: '1px solid var(--zw-border)', borderRadius: 7, fontSize: 12 }}>
          {EVENT_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
        <input placeholder="Titre" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ flex: 1, minWidth: 120, padding: '6px 8px', border: '1px solid var(--zw-border)', borderRadius: 7, fontSize: 12 }} />
        <input type="date" value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} style={{ padding: '6px 8px', border: '1px solid var(--zw-border)', borderRadius: 7, fontSize: 12 }} />
        <button onClick={add} style={{ padding: '6px 12px', background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>+ Ajouter</button>
      </div>
      {events.length === 0 ? <p style={{ fontSize: 12, color: 'var(--zw-text-faint)' }}>Aucun événement.</p> : (
        <div style={{ borderLeft: '2px solid var(--zw-border)', paddingLeft: 14 }}>
          {events.map((e) => (
            <div key={e.id} style={{ position: 'relative', marginBottom: 12 }}>
              <span style={{ position: 'absolute', left: -19, top: 3, width: 8, height: 8, borderRadius: '50%', background: '#0ea5e9' }} />
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--zw-text)' }}>{e.title}</div>
              <div style={{ fontSize: 11, color: 'var(--zw-text-faint)' }}>{new Date(e.occurred_at).toLocaleDateString('fr')} · {EVENT_TYPES.find((t) => t.v === e.event_type)?.l || e.event_type}</div>
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
      {series.length === 0 ? <p style={{ fontSize: 12, color: 'var(--zw-text-faint)' }}>Pas encore d'historique (recalculez les scores à plusieurs dates).</p> : (
        <div className="twin-longitudinal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 12 }}>
          {series.map(([organ, pts]) => {
            const w = 160, h = 40, max = 100;
            const step = pts.length > 1 ? w / (pts.length - 1) : 0;
            const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${h - (p.score / max) * h}`).join(' ');
            const last = pts[pts.length - 1]?.score ?? 0;
            return (
              <div key={organ} style={{ background: 'var(--zw-bg)', borderRadius: 8, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--zw-text-soft)' }}>{organ}</span>
                  <strong style={{ color: colorFor(last) }}>{last}</strong>
                </div>
                <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
                  <path d={path} fill="none" stroke={colorFor(last)} strokeWidth="2" />
                </svg>
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

  const projColor = (s: number): OrganColor => (s >= 80 ? 'green' : s >= 60 ? 'yellow' : s >= 40 ? 'orange' : 'red');
  const projected = (result?.organ_deltas || []).map((d: any) => ({
    code: d.organ_code, name_fr: '', position: null,
    score: { score: d.after, color: projColor(d.after) },
  }));

  return (
    <div style={panel}>
      <h3 style={head}><Beaker size={15} color="#f97316" /> Simulateur d'intervention</h3>
      <p style={{ fontSize: 11.5, color: 'var(--zw-text-faint)', marginTop: 0 }}>Scénario probabiliste — estimation, jamais une promesse de résultat.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {interventions.map((i) => (
          <button key={i.key} onClick={() => toggle(i.key)} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 20, border: '1px solid', cursor: 'pointer', background: picked.has(i.key) ? 'var(--zw-violet)' : '#fff', color: picked.has(i.key) ? '#fff' : 'var(--zw-text-soft)', borderColor: picked.has(i.key) ? 'var(--zw-violet)' : 'var(--zw-border)' }}>
            {i.label_fr}
          </button>
        ))}
      </div>
      {busy && <Loader2 size={16} className="spin" />}
      {result?.global_indices && picked.size > 0 && (
        <>
          <div className="twin-simulator-indices" style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            {[['Vitalité', result.global_indices.vitality], ['Inflammation', -result.global_indices.inflammation_load], ['Métabolisme', result.global_indices.metabolic_health]].map(([l, v]: any) => (
              <div key={l} style={{ flex: 1, background: 'var(--zw-bg)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: v > 0 ? '#10b981' : v < 0 ? '#ef4444' : 'var(--zw-text-muted)' }}>{v > 0 ? '+' : ''}{v}</div>
                <div style={{ fontSize: 11, color: 'var(--zw-text-muted)' }}>{l}</div>
              </div>
            ))}
          </div>
          {projected.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--zw-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Projection sur le corps</div>
              <div style={{ height: 430 }}>
                <BodyViewer organs={projected as any} selected={null} onSelect={() => {}} />
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px,1fr))', gap: 8 }}>
            {(result.organ_deltas || []).filter((d: any) => d.delta !== 0).map((d: any) => (
              <div key={d.organ_code} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', background: 'var(--zw-bg)', borderRadius: 6, padding: '5px 8px' }}>
                <span style={{ color: 'var(--zw-text-soft)' }}>{d.organ_code}</span>
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
const LAB_READER_ACCEPT = 'application/pdf,image/jpeg,image/jpg,image/png,image/webp,image/gif';
const LAB_READER_MAX_MB = 10;

type LabExtractedValue = {
  biomarker_code: string;
  value: number;
  unit?: string;
  confidence?: number | null;
};

// 8 codes essentiels pour le template CSV (Chantier connecteur labo).
const CSV_TEMPLATE_CODES = [
  'CRP_HS', 'TSH', 'VIT_D', 'FERRITIN', 'HOMA_IR', 'HBA1C', 'B12', 'MAGNESIUM',
];

/**
 * Parser CSV ultra-simple : sépare lignes par \n, cellules par , ou ;.
 * Tolère un header optionnel (détecté par "code" en 1ère cellule).
 * Colonnes attendues : code,value[,unit[,measured_at]].
 */
function parseCsvText(raw: string): Array<{ code: string; value: number; unit?: string; measured_at?: string }> {
  const out: Array<{ code: string; value: number; unit?: string; measured_at?: string }> = [];
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const sep = line.includes(';') ? ';' : ',';
    const cells = line.split(sep).map((c) => c.trim());
    if (i === 0 && cells[0]?.toLowerCase() === 'code') continue; // header
    const [code, valueRaw, unit, measured_at] = cells;
    if (!code) continue;
    const value = Number(String(valueRaw ?? '').replace(',', '.'));
    out.push({
      code: code.toUpperCase(),
      value,
      unit: unit || undefined,
      measured_at: measured_at || undefined,
    });
  }
  return out;
}

function buildCsvTemplate(): string {
  const header = 'code,value,unit,measured_at';
  const rows = CSV_TEMPLATE_CODES.map((c) => `${c},,,`);
  return [header, ...rows].join('\n') + '\n';
}

export function LabReaderPanel({ patientId, onChange }: { patientId: string; onChange: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [extracted, setExtracted] = useState<LabExtractedValue[] | null>(null);
  const [inserted, setInserted] = useState(false);
  const [history, setHistory] = useState<LabDocument[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [csvImportResult, setCsvImportResult] = useState<{ imported: number; skipped: Array<{ code: string; reason: string }> } | null>(null);
  const camera = useCamera();

  // Capture native d'une photo de bilan papier — fallback web automatique.
  async function takePhotoOfLab() {
    setErr(null); setMsg(null); setExtracted(null); setInserted(false);
    const photo = await camera.takePhoto({ filename: `bilan-${Date.now()}.jpg`, quality: 85 });
    if (!photo) {
      if (camera.error) setErr(camera.error);
      return;
    }
    if (photo.size > LAB_READER_MAX_MB * 1024 * 1024) {
      setErr(`Photo trop volumineuse (${Math.round(photo.size / 1024 / 1024)} Mo). Limite : ${LAB_READER_MAX_MB} Mo.`);
      return;
    }
    setBusy(true);
    try {
      const res = await twinApi.uploadDocument(patientId, photo, { source_type: 'blood' });
      const values: LabExtractedValue[] = res?.values || [];
      setExtracted(values);
      setInserted(true);
      setMsg(`${values.length} biomarqueur(s) extrait(s) depuis la photo.`);
      onChange();
      loadHistory();
    } catch (e: any) {
      setErr(e?.message || 'Upload / extraction échoué.');
    } finally {
      setBusy(false);
    }
  }

  // Liste des bilans uploadés du patient (audit trail).
  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    twinApi.listDocuments(patientId)
      .then((docs) => setHistory(docs || []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [patientId]);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  async function openSigned(docId: string) {
    try {
      const { url } = await twinApi.documentSignedUrl(patientId, docId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      setErr(e?.message || 'Impossible d ouvrir le fichier.');
    }
  }

  async function removeDoc(docId: string) {
    if (!confirm('Supprimer ce bilan et son fichier source ? La trace audit reste conservée.')) return;
    try {
      await twinApi.deleteDocument(patientId, docId);
      loadHistory();
    } catch (e: any) {
      setErr(e?.message || 'Suppression échouée.');
    }
  }

  async function runText() {
    if (!text.trim()) return;
    setBusy(true); setMsg(null); setErr(null); setExtracted(null); setInserted(false);
    try {
      const doc = await twinApi.createDocument(patientId, text.trim());
      const res = await twinApi.extractDocument(patientId, doc.id);
      setMsg(`${res.extracted ?? 0} biomarqueur(s) extrait(s) et intégré(s).`);
      setInserted(true);
      setText('');
      onChange();
      loadHistory();
    } catch (e: any) { setErr(e?.message || 'Extraction indisponible (IA).'); }
    finally { setBusy(false); }
  }

  function pickFile(f: File | null) {
    setErr(null); setMsg(null); setExtracted(null); setInserted(false);
    if (!f) { setFile(null); return; }
    const mime = (f.type || '').toLowerCase();
    const ok = mime === 'application/pdf' || mime.startsWith('image/');
    if (!ok) { setErr(`Type non supporté (${mime || 'inconnu'}). Acceptés : PDF, JPG, PNG, WebP, GIF.`); return; }
    if (f.size > LAB_READER_MAX_MB * 1024 * 1024) {
      setErr(`Fichier trop volumineux (${Math.round(f.size / 1024 / 1024)} Mo). Limite : ${LAB_READER_MAX_MB} Mo.`);
      return;
    }
    setFile(f);
  }

  async function runFile() {
    if (!file) return;
    setBusy(true); setMsg(null); setErr(null); setExtracted(null); setInserted(false);
    try {
      const res = await twinApi.uploadDocument(patientId, file, { source_type: 'blood' });
      const values: LabExtractedValue[] = res?.values || [];
      setExtracted(values);
      // L'endpoint upload insère déjà les valeurs côté patient (cf. service).
      setInserted(true);
      setMsg(`${values.length} biomarqueur(s) extrait(s) et intégré(s) depuis ${file.name}.`);
      onChange();
      loadHistory();
    } catch (e: any) {
      setErr(e?.message || 'Upload / extraction échoué.');
    } finally {
      setBusy(false);
    }
  }

  // Ré-insertion à la demande (utile si à l'avenir on passe en mode preview-only).
  async function reinsertExtracted() {
    if (!extracted || extracted.length === 0) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      await twinApi.addBiomarkers(
        patientId,
        extracted.map((v) => ({ biomarker_code: v.biomarker_code, value: Number(v.value) })),
      );
      setMsg(`${extracted.length} biomarqueur(s) ré-insérés.`);
      setInserted(true);
      onChange();
    } catch (e: any) { setErr(e?.message || 'Insertion échouée.'); }
    finally { setBusy(false); }
  }

  // ── Connecteur CSV labo (déterministe, zéro IA) ────────────────────────
  async function handleCsvFile(f: File | null) {
    if (!f) return;
    setBusy(true); setErr(null); setMsg(null); setCsvImportResult(null);
    try {
      const raw = await f.text();
      const items = parseCsvText(raw);
      if (items.length === 0) {
        setErr('CSV vide ou illisible (attendu : code,value,unit,measured_at).');
        return;
      }
      const res = await twinApi.importCsv(patientId, items);
      setCsvImportResult({ imported: res.imported_count, skipped: res.skipped || [] });
      setMsg(`${res.imported_count} biomarqueur(s) importé(s) depuis ${f.name}.`);
      onChange();
      loadHistory();
    } catch (e: any) {
      setErr(e?.message || 'Import CSV échoué.');
    } finally {
      setBusy(false);
    }
  }

  function downloadCsvTemplate() {
    const blob = new Blob([buildCsvTemplate()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'twin-biomarkers-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const dropStyle: React.CSSProperties = {
    border: `2px dashed ${dragging ? 'var(--brand-primary, var(--zw-violet))' : 'var(--zw-border-strong)'}`,
    background: dragging ? 'rgba(124,58,237,0.06)' : 'var(--zw-bg)',
    borderRadius: 10, padding: 16, textAlign: 'center', cursor: 'pointer',
    fontSize: 12.5, color: 'var(--zw-text-soft)', transition: 'all 0.15s', display: 'block',
  };

  return (
    <div style={panel}>
      <h3 style={head}><FileText size={15} color="#0ea5e9" /> Lecteur de bilan / ordonnance (IA)</h3>
      <p style={{ fontSize: 11.5, color: 'var(--zw-text-faint)', marginTop: 0 }}>
        Uploadez un PDF, JPG ou PNG d'un compte-rendu — ou collez le texte ci-dessous. L'IA extrait les biomarqueurs.
      </p>

      {/* Zone drag & drop */}
      <label
        htmlFor="lab-reader-file"
        style={dropStyle}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false);
          const f = e.dataTransfer.files?.[0]; if (f) pickFile(f);
        }}
      >
        <div style={{ fontWeight: 600, color: 'var(--zw-text-soft)', marginBottom: 4 }}>
          {file ? `📎 ${file.name}` : 'Glissez un PDF / JPG / PNG ici, ou cliquez pour parcourir'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--zw-text-faint)' }}>
          PDF, JPG, PNG, WebP, GIF — max {LAB_READER_MAX_MB} Mo
        </div>
        <input
          id="lab-reader-file"
          type="file"
          accept={LAB_READER_ACCEPT}
          style={{ display: 'none' }}
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {/* Capture caméra native (Capacitor) — visible aussi sur web via fallback <input capture>. */}
      <button
        type="button"
        onClick={takePhotoOfLab}
        disabled={busy || camera.busy}
        style={{
          marginTop: 8, width: '100%', padding: 9, background: '#0ea5e9', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
          cursor: busy || camera.busy ? 'wait' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        <CameraIcon size={14} />
        {camera.busy ? 'Capture…' : 'Prendre une photo du bilan'}
      </button>

      {file && (
        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          <button
            onClick={runFile}
            disabled={busy}
            style={{ flex: 1, padding: 9, background: 'var(--brand-primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}
          >
            {busy ? 'Extraction…' : `Extraire depuis ${file.name.length > 28 ? file.name.slice(0, 28) + '…' : file.name}`}
          </button>
          <button
            onClick={() => { setFile(null); setExtracted(null); setMsg(null); setErr(null); }}
            disabled={busy}
            style={{ padding: '9px 12px', background: 'var(--zw-bg-subtle)', color: 'var(--zw-text-soft)', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}
          >
            Annuler
          </button>
        </div>
      )}

      {/* Connecteur CSV labo (déterministe, zéro IA) */}
      <div style={{ marginTop: 10, padding: 10, background: 'var(--zw-bg-subtle)', border: '1px solid var(--zw-border)', borderRadius: 8 }}>
        <div style={{ fontSize: 11.5, color: 'var(--zw-text-soft)', fontWeight: 600, marginBottom: 6 }}>
          Import CSV labo (déterministe — zéro IA)
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <label
            htmlFor="lab-csv-file"
            style={{ flex: 1, minWidth: 160, padding: '7px 10px', background: '#0ea5e9', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', textAlign: 'center' }}
          >
            {busy ? 'Import…' : 'Importer CSV'}
          </label>
          <input
            id="lab-csv-file"
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0] ?? null; e.currentTarget.value = ''; void handleCsvFile(f); }}
          />
          <button
            type="button"
            onClick={downloadCsvTemplate}
            style={{ padding: '7px 10px', background: 'transparent', color: '#0ea5e9', border: '1px solid #0ea5e9', borderRadius: 6, fontSize: 11.5, cursor: 'pointer' }}
          >
            Télécharger le template
          </button>
        </div>
        {csvImportResult && (
          <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--zw-text-soft)' }}>
            <div style={{ color: '#10b981', fontWeight: 600 }}>{csvImportResult.imported} importé(s)</div>
            {csvImportResult.skipped.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ color: '#dc2626', fontWeight: 600 }}>{csvImportResult.skipped.length} ignoré(s) :</div>
                <ul style={{ margin: '2px 0 0 16px', padding: 0, fontSize: 11, color: 'var(--zw-text-muted)' }}>
                  {csvImportResult.skipped.slice(0, 10).map((s, i) => (
                    <li key={i}>{s.code || '(vide)'} — {s.reason}</li>
                  ))}
                  {csvImportResult.skipped.length > 10 && (
                    <li>… +{csvImportResult.skipped.length - 10} autres</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Séparateur visuel + textarea */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 8px' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--zw-border)' }} />
        <span style={{ fontSize: 11, color: 'var(--zw-text-faint)' }}>OU collez le texte</span>
        <div style={{ flex: 1, height: 1, background: 'var(--zw-border)' }} />
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Ex: CRP 4.1 mg/L, TSH 3.3 mUI/L, Vitamine D 21 ng/mL…" style={{ width: '100%', boxSizing: 'border-box', padding: 10, border: '1px solid var(--zw-border)', borderRadius: 8, fontSize: 12.5, fontFamily: 'inherit' }} />
      <button onClick={runText} disabled={busy || !text.trim()} style={{ marginTop: 8, width: '100%', padding: 9, background: 'var(--zw-text-soft)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', opacity: !text.trim() ? 0.5 : 1 }}>
        {busy ? 'Extraction…' : 'Extraire depuis le texte'}
      </button>

      {/* Liste des valeurs extraites */}
      {extracted && extracted.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--zw-text-soft)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span>Valeurs extraites ({extracted.length})</span>
            {inserted && <span style={{ color: '#10b981' }}>✓ insérées</span>}
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--zw-border)', borderRadius: 8, padding: 8, background: 'var(--zw-bg)' }}>
            {extracted.map((v, i) => {
              const conf = typeof v.confidence === 'number' ? v.confidence : null;
              const confColor = conf == null ? 'var(--zw-text-faint)' : conf >= 0.8 ? '#10b981' : conf >= 0.6 ? '#f59e0b' : '#ef4444';
              return (
                <div key={`${v.biomarker_code}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '4px 0', borderBottom: i < extracted.length - 1 ? '1px solid var(--zw-border)' : 'none' }}>
                  <span style={{ color: 'var(--zw-text)', fontWeight: 600 }}>{v.biomarker_code}</span>
                  <span style={{ color: 'var(--zw-text-soft)' }}>
                    {v.value}{v.unit ? ` ${v.unit}` : ''}
                    {conf != null && (
                      <span style={{ marginLeft: 8, fontSize: 10.5, color: confColor, fontWeight: 600 }}>
                        {Math.round(conf * 100)}%
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          {!inserted && (
            <button
              onClick={reinsertExtracted}
              disabled={busy}
              style={{ marginTop: 8, width: '100%', padding: 9, background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: busy ? 'wait' : 'pointer' }}
            >
              Insérer dans le patient
            </button>
          )}
        </div>
      )}

      {msg && <div style={{ marginTop: 8, fontSize: 12, color: '#10b981' }}>{msg}</div>}
      {err && <div style={{ marginTop: 8, fontSize: 12, color: '#dc2626' }}>{err}</div>}

      {/* ─── Audit trail : bilans uploadés ─────────────────────────────── */}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px dashed var(--zw-border)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--zw-text-soft)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileText size={13} color="var(--zw-text-muted)" />
          Bilans uploadés
          <span style={{ fontSize: 11, color: 'var(--zw-text-faint)', fontWeight: 400 }}>
            ({history.filter((d) => d.status !== 'deleted').length})
          </span>
          <button
            onClick={loadHistory}
            disabled={historyLoading}
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--zw-violet)', fontSize: 11, cursor: 'pointer' }}
          >
            {historyLoading ? '…' : 'Rafraîchir'}
          </button>
        </div>

        {history.length === 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--zw-text-faint)', fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
            Aucun bilan pour l'instant. Uploadez un PDF/image au-dessus.
          </div>
        )}

        {history.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {history.map((d) => {
              const isDeleted = d.status === 'deleted';
              const isPdf = d.mime_type === 'application/pdf';
              const isImg = !!d.mime_type && d.mime_type.startsWith('image/');
              const sizeKb = d.file_size_bytes ? Math.round(d.file_size_bytes / 1024) : null;
              const date = new Date(d.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
              const statusColor =
                d.status === 'extracted' ? '#10b981' :
                d.status === 'failed' ? '#ef4444' :
                d.status === 'deleted' ? 'var(--zw-text-faint)' :
                '#f59e0b';
              const statusLabel =
                d.status === 'extracted' ? 'Extrait' :
                d.status === 'failed' ? 'Échec' :
                d.status === 'deleted' ? 'Supprimé' :
                d.status === 'extracting' ? 'En cours' :
                'Uploadé';
              const icon = isPdf ? '📄' : isImg ? '🖼️' : '📝';
              return (
                <div
                  key={d.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px',
                    background: isDeleted ? 'var(--zw-bg)' : '#fff',
                    border: '1px solid var(--zw-border)', borderRadius: 8,
                    opacity: isDeleted ? 0.55 : 1,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--zw-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.original_filename || (isPdf ? 'Bilan PDF' : isImg ? 'Bilan image' : 'Texte collé')}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--zw-text-faint)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span>{date}</span>
                      {sizeKb !== null && <span>· {sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} Mo` : `${sizeKb} Ko`}</span>}
                      {d.extraction_confidence !== null && (
                        <span>· conf. {Math.round((d.extraction_confidence || 0) * 100)}%</span>
                      )}
                      <span style={{ color: statusColor, fontWeight: 600 }}>· {statusLabel}</span>
                    </div>
                  </div>
                  {d.has_file && !isDeleted && (
                    <button
                      onClick={() => openSigned(d.id)}
                      title="Voir le fichier source"
                      style={{ padding: '5px 10px', background: 'var(--zw-violet)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Voir
                    </button>
                  )}
                  {!isDeleted && (
                    <button
                      onClick={() => removeDoc(d.id)}
                      title="Supprimer (GDPR)"
                      style={{ padding: '5px 8px', background: 'transparent', color: 'var(--zw-text-faint)', border: '1px solid var(--zw-border)', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
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
      <h3 style={head}><FlaskConical size={15} color="var(--zw-violet)" /> Carte métabolique</h3>
      {Object.keys(groups).length === 0 ? <p style={{ fontSize: 12, color: 'var(--zw-text-faint)' }}>Aucune donnée.</p> : (
        <div className="twin-metabolic-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 12 }}>
          {Object.entries(groups).map(([cat, items]) => (
            <div key={cat} style={{ background: 'var(--zw-bg)', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--zw-text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>{cat}</div>
              {items.map((b) => (
                <div key={b.biomarker_code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
                  <span style={{ color: 'var(--zw-text-soft)' }}>{b.ref?.name_fr || b.biomarker_code}</span>
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
    <div className="twin-copilot-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 16 }}>
      {/* Root Cause */}
      <div style={panel}>
        <h3 style={head}><Sparkles size={15} color="var(--zw-violet)" /> Root Cause Explorer</h3>
        <button onClick={() => go('root')} disabled={!!busy} style={{ width: '100%', padding: 9, background: 'var(--zw-violet)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 10 }}>
          {busy === 'root' ? <Loader2 size={14} className="spin" /> : 'Identifier les causes racines'}
        </button>
        {rootCauses.map((c, i) => (
          <div key={i} style={{ padding: 10, background: '#faf5ff', borderRadius: 8, marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong style={{ fontSize: 13, color: 'var(--zw-text)' }}>{c.label_fr}</strong>{c.probability != null && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--zw-violet)' }}>{Math.round(c.probability * 100)}%</span>}</div>
            <div style={{ fontSize: 11.5, color: 'var(--zw-text-muted)', marginTop: 3 }}>{c.reasoning_fr}</div>
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
            <div style={{ padding: 10, background: '#eff6ff', borderRadius: 8, marginBottom: 8, fontSize: 12.5, color: 'var(--zw-text)' }}><strong>Consensus :</strong> {council.consensus_fr}</div>
            {(council.experts || []).map((e: any, i: number) => (
              <div key={i} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--zw-bg-subtle)' }}>
                <strong style={{ color: '#0ea5e9' }}>{e.specialty_fr}</strong> — {e.key_recommendation_fr}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Moteur scientifique */}
      <div style={panel}>
        <h3 style={head}><Search size={15} color="#10b981" /> Moteur scientifique (PubMed)</h3>
        <div className="twin-copilot-search" style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ex: insulin resistance inflammation" style={{ flex: 1, padding: '7px 9px', border: '1px solid var(--zw-border)', borderRadius: 7, fontSize: 12.5, minWidth: 0 }} />
          <button onClick={() => go('science')} disabled={!!busy || !query} style={{ padding: '7px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer' }}>{busy === 'science' ? '…' : 'Rechercher'}</button>
        </div>
        {(science?.results || []).map((r: any) => (
          <a key={r.pmid} href={r.url} target="_blank" rel="noreferrer" style={{ display: 'block', padding: '6px 0', borderBottom: '1px solid var(--zw-bg-subtle)', fontSize: 12, color: 'var(--zw-text)', textDecoration: 'none' }}>
            {r.title} <span style={{ color: 'var(--zw-text-faint)' }}>· {r.source} {r.year}</span>
          </a>
        ))}
      </div>
      {err && <div style={{ gridColumn: '1/-1', fontSize: 12, color: '#991b1b' }}>{err}</div>}
    </div>
  );
}
