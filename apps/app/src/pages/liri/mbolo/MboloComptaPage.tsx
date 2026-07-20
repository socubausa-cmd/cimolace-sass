import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Landmark, Building2, BookOpen, Calculator, FileDown, Save, RotateCcw,
  Loader2, Check, ChevronDown, AlertCircle,
} from 'lucide-react';
import { mboloApi } from '@/lib/api';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import '../../LiriPortal.css';

/* ────────────────────────────────────────────────────────────────────────────
 * mbolo · Compta — entité légale du tenant + plan comptable + export FEC.
 * Coquille = LiriPortalShell (active="compta", moteur mbolo). Données via
 * mboloApi.getAccountingSettings() → { id, config } (config en camelCase) et
 * mboloApi.updateAccountingSettings(patchDesChampsModifiés). Aucun montant ici :
 * ce sont des identités/codes comptables (pas de conversion centimes).
 * ──────────────────────────────────────────────────────────────────────────── */

type Cfg = Record<string, any>;
type FieldDef = { key: string; label: string; placeholder?: string; full?: boolean; mono?: boolean };

const LEGAL_FIELDS: FieldDef[] = [
  { key: 'legalName', label: 'Raison sociale', full: true, placeholder: 'Ma Boutique SARL' },
  { key: 'siren', label: 'SIREN', mono: true, placeholder: '9 chiffres' },
  { key: 'nic', label: 'NIC', mono: true, placeholder: '5 chiffres' },
  { key: 'addressLine1', label: 'Adresse', full: true, placeholder: 'Rue, quartier…' },
  { key: 'postalCode', label: 'Code postal' },
  { key: 'city', label: 'Ville' },
  { key: 'country', label: 'Pays', placeholder: 'Gabon' },
];

const JOURNAL_FIELDS: FieldDef[] = [
  { key: 'journalSalesCode', label: 'Code — Journal des ventes', mono: true, placeholder: 'VE' },
  { key: 'journalSalesLabel', label: 'Libellé — Journal des ventes', placeholder: 'Ventes' },
  { key: 'journalCashCode', label: 'Code — Journal de caisse / banque', mono: true, placeholder: 'BQ' },
  { key: 'journalCashLabel', label: 'Libellé — Journal de caisse / banque', placeholder: 'Banque' },
  { key: 'journalRefundCode', label: 'Code — Journal des remboursements', mono: true, placeholder: 'RB' },
  { key: 'journalRefundLabel', label: 'Libellé — Journal des remboursements', placeholder: 'Remboursements' },
];

const PCG_FIELDS: FieldDef[] = [
  { key: 'accountRevenueHt', label: 'Ventes HT (produits)', mono: true, placeholder: 'ex. 707' },
  { key: 'accountShippingRevenue', label: 'Frais de port perçus', mono: true, placeholder: 'ex. 7085' },
  { key: 'accountVatCollected', label: 'TVA collectée', mono: true, placeholder: 'ex. 44571' },
  { key: 'accountPaymentClearing', label: 'Compte d’attente (encaissements)', mono: true, placeholder: 'ex. 511' },
  { key: 'accountClients', label: 'Clients', mono: true, placeholder: 'ex. 411' },
  { key: 'accountDiscounts', label: 'Remises accordées', mono: true, placeholder: 'ex. 709' },
];

const FEC_TOGGLES: { key: string; label: string; hint: string }[] = [
  { key: 'fecIncludeOrders', label: 'Inclure les commandes', hint: 'Génère les écritures de vente à partir des commandes payées.' },
  { key: 'fecIncludeInvoices', label: 'Inclure les factures', hint: 'Ajoute les écritures issues des factures émises.' },
  { key: 'fecInvoicesSkipLinkedOrder', label: 'Éviter les doublons commande ↔ facture', hint: 'Ignore une facture dont la commande liée est déjà exportée.' },
];

const CURRENCIES = ['XAF', 'XOF', 'EUR', 'USD'];
const DEFAULTS: Cfg = { defaultCurrency: 'XAF' };

const TEXT_KEYS = [
  ...LEGAL_FIELDS.map((f) => f.key),
  'defaultCurrency',
  ...JOURNAL_FIELDS.map((f) => f.key),
  ...PCG_FIELDS.map((f) => f.key),
  'fecTimezone',
];
const BOOL_KEYS = FEC_TOGGLES.map((f) => f.key);

/** Config API → état de formulaire (défauts appliqués, jamais d'undefined). */
function toForm(config: Cfg | null | undefined): Cfg {
  const c = config ?? {};
  const f: Cfg = {};
  for (const k of TEXT_KEYS) f[k] = c[k] ?? DEFAULTS[k] ?? '';
  for (const k of BOOL_KEYS) f[k] = !!c[k];
  return f;
}

const norm = (v: any) => (typeof v === 'string' ? v.trim() : v);

/** Patch = uniquement les champs réellement modifiés (chaînes normalisées). */
function diff(form: Cfg, initial: Cfg): Cfg {
  const patch: Cfg = {};
  for (const k of Object.keys(form)) {
    if (norm(form[k]) !== norm(initial[k])) patch[k] = norm(form[k]);
  }
  return patch;
}

/* ── petits composants d'UI (thème sombre LIRI, accent coral) ─────────────── */

const INPUT =
  'w-full rounded-lg border lp-line bg-[rgba(255,255,255,.04)] px-3 py-2 text-[14px] text-white ' +
  'placeholder:text-white/25 focus:border-[rgba(217,119,87,.55)] focus:outline-none lp-tr';

function TextField({
  def, value, onChange,
}: { def: FieldDef; value: string; onChange: (v: string) => void }) {
  return (
    <div className={def.full ? 'sm:col-span-2' : ''}>
      <label className="mb-1.5 block text-[12px] font-medium lp-faint">{def.label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={def.placeholder}
        className={`${INPUT} ${def.mono ? 'font-mono text-[13px]' : ''}`}
      />
    </div>
  );
}

function Toggle({
  checked, label, hint, onChange,
}: { checked: boolean; label: string; hint?: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border lp-line bg-[rgba(255,255,255,.02)] px-4 py-3 text-left lp-tr hover:bg-[rgba(255,255,255,.04)]"
    >
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium lp-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-[12px] lp-faint">{hint}</span>}
      </span>
      <span
        className="relative h-6 w-11 shrink-0 rounded-full lp-tr"
        style={{ background: checked ? 'var(--coral, #d97757)' : 'rgba(255,255,255,.14)' }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white lp-tr"
          style={{ left: checked ? 22 : 2 }}
        />
      </span>
    </button>
  );
}

function SectionCard({
  icon: Icon, title, subtitle, open, onToggle, children,
}: {
  icon: typeof Landmark; title: string; subtitle?: string;
  open: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border lp-line lp-panel70">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-5 py-4 text-left lp-tr hover:bg-[rgba(255,255,255,.025)]"
        aria-expanded={open}
      >
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
          style={{ background: 'rgba(217,119,87,.13)', color: 'var(--coral, #d97757)' }}
        >
          <Icon size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-medium lp-ink">{title}</span>
          {subtitle && <span className="mt-0.5 block text-[12px] lp-faint">{subtitle}</span>}
        </span>
        <ChevronDown
          size={18}
          className="shrink-0 lp-faint lp-tr"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>
      {open && <div className="border-t lp-line px-5 py-5">{children}</div>}
    </section>
  );
}

/* ── page ─────────────────────────────────────────────────────────────────── */

export function MboloComptaPage() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ['mbolo-accounting-settings'],
    queryFn: mboloApi.getAccountingSettings,
  });

  const [form, setForm] = useState<Cfg>({});
  const [initial, setInitial] = useState<Cfg>({});
  const [err, setErr] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({
    legal: true, journaux: true, pcg: true, fec: true,
  });
  const hydratedRef = useRef(false);
  const toastTimer = useRef<number | undefined>(undefined);

  // Hydratation initiale (une seule fois, ne clobbe pas les saisies en cours).
  useEffect(() => {
    if (settings.data && !hydratedRef.current) {
      const f = toForm(settings.data.config);
      setForm(f);
      setInitial(f);
      hydratedRef.current = true;
    }
  }, [settings.data]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  function showToast(text: string) {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }

  const save = useMutation({
    mutationFn: (patch: Cfg) => mboloApi.updateAccountingSettings(patch),
    onSuccess: (data: any) => {
      const f = toForm(data?.config);
      setForm(f);
      setInitial(f);
      setErr('');
      qc.invalidateQueries({ queryKey: ['mbolo-accounting-settings'] });
      showToast('Paramètres comptables enregistrés');
    },
    onError: (e: Error) => setErr(e.message),
  });

  const patch = useMemo(() => diff(form, initial), [form, initial]);
  const dirty = Object.keys(patch).length > 0;

  const setField = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));
  const toggleSection = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || save.isPending) return;
    save.mutate(patch);
  }

  const entityName = (form.legalName || '').trim();

  return (
    <LiriPortalShell active="compta">
      <div className="lp-root relative flex h-full w-full flex-col items-center overflow-y-auto">
        <div className="lp-glow">
          <span style={{ width: 460, height: 360, left: '28%', top: -150, background: 'rgba(217,119,87,.07)' }} />
        </div>

        <form onSubmit={onSubmit} className="relative z-10 w-full max-w-4xl px-4 py-6 sm:px-6">
          {/* en-tête de section (le chrome LIRI est fourni par LiriPortalShell) */}
          <div className="mb-5 flex items-start gap-3">
            <span
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl"
              style={{ background: 'rgba(217,119,87,.13)', color: 'var(--coral, #d97757)' }}
            >
              <Landmark size={22} />
            </span>
            <div className="min-w-0">
              <h1 className="lp-serif text-[22px] font-medium leading-tight lp-ink">Comptabilité</h1>
              <p className="text-[12.5px] lp-faint">
                Entité légale, journaux, plan comptable (PCG) et export FEC de votre boutique mbolo.
                {entityName && <span className="lp-muted"> · {entityName}</span>}
              </p>
            </div>
          </div>

          {settings.isLoading && (
            <div className="flex items-center gap-2 rounded-2xl border lp-line lp-panel70 px-5 py-8 text-[13.5px] lp-muted">
              <Loader2 size={16} className="animate-spin lp-coral" /> Chargement des paramètres comptables…
            </div>
          )}

          {settings.isError && (
            <div
              className="flex items-center justify-between gap-4 rounded-2xl border px-5 py-4"
              style={{ borderColor: 'rgba(226,85,63,.3)', background: 'rgba(226,85,63,.06)' }}
            >
              <span className="flex items-center gap-2 text-[13.5px]" style={{ color: '#ef6a52' }}>
                <AlertCircle size={16} /> {(settings.error as Error)?.message || 'Impossible de charger les paramètres.'}
              </span>
              <button
                type="button"
                onClick={() => settings.refetch()}
                className="shrink-0 rounded-lg border px-3.5 py-2 text-[12.5px] font-medium lp-muted lp-tr"
                style={{ borderColor: 'rgba(245,244,238,.14)' }}
              >
                Réessayer
              </button>
            </div>
          )}

          {settings.data && (
            <div className="flex flex-col gap-3.5">
              {err && (
                <p
                  className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px]"
                  style={{ borderColor: 'rgba(226,85,63,.3)', background: 'rgba(226,85,63,.06)', color: '#ef6a52' }}
                >
                  <AlertCircle size={15} /> {err}
                </p>
              )}

              {/* Entité légale */}
              <SectionCard
                icon={Building2}
                title="Entité légale"
                subtitle="Identité juridique et devise par défaut de la boutique."
                open={open.legal}
                onToggle={() => toggleSection('legal')}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  {LEGAL_FIELDS.map((def) => (
                    <TextField
                      key={def.key}
                      def={def}
                      value={form[def.key] ?? ''}
                      onChange={(v) => setField(def.key, v)}
                    />
                  ))}
                  <div>
                    <label className="mb-1.5 block text-[12px] font-medium lp-faint">Devise par défaut</label>
                    <select
                      value={form.defaultCurrency ?? 'XAF'}
                      onChange={(e) => setField('defaultCurrency', e.target.value)}
                      className={INPUT}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </SectionCard>

              {/* Journaux */}
              <SectionCard
                icon={BookOpen}
                title="Journaux"
                subtitle="Codes et libellés des journaux comptables (ventes, caisse, remboursements)."
                open={open.journaux}
                onToggle={() => toggleSection('journaux')}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  {JOURNAL_FIELDS.map((def) => (
                    <TextField
                      key={def.key}
                      def={def}
                      value={form[def.key] ?? ''}
                      onChange={(v) => setField(def.key, v)}
                    />
                  ))}
                </div>
              </SectionCard>

              {/* Comptes PCG */}
              <SectionCard
                icon={Calculator}
                title="Comptes PCG"
                subtitle="Numéros de compte du plan comptable utilisés pour les écritures."
                open={open.pcg}
                onToggle={() => toggleSection('pcg')}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  {PCG_FIELDS.map((def) => (
                    <TextField
                      key={def.key}
                      def={def}
                      value={form[def.key] ?? ''}
                      onChange={(v) => setField(def.key, v)}
                    />
                  ))}
                </div>
              </SectionCard>

              {/* Export FEC */}
              <SectionCard
                icon={FileDown}
                title="Export FEC"
                subtitle="Fichier des écritures comptables — périmètre et fuseau horaire de l'export."
                open={open.fec}
                onToggle={() => toggleSection('fec')}
              >
                <div className="flex flex-col gap-3">
                  {FEC_TOGGLES.map((t) => (
                    <Toggle
                      key={t.key}
                      checked={!!form[t.key]}
                      label={t.label}
                      hint={t.hint}
                      onChange={(v) => setField(t.key, v)}
                    />
                  ))}
                  <div className="sm:max-w-xs">
                    <label className="mb-1.5 block text-[12px] font-medium lp-faint">Fuseau horaire</label>
                    <input
                      value={form.fecTimezone ?? ''}
                      onChange={(e) => setField('fecTimezone', e.target.value)}
                      placeholder="Africa/Libreville"
                      className={`${INPUT} font-mono text-[13px]`}
                    />
                  </div>
                </div>
              </SectionCard>

              {/* barre d'action collante */}
              <div className="sticky bottom-0 z-20 -mx-4 mt-1 flex items-center justify-between gap-3 border-t lp-line px-4 py-3 sm:-mx-6 sm:px-6"
                style={{ background: 'rgba(31,30,28,.92)', backdropFilter: 'blur(8px)' }}
              >
                <span className="flex items-center gap-2 text-[12.5px] lp-faint">
                  {dirty ? (
                    <>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--coral, #d97757)' }} />
                      Modifications non enregistrées
                    </>
                  ) : (
                    <>
                      <Check size={14} className="lp-coral" /> À jour
                    </>
                  )}
                </span>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => { setForm(initial); setErr(''); }}
                    disabled={!dirty || save.isPending}
                    className="flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[12.5px] font-medium lp-muted lp-tr disabled:opacity-40"
                    style={{ borderColor: 'rgba(245,244,238,.14)' }}
                  >
                    <RotateCcw size={14} /> Réinitialiser
                  </button>
                  <button
                    type="submit"
                    disabled={!dirty || save.isPending}
                    className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white lp-tr disabled:opacity-50"
                    style={{ background: 'linear-gradient(90deg,#e2855f,#c2683f)' }}
                  >
                    {save.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* toast de succès */}
        {toast && (
          <div className="pointer-events-none fixed bottom-6 left-1/2 z-[70] -translate-x-1/2">
            <div
              className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-medium lp-ink lp-soft"
              style={{ borderColor: 'rgba(217,119,87,.35)', background: '#221f1b' }}
            >
              <Check size={16} className="lp-coral" /> {toast}
            </div>
          </div>
        )}
      </div>
    </LiriPortalShell>
  );
}

export default MboloComptaPage;
