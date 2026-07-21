import { useRef, useState, useEffect } from 'react';
import { Asterisk, Check, Send, Upload } from 'lucide-react';

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'multi' | 'file' | 'measure';

export type FormField = {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  // Champ 'measure' : constante objective → biomarqueur du jumeau.
  biomarker_code?: string;
  unit?: string;
  // Grille de scoring roue (config libre, interprétée par le backend).
  scoring?: Array<Record<string, unknown>>;
  _uid?: number; // clé interne stable (builder) — ignorée à la sauvegarde
};

export type FormShape = {
  title?: string;
  description?: string | null;
  fields: FormField[];
};

const keyOf = (f: FormField, i: number) => f._uid ?? f.id ?? i;

/**
 * Rendu fidèle d'un formulaire tel que le patient le verra — interactif
 * (on peut le remplir pour tester). Sert d'aperçu live dans le builder et
 * pourra resservir pour la saisie réelle côté patient.
 */
export function FormRenderer({
  form,
  values,
  onChange,
  interactive = true,
  onSubmit,
  accent = 'var(--brand-primary, #7c3aed)',
}: {
  form: FormShape;
  values?: Record<string, any>;
  onChange?: (id: string, value: any) => void;
  interactive?: boolean;
  onSubmit?: () => void;
  accent?: string;
}) {
  const [localVals, setLocalVals] = useState<Record<string, any>>({});
  const [sent, setSent] = useState(false);
  const v = values ?? localVals;
  const set = (id: string, val: any) => {
    if (onChange) onChange(id, val);
    else setLocalVals((s) => ({ ...s, [id]: val }));
  };
  // reset l'état "envoyé" si le formulaire change
  useEffect(() => { setSent(false); }, [form.fields.length]);

  const fields = form.fields || [];

  return (
    <div className="fr-card" style={{ ['--fr-accent' as any]: accent }}>
      <div className="fr-accentbar" />
      <div className="fr-body">
        <h2 className="fr-title">{form.title?.trim() || 'Formulaire sans titre'}</h2>
        {form.description?.trim() && <p className="fr-desc">{form.description}</p>}

        {fields.length === 0 ? (
          <div className="fr-empty">Ajoutez une question pour voir l’aperçu ici.</div>
        ) : (
          <div className="fr-fields">
            {fields.map((f, i) => (
              <div className="fr-field" key={keyOf(f, i)} style={{ animationDelay: `${Math.min(i, 8) * 28}ms` }}>
                <label className="fr-label" htmlFor={`fr-${keyOf(f, i)}`}>
                  {f.label?.trim() || <span className="fr-label-empty">Question sans libellé</span>}
                  {f.required && <Asterisk size={9} className="fr-req" />}
                </label>
                <FieldControl
                  field={f}
                  id={`fr-${keyOf(f, i)}`}
                  value={v[f.id]}
                  onChange={(val) => set(f.id, val)}
                  disabled={!interactive}
                />
              </div>
            ))}
          </div>
        )}

        {fields.length > 0 && (
          <button
            type="button"
            className={`fr-submit ${sent ? 'fr-submit-ok' : ''}`}
            onClick={() => { setSent(true); onSubmit?.(); }}
            disabled={!interactive}
          >
            {sent ? (<><Check size={16} /> Réponse envoyée (aperçu)</>) : (<><Send size={15} /> Envoyer</>)}
          </button>
        )}
      </div>
      <style>{CSS}</style>
    </div>
  );
}

function FieldControl({
  field, id, value, onChange, disabled,
}: {
  field: FormField; id: string; value: any; onChange: (v: any) => void; disabled: boolean;
}) {
  const common = { id, disabled, className: 'fr-input' } as const;
  switch (field.type) {
    case 'textarea':
      return <textarea {...common} rows={3} placeholder={field.placeholder || 'Votre réponse…'} value={value || ''} onChange={(e) => onChange(e.target.value)} style={{ resize: 'vertical', fontFamily: 'inherit' }} />;
    case 'number':
      return <input {...common} type="number" placeholder={field.placeholder || '0'} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'date':
      return <input {...common} type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} />;
    case 'select':
      return (
        <div className="fr-select-wrap">
          <select {...common} value={value || ''} onChange={(e) => onChange(e.target.value)}>
            <option value="">— Choisir —</option>
            {(field.options || []).filter((o) => o.trim()).map((o, i) => <option key={i} value={o}>{o}</option>)}
          </select>
        </div>
      );
    case 'checkbox':
      return (
        <label className={`fr-check ${value ? 'fr-check-on' : ''}`} htmlFor={id}>
          <input id={id} type="checkbox" disabled={disabled} checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          <span className="fr-check-box">{value && <Check size={13} strokeWidth={3} />}</span>
          <span className="fr-check-txt">{field.placeholder || "J'accepte / Je confirme"}</span>
        </label>
      );
    case 'multi': {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (o: string) => onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
      return (
        <div className="fr-multi">
          {(field.options || []).filter((o) => o.trim()).map((o, i) => {
            const on = arr.includes(o);
            return (
              <label key={i} className={`fr-check ${on ? 'fr-check-on' : ''}`}>
                <input type="checkbox" disabled={disabled} checked={on} onChange={() => toggle(o)} />
                <span className="fr-check-box sq">{on && <Check size={13} strokeWidth={3} />}</span>
                <span className="fr-check-txt">{o}</span>
              </label>
            );
          })}
        </div>
      );
    }
    case 'measure':
      // Constante objective (poids, tension, glycémie…) : saisie numérique +
      // unité affichée. Alimente le jumeau via son biomarker_code.
      return (
        <div style={{ position: 'relative' }}>
          <input
            {...common}
            type="number"
            inputMode="decimal"
            placeholder={field.placeholder || '—'}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            style={{ paddingRight: field.unit ? 54 : undefined }}
          />
          {field.unit && (
            <span style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--zw-text-muted)', fontSize: 13, fontWeight: 600, pointerEvents: 'none' }}>
              {field.unit}
            </span>
          )}
        </div>
      );
    case 'file':
      return <FilePicker value={value} onChange={onChange} disabled={disabled} />;
    default:
      return <input {...common} type="text" placeholder={field.placeholder || 'Votre réponse…'} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
  }
}

function FilePicker({ value, onChange, disabled }: { value?: any; onChange: (v: any) => void; disabled: boolean }) {
  const ref = useRef<HTMLInputElement | null>(null);
  const name = typeof value === 'string' ? value : value?.name;
  return (
    <div
      className={`fr-file ${name ? 'fr-file-on' : ''}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && ref.current?.click()}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !disabled) ref.current?.click(); }}
    >
      <input
        ref={ref} type="file" disabled={disabled} style={{ display: 'none' }}
        onChange={(e) => onChange(e.target.files?.[0]?.name || '')}
      />
      <Upload size={18} />
      <span className="fr-file-txt">{name || 'Téléverser un fichier'}</span>
    </div>
  );
}

const CSS = `
.fr-card { position: relative; background:#fff; border:1px solid var(--zw-border); border-radius:16px; overflow:hidden; box-shadow:0 10px 30px -12px rgba(15,23,42,0.18); }
.fr-accentbar { height:8px; background:linear-gradient(90deg, var(--fr-accent), color-mix(in srgb, var(--fr-accent) 55%, #fff)); }
.fr-body { padding:22px 22px 20px; }
.fr-title { font-size:21px; font-weight:800; margin:0 0 4px; color:var(--zw-text); letter-spacing:-0.01em; }
.fr-desc { font-size:13.5px; color:var(--zw-text-muted); margin:0 0 4px; line-height:1.5; white-space:pre-wrap; }
.fr-empty { padding:34px 12px; text-align:center; color:var(--zw-text-faint); font-size:13px; border:1px dashed var(--zw-border); border-radius:12px; margin-top:14px; }
.fr-fields { display:flex; flex-direction:column; gap:18px; margin-top:18px; }
.fr-field { animation: frAppear .34s cubic-bezier(.2,.7,.3,1) both; }
@keyframes frAppear { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
.fr-label { display:flex; align-items:center; gap:3px; font-size:13px; font-weight:600; color:var(--zw-text-soft); margin-bottom:7px; }
.fr-label-empty { color:var(--zw-text-faint); font-style:italic; font-weight:500; }
.fr-req { color:#e11d48; }
.fr-input { width:100%; padding:11px 13px; border:1px solid var(--zw-border); border-radius:10px; font-size:14px; background:#fff; box-sizing:border-box; color:var(--zw-text); transition:border-color .15s, box-shadow .15s, background .15s; }
.fr-input::placeholder { color:var(--zw-text-faint); }
.fr-input:focus { outline:none; border-color:var(--fr-accent); box-shadow:0 0 0 3px color-mix(in srgb, var(--fr-accent) 16%, transparent); }
.fr-input:disabled { background:#fcfbf9; cursor:default; }
.fr-select-wrap { position:relative; }
.fr-select-wrap::after { content:'▾'; position:absolute; right:14px; top:50%; transform:translateY(-50%); pointer-events:none; color:var(--zw-text-muted); font-size:12px; }
.fr-select-wrap select { appearance:none; -webkit-appearance:none; padding-right:32px; cursor:pointer; }
.fr-check { display:inline-flex; align-items:center; gap:10px; cursor:pointer; user-select:none; padding:6px 2px; }
.fr-check input { position:absolute; opacity:0; width:0; height:0; }
.fr-check-box { width:22px; height:22px; border-radius:7px; border:2px solid var(--zw-border); display:flex; align-items:center; justify-content:center; color:#fff; transition:all .16s cubic-bezier(.2,.7,.3,1); flex-shrink:0; }
.fr-check-on .fr-check-box { background:var(--fr-accent); border-color:var(--fr-accent); transform:scale(1.05); }
.fr-check-txt { font-size:13.5px; color:var(--zw-text-soft); }
.fr-check-box.sq { border-radius:6px; }
.fr-multi { display:flex; flex-direction:column; gap:7px; }
.fr-file { display:flex; align-items:center; gap:10px; padding:16px 14px; border:1.5px dashed var(--zw-border); border-radius:10px; background:#fcfbf9; color:var(--zw-text-muted); cursor:pointer; transition:all .16s; }
.fr-file:hover { border-color:var(--fr-accent); color:var(--fr-accent); background:color-mix(in srgb, var(--fr-accent) 5%, #fcfbf9); }
.fr-file-on { border-style:solid; border-color:var(--fr-accent); color:var(--zw-text); }
.fr-file-txt { font-size:13.5px; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.fr-submit { margin-top:22px; width:100%; padding:13px; border:none; border-radius:11px; background:var(--fr-accent); color:#fff; font-size:14.5px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:transform .14s, box-shadow .2s, background .2s; box-shadow:0 8px 20px -8px color-mix(in srgb, var(--fr-accent) 70%, transparent); }
.fr-submit:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 12px 24px -8px color-mix(in srgb, var(--fr-accent) 70%, transparent); }
.fr-submit:disabled { cursor:default; }
.fr-submit-ok { background:#16a34a; box-shadow:0 8px 20px -8px rgba(22,163,74,0.6); }
`;
