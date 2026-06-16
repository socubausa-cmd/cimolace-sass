import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CreditCard,
  Smartphone,
  Package,
  Plus,
  Loader2,
  Eye,
  EyeOff,
  Trash2,
  Pencil,
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CircleSlash,
  PlugZap,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

import { paymentMethodsApi } from '@/lib/api-v2';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

/* ──────────────────────────────────────────────────────────────────────────
 * Catalogue des agrégateurs supportés (UI). Doit rester aligné sur le backend :
 *  - `secrets` = champs exacts attendus par /billing/payment-methods (clé = nom
 *    du champ credentials côté serveur).
 *  - `required` = sous-ensemble bloquant pour le statut « Incomplet ».
 * ────────────────────────────────────────────────────────────────────────── */
const PROVIDERS = {
  stripe: {
    key: 'stripe',
    name: 'Stripe',
    tagline: 'Carte bancaire',
    description: 'Paiements par carte (Visa, Mastercard, CB). Idéal pour l’international.',
    icon: CreditCard,
    accent: '#635BFF',
    hasMode: false,
    secrets: [
      { key: 'secret_key', label: 'Clé secrète (secret_key)', placeholder: 'sk_live_… ou sk_test_…', required: true },
      { key: 'webhook_secret', label: 'Secret du webhook (signing secret)', placeholder: 'whsec_…', required: false },
    ],
  },
  pawapay: {
    key: 'pawapay',
    name: 'PawaPay',
    tagline: 'Mobile Money',
    description: 'Orange Money, MTN, Airtel, Moov… (Afrique : CMR, CIV, SEN, RWA, GHA…).',
    icon: Smartphone,
    accent: '#E85D04',
    hasMode: true,
    secrets: [
      { key: 'api_token', label: 'Token API (api_token)', placeholder: 'pp_tk_…', required: true },
      { key: 'signing_secret', label: 'Secret de signature (signing_secret)', placeholder: 'optionnel', required: false },
    ],
  },
  chariow: {
    key: 'chariow',
    name: 'Chariow',
    tagline: 'Produits',
    description: 'Vente de produits/forfaits via Chariow + mapping des plans.',
    icon: Package,
    accent: '#10B981',
    hasMode: false,
    secrets: [
      { key: 'api_key', label: 'Clé API (api_key)', placeholder: 'sk_…', required: true },
      { key: 'webhook_secret', label: 'Secret du webhook', placeholder: 'optionnel', required: false },
    ],
    products: [
      { key: 'start', label: 'Product ID — START' },
      { key: 'business', label: 'Product ID — BUSINESS' },
      { key: 'entreprise', label: 'Product ID — ENTREPRISE' },
      { key: 'setup', label: 'Product ID — SETUP (frais one-off)' },
    ],
  },
};

/** Ordre d'affichage des cartes (les 3 agrégateurs principaux d'abord). */
const PROVIDER_ORDER = ['stripe', 'pawapay', 'chariow'];

/** Métadonnées de secours pour un provider stocké mais hors catalogue UI (paypal/cinetpay). */
function providerMeta(key) {
  return (
    PROVIDERS[key] || {
      key,
      name: key ? key[0].toUpperCase() + key.slice(1) : 'Inconnu',
      tagline: '',
      description: '',
      icon: PlugZap,
      accent: '#64748B',
      hasMode: true,
      secrets: [],
    }
  );
}

/**
 * Statut visuel d'un moyen configuré :
 *  - error    → dernier test KO
 *  - disabled → non activé
 *  - incomplete → un champ requis manque
 *  - ok       → activé + champs requis présents
 */
function computeStatus(method) {
  if (!method) return 'absent';
  const meta = providerMeta(method.provider);
  const requiredKeys = (meta.secrets || []).filter((s) => s.required).map((s) => s.key);
  const missingRequired = requiredKeys.some((k) => !method.credentials?.[k]?.set);
  if (method.lastTest?.ok === false) return 'error';
  if (!method.enabled) return 'disabled';
  if (missingRequired) return 'incomplete';
  return 'ok';
}

const STATUS_BADGE = {
  ok: { label: 'Actif', variant: 'default', dot: 'bg-emerald-400', Icon: CheckCircle2, iconClass: 'text-emerald-400' },
  incomplete: { label: 'Incomplet', variant: 'secondary', dot: 'bg-amber-400', Icon: AlertTriangle, iconClass: 'text-amber-400' },
  error: { label: 'Erreur', variant: 'destructive', dot: 'bg-red-400', Icon: XCircle, iconClass: 'text-red-400' },
  disabled: { label: 'Désactivé', variant: 'outline', dot: 'bg-zinc-400', Icon: CircleSlash, iconClass: 'text-zinc-400' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_BADGE[status] || STATUS_BADGE.disabled;
  return (
    <Badge variant={cfg.variant} className="gap-1.5">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden />
      {cfg.label}
    </Badge>
  );
}

/* Logo carré (initiale) coloré pour un agrégateur. */
function ProviderLogo({ meta, size = 44 }) {
  const Icon = meta.icon;
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
      style={{ width: size, height: size, background: meta.accent }}
    >
      <Icon className="h-5 w-5" strokeWidth={2.2} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Assistant d'ajout / modification (modal stepper).
 *  Étape 1 : choix de l'agrégateur (sauté en mode édition).
 *  Étape 2 : formulaire selon le provider.
 *  Étape 3 : récap + bouton « Ajouter » → save() puis test().
 * ────────────────────────────────────────────────────────────────────────── */
function PaymentMethodWizard({ open, onClose, onSaved, editProvider, existing }) {
  const { toast } = useToast();
  const isEdit = Boolean(editProvider);

  const [step, setStep] = useState(isEdit ? 2 : 1);
  const [provider, setProvider] = useState(editProvider || null);
  const [mode, setMode] = useState('sandbox');
  const [secrets, setSecrets] = useState({});
  const [products, setProducts] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { ok, message } du test

  // Réinitialise à chaque ouverture (ou changement de cible d'édition).
  useEffect(() => {
    if (!open) return;
    const initial = editProvider || null;
    setProvider(initial);
    setStep(initial ? 2 : 1);
    setSecrets({});
    setProducts(
      initial === 'chariow' && existing?.productMap ? { ...existing.productMap } : {},
    );
    setMode(existing?.mode || 'sandbox');
    setResult(null);
    setSubmitting(false);
  }, [open, editProvider, existing]);

  const meta = provider ? providerMeta(provider) : null;

  const requiredFilled = useMemo(() => {
    if (!meta) return false;
    return (meta.secrets || [])
      .filter((s) => s.required)
      .every((s) => (secrets[s.key] || '').trim().length > 0);
  }, [meta, secrets]);

  const pickProvider = (key) => {
    setProvider(key);
    setStep(2);
  };

  const buildBody = () => {
    const credentials = {};
    for (const f of meta.secrets || []) {
      const v = (secrets[f.key] || '').trim();
      if (v) credentials[f.key] = v;
    }
    const body = { provider, credentials };
    if (meta.hasMode) body.mode = mode;
    if (provider === 'chariow') {
      const pm = {};
      for (const p of meta.products || []) {
        const v = (products[p.key] || '').trim();
        if (v) pm[p.key] = v;
      }
      if (Object.keys(pm).length) body.productMap = pm;
    }
    return body;
  };

  const handleSubmit = async () => {
    if (!requiredFilled) {
      toast({
        title: 'Champs requis manquants',
        description: 'Renseignez au moins les clés obligatoires.',
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      await paymentMethodsApi.save(buildBody());
      // Test de connexion enchaîné (best-effort : l'enregistrement est déjà fait).
      let test = { ok: null, message: '' };
      try {
        test = await paymentMethodsApi.test(provider);
      } catch (e) {
        test = { ok: false, message: e?.message || 'Test impossible.' };
      }
      setResult(test);
      setStep(3);
      toast({
        title: isEdit ? 'Moyen mis à jour' : 'Moyen ajouté',
        description: `${meta.name} enregistré${test.ok ? ' et connexion vérifiée.' : '.'}`,
        className: 'bg-emerald-700 text-white border-none',
      });
      onSaved?.();
    } catch (e) {
      toast({
        title: 'Échec de l’enregistrement',
        description: e?.message || 'Erreur inattendue.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl" aria-describedby="pm-wizard-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlugZap className="h-5 w-5 text-[var(--school-accent)]" />
            {isEdit ? `Modifier ${meta?.name || ''}` : 'Ajouter un moyen de paiement'}
          </DialogTitle>
          <DialogDescription id="pm-wizard-desc">
            {step === 1 && 'Choisissez l’agrégateur à configurer pour cette école.'}
            {step === 2 && meta && (isEdit
              ? 'Saisissez de nouvelles clés pour remplacer celles enregistrées.'
              : `Renseignez les clés ${meta.name}. Elles sont chiffrées avant stockage.`)}
            {step === 3 && 'Résultat du test de connexion.'}
          </DialogDescription>
        </DialogHeader>

        {/* Fil d'étapes */}
        <ol className="flex items-center gap-2 text-xs">
          {['Agrégateur', 'Configuration', 'Vérification'].map((lbl, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <li key={lbl} className="flex items-center gap-2">
                <span
                  className={[
                    'flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold',
                    done
                      ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                      : active
                        ? 'border-[var(--school-accent)] bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)] text-[var(--school-accent)]'
                        : 'border-white/15 text-gray-500',
                  ].join(' ')}
                >
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
                </span>
                <span className={active ? 'text-white' : 'text-gray-500'}>{lbl}</span>
                {n < 3 ? <span className="mx-1 h-px w-5 bg-white/10" /> : null}
              </li>
            );
          })}
        </ol>

        {/* Étape 1 — choix de l'agrégateur */}
        {step === 1 && (
          <div className="grid gap-3 sm:grid-cols-3">
            {PROVIDER_ORDER.map((key) => {
              const m = PROVIDERS[key];
              const Icon = m.icon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => pickProvider(key)}
                  className="group flex flex-col items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition-all hover:border-[var(--school-accent)]/50 hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--school-accent)]/45"
                >
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
                    style={{ background: m.accent }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold text-white">{m.name}</span>
                  <span className="text-xs text-gray-400">{m.tagline}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Étape 2 — formulaire selon provider */}
        {step === 2 && meta && (
          <div className="grid gap-4">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <ProviderLogo meta={meta} size={38} />
              <div>
                <p className="text-sm font-semibold text-white">{meta.name}</p>
                <p className="text-xs text-gray-400">{meta.description}</p>
              </div>
            </div>

            {/* Mode sandbox/production (PawaPay) */}
            {meta.hasMode && (
              <div className="grid gap-1.5">
                <Label className="text-gray-300">Environnement</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: 'sandbox', l: 'Sandbox (tests)' },
                    { v: 'production', l: 'Production (live)' },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setMode(opt.v)}
                      className={[
                        'rounded-lg border px-3 py-2 text-sm transition-colors',
                        mode === opt.v
                          ? 'border-[var(--school-accent)] bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-white'
                          : 'border-white/10 bg-white/[0.02] text-gray-400 hover:bg-white/[0.05]',
                      ].join(' ')}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Champs secrets */}
            <div className="grid gap-3">
              {(meta.secrets || []).map((f) => (
                <SecretFieldDark
                  key={f.key}
                  id={`pm-${meta.key}-${f.key}`}
                  label={f.label + (f.required ? ' *' : '')}
                  placeholder={f.placeholder}
                  value={secrets[f.key] || ''}
                  onChange={(v) => setSecrets((s) => ({ ...s, [f.key]: v }))}
                />
              ))}
            </div>

            {/* Mapping produits (Chariow) */}
            {provider === 'chariow' && (
              <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-xs font-medium text-gray-300">
                  Mapping des plans → Product IDs Chariow (optionnel)
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(meta.products || []).map((p) => (
                    <div key={p.key} className="grid gap-1.5">
                      <Label className="text-gray-400">{p.label}</Label>
                      <Input
                        value={products[p.key] || ''}
                        onChange={(e) => setProducts((s) => ({ ...s, [p.key]: e.target.value }))}
                        placeholder="prod_…"
                        className="font-mono text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isEdit && (
              <p className="text-xs text-amber-300/80">
                Pour des raisons de sécurité, les clés actuelles ne sont jamais réaffichées.
                Saisissez à nouveau toutes les clés requises pour les remplacer.
              </p>
            )}
          </div>
        )}

        {/* Étape 3 — résultat */}
        {step === 3 && (
          <div className="grid place-items-center gap-3 py-4 text-center">
            {result?.ok ? (
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            ) : result?.ok === false ? (
              <AlertTriangle className="h-12 w-12 text-amber-400" />
            ) : (
              <ShieldCheck className="h-12 w-12 text-gray-400" />
            )}
            <p className="text-sm font-semibold text-white">
              {result?.ok
                ? 'Connexion vérifiée'
                : result?.ok === false
                  ? 'Enregistré, mais le test a échoué'
                  : 'Enregistré'}
            </p>
            <p className="max-w-sm text-xs text-gray-400">
              {result?.message || 'Vous pouvez tester la connexion à tout moment depuis la liste.'}
            </p>
          </div>
        )}

        {/* Pied — navigation */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div>
            {step === 2 && !isEdit && (
              <Button variant="ghost" onClick={() => setStep(1)} className="gap-1.5">
                <ArrowLeft className="h-4 w-4" /> Retour
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step === 3 ? (
              <Button onClick={onClose} className="min-w-24">Terminer</Button>
            ) : step === 2 ? (
              <Button
                onClick={handleSubmit}
                disabled={!requiredFilled || submitting}
                className="min-w-32 gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isEdit ? 'Mise à jour…' : 'Ajout…'}
                  </>
                ) : (
                  <>
                    {isEdit ? 'Enregistrer' : 'Ajouter'} <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            ) : (
              <Button variant="outline" onClick={onClose}>Annuler</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* Champ secret (dark — pour la modale glass). */
function SecretFieldDark({ id, label, placeholder, value, onChange }) {
  const [show, setShow] = useState(false);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-gray-300">{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10 font-mono text-sm"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 transition-colors hover:text-white"
          aria-label={show ? 'Masquer' : 'Révéler'}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Carte d'un moyen configuré.
 * ────────────────────────────────────────────────────────────────────────── */
function MethodCard({ method, onTest, onToggle, onEdit, onRemove, testing, toggling }) {
  const meta = providerMeta(method.provider);
  const status = computeStatus(method);
  const lastTest = method.lastTest || {};

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <ProviderLogo meta={meta} />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-zinc-900">{meta.name}</p>
              <span className="text-xs text-zinc-400">·</span>
              <span className="text-xs text-zinc-500">{meta.tagline}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={status} />
              {meta.hasMode && method.mode ? (
                <span
                  className={[
                    'rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
                    String(method.mode).toLowerCase().startsWith('prod')
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-amber-300 bg-amber-50 text-amber-700',
                  ].join(' ')}
                >
                  {String(method.mode).toLowerCase().startsWith('prod') ? 'Live' : 'Test'}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Menu Modifier / Supprimer */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
              aria-label="Plus d’actions"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(method)}>
              <Pencil className="mr-2 h-4 w-4" /> Modifier les clés
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onRemove(method)}
              className="text-red-300 focus:bg-red-500/15 focus:text-red-200"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Champs masqués (aperçu last4) */}
      <div className="flex flex-wrap gap-1.5">
        {(meta.secrets || []).map((f) => {
          const c = method.credentials?.[f.key];
          const set = c?.set;
          return (
            <span
              key={f.key}
              className={[
                'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[11px]',
                set
                  ? 'border-zinc-200 bg-zinc-50 text-zinc-600'
                  : 'border-amber-200 bg-amber-50 text-amber-700',
              ].join(' ')}
              title={set ? `Renseigné (…${c.last4})` : 'Non renseigné'}
            >
              {f.key}
              {set ? ` · …${c.last4}` : f.required ? ' · manquant' : ' · —'}
            </span>
          );
        })}
      </div>

      {/* Dernier test */}
      {lastTest.at ? (
        <p
          className={[
            'text-xs',
            lastTest.ok ? 'text-emerald-600' : lastTest.ok === false ? 'text-red-600' : 'text-zinc-500',
          ].join(' ')}
        >
          {lastTest.ok ? '✓ ' : lastTest.ok === false ? '✕ ' : ''}
          {lastTest.message || 'Testé'}
          <span className="text-zinc-400">
            {' '}· {new Date(lastTest.at).toLocaleString('fr-FR')}
          </span>
        </p>
      ) : (
        <p className="text-xs text-zinc-400">Connexion jamais testée.</p>
      )}

      {/* Actions */}
      <div className="mt-1 flex items-center justify-between gap-3 border-t border-zinc-100 pt-3">
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <Switch
            checked={!!method.enabled}
            disabled={toggling}
            onCheckedChange={(v) => onToggle(method, v)}
          />
          {method.enabled ? 'Activé' : 'Désactivé'}
        </label>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onTest(method)}
          disabled={testing}
          className="gap-2 border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
          Tester la connexion
        </Button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Écran principal : liste des moyens + assistant d'ajout.
 * ────────────────────────────────────────────────────────────────────────── */
export default function PaymentMethodsManager() {
  const { toast } = useToast();
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busyProvider, setBusyProvider] = useState(null); // { provider, action }
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // method en édition (ou null = ajout)

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await paymentMethodsApi.list();
      setMethods(Array.isArray(res?.providers) ? res.providers : []);
    } catch (e) {
      setLoadError(e?.message || 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isBusy = (provider, action) =>
    busyProvider?.provider === provider && busyProvider?.action === action;

  const handleTest = async (method) => {
    setBusyProvider({ provider: method.provider, action: 'test' });
    try {
      const r = await paymentMethodsApi.test(method.provider);
      toast({
        title: r.ok ? 'Connexion réussie' : 'Connexion en échec',
        description: r.message,
        className: r.ok ? 'bg-emerald-700 text-white border-none' : undefined,
        variant: r.ok ? undefined : 'destructive',
      });
      await load();
    } catch (e) {
      toast({ title: 'Test impossible', description: e?.message || 'Erreur', variant: 'destructive' });
    } finally {
      setBusyProvider(null);
    }
  };

  const handleToggle = async (method, enabled) => {
    setBusyProvider({ provider: method.provider, action: 'toggle' });
    // Optimiste : on reflète tout de suite, on recale au retour.
    setMethods((prev) =>
      prev.map((m) => (m.provider === method.provider ? { ...m, enabled } : m)),
    );
    try {
      await paymentMethodsApi.toggle(method.provider, enabled);
      toast({
        title: enabled ? 'Moyen activé' : 'Moyen désactivé',
        description: `${providerMeta(method.provider).name}`,
        className: 'bg-emerald-700 text-white border-none',
      });
      await load();
    } catch (e) {
      toast({ title: 'Action impossible', description: e?.message || 'Erreur', variant: 'destructive' });
      await load(); // revert
    } finally {
      setBusyProvider(null);
    }
  };

  const handleRemove = async (method) => {
    const meta = providerMeta(method.provider);
    if (!window.confirm(`Supprimer la configuration ${meta.name} ? Cette action est irréversible.`)) {
      return;
    }
    setBusyProvider({ provider: method.provider, action: 'remove' });
    try {
      await paymentMethodsApi.remove(method.provider);
      toast({
        title: 'Moyen supprimé',
        description: `${meta.name} a été retiré.`,
        className: 'bg-emerald-700 text-white border-none',
      });
      await load();
    } catch (e) {
      toast({ title: 'Suppression impossible', description: e?.message || 'Erreur', variant: 'destructive' });
    } finally {
      setBusyProvider(null);
    }
  };

  const openAdd = () => {
    setEditTarget(null);
    setWizardOpen(true);
  };
  const openEdit = (method) => {
    setEditTarget(method);
    setWizardOpen(true);
  };

  const configuredCount = methods.length;
  const activeCount = methods.filter((m) => computeStatus(m) === 'ok').length;

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
            <CreditCard className="h-5 w-5" style={{ color: 'var(--lt-gold-ink, #9a7b1f)' }} />
            Moyens de paiement
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Configurez les agrégateurs (Stripe, PawaPay, Chariow) propres à cette école.
            Les clés sont chiffrées en base.
            {configuredCount > 0 ? (
              <span className="ml-1 text-zinc-400">
                {activeCount} actif{activeCount > 1 ? 's' : ''} sur {configuredCount} configuré
                {configuredCount > 1 ? 's' : ''}.
              </span>
            ) : null}
          </p>
        </div>
        <Button onClick={openAdd} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Ajouter un moyen de paiement
        </Button>
      </div>

      {/* États */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border border-zinc-200 bg-zinc-100/60" />
          ))}
        </div>
      ) : loadError ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="flex items-center gap-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4" /> {loadError}
          </p>
          <Button variant="outline" size="sm" onClick={load} className="border-red-300 text-red-700">
            Réessayer
          </Button>
        </div>
      ) : methods.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 px-6 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
            <CreditCard className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-zinc-700">Aucun moyen de paiement configuré</p>
          <p className="max-w-sm text-xs text-zinc-500">
            Ajoutez Stripe pour la carte bancaire, PawaPay pour le mobile money, ou Chariow pour
            vendre vos produits.
          </p>
          <Button onClick={openAdd} className="mt-1 gap-2">
            <Plus className="h-4 w-4" /> Ajouter un moyen
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {methods.map((m) => (
            <MethodCard
              key={m.provider}
              method={m}
              testing={isBusy(m.provider, 'test')}
              toggling={isBusy(m.provider, 'toggle')}
              onTest={handleTest}
              onToggle={handleToggle}
              onEdit={openEdit}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {/* Assistant */}
      <PaymentMethodWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSaved={load}
        editProvider={editTarget?.provider || null}
        existing={editTarget}
      />
    </div>
  );
}
