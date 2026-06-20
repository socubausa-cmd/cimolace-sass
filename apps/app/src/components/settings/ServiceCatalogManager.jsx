import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  Loader2,
  GraduationCap,
  Flame,
  MessageCircle,
  Users,
  Boxes,
  AlertTriangle,
  PackageOpen,
} from 'lucide-react';

import { billingCatalogApi } from '@/lib/api-v2';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/* ──────────────────────────────────────────────────────────────────────────
 * Référentiel UI — DOIT rester aligné sur le CHECK SQL + le DTO backend.
 *  - `category` = valeur stockée (cycle | temple | consultation | mentorat | custom)
 *  - regroupement visuel : consultation + mentorat partagent le même bandeau
 *    « Accompagnement — Ngowazulu » (groupKey = 'accompagnement').
 * ────────────────────────────────────────────────────────────────────────── */
const CATEGORY_OPTIONS = [
  { value: 'cycle', label: 'École — Cycle' },
  { value: 'temple', label: 'Temple' },
  { value: 'consultation', label: 'Consultation (Ngowazulu)' },
  { value: 'mentorat', label: 'Mentorat (Ngowazulu)' },
  { value: 'custom', label: 'Autre service' },
];

/** Groupes d'affichage (ordre = ordre des sections). */
const GROUPS = [
  { key: 'cycle', label: 'École — Cycles', icon: GraduationCap, categories: ['cycle'], accent: '#7C3AED' },
  { key: 'temple', label: 'Temple', icon: Flame, categories: ['temple'], accent: '#E85D04' },
  {
    key: 'accompagnement',
    label: 'Accompagnement — Ngowazulu',
    icon: MessageCircle,
    categories: ['consultation', 'mentorat'],
    accent: '#0EA5E9',
  },
  { key: 'autres', label: 'Autres', icon: Boxes, categories: ['custom'], accent: '#64748B' },
];

/** Replie une catégorie sur sa clé de groupe. */
function groupKeyForCategory(category) {
  const g = GROUPS.find((grp) => grp.categories.includes(category));
  return g ? g.key : 'autres';
}

/* ──────────────────────────────────────────────────────────────────────────
 * Cycles de facturation — valeur stockée ⇄ libellé court affiché en ligne.
 * ────────────────────────────────────────────────────────────────────────── */
const BILLING_CYCLES = [
  { value: 'monthly', label: 'Mensuel', short: '/ mois' },
  { value: 'one_time', label: 'Paiement unique', short: 'unique' },
  { value: 'yearly', label: 'Annuel', short: '/ an' },
  { value: 'quarterly', label: 'Trimestriel', short: '/ trim.' },
  { value: 'weekly', label: 'Hebdomadaire', short: '/ sem.' },
];

function cycleShort(value) {
  return BILLING_CYCLES.find((c) => c.value === value)?.short || '';
}

/* Modèle d'accès : payant (checkout) / gratuit (accès direct) / communauté (adhésion gratuite). */
const ACCESS_MODELS = [
  { value: 'paid', label: 'Payant' },
  { value: 'free', label: 'Gratuit' },
  { value: 'community', label: 'Communauté' },
];

/* Devises proposées (le champ reste libre côté backend). */
const CURRENCIES = ['EUR', 'XAF', 'XOF', 'USD'];

/* Symbole d'affichage pour les devises courantes. */
const CURRENCY_SYMBOL = { EUR: '€', USD: '$', XAF: 'FCFA', XOF: 'FCFA' };

/* ────────────────────────────────────────────────────────────────────────── */
/* Helpers prix : le backend stocke des centimes (priceCents).                 */
/* ────────────────────────────────────────────────────────────────────────── */
function centsToAmount(cents) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return '';
  return String(Math.round(n) / 100);
}

function amountToCents(amount) {
  const n = Number.parseFloat(String(amount).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/* ──────────────────────────────────────────────────────────────────────────
 * Prix éditable en ligne : champ nombre + devise. Blur/Enter → onCommit(cents).
 * Optimiste : la valeur saisie reste affichée ; le parent recharge ensuite.
 * ────────────────────────────────────────────────────────────────────────── */
function InlinePrice({ service, busy, onCommit }) {
  const [value, setValue] = useState(centsToAmount(service.priceCents));
  const lastSynced = useRef(service.priceCents);

  // Re-synchronise si la prop change hors édition (ex. recharge serveur).
  useEffect(() => {
    if (service.priceCents !== lastSynced.current) {
      lastSynced.current = service.priceCents;
      setValue(centsToAmount(service.priceCents));
    }
  }, [service.priceCents]);

  const commit = () => {
    const cents = amountToCents(value);
    if (cents === null) {
      // Saisie invalide → on restaure la dernière valeur connue.
      setValue(centsToAmount(service.priceCents));
      return;
    }
    if (cents === service.priceCents) return; // pas de changement
    lastSynced.current = cents;
    onCommit(cents);
  };

  const symbol = CURRENCY_SYMBOL[service.currency] || service.currency || '';

  return (
    <div className="inline-flex items-center gap-1.5">
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={value}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          className="h-9 w-24 pr-7 text-right text-sm font-semibold text-zinc-900"
          aria-label={`Prix de ${service.label}`}
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-zinc-400">
          {symbol}
        </span>
      </div>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" /> : null}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Une ligne de service.
 * ────────────────────────────────────────────────────────────────────────── */
function ServiceRow({ service, busyAction, onPriceCommit, onToggleActive, onEdit }) {
  const priceBusy = busyAction === 'price';
  const toggleBusy = busyAction === 'toggle';

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
      {/* Nom + accroche */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-zinc-900">{service.label}</p>
        {service.tagline ? (
          <p className="truncate text-xs text-zinc-500">{service.tagline}</p>
        ) : null}
      </div>

      {/* Prix éditable + cycle */}
      <div className="flex items-center gap-2">
        <InlinePrice service={service} busy={priceBusy} onCommit={onPriceCommit} />
        <span className="whitespace-nowrap text-xs text-zinc-500">
          {cycleShort(service.billingCycle)}
        </span>
      </div>

      {/* Statut actif */}
      <label className="flex shrink-0 items-center gap-2 text-xs text-zinc-600">
        <Switch
          checked={!!service.isActive}
          disabled={toggleBusy}
          onCheckedChange={(v) => onToggleActive(v)}
        />
        <span className="hidden sm:inline">{service.isActive ? 'Actif' : 'Masqué'}</span>
      </label>

      {/* Éditer */}
      <Button
        variant="outline"
        size="sm"
        onClick={onEdit}
        className="shrink-0 gap-1.5 border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
      >
        <Pencil className="h-3.5 w-3.5" /> Éditer
      </Button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Dialog d'édition / création complet.
 *  - mode = 'create' → tous les champs vides (catégorie/cycle/devise par défaut)
 *  - mode = 'edit'   → pré-rempli ; bouton Supprimer disponible.
 * ────────────────────────────────────────────────────────────────────────── */
const EMPTY_FORM = {
  category: 'cycle',
  label: '',
  tagline: '',
  description: '',
  amount: '',
  currency: 'EUR',
  billingCycle: 'monthly',
  accessModel: 'paid',
  isActive: true,
};

function ServiceDialog({ open, mode, service, onClose, onSaved, onDeleted }) {
  const { toast } = useToast();
  const isEdit = mode === 'edit';
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // (Ré)initialise le formulaire à chaque ouverture / changement de cible.
  useEffect(() => {
    if (!open) return;
    if (isEdit && service) {
      setForm({
        category: service.category || 'custom',
        label: service.label || '',
        tagline: service.tagline || '',
        description: service.description || '',
        amount: centsToAmount(service.priceCents),
        currency: service.currency || 'EUR',
        billingCycle: service.billingCycle || 'monthly',
        accessModel: service.accessModel || 'paid',
        isActive: service.isActive !== false,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setSaving(false);
    setDeleting(false);
  }, [open, isEdit, service]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const handleSave = async () => {
    const label = form.label.trim();
    if (!label) {
      toast({ title: 'Nom requis', description: 'Donne un nom au service.', variant: 'destructive' });
      return;
    }
    const cents = amountToCents(form.amount);
    if (cents === null) {
      toast({ title: 'Prix invalide', description: 'Saisis un montant valide (≥ 0).', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const body = {
        category: form.category,
        label,
        tagline: form.tagline.trim() || null,
        description: form.description.trim() || null,
        priceCents: cents,
        currency: form.currency,
        billingCycle: form.billingCycle,
        accessModel: form.accessModel,
        isActive: form.isActive,
      };
      if (isEdit) {
        await billingCatalogApi.update(service.key, body);
      } else {
        await billingCatalogApi.create(body);
      }
      toast({
        title: isEdit ? 'Service mis à jour' : 'Service créé',
        description: label,
        className: 'bg-emerald-700 text-white border-none',
      });
      onSaved?.();
      onClose();
    } catch (e) {
      toast({
        title: isEdit ? 'Mise à jour impossible' : 'Création impossible',
        description: e?.message || 'Erreur inattendue.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!service) return;
    if (!window.confirm(`Supprimer « ${service.label} » ? Cette action est irréversible.`)) return;
    setDeleting(true);
    try {
      await billingCatalogApi.remove(service.key);
      toast({
        title: 'Service supprimé',
        description: service.label,
        className: 'bg-emerald-700 text-white border-none',
      });
      onDeleted?.();
      onClose();
    } catch (e) {
      toast({ title: 'Suppression impossible', description: e?.message || 'Erreur.', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const busy = saving || deleting;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !busy) onClose(); }}>
      <DialogContent className="max-w-lg bg-white text-zinc-900" aria-describedby="catalog-dialog-desc">
        <DialogHeader>
          <DialogTitle className="text-zinc-900">
            {isEdit ? 'Modifier le service' : 'Créer un service'}
          </DialogTitle>
          <DialogDescription id="catalog-dialog-desc" className="text-zinc-500">
            {isEdit
              ? 'Les changements se répercutent sur la vitrine, le hub et le paiement.'
              : 'Ce service apparaîtra dans la vitrine, le hub et le paiement.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-4 overflow-y-auto pr-1">
          {/* Catégorie */}
          <div className="grid gap-1.5">
            <Label className="text-zinc-700">Catégorie</Label>
            <Select value={form.category} onValueChange={(v) => set({ category: v })}>
              <SelectTrigger className="bg-white text-zinc-900">
                <SelectValue placeholder="Choisir…" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nom */}
          <div className="grid gap-1.5">
            <Label htmlFor="svc-label" className="text-zinc-700">Nom</Label>
            <Input
              id="svc-label"
              value={form.label}
              onChange={(e) => set({ label: e.target.value })}
              placeholder="Cycle Initiation, Consultation découverte…"
              className="bg-white text-zinc-900"
            />
          </div>

          {/* Accroche */}
          <div className="grid gap-1.5">
            <Label htmlFor="svc-tagline" className="text-zinc-700">Accroche</Label>
            <Input
              id="svc-tagline"
              value={form.tagline}
              onChange={(e) => set({ tagline: e.target.value })}
              placeholder="Une phrase courte qui vend le service."
              className="bg-white text-zinc-900"
            />
          </div>

          {/* Prix + devise + cycle */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="svc-price" className="text-zinc-700">Prix</Label>
              <Input
                id="svc-price"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => set({ amount: e.target.value })}
                placeholder="0.00"
                className="bg-white text-right text-zinc-900"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-zinc-700">Devise</Label>
              <Select value={form.currency} onValueChange={(v) => set({ currency: v })}>
                <SelectTrigger className="bg-white text-zinc-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 grid gap-1.5 sm:col-span-1">
              <Label className="text-zinc-700">Cycle</Label>
              <Select value={form.billingCycle} onValueChange={(v) => set({ billingCycle: v })}>
                <SelectTrigger className="bg-white text-zinc-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_CYCLES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Modèle d'accès */}
          <div className="grid gap-1.5">
            <Label className="text-zinc-700">Accès</Label>
            <Select value={form.accessModel} onValueChange={(v) => set({ accessModel: v })}>
              <SelectTrigger className="bg-white text-zinc-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCESS_MODELS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-zinc-500">
              {form.accessModel === 'free'
                ? 'Accès direct, sans paiement (le prix est ignoré).'
                : form.accessModel === 'community'
                  ? 'Adhésion gratuite à un espace communautaire (ex. le Temple).'
                  : 'Le membre paie pour accéder (carte ou mobile money).'}
            </p>
          </div>

          {/* Description */}
          <div className="grid gap-1.5">
            <Label htmlFor="svc-desc" className="text-zinc-700">Description</Label>
            <Textarea
              id="svc-desc"
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="Ce que comprend le service, à qui il s'adresse…"
              rows={4}
              className="bg-white text-zinc-900"
            />
          </div>

          {/* Actif */}
          <label className="flex items-center gap-2.5 text-sm text-zinc-700">
            <Switch checked={form.isActive} onCheckedChange={(v) => set({ isActive: v })} />
            Visible (actif) sur la vitrine et le paiement
          </label>
        </div>

        <DialogFooter className="mt-2 flex-row items-center justify-between gap-2 sm:justify-between">
          <div>
            {isEdit ? (
              <Button
                variant="ghost"
                onClick={handleDelete}
                disabled={busy}
                className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Supprimer
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy} className="border-zinc-300">
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={busy} className="min-w-28 gap-2">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isEdit ? 'Enregistrement…' : 'Création…'}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> {isEdit ? 'Enregistrer' : 'Créer'}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * En-tête d'un groupe de catégorie (icône + libellé + compteur).
 * ────────────────────────────────────────────────────────────────────────── */
function GroupHeader({ group, count }) {
  const Icon = group.icon;
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm"
        style={{ background: group.accent }}
      >
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </span>
      <h3 className="text-sm font-semibold text-zinc-900">{group.label}</h3>
      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500">
        {count}
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Écran principal : Catalogue & tarifs.
 * ────────────────────────────────────────────────────────────────────────── */
export default function ServiceCatalogManager() {
  const { toast } = useToast();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  // { key, action } — action ∈ 'price' | 'toggle'
  const [busy, setBusy] = useState(null);
  const [dialog, setDialog] = useState({ open: false, mode: 'create', service: null });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await billingCatalogApi.list();
      const list = Array.isArray(res) ? res : Array.isArray(res?.services) ? res.services : [];
      setServices(list);
    } catch (e) {
      setLoadError(e?.message || 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isBusy = (key, action) => busy?.key === key && busy?.action === action;

  /* Patch optimiste d'un service par clé. */
  const patchLocal = (key, patch) =>
    setServices((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  const handlePriceCommit = async (service, priceCents) => {
    setBusy({ key: service.key, action: 'price' });
    patchLocal(service.key, { priceCents }); // optimiste
    try {
      await billingCatalogApi.update(service.key, { priceCents });
      toast({ title: 'Prix mis à jour', description: service.label, className: 'bg-emerald-700 text-white border-none' });
      await load();
    } catch (e) {
      toast({ title: 'Prix non enregistré', description: e?.message || 'Erreur.', variant: 'destructive' });
      await load(); // revert depuis le serveur
    } finally {
      setBusy(null);
    }
  };

  const handleToggleActive = async (service, isActive) => {
    setBusy({ key: service.key, action: 'toggle' });
    patchLocal(service.key, { isActive }); // optimiste
    try {
      await billingCatalogApi.update(service.key, { isActive });
      toast({
        title: isActive ? 'Service activé' : 'Service masqué',
        description: service.label,
        className: 'bg-emerald-700 text-white border-none',
      });
      await load();
    } catch (e) {
      toast({ title: 'Action impossible', description: e?.message || 'Erreur.', variant: 'destructive' });
      await load(); // revert
    } finally {
      setBusy(null);
    }
  };

  const openCreate = () => setDialog({ open: true, mode: 'create', service: null });
  const openEdit = (service) => setDialog({ open: true, mode: 'edit', service });
  const closeDialog = () => setDialog((d) => ({ ...d, open: false }));

  /* Regroupe + trie les services par groupe (sortOrder puis label). */
  const grouped = useMemo(() => {
    const buckets = new Map(GROUPS.map((g) => [g.key, []]));
    for (const s of services) {
      const gk = groupKeyForCategory(s.category);
      (buckets.get(gk) || buckets.get('autres')).push(s);
    }
    for (const arr of buckets.values()) {
      arr.sort(
        (a, b) =>
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
          String(a.label).localeCompare(String(b.label), 'fr'),
      );
    }
    return buckets;
  }, [services]);

  const total = services.length;
  const activeCount = services.filter((s) => s.isActive).length;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900">
            <PackageOpen className="h-5 w-5" style={{ color: 'var(--lt-gold-ink, #9a7b1f)' }} />
            Catalogue &amp; tarifs
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Tes services et leurs prix au même endroit. Chaque modif se répercute sur la vitrine,
            le hub et le paiement.
            {total > 0 ? (
              <span className="ml-1 text-zinc-400">
                {activeCount} actif{activeCount > 1 ? 's' : ''} sur {total} service
                {total > 1 ? 's' : ''}.
              </span>
            ) : null}
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" /> Créer un service
        </Button>
      </div>

      {/* États */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl border border-zinc-200 bg-zinc-100/60" />
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
      ) : total === 0 ? (
        <div className="grid place-items-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/60 px-6 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
            <PackageOpen className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-zinc-700">Aucun service dans le catalogue</p>
          <p className="max-w-sm text-xs text-zinc-500">
            Crée tes cycles d&apos;école, tes offres du temple ou tes accompagnements pour les
            rendre visibles et payables.
          </p>
          <Button onClick={openCreate} className="mt-1 gap-2">
            <Plus className="h-4 w-4" /> Créer un service
          </Button>
        </div>
      ) : (
        <div className="space-y-7">
          {GROUPS.map((group) => {
            const items = grouped.get(group.key) || [];
            if (items.length === 0) return null;
            return (
              <section key={group.key} className="space-y-3">
                <GroupHeader group={group} count={items.length} />
                <div className="space-y-2.5">
                  {items.map((service) => (
                    <ServiceRow
                      key={service.key}
                      service={service}
                      busyAction={
                        isBusy(service.key, 'price')
                          ? 'price'
                          : isBusy(service.key, 'toggle')
                            ? 'toggle'
                            : null
                      }
                      onPriceCommit={(cents) => handlePriceCommit(service, cents)}
                      onToggleActive={(v) => handleToggleActive(service, v)}
                      onEdit={() => openEdit(service)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Dialog création / édition */}
      <ServiceDialog
        open={dialog.open}
        mode={dialog.mode}
        service={dialog.service}
        onClose={closeDialog}
        onSaved={load}
        onDeleted={load}
      />
    </div>
  );
}
