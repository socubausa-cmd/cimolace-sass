import React, { useMemo, useState } from 'react';
import { X, Upload, FileText, Check, Loader2, AlertCircle } from 'lucide-react';
import { crmApi } from '@/lib/api-v2';
import { useToast } from '@/components/ui/use-toast';

/* ── Import CSV de contacts — coller un CSV (avec en-têtes), mapping souple FR/EN. ── */

const ALIASES = {
  first_name: ['first_name', 'firstname', 'first', 'prénom', 'prenom'],
  last_name: ['last_name', 'lastname', 'last', 'nom', 'name'],
  email: ['email', 'e-mail', 'mail', 'courriel'],
  phone: ['phone', 'téléphone', 'telephone', 'tel', 'tél'],
  title: ['title', 'titre', 'fonction', 'poste', 'role', 'rôle'],
  company: ['company', 'company_name', 'société', 'societe', 'entreprise', 'organisation'],
};

const norm = (s) => String(s || '').trim().toLowerCase().replace(/^"|"$/g, '');

// Parseur CSV tolérant (gère les guillemets, virgules et retours-ligne échappés).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQ = false;
  const s = String(text || '').replace(/\r\n?/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',' || c === ';' || c === '\t') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
}

function toContacts(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { contacts: [], headers: [] };
  const headers = rows[0].map(norm);
  // Résout chaque colonne cible vers l'index d'en-tête correspondant.
  const idx = {};
  for (const [key, aliases] of Object.entries(ALIASES)) {
    idx[key] = headers.findIndex((h) => aliases.includes(h));
  }
  const contacts = rows.slice(1).map((r) => {
    const get = (k) => (idx[k] >= 0 ? String(r[idx[k]] ?? '').trim() : '');
    return {
      first_name: get('first_name'),
      last_name: get('last_name'),
      email: get('email'),
      phone: get('phone'),
      title: get('title'),
      company: get('company'),
    };
  }).filter((c) => c.email || c.first_name || c.last_name);
  return { contacts, headers };
}

const SAMPLE = `first_name,last_name,email,phone,title,company
Fatou,Diallo,fatou@zahir.com,+221 77 000 00 00,Directrice,Zahir Wellness
Moussa,Sow,m.sow@coop.sn,,Responsable achats,Coop Kaolack`;

export default function CrmImportModal({ onClose, onImported }) {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const { contacts } = useMemo(() => toContacts(text), [text]);

  const run = async () => {
    if (!contacts.length || busy) return;
    setBusy(true);
    try {
      const res = await crmApi.importContacts(contacts);
      setResult(res);
      toast({ title: 'Import', description: `${res.created} contact(s) importé(s).` });
      onImported?.();
    } catch (e) {
      toast({ title: 'Import', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: 'rgba(15,12,10,.55)' }}
      onClick={busy ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Importer des contacts"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border lp-line p-5 shadow-2xl backdrop-blur-[2px] sm:rounded-3xl"
        style={{ background: '#221f1b' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl lp-coral-tint">
              <Upload size={18} className="lp-coral" />
            </div>
            <div>
              <h2 className="text-[17px] font-semibold lp-ink">Importer des contacts</h2>
              <p className="text-[12.5px] lp-muted">Collez un CSV avec une ligne d'en-têtes.</p>
            </div>
          </div>
          <button
            type="button" aria-label="Fermer" onClick={onClose}
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg lp-muted lp-railbtn lp-tr"
          >
            <X size={17} />
          </button>
        </div>

        {result ? (
          <div className="mt-5 space-y-4">
            <div className="grid place-items-center rounded-2xl border lp-line lp-panel70 px-6 py-8 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl lp-coral-tint">
                <Check size={22} className="lp-coral" />
              </div>
              <h3 className="mt-3 text-[16px] font-semibold lp-ink">Import terminé</h3>
              <p className="mt-1 text-[13.5px] lp-muted">
                <span className="lp-ink font-semibold">{result.created}</span> contact(s) créé(s)
                {result.companiesCreated ? ` · ${result.companiesCreated} société(s) créée(s)` : ''}
                {result.skipped ? ` · ${result.skipped} ignoré(s)` : ''}.
              </p>
            </div>
            {result.errors?.length > 0 && (
              <div className="rounded-xl border lp-line px-3.5 py-3 text-[12.5px] lp-muted" style={{ background: 'rgba(217,119,87,.08)' }}>
                <div className="mb-1 flex items-center gap-1.5 lp-coral"><AlertCircle size={13} /> {result.errors.length} ligne(s) en erreur</div>
                {result.errors.slice(0, 5).map((er, i) => (
                  <div key={i}>Ligne {er.line} : {er.error}</div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className="cursor-pointer rounded-xl px-4 py-2 text-[13.5px] font-medium text-white lp-tr lp-ember">Terminé</button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3.5">
            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[.06em] lp-muted">
                <span>Données CSV</span>
                <button type="button" onClick={() => setText(SAMPLE)} className="cursor-pointer text-[11px] font-medium lp-coral lp-tr hover:opacity-80">
                  Insérer un exemple
                </button>
              </span>
              <textarea
                rows={9}
                spellCheck={false}
                className="w-full resize-y rounded-xl border lp-line bg-[rgba(245,244,238,.03)] px-3.5 py-3 font-mono text-[12.5px] lp-ink outline-none lp-tr placeholder:text-[var(--faint)] focus:border-[var(--coral)]"
                placeholder={"first_name,last_name,email,phone,title,company\nFatou,Diallo,fatou@zahir.com,,Directrice,Zahir Wellness"}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>

            <div className="flex items-center gap-2 text-[12.5px] lp-muted">
              <FileText size={14} className="shrink-0 lp-faint" />
              <span>
                Colonnes reconnues (FR/EN) : <span className="lp-ink">prénom · nom · email · téléphone · fonction · société</span>. Les sociétés sont créées ou reliées par leur nom.
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[13px] lp-muted">
                {contacts.length > 0
                  ? <><span className="lp-coral font-semibold">{contacts.length}</span> contact(s) détecté(s)</>
                  : 'Aucun contact détecté'}
              </span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={onClose} className="cursor-pointer rounded-xl px-4 py-2 text-[13.5px] font-medium lp-muted lp-railbtn lp-tr">Annuler</button>
                <button
                  type="button" onClick={run} disabled={busy || contacts.length === 0}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-medium text-white lp-tr lp-ember disabled:opacity-45"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                  Importer {contacts.length > 0 ? contacts.length : ''}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
