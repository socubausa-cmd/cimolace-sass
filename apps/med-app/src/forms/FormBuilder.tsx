import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Type, AlignLeft, Hash, Calendar, List, ListChecks, CheckSquare, Upload,
  Plus, Trash2, Copy, GripVertical, ChevronLeft, Check, Loader2, Monitor, Smartphone,
  Eye, Settings2, CircleAlert, X,
} from 'lucide-react';
import { FormRenderer, type FieldType, type FormField } from './FormRenderer';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

type BuilderField = { _uid: number; label: string; type: FieldType; required?: boolean; options?: string[] };

// Catégories alignées sur l'enum backend (create-form.dto : IsIn).
const CATEGORIES = [
  { value: 'intake', label: 'Anamnèse' },
  { value: 'assessment', label: 'Bilan' },
  { value: 'consent', label: 'Consentement' },
  { value: 'followup', label: 'Suivi' },
  { value: 'custom', label: 'Personnalisé' },
];

const TYPES: { value: FieldType; label: string; icon: typeof Type }[] = [
  { value: 'text', label: 'Texte court', icon: Type },
  { value: 'textarea', label: 'Texte long', icon: AlignLeft },
  { value: 'number', label: 'Nombre', icon: Hash },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'select', label: 'Choix', icon: List },
  { value: 'multi', label: 'Choix multiples', icon: ListChecks },
  { value: 'checkbox', label: 'Case à cocher', icon: CheckSquare },
  { value: 'file', label: 'Fichier', icon: Upload },
];
const typeMeta = (t: FieldType) => TYPES.find((x) => x.value === t) || TYPES[0];

function authHeaders(json = false): HeadersInit {
  const h: Record<string, string> = {
    Authorization: 'Bearer ' + (localStorage.getItem('supabase_token') || ''),
    'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
  };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

function slugify(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
}

export function FormBuilder() {
  const navigate = useNavigate();
  const uid = useRef(2);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('intake');
  const [sendBefore, setSendBefore] = useState('');
  const [fields, setFields] = useState<BuilderField[]>([
    { _uid: 1, label: '', type: 'text', required: false },
  ]);
  const [selected, setSelected] = useState<number | null>(1);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [tab, setTab] = useState<'config' | 'preview'>('config');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pv, setPv] = useState<Record<string, any>>({});

  const drag = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  function addField(type: FieldType = 'text') {
    const _uid = uid.current++;
    setFields((p) => [...p, { _uid, label: '', type, required: false, options: type === 'select' || type === 'multi' ? ['Option 1'] : undefined }]);
    setSelected(_uid);
    setError(null);
    setTab('config');
    setTimeout(() => document.getElementById(`q-${_uid}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30);
  }
  function patch(_uid: number, p: Partial<BuilderField>) {
    setFields((prev) => prev.map((f) => (f._uid === _uid ? { ...f, ...p } : f)));
  }
  function remove(_uid: number) {
    setFields((prev) => prev.filter((f) => f._uid !== _uid));
    if (selected === _uid) setSelected(null);
  }
  function duplicate(_uid: number) {
    setFields((prev) => {
      const i = prev.findIndex((f) => f._uid === _uid);
      if (i < 0) return prev;
      const copy = { ...prev[i], _uid: uid.current++, options: prev[i].options ? [...prev[i].options!] : undefined };
      const next = [...prev]; next.splice(i + 1, 0, copy); return next;
    });
  }
  function reorder(from: number, to: number) {
    setFields((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev]; const [m] = next.splice(from, 1); next.splice(to, 0, m); return next;
    });
  }

  // — aperçu live —
  const previewForm = useMemo(() => ({
    title, description,
    fields: fields.map((f): FormField => ({
      id: `q_${f._uid}`, _uid: f._uid, label: f.label, type: f.type, required: f.required,
      options: f.options,
    })),
  }), [title, description, fields]);

  function buildPayload() {
    const used = new Set<string>();
    const out = fields.filter((f) => f.label.trim()).map((f, i) => {
      let id = slugify(f.label) || `champ_${i + 1}`;
      while (used.has(id)) id = `${id}_${i + 1}`;
      used.add(id);
      const field: any = { id, label: f.label.trim(), type: f.type };
      if (f.required) field.required = true;
      if (f.type === 'select' || f.type === 'multi') field.options = (f.options || []).map((o) => o.trim()).filter(Boolean);
      return field;
    });
    return out;
  }

  async function save() {
    if (!title.trim()) { setError('Donnez un titre au formulaire.'); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const fieldsPayload = buildPayload();
    if (fieldsPayload.length === 0) { setError('Ajoutez au moins une question avec un libellé.'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(API + '/med/forms', {
        method: 'POST', headers: authHeaders(true),
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          fields: fieldsPayload,
          send_before_days: sendBefore ? Number(sendBefore) : undefined,
        }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.error?.message || b?.message || `Erreur ${res.status}`); }
      navigate('/forms', { state: { created: true } });
    } catch (e: any) {
      setError(e?.message || 'Échec de l’enregistrement');
    } finally {
      setSaving(false);
    }
  }

  const filledCount = fields.filter((f) => f.label.trim()).length;

  return (
    <div className="fb-root">
      {/* Barre d'action */}
      <header className="fb-top">
        <button className="fb-back" onClick={() => navigate('/forms')}><ChevronLeft size={16} /> Formulaires</button>
        <div className="fb-top-title"><Settings2 size={16} /> Créateur de formulaire</div>
        <div className="fb-top-actions">
          <div className="fb-seg">
            <button className={device === 'desktop' ? 'on' : ''} onClick={() => setDevice('desktop')} title="Aperçu ordinateur"><Monitor size={15} /></button>
            <button className={device === 'mobile' ? 'on' : ''} onClick={() => setDevice('mobile')} title="Aperçu mobile"><Smartphone size={15} /></button>
          </div>
          <button className="fb-save" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={15} className="fb-spin" /> : <Check size={15} />} {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </header>

      {error && <div className="fb-error"><CircleAlert size={15} /> {error} <button onClick={() => setError(null)}><X size={13} /></button></div>}

      {/* Onglets (mobile) */}
      <div className="fb-mtabs">
        <button className={tab === 'config' ? 'on' : ''} onClick={() => setTab('config')}><Settings2 size={14} /> Configurer</button>
        <button className={tab === 'preview' ? 'on' : ''} onClick={() => setTab('preview')}><Eye size={14} /> Aperçu</button>
      </div>

      <div className="fb-grid" data-tab={tab}>
        {/* ───── CONFIG ───── */}
        <section className="fb-config">
          <div className="fb-meta">
            <div className="fb-meta-bar" />
            <input className="fb-title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre du formulaire" />
            <textarea className="fb-desc-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description / instructions au patient (optionnel)" rows={2} />
            <div className="fb-meta-row">
              <label className="fb-mini">
                <span>Catégorie</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              <label className="fb-mini">
                <span>Envoyer avant le RDV</span>
                <div className="fb-days">
                  <input type="number" min={0} value={sendBefore} onChange={(e) => setSendBefore(e.target.value)} placeholder="—" />
                  <em>jours</em>
                </div>
              </label>
            </div>
          </div>

          <div className="fb-qcount">{filledCount} question{filledCount > 1 ? 's' : ''}</div>

          <div className="fb-qlist">
            {fields.map((f, i) => {
              const Meta = typeMeta(f.type);
              const isSel = selected === f._uid;
              return (
                <div
                  id={`q-${f._uid}`}
                  key={f._uid}
                  className={`fb-q${isSel ? ' sel' : ''}${over === i && drag.current !== null ? ' over' : ''}${drag.current === i ? ' dragging' : ''}`}
                  onClick={() => setSelected(f._uid)}
                  onDragOver={(e) => { e.preventDefault(); if (over !== i) setOver(i); }}
                  onDrop={() => { if (drag.current !== null) reorder(drag.current, i); drag.current = null; setOver(null); }}
                >
                  <div
                    className="fb-grip"
                    draggable
                    onDragStart={() => { drag.current = i; }}
                    onDragEnd={() => { drag.current = null; setOver(null); }}
                    title="Glisser pour réordonner"
                  >
                    <GripVertical size={16} />
                  </div>

                  <div className="fb-q-main">
                    <div className="fb-q-head">
                      <span className="fb-q-num">{i + 1}</span>
                      <input
                        className="fb-q-label"
                        value={f.label}
                        onChange={(e) => patch(f._uid, { label: e.target.value })}
                        onFocus={() => setSelected(f._uid)}
                        placeholder="Intitulé de la question"
                      />
                      <span className="fb-q-typebadge"><Meta.icon size={13} /> {Meta.label}</span>
                    </div>

                    {isSel && (
                      <div className="fb-q-editor">
                        <div className="fb-types">
                          {TYPES.map((t) => (
                            <button
                              key={t.value}
                              className={`fb-typechip${f.type === t.value ? ' on' : ''}`}
                              onClick={(e) => { e.stopPropagation(); patch(f._uid, { type: t.value, options: (t.value === 'select' || t.value === 'multi') ? (f.options?.length ? f.options : ['Option 1']) : f.options }); }}
                            >
                              <t.icon size={14} /> {t.label}
                            </button>
                          ))}
                        </div>

                        {(f.type === 'select' || f.type === 'multi') && (
                          <div className="fb-opts">
                            {(f.options || []).map((o, oi) => (
                              <div className="fb-opt" key={oi}>
                                <span className="fb-opt-dot" />
                                <input value={o} onChange={(e) => { const next = [...(f.options || [])]; next[oi] = e.target.value; patch(f._uid, { options: next }); }} placeholder={`Option ${oi + 1}`} />
                                <button className="fb-opt-del" onClick={(e) => { e.stopPropagation(); patch(f._uid, { options: (f.options || []).filter((_, k) => k !== oi) }); }} title="Supprimer l'option"><X size={13} /></button>
                              </div>
                            ))}
                            <button className="fb-opt-add" onClick={(e) => { e.stopPropagation(); patch(f._uid, { options: [...(f.options || []), `Option ${(f.options?.length || 0) + 1}`] }); }}><Plus size={13} /> Ajouter une option</button>
                          </div>
                        )}

                        <div className="fb-q-foot">
                          <label className="fb-switch" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={!!f.required} onChange={(e) => patch(f._uid, { required: e.target.checked })} />
                            <span className="fb-switch-track"><span className="fb-switch-thumb" /></span>
                            <span className="fb-switch-lbl">Obligatoire</span>
                          </label>
                          <div className="fb-q-foot-actions">
                            <button onClick={(e) => { e.stopPropagation(); duplicate(f._uid); }} title="Dupliquer"><Copy size={15} /></button>
                            <button className="del" onClick={(e) => { e.stopPropagation(); remove(f._uid); }} title="Supprimer" disabled={fields.length <= 1}><Trash2 size={15} /></button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button className="fb-add" onClick={() => addField('text')}><Plus size={16} /> Ajouter une question</button>
          <div className="fb-quicktypes">
            <span>Ajout rapide :</span>
            {TYPES.map((t) => <button key={t.value} onClick={() => addField(t.value)} title={t.label}><t.icon size={15} /></button>)}
          </div>
        </section>

        {/* ───── APERÇU ───── */}
        <aside className="fb-preview">
          <div className="fb-preview-head"><Eye size={14} /> Aperçu en temps réel — remplissez-le pour tester</div>
          <div className={`fb-frame fb-frame-${device}`}>
            {device === 'mobile' && <div className="fb-notch" />}
            <div className="fb-frame-scroll">
              <FormRenderer form={previewForm} values={pv} onChange={(id, val) => setPv((s) => ({ ...s, [id]: val }))} interactive />
            </div>
          </div>
        </aside>
      </div>

      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.fb-root { --fb-accent: var(--brand-primary, #7c3aed); padding-bottom:40px; }
.fb-top { position:sticky; top:0; z-index:20; display:flex; align-items:center; gap:12px; padding:12px 2px; margin-bottom:8px; background:linear-gradient(var(--zw-bg, #f6efe6), color-mix(in srgb, var(--zw-bg, #f6efe6) 80%, transparent)); backdrop-filter:blur(6px); }
.fb-back { display:inline-flex; align-items:center; gap:3px; background:#fff; border:1px solid var(--zw-border); border-radius:9px; padding:7px 12px; font-size:13px; font-weight:600; color:var(--zw-text-soft); cursor:pointer; transition:background .15s; }
.fb-back:hover { background:var(--zw-bg-subtle); }
.fb-top-title { display:flex; align-items:center; gap:7px; font-size:15px; font-weight:800; color:var(--zw-text); }
.fb-top-actions { margin-left:auto; display:flex; align-items:center; gap:10px; }
.fb-seg { display:inline-flex; gap:2px; background:var(--zw-bg-subtle); border:1px solid var(--zw-border); border-radius:9px; padding:3px; }
.fb-seg button { width:32px; height:28px; border:none; background:transparent; border-radius:6px; cursor:pointer; color:var(--zw-text-muted); display:inline-flex; align-items:center; justify-content:center; transition:all .15s; }
.fb-seg button.on { background:#fff; color:var(--fb-accent); box-shadow:0 1px 3px rgba(15,23,42,0.14); }
.fb-save { display:inline-flex; align-items:center; gap:6px; background:var(--fb-accent); color:#fff; border:none; border-radius:9px; padding:9px 18px; font-size:13.5px; font-weight:700; cursor:pointer; transition:transform .14s, box-shadow .2s, opacity .2s; box-shadow:0 8px 18px -8px color-mix(in srgb, var(--fb-accent) 70%, transparent); }
.fb-save:hover:not(:disabled) { transform:translateY(-1px); }
.fb-save:disabled { opacity:.7; cursor:wait; }
.fb-spin { animation:fbspin 1s linear infinite; } @keyframes fbspin { to { transform:rotate(360deg); } }
.fb-error { display:flex; align-items:center; gap:8px; background:#fef2f2; border:1px solid #fecaca; color:#991b1b; padding:10px 14px; border-radius:10px; font-size:13px; margin-bottom:12px; }
.fb-error button { margin-left:auto; background:none; border:none; color:#991b1b; cursor:pointer; display:inline-flex; }
.fb-mtabs { display:none; gap:4px; background:var(--zw-bg-subtle); border-radius:10px; padding:4px; margin-bottom:14px; }
.fb-mtabs button { flex:1; display:inline-flex; align-items:center; justify-content:center; gap:6px; border:none; background:transparent; padding:9px; border-radius:7px; font-size:13px; font-weight:600; color:var(--zw-text-muted); cursor:pointer; }
.fb-mtabs button.on { background:#fff; color:var(--fb-accent); box-shadow:0 1px 3px rgba(15,23,42,0.12); }

.fb-grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,460px); gap:20px; align-items:start; }
.fb-preview { position:sticky; top:78px; }

.fb-meta { position:relative; background:#fff; border:1px solid var(--zw-border); border-radius:14px; padding:20px 20px 16px; overflow:hidden; box-shadow:0 4px 16px -10px rgba(15,23,42,0.2); }
.fb-meta-bar { position:absolute; left:0; top:0; bottom:0; width:6px; background:linear-gradient(var(--fb-accent), color-mix(in srgb, var(--fb-accent) 50%, #fff)); }
.fb-title-input { width:100%; border:none; border-bottom:2px solid transparent; font-size:22px; font-weight:800; color:var(--zw-text); padding:4px 0 8px; outline:none; background:transparent; letter-spacing:-0.01em; transition:border-color .2s; }
.fb-title-input::placeholder { color:var(--zw-text-faint); }
.fb-title-input:focus { border-bottom-color:var(--fb-accent); }
.fb-desc-input { width:100%; border:none; resize:vertical; font-size:13.5px; color:var(--zw-text-soft); padding:8px 0; outline:none; background:transparent; font-family:inherit; border-bottom:1px solid var(--zw-bg-subtle); }
.fb-desc-input::placeholder { color:var(--zw-text-faint); }
.fb-meta-row { display:flex; gap:16px; margin-top:14px; flex-wrap:wrap; }
.fb-mini { display:flex; flex-direction:column; gap:5px; font-size:11.5px; font-weight:600; color:var(--zw-text-muted); }
.fb-mini select, .fb-days input { border:1px solid var(--zw-border); border-radius:8px; padding:7px 10px; font-size:13px; background:#fff; color:var(--zw-text); }
.fb-days { display:flex; align-items:center; gap:6px; } .fb-days input { width:70px; } .fb-days em { font-size:12px; color:var(--zw-text-muted); font-style:normal; }

.fb-qcount { font-size:11.5px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--zw-text-faint); margin:18px 2px 8px; }
.fb-qlist { display:flex; flex-direction:column; gap:10px; }
.fb-q { position:relative; display:flex; gap:4px; background:#fff; border:1px solid var(--zw-border); border-radius:12px; padding:6px 12px 6px 4px; cursor:pointer; transition:box-shadow .18s, border-color .18s, transform .12s; animation:fbq .28s cubic-bezier(.2,.7,.3,1) both; }
@keyframes fbq { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
.fb-q:hover { border-color:color-mix(in srgb, var(--fb-accent) 35%, var(--zw-border)); }
.fb-q.sel { border-color:var(--fb-accent); box-shadow:0 8px 26px -12px color-mix(in srgb, var(--fb-accent) 60%, transparent); }
.fb-q.sel::before { content:''; position:absolute; left:0; top:10px; bottom:10px; width:4px; border-radius:0 4px 4px 0; background:var(--fb-accent); }
.fb-q.dragging { opacity:.45; }
.fb-q.over { box-shadow:0 -2px 0 0 var(--fb-accent), 0 8px 26px -12px color-mix(in srgb, var(--fb-accent) 50%, transparent); }
.fb-grip { display:flex; align-items:flex-start; padding:12px 2px 0; color:var(--zw-text-faint); cursor:grab; }
.fb-grip:active { cursor:grabbing; }
.fb-q-main { flex:1; min-width:0; padding:6px 2px; }
.fb-q-head { display:flex; align-items:center; gap:9px; }
.fb-q-num { width:22px; height:22px; flex-shrink:0; border-radius:50%; background:color-mix(in srgb, var(--fb-accent) 12%, #fff); color:var(--fb-accent); font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center; }
.fb-q-label { flex:1; min-width:0; border:none; outline:none; font-size:14.5px; font-weight:600; color:var(--zw-text); background:transparent; padding:6px 0; border-bottom:2px solid transparent; transition:border-color .18s; }
.fb-q-label::placeholder { color:var(--zw-text-faint); font-weight:500; }
.fb-q.sel .fb-q-label:focus { border-bottom-color:color-mix(in srgb, var(--fb-accent) 45%, transparent); }
.fb-q-typebadge { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:600; color:var(--zw-text-muted); background:var(--zw-bg-subtle); padding:3px 9px; border-radius:999px; white-space:nowrap; }
.fb-q.sel .fb-q-typebadge { display:none; }
.fb-q-editor { margin-top:12px; animation:fbExp .22s ease both; }
@keyframes fbExp { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } }
.fb-types { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px; }
.fb-typechip { display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:600; padding:6px 11px; border-radius:8px; border:1px solid var(--zw-border); background:#fff; color:var(--zw-text-soft); cursor:pointer; transition:all .14s; }
.fb-typechip:hover { border-color:color-mix(in srgb, var(--fb-accent) 40%, var(--zw-border)); }
.fb-typechip.on { background:var(--fb-accent); border-color:var(--fb-accent); color:#fff; }
.fb-opts { display:flex; flex-direction:column; gap:6px; margin:4px 0 12px; padding-left:2px; }
.fb-opt { display:flex; align-items:center; gap:8px; }
.fb-opt-dot { width:14px; height:14px; border:2px solid var(--zw-border); border-radius:50%; flex-shrink:0; }
.fb-opt input { flex:1; border:none; border-bottom:1px solid var(--zw-bg-subtle); font-size:13px; padding:5px 2px; outline:none; background:transparent; color:var(--zw-text); }
.fb-opt input:focus { border-bottom-color:var(--fb-accent); }
.fb-opt-del { background:none; border:none; color:var(--zw-text-faint); cursor:pointer; display:inline-flex; padding:3px; border-radius:5px; }
.fb-opt-del:hover { color:#dc2626; background:#fef2f2; }
.fb-opt-add { align-self:flex-start; display:inline-flex; align-items:center; gap:4px; font-size:12px; font-weight:600; color:var(--fb-accent); background:none; border:none; cursor:pointer; padding:4px 2px; margin-left:22px; }
.fb-q-foot { display:flex; align-items:center; gap:12px; padding-top:10px; margin-top:8px; border-top:1px solid var(--zw-bg-subtle); }
.fb-switch { display:inline-flex; align-items:center; gap:8px; cursor:pointer; user-select:none; }
.fb-switch input { position:absolute; opacity:0; width:0; height:0; }
.fb-switch-track { width:36px; height:20px; border-radius:999px; background:var(--zw-border); position:relative; transition:background .18s; }
.fb-switch-thumb { position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.25); transition:transform .18s cubic-bezier(.2,.7,.3,1); }
.fb-switch input:checked + .fb-switch-track { background:var(--fb-accent); }
.fb-switch input:checked + .fb-switch-track .fb-switch-thumb { transform:translateX(16px); }
.fb-switch-lbl { font-size:12.5px; font-weight:600; color:var(--zw-text-soft); }
.fb-q-foot-actions { margin-left:auto; display:flex; gap:4px; }
.fb-q-foot-actions button { background:none; border:none; cursor:pointer; color:var(--zw-text-muted); padding:6px; border-radius:7px; display:inline-flex; transition:all .14s; }
.fb-q-foot-actions button:hover { background:var(--zw-bg-subtle); color:var(--zw-text); }
.fb-q-foot-actions button.del:hover { background:#fef2f2; color:#dc2626; }
.fb-q-foot-actions button:disabled { opacity:.3; cursor:default; }

.fb-add { width:100%; margin-top:12px; display:flex; align-items:center; justify-content:center; gap:7px; padding:12px; background:#fff; color:var(--fb-accent); border:1.5px dashed color-mix(in srgb, var(--fb-accent) 45%, var(--zw-border)); border-radius:11px; font-size:13.5px; font-weight:700; cursor:pointer; transition:background .15s, border-color .15s; }
.fb-add:hover { background:color-mix(in srgb, var(--fb-accent) 6%, #fff); border-color:var(--fb-accent); }
.fb-quicktypes { display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-top:10px; padding:0 2px; font-size:12px; color:var(--zw-text-faint); }
.fb-quicktypes span { font-weight:600; }
.fb-quicktypes button { width:30px; height:30px; border:1px solid var(--zw-border); background:#fff; border-radius:8px; color:var(--zw-text-muted); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:all .14s; }
.fb-quicktypes button:hover { border-color:var(--fb-accent); color:var(--fb-accent); transform:translateY(-1px); }

.fb-preview-head { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:700; color:var(--zw-text-muted); margin-bottom:10px; text-transform:uppercase; letter-spacing:.03em; }
.fb-frame { transition:all .3s cubic-bezier(.2,.7,.3,1); }
.fb-frame-desktop { max-width:100%; }
.fb-frame-mobile { position:relative; width:380px; max-width:100%; margin:0 auto; background:#1f2430; border-radius:38px; padding:14px; box-shadow:0 30px 60px -20px rgba(15,23,42,0.5); }
.fb-frame-mobile .fb-notch { position:absolute; top:18px; left:50%; transform:translateX(-50%); width:120px; height:22px; background:#1f2430; border-radius:0 0 16px 16px; z-index:3; }
.fb-frame-mobile .fb-frame-scroll { background:var(--zw-bg, #f6efe6); border-radius:26px; padding:30px 12px 16px; max-height:72vh; overflow-y:auto; }
.fb-frame-desktop .fb-frame-scroll { }

@media (max-width: 980px) {
  .fb-grid { grid-template-columns:1fr; }
  .fb-mtabs { display:flex; }
  .fb-preview { position:static; }
  .fb-grid[data-tab="config"] .fb-preview { display:none; }
  .fb-grid[data-tab="preview"] .fb-config { display:none; }
  .fb-frame-mobile { width:330px; }
}
`;
