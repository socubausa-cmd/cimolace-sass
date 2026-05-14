/**
 * Page admin minimale — IRI builder (pages + blocks).
 * Édition « JSON-first » : un block = type + JSON config. Renderer côté client
 * via `IriBlockRenderer` ; le serveur garantit le filtrage tenant.
 *
 * Aucune logique tenant en dur ici : le tenant courant est résolu côté
 * serveur via le Host (Netlify function `iri-admin`).
 */

import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';

const IriBlockRenderer = lazy(() => import('@/components/iri/IriBlockRenderer'));

const ALLOWED_TYPES = ['text', 'hero', 'button', 'image', 'video', 'columns', 'faq', 'offer', 'live'];

async function callIriAdmin(method, payload) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) throw new Error('Session admin requise');

  const url = method === 'GET'
    ? `/.netlify/functions/iri-admin${payload?.qs ? `?${payload.qs}` : ''}`
    : '/.netlify/functions/iri-admin';

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: method === 'GET' ? undefined : JSON.stringify(payload?.body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return data;
}

function PageList({ pages, activeSlug, onSelect, onCreate, onRefresh, loading }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button onClick={onCreate} variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-1" /> Nouvelle page
        </Button>
        <Button onClick={onRefresh} variant="ghost" size="sm" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </div>
      <ul className="space-y-1">
        {(pages || []).map((p) => {
          const isActive = activeSlug && p.slug?.toLowerCase() === activeSlug.toLowerCase();
          return (
            <li key={p.id}>
              <button
                type="button"
                className={`w-full text-left px-3 py-2 rounded border ${isActive ? 'bg-primary/10 border-primary' : 'border-white/10 hover:bg-white/5'}`}
                onClick={() => onSelect(p.slug)}
              >
                <div className="text-sm font-medium">{p.title || p.slug}</div>
                <div className="text-xs opacity-70 flex items-center gap-2">
                  <span>/{p.slug}</span>
                  <Badge variant="outline">{p.status}</Badge>
                  <Badge variant="outline">{p.visibility}</Badge>
                </div>
              </button>
            </li>
          );
        })}
        {!pages?.length ? (
          <li className="text-sm opacity-60 px-3 py-2">Aucune page pour ce tenant.</li>
        ) : null}
      </ul>
    </div>
  );
}

function PageMetaForm({ page, onChange, onSave, saving }) {
  const update = (k, v) => onChange({ ...page, [k]: v });
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs opacity-70">
          Slug
          <input
            className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
            value={page.slug || ''}
            onChange={(e) => update('slug', e.target.value)}
          />
        </label>
        <label className="text-xs opacity-70">
          Titre
          <input
            className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
            value={page.title || ''}
            onChange={(e) => update('title', e.target.value)}
          />
        </label>
        <label className="text-xs opacity-70">
          Statut
          <select
            className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
            value={page.status || 'draft'}
            onChange={(e) => update('status', e.target.value)}
          >
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </select>
        </label>
        <label className="text-xs opacity-70">
          Visibilité
          <select
            className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
            value={page.visibility || 'public'}
            onChange={(e) => update('visibility', e.target.value)}
          >
            <option value="public">public</option>
            <option value="authenticated">authenticated</option>
            <option value="paid">paid</option>
          </select>
        </label>
      </div>
      <Button onClick={onSave} size="sm" disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
        Enregistrer la page
      </Button>
    </div>
  );
}

function BlockEditor({ block, onChange, onSave, onDelete, saving }) {
  const update = (k, v) => onChange({ ...block, [k]: v });
  const [configText, setConfigText] = useState(() => JSON.stringify(block.config || {}, null, 2));

  useEffect(() => {
    setConfigText(JSON.stringify(block.config || {}, null, 2));
    // Resync seulement quand l’identité du block change (évite d’écraser la saisie JSON en cours).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- exclure block.config (saisie locale)
  }, [block.id]);

  const tryCommitConfig = () => {
    try {
      const parsed = JSON.parse(configText || '{}');
      update('config', parsed && typeof parsed === 'object' ? parsed : {});
      return true;
    } catch (e) {
      return false;
    }
  };

  return (
    <div className="space-y-2 p-3 border border-white/10 rounded">
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs opacity-70">
          Type
          <select
            className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
            value={block.type || 'text'}
            onChange={(e) => update('type', e.target.value)}
          >
            {ALLOWED_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="text-xs opacity-70">
          Position
          <input
            type="number"
            className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
            value={Number(block.position || 0)}
            onChange={(e) => update('position', Number(e.target.value))}
          />
        </label>
        <label className="text-xs opacity-70">
          Visibilité
          <select
            className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-sm"
            value={block.visibility || 'inherit'}
            onChange={(e) => update('visibility', e.target.value)}
          >
            <option value="inherit">inherit</option>
            <option value="public">public</option>
            <option value="authenticated">authenticated</option>
            <option value="paid">paid</option>
          </select>
        </label>
      </div>
      <label className="text-xs opacity-70 block">
        Config JSON
        <textarea
          className="w-full font-mono text-xs bg-transparent border border-white/10 rounded p-2 min-h-[160px]"
          value={configText}
          onChange={(e) => setConfigText(e.target.value)}
          spellCheck={false}
        />
      </label>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => {
            if (!tryCommitConfig()) {
              return;
            }
            onSave();
          }}
          disabled={saving}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          Enregistrer
        </Button>
        {block.id ? (
          <Button size="sm" variant="destructive" onClick={onDelete} disabled={saving}>
            <Trash2 className="w-4 h-4 mr-1" /> Supprimer
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminIriBuilderPage() {
  const { toast } = useToast();
  const [pages, setPages] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [activeSlug, setActiveSlug] = useState('');
  const [pageDraft, setPageDraft] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [savingPage, setSavingPage] = useState(false);
  const [savingBlockId, setSavingBlockId] = useState(null);
  const [draftBlocks, setDraftBlocks] = useState({}); // id -> draft

  const loadPages = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await callIriAdmin('GET', { qs: 'op=list-pages' });
      setPages(data.pages || []);
    } catch (e) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingList(false);
    }
  }, [toast]);

  const loadPage = useCallback(async (slug) => {
    if (!slug) {
      setPageDraft(null);
      setBlocks([]);
      setDraftBlocks({});
      return;
    }
    try {
      const data = await callIriAdmin('GET', { qs: `op=get-page&slug=${encodeURIComponent(slug)}` });
      setPageDraft(data.page || { slug, title: slug, status: 'draft', visibility: 'public' });
      setBlocks(data.blocks || []);
      setDraftBlocks({});
    } catch (e) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => { loadPages(); }, [loadPages]);
  useEffect(() => { loadPage(activeSlug); }, [activeSlug, loadPage]);

  const handleCreatePage = useCallback(() => {
    const slug = window.prompt('Slug de la nouvelle page (ex: accueil) ?');
    if (!slug) return;
    const normalized = String(slug).trim().toLowerCase();
    setActiveSlug(normalized);
    setPageDraft({ slug: normalized, title: normalized, status: 'draft', visibility: 'public' });
    setBlocks([]);
  }, []);

  const handleSavePage = useCallback(async () => {
    if (!pageDraft?.slug) return;
    setSavingPage(true);
    try {
      const data = await callIriAdmin('POST', { body: { op: 'upsert-page', page: pageDraft } });
      setPageDraft(data.page);
      setActiveSlug(data.page.slug);
      await loadPages();
      toast({ title: 'Page enregistrée', description: `/${data.page.slug}` });
    } catch (e) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setSavingPage(false);
    }
  }, [pageDraft, loadPages, toast]);

  const handleAddBlock = useCallback(() => {
    if (!pageDraft?.id) {
      toast({ title: 'Enregistre la page d’abord', variant: 'destructive' });
      return;
    }
    const tempId = `new-${Date.now()}`;
    const draft = {
      id: null,
      _localId: tempId,
      page_id: pageDraft.id,
      type: 'text',
      position: blocks.length,
      config: { text: '' },
      visibility: 'inherit',
    };
    setDraftBlocks((d) => ({ ...d, [tempId]: draft }));
  }, [pageDraft?.id, blocks.length, toast]);

  const handleSaveBlock = useCallback(async (key, draft) => {
    if (!draft) return;
    setSavingBlockId(key);
    try {
      const body = { op: 'upsert-block', block: { ...draft } };
      const data = await callIriAdmin('POST', { body });
      // remplace dans la liste
      setBlocks((prev) => {
        const next = prev.filter((b) => b.id !== data.block.id);
        next.push(data.block);
        next.sort((a, b) => Number(a.position || 0) - Number(b.position || 0));
        return next;
      });
      setDraftBlocks((d) => {
        const copy = { ...d };
        delete copy[key];
        return copy;
      });
      toast({ title: 'Block enregistré', description: data.block.type });
    } catch (e) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setSavingBlockId(null);
    }
  }, [toast]);

  const handleDeleteBlock = useCallback(async (blockId) => {
    if (!blockId) return;
    if (!window.confirm('Supprimer ce block ?')) return;
    try {
      await callIriAdmin('POST', { body: { op: 'delete-block', blockId } });
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
      toast({ title: 'Block supprimé' });
    } catch (e) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    }
  }, [toast]);

  const allBlocksForRender = useMemo(() => {
    // Aperçu : on prend les blocks server-side ; les drafts non sauvegardés
    // ne sont pas rendus pour rester cohérents avec l’endpoint public.
    return blocks;
  }, [blocks]);

  return (
    <>
      <Helmet><title>IRI Builder — Admin</title></Helmet>
      <div className="p-6 grid grid-cols-12 gap-6">
        <aside className="col-span-3">
          <h2 className="text-sm font-semibold mb-3 opacity-80">Pages</h2>
          <PageList
            pages={pages}
            activeSlug={activeSlug}
            onSelect={setActiveSlug}
            onCreate={handleCreatePage}
            onRefresh={loadPages}
            loading={loadingList}
          />
        </aside>

        <section className="col-span-5 space-y-4">
          <h2 className="text-sm font-semibold opacity-80">Édition</h2>
          {pageDraft ? (
            <PageMetaForm
              page={pageDraft}
              onChange={setPageDraft}
              onSave={handleSavePage}
              saving={savingPage}
            />
          ) : (
            <p className="text-sm opacity-60">Sélectionne ou crée une page.</p>
          )}

          {pageDraft?.id ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold opacity-80">Blocks ({blocks.length})</h3>
                <Button size="sm" variant="outline" onClick={handleAddBlock}>
                  <Plus className="w-4 h-4 mr-1" /> Ajouter
                </Button>
              </div>

              {blocks.map((b) => (
                <BlockEditor
                  key={b.id}
                  block={b}
                  onChange={(next) => setBlocks((prev) => prev.map((x) => (x.id === b.id ? next : x)))}
                  onSave={() => {
                    const current = blocks.find((x) => x.id === b.id);
                    handleSaveBlock(b.id, current);
                  }}
                  onDelete={() => handleDeleteBlock(b.id)}
                  saving={savingBlockId === b.id}
                />
              ))}

              {Object.entries(draftBlocks).map(([key, d]) => (
                <BlockEditor
                  key={key}
                  block={d}
                  onChange={(next) => setDraftBlocks((dd) => ({ ...dd, [key]: next }))}
                  onSave={() => handleSaveBlock(key, draftBlocks[key])}
                  onDelete={() => setDraftBlocks((dd) => {
                    const copy = { ...dd };
                    delete copy[key];
                    return copy;
                  })}
                  saving={savingBlockId === key}
                />
              ))}
            </div>
          ) : null}
        </section>

        <section className="col-span-4">
          <h2 className="text-sm font-semibold mb-3 opacity-80">Aperçu</h2>
          <div className="border border-white/10 rounded p-3 min-h-[200px]">
            {allBlocksForRender.length ? (
              <Suspense fallback={<p className="text-sm opacity-60">Chargement renderer…</p>}>
                <IriBlockRenderer blocks={allBlocksForRender} />
              </Suspense>
            ) : (
              <p className="text-sm opacity-60">Pas de blocks (encore).</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
