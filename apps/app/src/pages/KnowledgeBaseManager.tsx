import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2, Plus, Trash2, BookOpen, CheckCircle2, Upload, FileText,
  ArrowLeft, Search, X, Pencil, Eye, Tag, Save, RefreshCw,
} from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

const CATEGORIES_KEY = 'kb_custom_categories';

type KBEntry = {
  id: string;
  title: string;
  topic: string | null;
  content: string;
  source: string | null;
  created_at: string;
  embedding: unknown | null;
};

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';
type ParseStatus = 'idle' | 'parsing' | 'done' | 'error';
type EditStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function KnowledgeBaseManager() {
  const navigate = useNavigate();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

  // --- Entries ---
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Search & filter ---
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Toutes');

  // --- Custom categories ---
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(CATEGORIES_KEY) || '[]'); } catch { return []; }
  });
  const [showCatInput, setShowCatInput] = useState(false);
  const [newCatValue, setNewCatValue] = useState('');

  // --- Add form ---
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', topic: '', content: '', source: '' });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState('');
  const [parseStatus, setParseStatus] = useState<ParseStatus>('idle');
  const [parseError, setParseError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- View / Edit panel ---
  const [selected, setSelected] = useState<KBEntry | null>(null);
  const [editForm, setEditForm] = useState({ title: '', topic: '', content: '', source: '' });
  const [editMode, setEditMode] = useState(false);
  const [editStatus, setEditStatus] = useState<EditStatus>('idle');
  const [editError, setEditError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // --- Derived ---
  const entryCategories = useMemo(
    () => [...new Set(entries.map((e) => e.topic).filter(Boolean) as string[])],
    [entries]
  );
  const allCategories = useMemo(
    () => [...new Set([...entryCategories, ...customCategories])].sort(),
    [entryCategories, customCategories]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter((e) => {
      const matchCat = activeCategory === 'Toutes' || e.topic === activeCategory;
      const matchSearch = !q || e.title.toLowerCase().includes(q) || (e.topic ?? '').toLowerCase().includes(q) || e.content.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [entries, search, activeCategory]);

  // --- Data fetching ---
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('knowledge_base')
      .select('id, title, topic, content, source, created_at, embedding')
      .order('created_at', { ascending: false });
    setEntries((data as KBEntry[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // --- Category creation ---
  const addCategory = () => {
    const val = newCatValue.trim();
    if (!val || allCategories.includes(val)) { setShowCatInput(false); setNewCatValue(''); return; }
    const updated = [...customCategories, val];
    setCustomCategories(updated);
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(updated));
    setNewCatValue('');
    setShowCatInput(false);
  };

  // --- File parsing ---
  const parseFile = useCallback(async (file: File) => {
    setParseStatus('parsing');
    setParseError('');
    try {
      let text = '';
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'pdf') {
        const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
        const pages: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const ct = await page.getTextContent();
          pages.push(ct.items.map((item) => ('str' in item ? item.str : '')).join(' '));
        }
        text = pages.join('\n\n');
      } else {
        text = await file.text();
      }
      text = text.replace(/\r\n/g, '\n').replace(/[ \t]{3,}/g, '  ').trim();
      const titleFromFile = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      setForm((f) => ({ ...f, content: text, title: f.title.trim() ? f.title : titleFromFile, source: f.source.trim() ? f.source : file.name }));
      setParseStatus('done');
    } catch (err: unknown) {
      setParseStatus('error');
      setParseError((err as Error)?.message || String(err));
    }
  }, []);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0]; if (file) parseFile(file);
  }, [parseFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) parseFile(file); e.target.value = '';
  }, [parseFile]);

  // --- Add document ---
  const handleAdd = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaveStatus('saving'); setSaveError('');
    try {
      const { data: sd } = await supabase.auth.getSession();
      const token = sd?.session?.access_token || '';
      const res = await fetch(`${supabaseUrl}/functions/v1/embed-knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ title: form.title.trim(), topic: form.topic.trim() || undefined, content: form.content.trim(), source: form.source.trim() || undefined }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error((err as { error?: string }).error || `Erreur ${res.status}`); }
      setSaveStatus('success');
      setForm({ title: '', topic: '', content: '', source: '' });
      setParseStatus('idle');
      setShowForm(false);
      await fetchEntries();
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e: unknown) { setSaveStatus('error'); setSaveError((e as Error)?.message || String(e)); }
  };

  // --- Edit document ---
  const openEntry = (entry: KBEntry) => {
    setSelected(entry);
    setEditForm({ title: entry.title, topic: entry.topic ?? '', content: entry.content, source: entry.source ?? '' });
    setEditMode(false);
    setEditStatus('idle');
    setEditError('');
  };

  const handleSave = async () => {
    if (!selected) return;
    setEditStatus('saving'); setEditError('');
    try {
      const { data: sd } = await supabase.auth.getSession();
      const token = sd?.session?.access_token || '';
      const res = await fetch(`${supabaseUrl}/functions/v1/embed-knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ id: selected.id, title: editForm.title.trim(), topic: editForm.topic.trim() || undefined, content: editForm.content.trim(), source: editForm.source.trim() || undefined }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error((err as { error?: string }).error || `Erreur ${res.status}`); }
      setEditStatus('saved');
      await fetchEntries();
      const updated = entries.find((e) => e.id === selected.id);
      if (updated) setSelected({ ...updated, ...{ title: editForm.title, topic: editForm.topic || null, content: editForm.content, source: editForm.source || null } });
      setTimeout(() => setEditStatus('idle'), 2500);
    } catch (e: unknown) { setEditStatus('error'); setEditError((e as Error)?.message || String(e)); }
  };

  const handleDelete = async (id: string) => {
    setDeleteId(id);
    await supabase.from('knowledge_base').delete().eq('id', id);
    setDeleteId(null);
    if (selected?.id === id) setSelected(null);
    await fetchEntries();
  };

  const ic = 'bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-[var(--school-accent)] focus:ring-0';

  return (
    <div className="min-h-screen bg-[#0A0F1A] text-white flex flex-col">
      <div className="max-w-7xl mx-auto w-full px-6 py-8 flex flex-col gap-6 flex-1">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <BookOpen className="w-6 h-6 text-[var(--school-accent)]" />
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Base de connaissances</h1>
            <p className="text-xs text-gray-500">Les documents enrichissent automatiquement les explications IA (pgvector RAG).</p>
          </div>
          <Button onClick={() => { setShowForm((v) => !v); setSaveStatus('idle'); }} className="bg-[var(--school-accent)] text-black hover:bg-yellow-400 font-bold gap-2 text-sm">
            <Plus className="w-4 h-4" /> Ajouter un document
          </Button>
        </div>

        {/* ── Search + Category filter ── */}
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher dans vos documents (titre, catégorie, contenu)…"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[var(--school-accent)]"
            />
            {search && <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {['Toutes', ...allCategories].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${activeCategory === cat ? 'bg-[var(--school-accent)] border-[var(--school-accent)] text-black font-semibold' : 'border-white/15 text-gray-400 hover:border-white/30 hover:text-white'}`}
              >
                {cat}
                {cat !== 'Toutes' && <span className="ml-1 opacity-60">({entries.filter((e) => e.topic === cat).length})</span>}
              </button>
            ))}

            {showCatInput ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={newCatValue}
                  onChange={(e) => setNewCatValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); if (e.key === 'Escape') { setShowCatInput(false); setNewCatValue(''); } }}
                  placeholder="Nom de catégorie…"
                  className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-[var(--school-accent)] text-white placeholder:text-gray-500 focus:outline-none w-44"
                />
                <button type="button" onClick={addCategory} className="text-[var(--school-accent)] hover:text-yellow-300 p-1"><CheckCircle2 className="w-4 h-4" /></button>
                <button type="button" onClick={() => { setShowCatInput(false); setNewCatValue(''); }} className="text-gray-500 hover:text-white p-1"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowCatInput(true)} className="text-xs px-3 py-1.5 rounded-full border border-dashed border-white/20 text-gray-500 hover:text-[var(--school-accent)] hover:border-[var(--school-accent)] transition-colors flex items-center gap-1">
                <Tag className="w-3 h-3" /> Nouvelle catégorie
              </button>
            )}
          </div>
        </div>

        {/* ── Add form (collapsible) ── */}
        {showForm && (
          <div className="rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] bg-white/3 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[var(--school-accent)] uppercase tracking-wider">Nouveau document</div>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            <div
              role="button" tabIndex={0}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-6 cursor-pointer transition-colors ${dragOver ? 'border-[var(--school-accent)] bg-[color-mix(in_srgb,var(--school-accent)_8%,transparent)]' : 'border-white/15 hover:border-white/30 bg-black/10'}`}
            >
              <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf" className="sr-only" onChange={handleFileChange} />
              {parseStatus === 'parsing' ? <><Loader2 className="w-5 h-5 animate-spin text-[var(--school-accent)]" /><span className="text-sm text-gray-300">Extraction…</span></>
                : parseStatus === 'done' ? <><CheckCircle2 className="w-5 h-5 text-green-400" /><span className="text-sm text-green-400">Texte extrait — vérifiez ci-dessous</span></>
                : parseStatus === 'error' ? <><FileText className="w-5 h-5 text-red-400" /><span className="text-sm text-red-400">{parseError}</span></>
                : <><Upload className="w-5 h-5 text-gray-400" /><span className="text-sm text-gray-400">Glisse PDF, TXT ou MD ici — ou clique pour parcourir</span></>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Titre *</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="ex: Brisure de symétrie" className={ic} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Catégorie</Label>
                <div className="flex gap-2">
                  <select
                    value={form.topic}
                    onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                    className="flex-1 rounded-md bg-white/5 border border-white/10 text-sm text-white px-3 py-2 focus:outline-none focus:border-[var(--school-accent)]"
                  >
                    <option value="">— Aucune —</option>
                    {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">Contenu *</Label>
              <Textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder="Cours, fiche, définition, chapitre…" className={`${ic} min-h-[120px] resize-y`} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-400">Source (optionnel)</Label>
              <Input value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} placeholder="ex: Cours M1 Physique, manuel p.42…" className={ic} />
            </div>

            {saveStatus === 'error' && <div className="text-sm text-red-400 rounded-lg border border-red-500/20 bg-red-500/5 p-3">{saveError}</div>}
            {saveStatus === 'success' && <div className="flex items-center gap-2 text-sm text-green-400 rounded-lg border border-green-500/20 bg-green-500/5 p-3"><CheckCircle2 className="w-4 h-4" />Document ajouté et vectorisé.</div>}

            <Button onClick={handleAdd} disabled={saveStatus === 'saving' || !form.title.trim() || !form.content.trim()} className="bg-[var(--school-accent)] text-black hover:bg-yellow-400 font-bold gap-2">
              {saveStatus === 'saving' ? <><Loader2 className="w-4 h-4 animate-spin" />Vectorisation…</> : <><Plus className="w-4 h-4" />Ajouter à la base</>}
            </Button>
          </div>
        )}

        {/* ── Main content: list + detail panel ── */}
        <div className="flex gap-4 flex-1 min-h-0">

          {/* List */}
          <div className={`flex flex-col gap-3 overflow-y-auto flex-1 ${selected ? 'max-w-[55%]' : 'w-full'}`}>
            <div className="flex items-center justify-between text-xs text-gray-500 pb-1">
              <span>{loading ? 'Chargement…' : `${filtered.length} document${filtered.length !== 1 ? 's' : ''}${filtered.length !== entries.length ? ` sur ${entries.length}` : ''}`}</span>
              <button type="button" onClick={fetchEntries} className="flex items-center gap-1 hover:text-gray-300 transition-colors"><RefreshCw className="w-3 h-3" />Rafraîchir</button>
            </div>

            {loading && <div className="flex items-center gap-2 text-gray-400 py-12 justify-center"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Chargement…</span></div>}

            {!loading && filtered.length === 0 && (
              <div className="text-center py-14 text-gray-500 text-sm border border-white/10 rounded-2xl">
                {entries.length === 0 ? 'Aucun document. Clique sur "+ Ajouter un document".' : 'Aucun résultat pour cette recherche / catégorie.'}
              </div>
            )}

            {filtered.map((entry) => (
              <div
                key={entry.id}
                onClick={() => openEntry(entry)}
                className={`rounded-xl border p-4 flex items-start gap-3 cursor-pointer transition-all group ${selected?.id === entry.id ? 'border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)]' : 'border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5'}`}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white text-sm">{entry.title}</span>
                    {entry.topic && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-[var(--school-accent)] border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]">{entry.topic}</span>}
                    {entry.embedding
                      ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">✓ vectorisé</span>
                      : <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">⏳ en attente</span>}
                  </div>
                  <p className="text-xs text-gray-400 line-clamp-2">{entry.content}</p>
                  <div className="flex items-center gap-3 text-[10px] text-gray-600">
                    {entry.source && <span>Source : {entry.source}</span>}
                    <span>{new Date(entry.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
                <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={(e) => { e.stopPropagation(); openEntry(entry); }} className="p-1.5 rounded text-gray-400 hover:text-[var(--school-accent)] hover:bg-white/10 transition-colors" title="Voir / Modifier"><Eye className="w-4 h-4" /></button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }} disabled={deleteId === entry.id} className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-white/10 transition-colors" title="Supprimer">
                    {deleteId === entry.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Detail / Edit panel */}
          {selected && (
            <div className="w-[45%] flex-shrink-0 rounded-2xl border border-white/15 bg-[#111827] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  {editMode
                    ? <Pencil className="w-4 h-4 text-[var(--school-accent)]" />
                    : <Eye className="w-4 h-4 text-gray-400" />}
                  <span className="text-sm font-semibold text-white truncate max-w-[200px]">{selected.title}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => { setEditMode((v) => !v); setEditStatus('idle'); }} className={`p-1.5 rounded transition-colors text-xs flex items-center gap-1 px-3 py-1.5 border ${editMode ? 'border-white/20 text-gray-400 hover:text-white' : 'border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]'}`}>
                    {editMode ? <><X className="w-3 h-3" />Annuler</> : <><Pencil className="w-3 h-3" />Modifier</>}
                  </button>
                  <button type="button" onClick={() => setSelected(null)} className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-white/10 transition-colors ml-1"><X className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {editMode ? (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">Titre</Label>
                      <Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} className={ic} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">Catégorie</Label>
                      <select value={editForm.topic} onChange={(e) => setEditForm((f) => ({ ...f, topic: e.target.value }))} className="w-full rounded-md bg-white/5 border border-white/10 text-sm text-white px-3 py-2 focus:outline-none focus:border-[var(--school-accent)]">
                        <option value="">— Aucune —</option>
                        {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">Contenu</Label>
                      <Textarea value={editForm.content} onChange={(e) => setEditForm((f) => ({ ...f, content: e.target.value }))} className={`${ic} min-h-[220px] resize-y`} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">Source</Label>
                      <Input value={editForm.source} onChange={(e) => setEditForm((f) => ({ ...f, source: e.target.value }))} className={ic} />
                    </div>
                    {editStatus === 'error' && <div className="text-sm text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg p-3">{editError}</div>}
                    {editStatus === 'saved' && <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/5 border border-green-500/20 rounded-lg p-3"><CheckCircle2 className="w-4 h-4" />Sauvegardé et re-vectorisé.</div>}
                    <Button onClick={handleSave} disabled={editStatus === 'saving'} className="w-full bg-[var(--school-accent)] text-black hover:bg-yellow-400 font-bold gap-2">
                      {editStatus === 'saving' ? <><Loader2 className="w-4 h-4 animate-spin" />Re-vectorisation…</> : <><Save className="w-4 h-4" />Sauvegarder et re-vectoriser</>}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      {selected.topic && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-[var(--school-accent)] border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]">{selected.topic}</span>}
                      {selected.embedding
                        ? <span className="text-xs px-2.5 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">✓ vectorisé</span>
                        : <span className="text-xs px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">⏳ en attente</span>}
                    </div>
                    {selected.source && <div className="text-xs text-gray-500">Source : {selected.source}</div>}
                    <div className="text-xs text-gray-600">{new Date(selected.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed border-t border-white/10 pt-4">{selected.content}</div>
                  </>
                )}
              </div>

              <div className="px-5 py-3 border-t border-white/10 flex justify-end">
                <button type="button" onClick={() => handleDelete(selected.id)} disabled={deleteId === selected.id} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors">
                  {deleteId === selected.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}Supprimer ce document
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
