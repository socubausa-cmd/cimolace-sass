import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Film, Music2, FileText, Type, Sparkles, BookOpen, Presentation, Radio,
  FileDown, Loader2, Check, AlertTriangle, RefreshCw, Search, ArrowUpRight,
  Upload, AudioLines, Link2,
} from 'lucide-react';
import { masterFactoryApi } from '@/lib/api-v2';
import { authStore } from '@/lib/auth-store';
import { exportCoursePdf } from '@/lib/exportCoursePdf';
import { extractTextFromFile } from '@/lib/extractDocumentText';

/**
 * ATELIER DE COURS — lot 6 de l'unification (docs/ATELIER_COURS_UNIFIE_SPEC.md).
 *
 * Un seul écran pour TOUTES les sources (replays, TikTok, documents, texte) et
 * TOUS les rendus. Remplace : les deux boutons concurrents du lecteur Vidéothèque
 * et les lancements manuels de `tools/precepteur-tiktok/04-batch.mjs`.
 *
 * ⭐ Le parti pris central : rendre VISIBLE ce qui coûte et ce qui est gratuit.
 * Une source déjà « comprise » ne repaye jamais l'analyse ; un cours déjà écrit
 * ressort en PDF sans le moindre appel IA. L'écran affiche donc l'état des
 * pivots AVANT que l'utilisateur ne clique, au lieu de le découvrir sur sa facture.
 */

const C = {
  base: '#262624', panel: '#30302e', panel2: '#3a3a37', rail: '#1f1e1c',
  coral: '#d97757', ink: '#f5f4ee', muted: '#b0ada3', faint: '#82807a',
  line: 'rgba(245,244,238,.09)', ok: '#7ab57a', warn: '#e0976a',
};

const TYPES = [
  { key: 'replay', label: 'Replays', icon: Film },
  { key: 'live', label: 'Lives', icon: Radio },
  { key: 'tiktok', label: 'TikTok', icon: Music2 },
  { key: 'document', label: 'Documents', icon: FileText },
  { key: 'pdf', label: 'PDF', icon: FileText },
  { key: 'audio', label: 'Audio', icon: AudioLines },
  { key: 'video', label: 'Vidéo', icon: Film },
  { key: 'url', label: 'Lien', icon: Link2 },
  { key: 'texte', label: 'Texte', icon: Type },
];
const INGEST_TYPES = new Set(['document', 'pdf', 'audio', 'video', 'url', 'texte']);

/** Rendus proposés. `needs` = le pivot requis ; sans lui, l'action COÛTE de l'IA. */
const ACTIONS = [
  { key: 'course', label: 'Cours + parcours', icon: BookOpen, needs: 'ecrit', call: 'produceCourse', long: true },
  { key: 'master-script', label: 'Master Script', icon: Sparkles, needs: 'master_script', call: 'produceMasterScript', long: true },
  { key: 'smartboard', label: 'SmartBoard', icon: Presentation, needs: 'smartboard_timeline', call: 'produceSmartboard', long: true },
  { key: 'live', label: 'Scénario live', icon: Radio, needs: 'live_scenario', call: 'produceLiveScenario', long: true },
];

export default function LiriAtelierPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const bootSourceRef = useRef('');
  const importInputRef = useRef(null);
  const urlParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const urlSourceType = urlParams.get('mfSourceType') || urlParams.get('sourceType') || 'replay';
  const urlSourceId = urlParams.get('mfSourceId') || urlParams.get('sourceId') || '';
  const [type, setType] = useState(TYPES.some((t) => t.key === urlSourceType) ? urlSourceType : 'replay');
  const [sources, setSources] = useState(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [etat, setEtat] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [extractedCourse, setExtractedCourse] = useState(null);
  const [precepteurCourse, setPrecepteurCourse] = useState(null);
  const [sourceDraft, setSourceDraft] = useState({ title: '', text: '', url: '', fileName: '', mimeType: '' });

  // ── TRAITEMENT EN LOT ────────────────────────────────────────────────────
  // Sans lui, 512 sources = 512 clics : le volume restait hors de portée du
  // fondateur et retombait sur la ligne de commande. Les demandes partent une
  // par une (l'API est idempotente : une source déjà traitée est ignorée), et
  // la file du worker fait le reste — on n'attend pas ici.
  const [picked, setPicked] = useState(() => new Set());
  const [lot, setLot] = useState({ running: false, done: 0, total: 0 });

  const togglePick = (id) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const runLot = async (action) => {
    const ids = [...picked];
    if (!ids.length) return;
    setLot({ running: true, done: 0, total: ids.length });
    let ok = 0;
    for (const [i, id] of ids.entries()) {
      try {
        if (action === 'understand') await masterFactoryApi.understand({ sourceType: type, sourceId: id });
        else await masterFactoryApi.produceCourse({ sourceType: type, sourceId: id });
        ok += 1;
      } catch { /* une source en échec ne doit pas arrêter le lot */ }
      setLot({ running: true, done: i + 1, total: ids.length });
    }
    setLot({ running: false, done: ids.length, total: ids.length });
    setPicked(new Set());
    flash('ok', `${ok}/${ids.length} source(s) mise(s) en file — le travail se poursuit en arrière-plan.`);
  };

  const load = useCallback(async (t, opts = {}) => {
    setSources(null);
    if (!opts.keepSelection) {
      setSel(null);
      setEtat(null);
    }
    try {
      const r = await masterFactoryApi.listSources(t);
      setSources(Array.isArray(r) ? r : (Array.isArray(r?.data) ? r.data : []));
    } catch (e) {
      setSources([]); setMsg({ k: 'err', t: e?.message || 'Chargement impossible.' });
    }
  }, []);
  useEffect(() => { load(type, { keepSelection: !!urlSourceId }); }, [type, load, urlSourceId]);

  useEffect(() => {
    if (!urlSourceId) return;
    const signature = `${type}:${urlSourceId}:direct`;
    if (bootSourceRef.current === signature) return;
    bootSourceRef.current = signature;
    const placeholder = {
      id: urlSourceId,
      title: 'Source sélectionnée',
      ready: true,
      chars: 0,
      direct: true,
    };
    setMsg(null);
    setSel((prev) => (String(prev?.id || '') === String(urlSourceId) ? prev : placeholder));
    setEtat('loading');
    let cancelled = false;
    void masterFactoryApi.getSource(type, urlSourceId)
      .then((source) => {
        if (!cancelled) setSel((prev) => ({ ...(prev || placeholder), ...(source?.data || source || {}) }));
      })
      .catch(() => {
        if (!cancelled) setSel(placeholder);
      });
    void masterFactoryApi.status(type, urlSourceId)
      .then((status) => {
        if (!cancelled) setEtat(status);
      })
      .catch(() => {
        if (!cancelled) setEtat(null);
      });
    return () => { cancelled = true; };
  }, [type, urlSourceId]);

  useEffect(() => {
    if (!Array.isArray(sources) || !urlSourceId) return;
    const signature = `${type}:${urlSourceId}`;
    const found = sources.find((s) => String(s.id) === String(urlSourceId));
    if (!found) return;
    bootSourceRef.current = signature;
    setSel(found);
    void masterFactoryApi.status(type, found.id).then(setEtat).catch(() => setEtat(null));
    window.setTimeout(() => {
      try {
        document.querySelector(`[data-source-id="${CSS.escape(String(urlSourceId))}"]`)?.scrollIntoView({
          block: 'center',
          behavior: 'smooth',
        });
      } catch {
        // ignore
      }
    }, 250);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources, type, urlSourceId]);

  useEffect(() => {
    if (!urlSourceType || !TYPES.some((t) => t.key === urlSourceType)) return;
    if (urlSourceType !== type) setType(urlSourceType);
  }, [urlSourceType, type]);

  const openSource = async (s) => {
    setMsg(null);
    setExtractedCourse(null);
    setSel(s); setEtat('loading');
    try { setEtat(await masterFactoryApi.status(type, s.id)); }
    catch { setEtat(null); }
  };

  const openInStudio = (target, source = sel) => {
    if (!source?.id) return;
    const params = new URLSearchParams({
      tenant: authStore.getTenantSlug?.() || 'isna',
      mfSourceType: type,
      mfSourceId: source.id,
    });
    if (target === 'formation') {
      if (etat?.course?.id) {
        params.set('editFormationId', etat.course.id);
      }
      navigate(`/studio/formation?${params.toString()}`);
      return;
    }
    navigate(`/studio/live?${params.toString()}`);
  };

  const flash = (k, t) => { setMsg({ k, t }); setTimeout(() => setMsg(null), 7000); };

  const chooseSourceFile = async (file) => {
    if (!file) return;
    const isRawMedia = /^(audio|video)\//.test(file.type || '');
    if (isRawMedia) {
      flash('err', 'Le média brut passe d’abord par Import vidéo/audio du Studio pour être transcrit. Ici, dépose sa transcription .txt, .srt ou .vtt.');
      return;
    }
    setBusy('extract-source');
    try {
      const text = await extractTextFromFile(file);
      if (text.length < 200) throw new Error('Le fichier ne contient pas assez de texte exploitable.');
      setSourceDraft({ title: file.name.replace(/\.[^.]+$/, ''), text, url: '', fileName: file.name, mimeType: file.type || 'text/plain' });
      flash('ok', `${file.name} extrait localement · ${text.length.toLocaleString('fr-FR')} caractères prêts.`);
    } catch (error) {
      flash('err', error?.message || 'Extraction du fichier impossible.');
    }
    setBusy('');
  };

  const ingestSource = async () => {
    if (!INGEST_TYPES.has(type) || (type === 'url' ? !sourceDraft.url.trim() : sourceDraft.text.trim().length < 200)) return;
    setBusy('ingest-source');
    try {
      const created = await masterFactoryApi.ingestSource({
        sourceType: type,
        title: sourceDraft.title || undefined,
        contentText: sourceDraft.text,
        sourceUrl: type === 'url' ? sourceDraft.url.trim() : undefined,
        mimeType: sourceDraft.mimeType || undefined,
        metadata: sourceDraft.fileName ? { original_filename: sourceDraft.fileName, extractor: 'liri-atelier-browser' } : { extractor: 'manual' },
      });
      const source = created?.data || created;
      setSourceDraft({ title: '', text: '', url: '', fileName: '', mimeType: '' });
      await load(type);
      await openSource(source);
      flash('ok', 'Source enregistrée et normalisée. Elle peut maintenant alimenter tous les moteurs Master Factory.');
    } catch (error) {
      flash('err', error?.message || 'Import de la source impossible.');
    }
    setBusy('');
  };

  const run = async (action) => {
    if (!sel) return;
    setBusy(action.key);
    try {
      const r = await masterFactoryApi[action.call]({ sourceType: type, sourceId: sel.id });
      const job = r?.job || r;
      flash('ok', job?.id
        ? `Demande enregistrée — le travail se poursuit en arrière-plan (${action.label}).`
        : `${action.label} : produit.`);
      setEtat(await masterFactoryApi.status(type, sel.id));
    } catch (e) {
      flash('err', e?.message || 'Action impossible.');
    }
    setBusy('');
  };

  const comprendre = async () => {
    if (!sel) return;
    setBusy('understand');
    try {
      const r = await masterFactoryApi.understand({ sourceType: type, sourceId: sel.id });
      const c = r?.comprehension || r;
      flash('ok', r?.cached
        ? 'Déjà compris — aucun jeton dépensé.'
        : `Compris : ${c?.notions?.length ?? '?'} notion(s) extraites.`);
      setEtat(await masterFactoryApi.status(type, sel.id));
    } catch (e) { flash('err', e?.message || 'Analyse impossible.'); }
    setBusy('');
  };

  const pdf = async () => {
    if (!sel) return;
    setBusy('pdf');
    try {
      const course = await masterFactoryApi.renderPdf({ sourceType: type, sourceId: sel.id });
      await exportCoursePdf(course?.data ?? course, { schoolName: '' });
      flash('ok', 'PDF produit depuis le pivot — aucun appel IA.');
    } catch (e) { flash('err', e?.message || 'PDF indisponible.'); }
    setBusy('');
  };

  const manual = async () => {
    if (!sel) return;
    setBusy('manual');
    try {
      const result = await masterFactoryApi.renderManual({ sourceType: type, sourceId: sel.id });
      const value = result?.data || result;
      const blob = new Blob([value.markdown || ''], { type: 'text/markdown;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${String(value.title || sel.title || 'manuel').replace(/[^a-z0-9à-ÿ]+/gi, '-').replace(/^-|-$/g, '')}.md`;
      link.click();
      URL.revokeObjectURL(link.href);
      flash('ok', 'Manuel Markdown produit depuis le pivot — aucun appel IA.');
    } catch (error) { flash('err', error?.message || 'Manuel indisponible.'); }
    setBusy('');
  };

  const precepteur = async () => {
    if (!sel) return;
    setBusy('precepteur');
    try {
      const result = await masterFactoryApi.renderPrecepteur({ sourceType: type, sourceId: sel.id });
      const value = result?.data || result;
      setPrecepteurCourse(value.course || value);
      setEtat(await masterFactoryApi.status(type, sel.id));
      flash('ok', value.cached ? 'Précepteur déjà prêt — rendu réutilisé.' : 'Précepteur construit et mémorisé sans nouvel appel IA.');
    } catch (error) { flash('err', error?.message || 'Précepteur indisponible.'); }
    setBusy('');
  };

  const extractCourse = async () => {
    if (!sel) return;
    setBusy('extract-course');
    setExtractedCourse(null);
    try {
      let course = await masterFactoryApi.renderPdf({ sourceType: type, sourceId: sel.id });
      course = course?.data ?? course;
      if (!course?.modules?.length) throw new Error('Aucun cours exploitable extrait.');
      setExtractedCourse(course);
      const nbLessons = course.modules.reduce((n, mod) => n + (mod.lessons?.length || 0), 0);
      flash('ok', `Rendu du pivot prêt : ${course.modules.length} module(s), ${nbLessons} leçon(s) · aucune seconde analyse IA.`);
    } catch (e) {
      flash('err', e?.message || 'Extraction du cours impossible.');
    }
    setBusy('');
  };

  const sendExtractedCourseToMasterclassFactory = () => {
    if (!sel || !etat?.ecrit) return;
    // Le Studio Masterclass vit sur une route produit partagée (sans `/t/:slug`).
    // On transporte donc explicitement le tenant, comme pour les ponts Formation
    // et Live ci-dessus. Sans ce paramètre, un nouvel onglet / un localhost sans
    // tenant en cache appelle l'API sans `X-Tenant-Slug` et perd le cours extrait.
    const tenantSlug = authStore.getTenantSlug?.() || 'isna';
    const params = new URLSearchParams({
      from: 'liri-atelier',
      tenant: tenantSlug,
      mfSourceType: type,
      mfSourceId: sel.id,
    });
    if (urlParams.get('preview') === '1') params.set('preview', '1');
    navigate(`/dashboard/tools/masterclass-factory?${params.toString()}`);
  };

  const filtered = useMemo(() => {
    const list = Array.isArray(sources) ? sources : [];
    const term = q.trim().toLowerCase();
    const base = term ? list.filter((s) => String(s.title || '').toLowerCase().includes(term)) : list;
    // Les plus riches d'abord : c'est la matière qui fait la profondeur du cours.
    return [...base].sort((a, b) => (b.chars || 0) - (a.chars || 0));
  }, [sources, q]);

  const pret = (s) => s.ready !== false;
  const gratuits = etat && etat !== 'loading' ? (etat.rendusGratuits || []) : [];

  const btn = (active) => ({
    display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 10, padding: '9px 13px',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
    background: active ? C.coral : 'rgba(245,244,238,.10)', color: active ? '#fff' : C.ink,
  });

  return (
    <div style={{ minHeight: 'calc(100vh - 120px)', background: C.base, color: C.ink, padding: '18px 20px 48px', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 700 }}>Atelier de cours</h1>
      <p style={{ margin: '0 0 18px', fontSize: 13.5, color: C.muted, maxWidth: 720, lineHeight: 1.6 }}>
        Toutes tes sources au même endroit. Comprendre une source coûte des jetons —
        une fois faite, l'analyse est réutilisée pour tous les rendus, sans surcoût.
      </p>

      {msg && (
        <div style={{
          marginBottom: 14, padding: '10px 14px', borderRadius: 10, fontSize: 13,
          background: msg.k === 'ok' ? 'rgba(122,181,122,.12)' : 'rgba(224,151,106,.12)',
          border: `1px solid ${msg.k === 'ok' ? 'rgba(122,181,122,.4)' : 'rgba(224,151,106,.4)'}`,
          color: msg.k === 'ok' ? C.ok : C.warn,
        }}>{msg.t}</div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {TYPES.map((t) => (
          <button key={t.key} type="button" onClick={() => setType(t.key)} style={btn(type === t.key)}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: 10, color: C.faint }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…"
            style={{ borderRadius: 10, border: `1px solid ${C.line}`, background: C.panel, color: C.ink, padding: '9px 12px 9px 32px', fontSize: 13, width: 220 }} />
        </div>
        <button type="button" onClick={() => load(type)} style={btn(false)} title="Recharger">
          <RefreshCw size={15} />
        </button>
      </div>

      <style>{`@media (max-width: 980px){.mf-atelier-grid{grid-template-columns:1fr!important}.mf-action-panel{position:static!important}}`}</style>
      <div className="mf-atelier-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(380px, 440px)', gap: 18, alignItems: 'start' }}>
        {/* ── Sources ── */}
        <div style={{ display: 'grid', gap: 12 }}>
          {INGEST_TYPES.has(type) && (
            <section style={{ background: C.panel, borderRadius: 14, border: `1px solid ${C.line}`, padding: 15 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', marginBottom: 10 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 750 }}>Ajouter une source</p>
                  <p style={{ margin: '4px 0 0', color: C.muted, fontSize: 11.5, lineHeight: 1.45 }}>
                    {type === 'url' ? 'Colle un lien public : Liri extrait le texte, bloque les réseaux privés et conserve la source.' : ['audio', 'video'].includes(type)
                      ? 'Colle la transcription ou dépose un fichier de sous-titres. Le média brut se transcrit dans le Studio.'
                      : 'Dépose un PDF, Word ou texte : l’extraction reste locale, puis seul le texte utile est enregistré.'}
                  </p>
                </div>
                <button type="button" onClick={() => importInputRef.current?.click()} style={btn(false)} disabled={!!busy}>
                  {busy === 'extract-source' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Fichier
                </button>
                <input ref={importInputRef} type="file" hidden accept=".pdf,.docx,.txt,.md,.srt,.vtt,text/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => chooseSourceFile(event.target.files?.[0])} />
              </div>
              {type === 'url' && <input value={sourceDraft.url} onChange={(event) => setSourceDraft((prev) => ({ ...prev, url: event.target.value }))}
                placeholder="https://…"
                style={{ width: '100%', boxSizing: 'border-box', borderRadius: 9, border: `1px solid ${C.line}`, background: C.panel2, color: C.ink, padding: '9px 11px', fontSize: 12.5, marginBottom: 8 }} />}
              <input value={sourceDraft.title} onChange={(event) => setSourceDraft((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Titre de la source"
                style={{ width: '100%', boxSizing: 'border-box', borderRadius: 9, border: `1px solid ${C.line}`, background: C.panel2, color: C.ink, padding: '9px 11px', fontSize: 12.5, marginBottom: 8 }} />
              {type !== 'url' && <textarea value={sourceDraft.text} onChange={(event) => setSourceDraft((prev) => ({ ...prev, text: event.target.value }))}
                placeholder={['audio', 'video'].includes(type) ? 'Colle ici la transcription…' : 'Colle ici le contenu, ou choisis un fichier…'}
                style={{ width: '100%', minHeight: 104, resize: 'vertical', boxSizing: 'border-box', borderRadius: 9, border: `1px solid ${C.line}`, background: C.panel2, color: C.ink, padding: '10px 11px', fontSize: 12.5, lineHeight: 1.5 }} />}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginTop: 9 }}>
                <span style={{ color: type === 'url' ? (sourceDraft.url ? C.ok : C.faint) : sourceDraft.text.length >= 200 ? C.ok : C.faint, fontSize: 11.5 }}>
                  {type === 'url' ? (sourceDraft.url ? 'Lien prêt à extraire' : 'Lien public requis') : `${sourceDraft.text.length.toLocaleString('fr-FR')} / 200 caractères minimum`}
                </span>
                <button type="button" onClick={ingestSource} disabled={!!busy || (type === 'url' ? !sourceDraft.url.trim() : sourceDraft.text.trim().length < 200)}
                  style={{ ...btn(true), opacity: busy || (type === 'url' ? !sourceDraft.url.trim() : sourceDraft.text.trim().length < 200) ? 0.45 : 1 }}>
                  {busy === 'ingest-source' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Envoyer au moteur
                </button>
              </div>
            </section>
          )}
          <div style={{ background: C.panel, borderRadius: 14, border: `1px solid ${C.line}`, overflow: 'hidden' }}>
          {sources === null ? (
            <p style={{ padding: 22, color: C.muted, fontSize: 13 }}>Chargement…</p>
          ) : !filtered.length ? (
            <p style={{ padding: 22, color: C.muted, fontSize: 13 }}>Aucune source de ce type.</p>
          ) : (
            <>
              <div style={{ padding: '10px 14px', fontSize: 12, color: C.faint, borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 140 }}>{filtered.length} source(s) · triées par richesse</span>
                <button type="button" onClick={() => setPicked(new Set(filtered.filter(pret).map((s) => s.id)))}
                  style={{ background: 'none', border: 'none', color: C.muted, fontSize: 11.5, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                  tout cocher
                </button>
                {picked.size > 0 && (
                  <button type="button" onClick={() => setPicked(new Set())}
                    style={{ background: 'none', border: 'none', color: C.muted, fontSize: 11.5, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                    décocher
                  </button>
                )}
              </div>

              <div style={{ maxHeight: '62vh', overflowY: 'auto' }}>
                {filtered.map((s) => {
                  const on = sel?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      data-source-id={s.id}
                      onClick={() => openSource(s)}
                      onDoubleClick={() => openInStudio('live', s)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
                        padding: '11px 14px', border: 'none', borderBottom: `1px solid ${C.line}`,
                        background: on ? 'linear-gradient(90deg, rgba(217,119,87,.24), rgba(217,119,87,.08))' : 'transparent',
                        color: C.ink, cursor: 'pointer',
                        boxShadow: on ? 'inset 3px 0 0 #d97757' : 'none',
                      }}>
                      <span
                        role="checkbox"
                        aria-checked={picked.has(s.id)}
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); togglePick(s.id); }}
                        onKeyDown={(e) => { if (e.key === ' ') { e.preventDefault(); e.stopPropagation(); togglePick(s.id); } }}
                        title="Sélectionner pour un traitement en lot"
                        style={{
                          width: 15, height: 15, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
                          border: `1.5px solid ${picked.has(s.id) ? C.coral : 'rgba(245,244,238,.28)'}`,
                          background: picked.has(s.id) ? C.coral : 'transparent',
                          display: 'grid', placeItems: 'center',
                        }}>
                        {picked.has(s.id) && <Check size={10} color="#fff" />}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.title || <em style={{ color: C.faint }}>sans titre</em>}
                      </span>
                      {typeof s.chars === 'number' && s.chars > 0 && (
                        <span style={{ fontSize: 11.5, color: s.chars >= 10000 ? C.coral : C.faint, fontWeight: s.chars >= 10000 ? 700 : 400 }}>
                          {(s.chars / 1000).toFixed(1)}k
                        </span>
                      )}
                      {on && (
                        <span style={{ fontSize: 10, color: C.coral, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                          ouverte
                        </span>
                      )}
                      {!pret(s) && <AlertTriangle size={14} style={{ color: C.warn }} title="Pas de transcription" />}
                    </button>
                  );
                })}
              </div>

            </>
          )}
          </div>
        </div>

        {/* ── Panneau d'action ── */}
        <div className="mf-action-panel" style={{ background: C.panel, borderRadius: 14, border: `1px solid ${sel ? 'rgba(217,119,87,.36)' : C.line}`, padding: 16, position: 'sticky', top: 16, boxShadow: sel ? '0 20px 55px rgba(0,0,0,.25)' : 'none' }}>
          {!sel ? (
            <div>
              <p style={{ color: C.ink, fontSize: 15, fontWeight: 750, margin: '0 0 7px' }}>Choisis une source</p>
              <p style={{ color: C.muted, fontSize: 13, margin: 0, lineHeight: 1.55 }}>
                Le panneau se transforme en poste Master Factory : extraction, cours,
                SmartBoard, live, PDF et ouverture directe dans le Studio.
              </p>
            </div>
          ) : (
            <>
              <div style={{
                margin: '-2px 0 14px', padding: '10px 12px', borderRadius: 12,
                background: 'rgba(217,119,87,.12)', border: '1px solid rgba(217,119,87,.25)',
              }}>
                <p style={{ margin: '0 0 4px', color: C.coral, fontSize: 10.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: '.12em' }}>
                  Source ouverte · Master Factory
                </p>
                <p style={{ margin: 0, color: C.ink, fontSize: 12.5, lineHeight: 1.45 }}>
                  Cette source devient le fond commun : une seule compréhension, puis plusieurs rendus.
                </p>
              </div>
              <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, lineHeight: 1.35 }}>
                {sel.title || 'Sans titre'}
              </p>
              <p style={{ margin: '0 0 14px', fontSize: 12, color: C.faint }}>
                {sel.chars ? `${sel.chars.toLocaleString('fr-FR')} caractères de matière` : 'Transcription absente'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 7, marginBottom: 10 }}>
                {[
                  ['Comprendre', etat?.comprehension],
                  ['Écrire', etat?.ecrit],
                  ['Parcours', Boolean(etat?.course?.id)],
                  ['Live', etat?.live_scenario],
                ].map(([label, ok]) => (
                  <div key={label} style={{ borderRadius: 10, padding: '9px 8px', background: ok ? 'rgba(122,181,122,.10)' : 'rgba(245,244,238,.06)', border: `1px solid ${ok ? 'rgba(122,181,122,.35)' : C.line}` }}>
                    <p style={{ margin: 0, fontSize: 10, color: C.faint, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: ok ? C.ok : C.muted, fontWeight: 750 }}>{ok ? 'Prêt' : etat === 'loading' ? 'Lecture…' : 'À faire'}</p>
                  </div>
                ))}
              </div>
              {etat?.course?.id && (
                <div style={{
                  marginBottom: 14, padding: '8px 10px', borderRadius: 9,
                  color: C.ok, background: 'rgba(122,181,122,.08)',
                  border: '1px solid rgba(122,181,122,.25)', fontSize: 10.5,
                  lineHeight: 1.5, overflowWrap: 'anywhere',
                }}>
                  Traçabilité vérifiée · pivot {String(etat.course.pivotId || '—').slice(0, 8)} · cours {String(etat.course.id).slice(0, 8)}
                </div>
              )}

              {!pret(sel) ? (
                <p style={{ fontSize: 12.5, color: C.warn, lineHeight: 1.5 }}>
                  Cette source n'a pas de transcription : rien à comprendre pour l'instant.
                </p>
              ) : (
                <>
                  {/* Étape 1 — le FOND */}
                  <button type="button" onClick={comprendre} disabled={!!busy}
                    style={{ ...btn(!etat?.comprehension), width: '100%', justifyContent: 'center', marginBottom: 10, opacity: busy ? 0.6 : 1 }}>
                    {busy === 'understand' ? <Loader2 size={15} className="animate-spin" /> : etat?.comprehension ? <Check size={15} /> : <Sparkles size={15} />}
                    {etat?.comprehension ? 'Déjà compris' : 'Comprendre la source'}
                  </button>

                  {etat?.comprehension && (
                    <p style={{ fontSize: 11.5, color: C.ok, margin: '0 0 12px', lineHeight: 1.45 }}>
                      L'analyse est faite : les rendus ci-dessous la réutilisent sans nouveau coût.
                    </p>
                  )}
                  {etat === 'loading' && (
                    <p style={{ fontSize: 11.5, color: C.muted, margin: '0 0 12px', lineHeight: 1.45 }}>
                      Lecture des pivots existants… les actions restent disponibles dès que l'état revient.
                    </p>
                  )}

                  {/* Étape 2 — les FORMES */}
                  <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                    {ACTIONS.map((a) => {
                      // Un pivot écrit rend le PDF/manuel possibles, mais ne signifie
                      // pas que le parcours élève a déjà été publié par le worker.
                      const fait = etat && etat !== 'loading' && (a.key === 'course' ? Boolean(etat?.course?.id) : etat[a.needs]);
                      return (
                        <button key={a.key} type="button" onClick={() => run(a)} disabled={!!busy}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px', borderRadius: 10,
                            border: `1px solid ${fait ? 'rgba(122,181,122,.4)' : C.line}`,
                            background: fait ? 'rgba(122,181,122,.10)' : C.panel2,
                            color: C.ink, fontSize: 12.8, cursor: busy ? 'wait' : 'pointer', textAlign: 'left',
                          }}>
                          {busy === a.key ? <Loader2 size={14} className="animate-spin" /> : fait ? <Check size={14} style={{ color: C.ok }} /> : <a.icon size={14} />}
                          <span style={{ flex: 1 }}>{a.label}</span>
                          {fait && <span style={{ fontSize: 10.5, color: C.ok }}>prêt</span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* Rendu immédiat, sans IA */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
                    <button type="button" onClick={pdf} disabled={!!busy || !gratuits.includes('pdf')}
                      style={{ ...btn(false), justifyContent: 'center', opacity: gratuits.includes('pdf') ? 1 : 0.45 }} title="Rendu sans IA">
                      {busy === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />} PDF
                    </button>
                    <button type="button" onClick={manual} disabled={!!busy || !etat?.ecrit}
                      style={{ ...btn(false), justifyContent: 'center', opacity: etat?.ecrit ? 1 : 0.45 }} title="Rendu sans IA">
                      {busy === 'manual' ? <Loader2 size={15} className="animate-spin" /> : <BookOpen size={15} />} Manuel
                    </button>
                    <button type="button" onClick={precepteur} disabled={!!busy || !etat?.ecrit}
                      style={{ ...btn(Boolean(etat?.joue)), justifyContent: 'center', opacity: etat?.ecrit ? 1 : 0.45 }} title="Rendu joué sans IA">
                      {busy === 'precepteur' ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Précepteur
                    </button>
                  </div>

                  {precepteurCourse?.concepts?.length ? (
                    <div style={{ marginTop: 10, padding: 11, borderRadius: 10, background: 'rgba(217,119,87,.10)', border: '1px solid rgba(217,119,87,.28)' }}>
                      <p style={{ margin: 0, color: C.coral, fontSize: 10.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: '.1em' }}>Précepteur jouable</p>
                      <p style={{ margin: '5px 0 0', fontSize: 12.5, color: C.ink }}>{precepteurCourse.concepts.length} concept(s) · {precepteurCourse.concepts.reduce((total, concept) => total + (concept.scenes?.length || 0), 0)} scène(s)</p>
                    </div>
                  ) : null}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                    <button type="button" onClick={extractCourse} disabled={!!busy || !etat?.ecrit}
                      style={{
                        ...btn(false), justifyContent: 'center',
                        opacity: etat?.ecrit ? 1 : 0.45,
                        cursor: busy ? 'wait' : etat?.ecrit ? 'pointer' : 'not-allowed',
                      }}>
                      {busy === 'extract-course' ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />}
                      Voir le cours extrait
                    </button>
                    <button type="button" onClick={sendExtractedCourseToMasterclassFactory} disabled={!etat?.ecrit || !!busy}
                      style={{ ...btn(Boolean(etat?.ecrit)), justifyContent: 'center', opacity: etat?.ecrit ? 1 : 0.45 }}>
                      <ArrowUpRight size={14} /> Éditer dans Masterclass Factory
                    </button>
                  </div>

                  {extractedCourse ? (
                    <div style={{
                      marginTop: 12, borderRadius: 12, border: `1px solid rgba(122,181,122,.30)`,
                      background: 'rgba(122,181,122,.08)', padding: 12,
                    }}>
                      <p style={{ margin: '0 0 4px', color: C.ok, fontSize: 10.5, fontWeight: 850, textTransform: 'uppercase', letterSpacing: '.12em' }}>
                        Rendu extrait · prêt à envoyer
                      </p>
                      <p style={{ margin: '0 0 8px', color: C.ink, fontSize: 13, fontWeight: 750 }}>
                        {extractedCourse.title || sel.title}
                      </p>
                      <div style={{ display: 'grid', gap: 7, maxHeight: 185, overflowY: 'auto', paddingRight: 4 }}>
                        {(extractedCourse.modules || []).slice(0, 4).map((mod, idx) => (
                          <div key={`${mod.title}-${idx}`} style={{ borderRadius: 10, background: 'rgba(0,0,0,.16)', padding: '8px 10px' }}>
                            <p style={{ margin: 0, color: C.ink, fontSize: 12.5, fontWeight: 750 }}>{mod.title || `Module ${idx + 1}`}</p>
                            <p style={{ margin: '4px 0 0', color: C.muted, fontSize: 11.5 }}>
                              {(mod.lessons || []).length} leçon(s)
                              {(mod.lessons || [])[0]?.title ? ` · ${(mod.lessons || [])[0].title}` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                    <button type="button" onClick={() => openInStudio('live')} style={{ ...btn(false), justifyContent: 'center' }}>
                      <ArrowUpRight size={14} /> Live Studio
                    </button>
                    <button type="button" onClick={() => openInStudio('formation')} style={{ ...btn(false), justifyContent: 'center' }}>
                      <ArrowUpRight size={14} /> Formation
                    </button>
                  </div>

                  <p style={{ fontSize: 11, color: C.faint, margin: '12px 0 0', lineHeight: 1.5 }}>
                    Un cours complet demande une quinzaine de minutes : le travail se poursuit
                    en arrière-plan, tu peux fermer cet écran.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Barre de lot ────────────────────────────────────────────────────
          Ancrée en bas de l'écran, hors du flux : cocher une case ne décale
          aucune ligne (le deuxième clic tombait sinon sur la mauvaise source,
          vu en test) et l'action reste atteignable sans faire défiler 62 lignes.
          Elle n'apparaît que si quelque chose est coché. */}
      {picked.size > 0 && (
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40,
          padding: '11px 18px', borderTop: '1px solid rgba(217,119,87,.35)',
          background: '#33241d', boxShadow: '0 -12px 34px rgba(0,0,0,.4)',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{ color: C.ink, fontSize: 13, fontWeight: 750, flex: 1, minWidth: 150 }}>
            {lot.running
              ? `Envoi en cours… ${lot.done}/${lot.total}`
              : `${picked.size} source(s) cochée(s)`}
          </span>
          <span style={{ color: C.muted, fontSize: 11.5, lineHeight: 1.4, flex: '2 1 320px', minWidth: 220 }}>
            « Produire les cours » met en file et rend la main tout de suite : le worker
            comprend puis rédige, même onglet fermé. « Comprendre seulement » travaille
            source par source et exige que cet onglet reste ouvert.
          </span>
          <button type="button" onClick={() => setPicked(new Set())} disabled={lot.running}
            style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
            annuler
          </button>
          <button type="button" onClick={() => runLot('understand')} disabled={lot.running}
            style={{ ...btn(false), opacity: lot.running ? 0.5 : 1 }}>
            <Sparkles size={14} /> Comprendre seulement
          </button>
          <button type="button" onClick={() => runLot('course')} disabled={lot.running}
            style={{ ...btn(true), opacity: lot.running ? 0.5 : 1 }}>
            {lot.running ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />} Produire les cours
          </button>
        </div>
      )}
    </div>
  );
}
