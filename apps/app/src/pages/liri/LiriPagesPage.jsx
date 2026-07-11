import { useCallback, useEffect, useState } from 'react';
import {
  Plus, Trash2, X, Loader2, Check, FileText, ArrowUp, ArrowDown, ExternalLink,
  Eye, EyeOff, ChevronLeft, LayoutTemplate, Type, Image as ImageIcon, MousePointerClick, Tag,
} from 'lucide-react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import { iriApi } from '@/lib/api-v2';
import activeTenantConfig from '@/lib/tenant/activeTenantConfig';

/**
 * LiriPagesPage — éditeur de PAGES no-code du tenant, DANS le portail LIRI. Chaque tenant
 * construit ses pages (vitrine, à-propos, offre…) en blocs, les publie, et les sert à
 * `<son-domaine>/p/<slug>` (rendu par IriPublicPage + IriBlockRenderer). Backend réutilisé
 * tel quel : iriApi (/iri/pages, CRUD + publish, tenant scoping). Style 100 % chaud LIRI.
 *
 * Modèle de bloc = { id, type, position, config } — aligné sur IriBlockRenderer (REGISTRY).
 */

const uid = () => 'blk_' + Math.random().toString(36).slice(2, 9);
const slugify = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

// Schéma des types de blocs (sous-ensemble utile de IriBlockRenderer). Clés « a.b » = imbriqué dans config.
const BLOCK_TYPES = {
  hero: { label: 'Hero', icon: LayoutTemplate, fields: [
    { k: 'title', label: 'Titre' }, { k: 'subtitle', label: 'Sous-titre' },
    { k: 'cta.label', label: 'Bouton — texte' }, { k: 'cta.href', label: 'Bouton — lien' },
  ] },
  text: { label: 'Texte', icon: Type, fields: [
    { k: 'as', label: 'Style', type: 'select', options: [['h2', 'Titre'], ['h3', 'Sous-titre'], ['p', 'Paragraphe']] },
    { k: 'text', label: 'Contenu', type: 'textarea' },
  ] },
  image: { label: 'Image', icon: ImageIcon, fields: [
    { k: 'src', label: 'URL de l’image' }, { k: 'alt', label: 'Texte alternatif' },
  ] },
  button: { label: 'Bouton', icon: MousePointerClick, fields: [
    { k: 'label', label: 'Texte' }, { k: 'href', label: 'Lien' },
  ] },
  offer: { label: 'Offre', icon: Tag, fields: [
    { k: 'title', label: 'Titre' }, { k: 'price', label: 'Prix' }, { k: 'currency', label: 'Devise' },
    { k: 'cta.label', label: 'Bouton — texte' }, { k: 'cta.href', label: 'Bouton — lien' },
  ] },
};
const TYPE_ORDER = ['hero', 'text', 'image', 'button', 'offer'];

const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const setPath = (obj, path, val) => {
  const keys = path.split('.'); const next = { ...(obj || {}) }; let cur = next;
  for (let i = 0; i < keys.length - 1; i++) { cur[keys[i]] = { ...(cur[keys[i]] || {}) }; cur = cur[keys[i]]; }
  cur[keys[keys.length - 1]] = val; return next;
};

export default function LiriPagesPage() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editing, setEditing] = useState(null); // { title, slug, status, blocks[] }
  const [saving, setSaving] = useState(false);

  const host = activeTenantConfig?.host || (typeof window !== 'undefined' ? window.location.host : '');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try { setPages(await iriApi.listPages() || []); }
    catch (e) { setErr(e?.message || 'Impossible de charger les pages.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const createPage = async () => {
    const title = newTitle.trim(); if (!title) return;
    setSaving(true); setErr('');
    try {
      const page = await iriApi.createPage({ title, slug: slugify(title), blocks: [] });
      setCreating(false); setNewTitle(''); await load();
      openEditor(page?.slug || slugify(title));
    } catch (e) { setErr(e?.message || 'Création impossible.'); }
    finally { setSaving(false); }
  };

  const openEditor = async (slug) => {
    setErr('');
    try {
      const p = await iriApi.getPage(slug);
      const blocks = Array.isArray(p?.blocks) ? p.blocks : [];
      setEditing({ title: p?.title || slug, slug: p?.slug || slug, status: p?.status || 'draft',
        blocks: blocks.map((b, i) => ({ id: b.id || uid(), type: b.type, position: i, config: b.config || {} })) });
    } catch (e) { setErr(e?.message || 'Ouverture impossible.'); }
  };

  const addBlock = (type) => setEditing((e) => ({ ...e, blocks: [...e.blocks, { id: uid(), type, position: e.blocks.length, config: {} }] }));
  const updateBlockCfg = (id, path, val) => setEditing((e) => ({ ...e, blocks: e.blocks.map((b) => b.id === id ? { ...b, config: setPath(b.config, path, val) } : b) }));
  const removeBlock = (id) => setEditing((e) => ({ ...e, blocks: e.blocks.filter((b) => b.id !== id) }));
  const moveBlock = (id, dir) => setEditing((e) => {
    const arr = [...e.blocks]; const i = arr.findIndex((b) => b.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return e;
    [arr[i], arr[j]] = [arr[j], arr[i]]; return { ...e, blocks: arr };
  });

  const persist = async ({ publish } = {}) => {
    if (!editing) return; setSaving(true); setErr('');
    const blocks = editing.blocks.map((b, i) => ({ id: b.id, type: b.type, position: i, config: b.config || {} }));
    try {
      await iriApi.updatePage(editing.slug, { title: editing.title, blocks, ...(publish === false ? { status: 'draft' } : {}) });
      if (publish === true) await iriApi.publishPage(editing.slug);
      setEditing((e) => ({ ...e, status: publish === true ? 'published' : publish === false ? 'draft' : e.status }));
      await load();
    } catch (e) { setErr(e?.message || 'Enregistrement impossible.'); }
    finally { setSaving(false); }
  };

  const deletePage = async (slug) => {
    try { await iriApi.deletePage(slug); if (editing?.slug === slug) setEditing(null); await load(); }
    catch (e) { setErr(e?.message || 'Suppression impossible.'); }
  };

  // ─────────────────────────── ÉDITEUR ───────────────────────────
  if (editing) {
    const pubUrl = `https://${host}/p/${editing.slug}`;
    return (
      <LiriPortalShell active="pages" rail>
        <div className="lp-scroll relative min-h-0 overflow-y-auto" style={{ background: 'var(--base)', color: 'var(--ink)' }}>
          <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
            <button onClick={() => setEditing(null)} className="inline-flex items-center gap-1.5 text-[13px] lp-muted lp-tr hover:lp-ink"><ChevronLeft size={15} /> Toutes les pages</button>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className="min-w-0 flex-1 bg-transparent text-[22px] font-semibold tracking-tight lp-ink outline-none" placeholder="Titre de la page" />
              <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium" style={editing.status === 'published' ? { background: 'rgba(91,122,82,.2)', color: '#9ec08f' } : { background: 'rgba(217,119,87,.14)', color: '#e7a07f' }}>
                {editing.status === 'published' ? 'Publiée' : 'Brouillon'}
              </span>
            </div>
            <a href={pubUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1.5 text-[12.5px] lp-coral lp-tr hover:underline">{host}/p/{editing.slug} <ExternalLink size={12} /></a>

            {err && <div className="mt-4 rounded-xl border px-3.5 py-2.5 text-[13px]" style={{ borderColor: 'rgba(226,85,63,.3)', background: 'rgba(226,85,63,.08)', color: '#e7a07f' }}>{err}</div>}

            {/* Blocs */}
            <div className="mt-5 space-y-3">
              {editing.blocks.length === 0 && (
                <div className="rounded-2xl border lp-line px-5 py-10 text-center" style={{ background: 'var(--panel)' }}>
                  <p className="text-[14px] lp-muted">Page vide. Ajoute ton premier bloc ci-dessous.</p>
                </div>
              )}
              {editing.blocks.map((b, i) => {
                const spec = BLOCK_TYPES[b.type]; if (!spec) return null;
                const Icon = spec.icon;
                return (
                  <div key={b.id} className="rounded-2xl border lp-line p-4" style={{ background: 'var(--panel)' }}>
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium lp-coral"><Icon size={14} /> {spec.label}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => moveBlock(b.id, -1)} disabled={i === 0} aria-label="Monter" className="grid h-7 w-7 place-items-center rounded-lg lp-muted lp-railbtn lp-tr disabled:opacity-30"><ArrowUp size={14} /></button>
                        <button onClick={() => moveBlock(b.id, 1)} disabled={i === editing.blocks.length - 1} aria-label="Descendre" className="grid h-7 w-7 place-items-center rounded-lg lp-muted lp-railbtn lp-tr disabled:opacity-30"><ArrowDown size={14} /></button>
                        <button onClick={() => removeBlock(b.id)} aria-label="Supprimer le bloc" className="grid h-7 w-7 place-items-center rounded-lg lp-muted lp-railbtn lp-tr"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2.5">
                      {spec.fields.map((f) => {
                        const val = getPath(b.config, f.k) ?? '';
                        return (
                          <label key={f.k} className="block">
                            <span className="mb-1 block text-[11.5px] font-medium lp-muted">{f.label}</span>
                            {f.type === 'textarea' ? (
                              <textarea value={val} onChange={(e) => updateBlockCfg(b.id, f.k, e.target.value)} rows={3} className={inputCls} style={{ resize: 'vertical' }} />
                            ) : f.type === 'select' ? (
                              <select value={val || f.options[0][0]} onChange={(e) => updateBlockCfg(b.id, f.k, e.target.value)} className={inputCls}>
                                {f.options.map(([v, l]) => <option key={v} value={v} style={{ background: '#221f1b' }}>{l}</option>)}
                              </select>
                            ) : (
                              <input value={val} onChange={(e) => updateBlockCfg(b.id, f.k, e.target.value)} className={inputCls} />
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Palette d'ajout */}
            <div className="mt-4 flex flex-wrap gap-2">
              {TYPE_ORDER.map((t) => { const S = BLOCK_TYPES[t]; const I = S.icon; return (
                <button key={t} onClick={() => addBlock(t)} className="inline-flex items-center gap-1.5 rounded-xl border lp-line px-3 py-2 text-[12.5px] font-medium lp-muted lp-tr hover:lp-ink" style={{ background: 'var(--panel)' }}>
                  <I size={14} /> {S.label}
                </button>
              ); })}
            </div>

            {/* Barre d'actions */}
            <div className="sticky bottom-0 mt-6 flex items-center justify-between gap-2 rounded-2xl border lp-line px-3 py-2.5" style={{ background: '#221f1b' }}>
              <button onClick={() => deletePage(editing.slug)} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium lp-tr" style={{ color: '#e08a6a' }}><Trash2 size={14} /> Supprimer</button>
              <div className="flex items-center gap-2">
                {editing.status === 'published'
                  ? <button onClick={() => persist({ publish: false })} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-medium lp-muted lp-railbtn lp-tr"><EyeOff size={14} /> Dépublier</button>
                  : null}
                <button onClick={() => persist({})} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-medium lp-muted lp-railbtn lp-tr disabled:opacity-60">{saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Enregistrer</button>
                <button onClick={() => persist({ publish: true })} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-medium text-white lp-tr lp-ember disabled:opacity-60"><Eye size={14} /> Publier</button>
              </div>
            </div>
          </div>
        </div>
      </LiriPortalShell>
    );
  }

  // ─────────────────────────── LISTE ───────────────────────────
  return (
    <LiriPortalShell active="pages" rail>
      <div className="lp-scroll relative min-h-0 overflow-y-auto" style={{ background: 'var(--base)', color: 'var(--ink)' }}>
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight lp-ink">Pages</h1>
              <p className="mt-1 text-[13.5px] lp-muted">Construis les pages de ton organisation en blocs, publie-les à ton adresse. Le pendant « pages » de tes services.</p>
            </div>
            <button onClick={() => { setCreating(true); setNewTitle(''); }} className="inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-[13.5px] font-medium text-white lp-tr lp-ember"><Plus size={16} /> Nouvelle page</button>
          </div>

          {err && <div className="mt-4 rounded-xl border px-3.5 py-2.5 text-[13px]" style={{ borderColor: 'rgba(226,85,63,.3)', background: 'rgba(226,85,63,.08)', color: '#e7a07f' }}>{err}</div>}

          {loading ? (
            <div className="mt-16 flex items-center justify-center lp-muted"><Loader2 className="animate-spin" size={22} /></div>
          ) : pages.length === 0 ? (
            <div className="mt-10 flex flex-col items-center rounded-2xl border lp-line px-6 py-14 text-center" style={{ background: 'var(--panel)' }}>
              <span className="grid h-12 w-12 place-items-center rounded-2xl lp-coral" style={{ background: 'rgba(217,119,87,.12)' }}><FileText size={24} /></span>
              <p className="mt-4 text-[15px] font-medium lp-ink">Aucune page pour le moment</p>
              <p className="mt-1 max-w-sm text-[13px] lp-muted">Crée ta première page : accueil, à-propos, une offre… en blocs, publiée à ton adresse.</p>
              <button onClick={() => { setCreating(true); setNewTitle(''); }} className="mt-5 inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13.5px] font-medium text-white lp-tr lp-ember"><Plus size={16} /> Créer une page</button>
            </div>
          ) : (
            <div className="mt-6 space-y-2.5">
              {pages.map((p) => (
                <div key={p.slug} className="flex items-center justify-between gap-3 rounded-2xl border lp-line p-4 lp-tr" style={{ background: 'var(--panel)' }}>
                  <button onClick={() => openEditor(p.slug)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-[15px] font-semibold lp-ink">{p.title || p.slug}</p>
                    <p className="mt-0.5 truncate text-[12px] lp-faint">/p/{p.slug}</p>
                  </button>
                  <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium" style={p.status === 'published' ? { background: 'rgba(91,122,82,.2)', color: '#9ec08f' } : { background: 'rgba(217,119,87,.14)', color: '#e7a07f' }}>{p.status === 'published' ? 'Publiée' : 'Brouillon'}</span>
                  <button onClick={() => openEditor(p.slug)} className="shrink-0 rounded-xl px-3 py-1.5 text-[12.5px] font-medium lp-muted lp-railbtn lp-tr">Éditer</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,.55)' }} onClick={() => !saving && setCreating(false)}>
          <div className="w-full max-w-sm rounded-2xl border lp-line p-5" style={{ background: '#221f1b' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="text-[16px] font-semibold lp-ink">Nouvelle page</h2><button onClick={() => setCreating(false)} className="grid h-8 w-8 place-items-center rounded-lg lp-muted lp-railbtn"><X size={16} /></button></div>
            <label className="mt-4 block"><span className="mb-1.5 block text-[12px] font-medium lp-muted">Titre</span>
              <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createPage()} placeholder="ex. Accueil" className={inputCls} /></label>
            {newTitle.trim() && <p className="mt-1.5 text-[11.5px] lp-faint">Adresse : {host}/p/{slugify(newTitle)}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setCreating(false)} className="rounded-xl px-4 py-2 text-[13.5px] font-medium lp-muted lp-railbtn">Annuler</button>
              <button onClick={createPage} disabled={saving || !newTitle.trim()} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-medium text-white lp-tr lp-ember disabled:opacity-60">{saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Créer</button>
            </div>
          </div>
        </div>
      )}
    </LiriPortalShell>
  );
}

const inputCls = 'w-full rounded-xl border lp-line bg-transparent px-3 py-2.5 text-[14px] lp-ink outline-none placeholder:lp-faint focus:border-[var(--coral)]';
