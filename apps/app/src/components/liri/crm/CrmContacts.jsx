import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Plus, Pencil, Trash2, X, Users, Building2 } from 'lucide-react';
import { crmApi } from '@/lib/api-v2';
import { useToast } from '@/components/ui/use-toast';
import CrmContactDetail from './CrmContactDetail';

/**
 * CRM · Section CONTACTS (portail LIRI). Corps de section seul :
 * pas de barre d'onglets, pas de shell — l'en-tête et la coque viennent de la page hôte.
 * Fait ses propres appels crmApi ; gère loading / erreur / vide.
 */

const inputCls =
  'w-full rounded-xl border lp-line bg-transparent px-3 py-2.5 text-[14px] lp-ink outline-none placeholder:text-[var(--faint)] focus:border-[var(--coral)]';

function Field({ label, htmlFor, children }) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="mb-1.5 block text-[12px] font-medium lp-muted">{label}</span>
      {children}
    </label>
  );
}

function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function displayName(c) {
  const full = `${c?.first_name || ''} ${c?.last_name || ''}`.trim();
  return full || c?.email || 'Contact sans nom';
}

const STATUS_LABELS = { active: 'Actif', archived: 'Archivé', lead: 'Lead' };

const emptyForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  title: '',
  company_id: '',
  status: 'active',
};

export default function CrmContacts() {
  const { toast } = useToast();

  const [contacts, setContacts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  const [search, setSearch] = useState('');
  const firstRun = useRef(true);
  const reqRef = useRef(0);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null); // null => création
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [detail, setDetail] = useState(null); // contact ouvert dans le drawer de détail

  const fetchContacts = useCallback(
    async (q) => {
      // Garde de course : seule la requête la PLUS RÉCENTE peut écrire l'état
      // (évite qu'une réponse lente d'une recherche antérieure écrase la liste).
      const rid = ++reqRef.current;
      setLoading(true);
      setErrored(false);
      try {
        const params = q && q.trim() ? { search: q.trim() } : undefined;
        const rows = await crmApi.listContacts(params);
        if (rid !== reqRef.current) return;
        setContacts(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (rid !== reqRef.current) return;
        setErrored(true);
        toast({ title: 'CRM', description: String(e?.message || e), variant: 'destructive' });
      } finally {
        if (rid === reqRef.current) setLoading(false);
      }
    },
    [toast],
  );

  // Chargement des sociétés (pour le select de la modale) — une seule fois.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await crmApi.listCompanies({ limit: 200 });
        if (alive) setCompanies(Array.isArray(rows) ? rows : []);
      } catch {
        // non bloquant : le select restera vide, on ne spamme pas de toast.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Recherche debouncée (~300ms) ; premier rendu = immédiat.
  useEffect(() => {
    const delay = firstRun.current ? 0 : 300;
    firstRun.current = false;
    const id = setTimeout(() => {
      fetchContacts(search);
    }, delay);
    return () => clearTimeout(id);
  }, [search, fetchContacts]);

  const companyName = useCallback(
    (c) => {
      if (c?.company?.name) return c.company.name;
      if (c?.company_id) {
        const found = companies.find((co) => co.id === c.company_id);
        return found?.name || null;
      }
      return null;
    },
    [companies],
  );

  const statusOptions = useMemo(() => {
    const base = ['active', 'archived'];
    // Préserver un statut existant hors-liste (ex. 'lead') pour ne pas le perdre à l'édition.
    if (editing?.status && !base.includes(editing.status)) base.unshift(editing.status);
    return base;
  }, [editing]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setEditorOpen(true);
  }

  function openEdit(c) {
    setEditing(c);
    setForm({
      first_name: c.first_name || '',
      last_name: c.last_name || '',
      email: c.email || '',
      phone: c.phone || '',
      title: c.title || '',
      company_id: c.company?.id || c.company_id || '',
      status: c.status || 'active',
    });
    setEditorOpen(true);
  }

  function closeEditor() {
    if (saving) return;
    setEditorOpen(false);
  }

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e?.preventDefault?.();
    const hasName = form.first_name.trim() || form.last_name.trim();
    if (!hasName && !form.email.trim()) {
      toast({
        title: 'CRM',
        description: 'Renseigne au moins un nom ou un e-mail.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const body = {
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        title: form.title.trim() || null,
        company_id: form.company_id || null,
        status: form.status,
      };
      if (editing) {
        await crmApi.updateContact(editing.id, body);
      } else {
        await crmApi.createContact(body);
      }
      setEditorOpen(false);
      toast({ title: 'CRM', description: editing ? 'Contact mis à jour.' : 'Contact créé.' });
      await fetchContacts(search);
    } catch (err) {
      toast({ title: 'CRM', description: String(err?.message || err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await crmApi.deleteContact(pendingDelete.id);
      setPendingDelete(null);
      toast({ title: 'CRM', description: 'Contact supprimé.' });
      await fetchContacts(search);
    } catch (err) {
      toast({ title: 'CRM', description: String(err?.message || err), variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  }

  const isSearching = search.trim().length > 0;

  return (
    <div className="lp-rise">
      {/* Barre haut : recherche + action */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 lp-faint"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un contact…"
            aria-label="Rechercher un contact"
            className={`${inputCls} pl-9`}
          />
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-medium text-white lp-tr lp-ember disabled:opacity-60 cursor-pointer"
        >
          <Plus size={16} />
          Nouveau contact
        </button>
      </div>

      {/* Corps */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border lp-line lp-panel animate-pulse p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full lp-panel70" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 rounded lp-panel70" />
                  <div className="h-3 w-56 max-w-full rounded lp-panel70" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <div className="rounded-2xl border lp-line lp-panel70 px-6 py-14 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full lp-coral-tint">
            <Users size={22} className="lp-ink" aria-hidden="true" />
          </div>
          <p className="mx-auto max-w-sm text-[14px] lp-muted">
            {errored
              ? 'Impossible de charger les contacts pour le moment.'
              : isSearching
              ? `Aucun contact ne correspond à « ${search.trim()} ».`
              : 'Aucun contact pour l’instant. Ajoute ton premier contact pour commencer à suivre tes relations.'}
          </p>
          <div className="mt-5">
            {errored ? (
              <button
                type="button"
                onClick={() => fetchContacts(search)}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-medium text-white lp-tr lp-ember cursor-pointer"
              >
                Réessayer
              </button>
            ) : (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-medium text-white lp-tr lp-ember cursor-pointer"
              >
                <Plus size={16} />
                Créer un contact
              </button>
            )}
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {contacts.map((c) => {
            const name = displayName(c);
            const sub = [c.email, c.phone, c.title].filter(Boolean).join(' · ');
            const coName = companyName(c);
            const isLead = c.source === 'lead' || c.status === 'lead';
            return (
              <li
                key={c.id}
                className="rounded-xl border lp-line lp-panel70 p-4 lp-tr lp-lift"
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setDetail(c)}
                    aria-label={`Ouvrir la fiche de ${name}`}
                    className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left"
                  >
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full lp-coral-tint text-[13px] font-semibold lp-ink"
                    aria-hidden="true"
                  >
                    {initialsOf(name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[14.5px] font-medium lp-ink">{name}</span>
                      {coName && (
                        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] lp-coral-tint">
                          <Building2 size={11} aria-hidden="true" />
                          {coName}
                        </span>
                      )}
                      {isLead && (
                        <span className="rounded-md px-2 py-0.5 text-[11px] lp-coral-tint">
                          Issu d’un lead
                        </span>
                      )}
                    </div>
                    {sub ? (
                      <p className="mt-1 truncate text-[12.5px] lp-muted">{sub}</p>
                    ) : (
                      <p className="mt-1 text-[12.5px] lp-faint">Aucune coordonnée</p>
                    )}
                  </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      aria-label={`Éditer ${name}`}
                      className="grid h-8 w-8 place-items-center rounded-lg lp-muted lp-railbtn lp-tr cursor-pointer"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(c)}
                      aria-label={`Supprimer ${name}`}
                      className="grid h-8 w-8 place-items-center rounded-lg lp-muted lp-railbtn lp-tr cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Modale création / édition */}
      {editorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          style={{ background: 'rgba(0,0,0,.55)' }}
          onClick={closeEditor}
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border lp-line p-5 sm:rounded-3xl"
            style={{ background: '#221f1b' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={editing ? 'Éditer le contact' : 'Nouveau contact'}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold lp-ink">
                {editing ? 'Éditer le contact' : 'Nouveau contact'}
              </h2>
              <button
                type="button"
                onClick={closeEditor}
                aria-label="Fermer"
                className="grid h-8 w-8 place-items-center rounded-lg lp-muted lp-railbtn cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={submit} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <Field label="Prénom" htmlFor="ct-first">
                  <input
                    id="ct-first"
                    className={inputCls}
                    value={form.first_name}
                    onChange={setField('first_name')}
                    placeholder="Prénom"
                  />
                </Field>
                <Field label="Nom" htmlFor="ct-last">
                  <input
                    id="ct-last"
                    className={inputCls}
                    value={form.last_name}
                    onChange={setField('last_name')}
                    placeholder="Nom"
                  />
                </Field>
              </div>

              <Field label="E-mail" htmlFor="ct-email">
                <input
                  id="ct-email"
                  type="email"
                  className={inputCls}
                  value={form.email}
                  onChange={setField('email')}
                  placeholder="nom@exemple.com"
                />
              </Field>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <Field label="Téléphone" htmlFor="ct-phone">
                  <input
                    id="ct-phone"
                    className={inputCls}
                    value={form.phone}
                    onChange={setField('phone')}
                    placeholder="+241 …"
                  />
                </Field>
                <Field label="Fonction" htmlFor="ct-title">
                  <input
                    id="ct-title"
                    className={inputCls}
                    value={form.title}
                    onChange={setField('title')}
                    placeholder="Ex. Directrice"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <Field label="Société" htmlFor="ct-company">
                  <select
                    id="ct-company"
                    className={inputCls}
                    value={form.company_id}
                    onChange={setField('company_id')}
                  >
                    <option value="" style={{ background: '#221f1b' }}>
                      —
                    </option>
                    {companies.map((co) => (
                      <option key={co.id} value={co.id} style={{ background: '#221f1b' }}>
                        {co.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Statut" htmlFor="ct-status">
                  <select
                    id="ct-status"
                    className={inputCls}
                    value={form.status}
                    onChange={setField('status')}
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s} style={{ background: '#221f1b' }}>
                        {STATUS_LABELS[s] || s}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  className="rounded-xl px-4 py-2 text-[13.5px] font-medium lp-muted lp-railbtn lp-tr cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-medium text-white lp-tr lp-ember disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer le contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation de suppression */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          style={{ background: 'rgba(0,0,0,.55)' }}
          onClick={() => (deleting ? null : setPendingDelete(null))}
        >
          <div
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border lp-line p-5 sm:rounded-3xl"
            style={{ background: '#221f1b' }}
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirmer la suppression"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-[17px] font-semibold lp-ink">Supprimer le contact</h2>
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                aria-label="Fermer"
                className="grid h-8 w-8 place-items-center rounded-lg lp-muted lp-railbtn cursor-pointer"
              >
                <X size={17} />
              </button>
            </div>
            <p className="mt-3 text-[14px] lp-muted">
              Confirmer la suppression de{' '}
              <span className="lp-ink font-medium">{displayName(pendingDelete)}</span> ? Cette action
              est définitive.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="rounded-xl px-4 py-2 text-[13.5px] font-medium lp-muted lp-railbtn lp-tr cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-xl px-4 py-2 text-[13.5px] font-medium text-white lp-tr disabled:opacity-60 cursor-pointer"
                style={{ background: '#c2683f' }}
              >
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <CrmContactDetail
          contact={detail}
          onClose={() => setDetail(null)}
          onChanged={() => {}}
        />
      )}
    </div>
  );
}
