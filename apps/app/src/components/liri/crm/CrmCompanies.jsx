import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  Building2,
  Globe,
  MapPin,
  Users,
  Pencil,
  Trash2,
  X,
  Loader2,
} from 'lucide-react';
import { crmApi } from '@/lib/api-v2';
import { useToast } from '@/components/ui/use-toast';
import CrmCompanyDetail from './CrmCompanyDetail';

/* ── Liste sociétés (grille) — comptes & organisations du CRM ──
   Design : en-tête d'écran, cartes à pastille coral, actions révélées au survol. */

const inputCls =
  'w-full rounded-xl border lp-line bg-[rgba(245,244,238,.03)] px-3 py-2.5 text-[14px] lp-ink outline-none placeholder:text-[var(--faint)] lp-tr focus:border-[var(--coral)]';

const SIZE_OPTIONS = ['1-10', '11-50', '51-200', '201-500', '500+'];

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[.07em] lp-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function Meta({ icon: Icon, children }) {
  if (!children) return null;
  return (
    <div className="flex items-center gap-1.5 text-[12.5px] lp-muted">
      <Icon size={12.5} className="shrink-0 lp-faint" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </div>
  );
}

const EMPTY_FORM = {
  name: '',
  website: '',
  industry: '',
  size: '',
  phone: '',
  city: '',
  country: '',
  description: '',
};

function normalizeHref(website) {
  if (!website) return null;
  const w = String(website).trim();
  if (!w) return null;
  return /^https?:\/\//i.test(w) ? w : `https://${w}`;
}

function companyInitials(name) {
  const n = String(name || '').trim();
  if (!n) return '?';
  return (
    n
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || '')
      .join('') || '?'
  );
}

export default function CrmCompanies() {
  const { toast } = useToast();

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // company being edited, or null for create
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [detail, setDetail] = useState(null); // société ouverte en fiche 360°
  const reqRef = useRef(0);

  const load = useCallback(
    async (searchTerm) => {
      // Garde de course : la dernière requête gagne (une recherche lente ne réécrit pas).
      const rid = ++reqRef.current;
      setLoading(true);
      try {
        const rows = await crmApi.listCompanies(
          searchTerm ? { search: searchTerm } : {},
        );
        if (rid !== reqRef.current) return;
        setCompanies(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (rid !== reqRef.current) return;
        toast({
          title: 'CRM',
          description: String(e?.message || e),
          variant: 'destructive',
        });
      } finally {
        if (rid === reqRef.current) setLoading(false);
      }
    },
    [toast],
  );

  // Chargement initial + recherche (debounce)
  useEffect(() => {
    const term = search.trim();
    const t = setTimeout(() => load(term), term ? 300 : 0);
    return () => clearTimeout(t);
  }, [search, load]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((company) => {
    setEditing(company);
    setForm({
      name: company?.name || '',
      website: company?.website || '',
      industry: company?.industry || '',
      size: company?.size || '',
      phone: company?.phone || '',
      city: company?.city || '',
      country: company?.country || '',
      description: company?.description || '',
    });
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
  }, [saving]);

  const setField = useCallback((key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const name = form.name.trim();
      if (!name) {
        toast({
          title: 'CRM',
          description: 'Le nom de la société est requis.',
          variant: 'destructive',
        });
        return;
      }
      const body = {
        name,
        website: form.website.trim() || null,
        industry: form.industry.trim() || null,
        size: form.size || null,
        phone: form.phone.trim() || null,
        city: form.city.trim() || null,
        country: form.country.trim() || null,
        description: form.description.trim() || null,
      };
      setSaving(true);
      try {
        if (editing?.id) {
          await crmApi.updateCompany(editing.id, body);
          toast({ title: 'CRM', description: 'Société mise à jour.' });
        } else {
          await crmApi.createCompany(body);
          toast({ title: 'CRM', description: 'Société créée.' });
        }
        setModalOpen(false);
        setEditing(null);
        await load(search.trim());
      } catch (err) {
        toast({
          title: 'CRM',
          description: String(err?.message || err),
          variant: 'destructive',
        });
      } finally {
        setSaving(false);
      }
    },
    [form, editing, toast, load, search],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      await crmApi.deleteCompany(deleteTarget.id);
      toast({ title: 'CRM', description: 'Société supprimée.' });
      setDeleteTarget(null);
      await load(search.trim());
    } catch (err) {
      toast({
        title: 'CRM',
        description: String(err?.message || err),
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, toast, load, search]);

  const gridStyle = useMemo(
    () => ({ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }),
    [],
  );

  const hasSearch = search.trim().length > 0;
  const subtitle = loading
    ? 'Chargement…'
    : companies.length
      ? `${companies.length} société${companies.length > 1 ? 's' : ''}`
      : 'Vos comptes et organisations';

  return (
    <div className="lp-rise">
      {/* En-tête d'écran : titre + sous-titre à gauche, action à droite */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[18px] font-semibold leading-tight lp-ink">Sociétés</h1>
          <p className="mt-0.5 text-[13px] lp-muted">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-medium text-white lp-tr lp-ember disabled:opacity-60"
        >
          <Plus size={16} />
          Nouvelle société
        </button>
      </div>

      {/* Barre de recherche */}
      <div className="relative mb-5 w-full sm:max-w-sm">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 lp-faint"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une société…"
          aria-label="Rechercher une société"
          className={`${inputCls} pl-9`}
        />
      </div>

      {/* Corps */}
      {loading ? (
        <div className="grid gap-4" style={gridStyle}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border lp-line lp-panel animate-pulse p-4"
            >
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 shrink-0 rounded-2xl" style={{ background: 'var(--line)' }} />
                <div className="min-w-0 flex-1 pt-1">
                  <div className="mb-2 h-3.5 w-2/3 rounded" style={{ background: 'var(--line)' }} />
                  <div className="h-3 w-1/2 rounded" style={{ background: 'var(--line)' }} />
                </div>
              </div>
              <div className="mt-4 h-3 w-1/3 rounded" style={{ background: 'var(--line)' }} />
            </div>
          ))}
        </div>
      ) : companies.length === 0 ? (
        <div className="rounded-2xl border lp-line lp-panel70 px-6 py-16 text-center">
          <div
            className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl lp-coral-tint"
            aria-hidden="true"
          >
            <Building2 size={22} className="lp-coral" />
          </div>
          <h3 className="text-[15px] font-semibold lp-ink">
            {hasSearch ? 'Aucun résultat' : 'Aucune société'}
          </h3>
          <p className="mx-auto mt-1.5 max-w-sm text-[13px] lp-muted">
            {hasSearch
              ? 'Aucune société ne correspond à votre recherche.'
              : "Créez la première pour commencer à organiser vos comptes et vos prospects."}
          </p>
          {!hasSearch && (
            <button
              type="button"
              onClick={openCreate}
              className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-medium text-white lp-tr lp-ember"
            >
              <Plus size={16} />
              Créer une société
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4" style={gridStyle}>
          {companies.map((c) => {
            const href = normalizeHref(c?.website);
            const industry = c?.industry || '';
            const loc = [c?.city, c?.country].filter(Boolean).join(', ');
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                aria-label={`Ouvrir ${c?.name || 'la société'}`}
                onClick={() => setDetail(c)}
                onKeyDown={(e) => {
                  // Ne réagir qu'au focus de la carte elle-même : une touche pressée sur un
                  // enfant interactif (éditer/supprimer/lien) ne doit pas ouvrir aussi le drawer.
                  if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                    e.preventDefault();
                    setDetail(c);
                  }
                }}
                className="group relative flex cursor-pointer flex-col rounded-2xl border lp-line lp-panel70 p-4 lp-tr lp-lift"
              >
                {/* Actions révélées au survol */}
                <div className="absolute right-3 top-3 flex items-center gap-1 opacity-0 lp-tr group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                    aria-label={`Éditer ${c?.name || 'la société'}`}
                    className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg lp-muted lp-railbtn lp-tr"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                    aria-label={`Supprimer ${c?.name || 'la société'}`}
                    className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg lp-railbtn lp-tr"
                    style={{ color: '#e0a48f' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Identité */}
                <div className="flex items-start gap-3 pr-14">
                  <div
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[14px] font-semibold text-white"
                    style={{ background: 'linear-gradient(140deg,#d97757,#c2683f)' }}
                    aria-hidden="true"
                  >
                    {companyInitials(c?.name)}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <h3 className="truncate text-[15px] font-semibold leading-tight lp-ink">
                      {c?.name || 'Sans nom'}
                    </h3>
                    {industry && (
                      <p className="mt-0.5 truncate text-[12.5px] lp-muted">{industry}</p>
                    )}
                  </div>
                </div>

                {/* Méta */}
                {(loc || href) && (
                  <div className="mt-3 space-y-1.5">
                    <Meta icon={MapPin}>{loc}</Meta>
                    {href && (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex w-fit max-w-full cursor-pointer items-center gap-1.5 truncate text-[12.5px] lp-tr"
                        style={{ color: 'var(--coral)' }}
                      >
                        <Globe size={12.5} className="shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {c.website.replace(/^https?:\/\//i, '')}
                        </span>
                      </a>
                    )}
                  </div>
                )}

                {/* Chip taille */}
                {c?.size && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full py-1 pl-2 pr-2.5 text-[11px] font-medium"
                      style={{ background: 'rgba(217,119,87,.13)', color: '#e08a63' }}
                    >
                      <Users size={11} className="shrink-0" aria-hidden="true" />
                      {c.size}
                    </span>
                  </div>
                )}

                {/* Description */}
                {c?.description && (
                  <p className="mt-3 line-clamp-2 border-t lp-line pt-3 text-[12.5px] leading-relaxed lp-faint">
                    {c.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Fiche société 360° (reliure écosystème) */}
      {detail && <CrmCompanyDetail company={detail} onClose={() => setDetail(null)} />}

      {/* Modale création / édition */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          style={{ background: 'rgba(15,12,10,.55)', backdropFilter: 'blur(2px)' }}
          onClick={closeModal}
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border lp-line p-5 shadow-2xl sm:rounded-3xl"
            style={{ background: '#221f1b' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={editing ? 'Éditer la société' : 'Nouvelle société'}
          >
            <div className="flex items-start gap-3">
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white"
                style={{ background: 'linear-gradient(140deg,#d97757,#c2683f)' }}
                aria-hidden="true"
              >
                <Building2 size={18} />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <h2 className="text-[17px] font-semibold leading-tight lp-ink">
                  {editing ? 'Éditer la société' : 'Nouvelle société'}
                </h2>
                <p className="mt-0.5 text-[12.5px] lp-muted">
                  {editing
                    ? 'Mettez à jour les informations du compte.'
                    : 'Ajoutez un nouveau compte à votre CRM.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Fermer"
                className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg lp-muted lp-railbtn lp-tr"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 grid gap-3.5">
              <Field label="Nom *">
                <input
                  className={inputCls}
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="Nom de la société"
                  required
                  autoFocus
                />
              </Field>

              <Field label="Site web">
                <input
                  className={inputCls}
                  value={form.website}
                  onChange={(e) => setField('website', e.target.value)}
                  placeholder="exemple.com"
                  inputMode="url"
                />
              </Field>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <Field label="Secteur">
                  <input
                    className={inputCls}
                    value={form.industry}
                    onChange={(e) => setField('industry', e.target.value)}
                    placeholder="Ex. Santé, Retail…"
                  />
                </Field>
                <Field label="Taille">
                  <select
                    className={`${inputCls} cursor-pointer`}
                    value={form.size}
                    onChange={(e) => setField('size', e.target.value)}
                  >
                    <option value="" style={{ background: '#221f1b' }}>
                      —
                    </option>
                    {SIZE_OPTIONS.map((s) => (
                      <option key={s} value={s} style={{ background: '#221f1b' }}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Téléphone">
                <input
                  className={inputCls}
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="+241…"
                  inputMode="tel"
                />
              </Field>

              <div className="grid gap-3.5 sm:grid-cols-2">
                <Field label="Ville">
                  <input
                    className={inputCls}
                    value={form.city}
                    onChange={(e) => setField('city', e.target.value)}
                    placeholder="Ville"
                  />
                </Field>
                <Field label="Pays">
                  <input
                    className={inputCls}
                    value={form.country}
                    onChange={(e) => setField('country', e.target.value)}
                    placeholder="Pays"
                  />
                </Field>
              </div>

              <Field label="Description">
                <textarea
                  className={`${inputCls} min-h-[88px] resize-y`}
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="Notes internes, contexte du compte…"
                  rows={3}
                />
              </Field>

              <div className="mt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="cursor-pointer rounded-xl px-4 py-2 text-[13.5px] font-medium lp-muted lp-railbtn lp-tr"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-medium text-white lp-tr lp-ember disabled:opacity-60"
                >
                  {saving && <Loader2 size={15} className="animate-spin" />}
                  {editing ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale confirmation suppression */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          style={{ background: 'rgba(15,12,10,.55)', backdropFilter: 'blur(2px)' }}
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-t-3xl border lp-line p-5 shadow-2xl sm:rounded-3xl"
            style={{ background: '#221f1b' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Confirmer la suppression"
          >
            <div className="flex items-start gap-3">
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl lp-coral-tint"
                aria-hidden="true"
              >
                <Trash2 size={18} className="lp-coral" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <h2 className="text-[17px] font-semibold leading-tight lp-ink">
                  Supprimer la société
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed lp-muted">
                  Voulez-vous vraiment supprimer{' '}
                  <span className="font-medium lp-ink">
                    {deleteTarget?.name || 'cette société'}
                  </span>{' '}
                  ? Cette action est irréversible.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !deleting && setDeleteTarget(null)}
                aria-label="Fermer"
                className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg lp-muted lp-railbtn lp-tr"
              >
                <X size={17} />
              </button>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="cursor-pointer rounded-xl px-4 py-2 text-[13.5px] font-medium lp-muted lp-railbtn lp-tr disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-medium text-white lp-tr disabled:opacity-60"
                style={{ background: '#c2683f' }}
              >
                {deleting && <Loader2 size={15} className="animate-spin" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
