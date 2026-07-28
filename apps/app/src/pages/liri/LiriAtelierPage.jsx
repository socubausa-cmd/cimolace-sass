import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Film, Music2, FileText, Type, Sparkles, BookOpen, Presentation, Radio,
  FileDown, Loader2, Check, AlertTriangle, RefreshCw, Search, ArrowUpRight,
} from 'lucide-react';
import { masterFactoryApi, masterclassApi } from '@/lib/api-v2';
import { authStore } from '@/lib/auth-store';
import { exportCoursePdf } from '@/lib/exportCoursePdf';

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
  { key: 'tiktok', label: 'TikTok', icon: Music2 },
  { key: 'document', label: 'Documents', icon: FileText },
  { key: 'texte', label: 'Texte', icon: Type },
];

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
      navigate(`/studio/formation?${params.toString()}`);
      return;
    }
    navigate(`/studio/live?${params.toString()}`);
  };

  const flash = (k, t) => { setMsg({ k, t }); setTimeout(() => setMsg(null), 7000); };

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

  const courseToMasterFactoryText = (course) => {
    if (!course) return '';
    const lines = [
      `# ${course.title || 'Cours extrait'}`,
      course.subtitle ? `\n${course.subtitle}` : '',
      course.summary ? `\n## Résumé\n${course.summary}` : '',
      Array.isArray(course.objectives) && course.objectives.length
        ? `\n## Objectifs\n${course.objectives.map((o) => `- ${o}`).join('\n')}`
        : '',
    ].filter(Boolean);
    (course.modules || []).forEach((mod, mIdx) => {
      lines.push(`\n## Module ${mIdx + 1} — ${mod.title || 'Module'}`);
      if (mod.description) lines.push(mod.description);
      (mod.lessons || []).forEach((lesson, lIdx) => {
        lines.push(`\n### Leçon ${mIdx + 1}.${lIdx + 1} — ${lesson.title || 'Leçon'}`);
        if (lesson.content) lines.push(lesson.content);
        if (Array.isArray(lesson.key_points) && lesson.key_points.length) {
          lines.push('\nPoints clés :');
          lines.push(lesson.key_points.map((p) => `- ${p}`).join('\n'));
        }
      });
    });
    if (Array.isArray(course.glossary) && course.glossary.length) {
      lines.push('\n## Glossaire');
      lines.push(course.glossary.map((g) => `- ${g.term} : ${g.definition}`).join('\n'));
    }
    return lines.join('\n').trim();
  };

  const extractCourse = async () => {
    if (!sel) return;
    setBusy('extract-course');
    setExtractedCourse(null);
    try {
      let course = null;
      let source = 'masterclass';
      if (type === 'replay') {
        try {
          course = await masterclassApi.fromReplay(sel.id);
        } catch (e) {
          // Le replay direct peut échouer si la transcription est trop bruitée ou
          // si le fournisseur IA est indisponible. Dans ce cas, on ne bloque pas
          // le tunnel : Master Factory sait déjà rendre un cours depuis le pivot
          // écrit existant, sans nouvel appel modèle.
          source = 'pivot';
          course = await masterFactoryApi.renderPdf({ sourceType: type, sourceId: sel.id });
          course = course?.data ?? course;
        }
      } else {
        source = 'pivot';
        course = await masterFactoryApi.renderPdf({ sourceType: type, sourceId: sel.id });
        course = course?.data ?? course;
      }
      if (!course?.modules?.length) throw new Error('Aucun cours exploitable extrait.');
      setExtractedCourse(course);
      const nbLessons = course.modules.reduce((n, mod) => n + (mod.lessons?.length || 0), 0);
      flash('ok', `Rendu extrait prêt : ${course.modules.length} module(s), ${nbLessons} leçon(s)${source === 'pivot' ? ' · depuis le pivot Master Factory' : ''}.`);
    } catch (e) {
      flash('err', e?.message || 'Extraction du cours impossible.');
    }
    setBusy('');
  };

  const sendExtractedCourseToMasterclassFactory = () => {
    if (!extractedCourse) return;
    const text = courseToMasterFactoryText(extractedCourse);
    if (!text.trim()) {
      flash('err', 'Le rendu extrait est vide.');
      return;
    }
    try {
      window.localStorage.setItem('masterclass:prefillRawText', text.slice(0, 40000));
      window.localStorage.setItem('masterclass:prefillSourceTitle', extractedCourse.title || sel?.title || 'Cours extrait');
    } catch {
      flash('err', "Impossible d'envoyer le rendu au Masterclass Factory : stockage local indisponible.");
      return;
    }
    const params = new URLSearchParams({ step: '0', from: 'liri-atelier' });
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

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(380px, 440px)', gap: 18, alignItems: 'start' }}>
        {/* ── Sources ── */}
        <div style={{ background: C.panel, borderRadius: 14, border: `1px solid ${C.line}`, overflow: 'hidden' }}>
          {sources === null ? (
            <p style={{ padding: 22, color: C.muted, fontSize: 13 }}>Chargement…</p>
          ) : !filtered.length ? (
            <p style={{ padding: 22, color: C.muted, fontSize: 13 }}>Aucune source de ce type.</p>
          ) : (
            <>
              <div style={{ padding: '10px 14px', fontSize: 12, color: C.faint, borderBottom: `1px solid ${C.line}` }}>
                {filtered.length} source(s) · triées par richesse
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

        {/* ── Panneau d'action ── */}
        <div style={{ background: C.panel, borderRadius: 14, border: `1px solid ${sel ? 'rgba(217,119,87,.36)' : C.line}`, padding: 16, position: 'sticky', top: 16, boxShadow: sel ? '0 20px 55px rgba(0,0,0,.25)' : 'none' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 7, marginBottom: 14 }}>
                {[
                  ['Comprendre', etat?.comprehension],
                  ['Écrire', etat?.ecrit],
                  ['Live', etat?.live_scenario],
                ].map(([label, ok]) => (
                  <div key={label} style={{ borderRadius: 10, padding: '9px 8px', background: ok ? 'rgba(122,181,122,.10)' : 'rgba(245,244,238,.06)', border: `1px solid ${ok ? 'rgba(122,181,122,.35)' : C.line}` }}>
                    <p style={{ margin: 0, fontSize: 10, color: C.faint, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: ok ? C.ok : C.muted, fontWeight: 750 }}>{ok ? 'Prêt' : etat === 'loading' ? 'Lecture…' : 'À faire'}</p>
                  </div>
                ))}
              </div>

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
                      const fait = etat && etat !== 'loading' && etat[a.needs];
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
                  <button type="button" onClick={pdf} disabled={!!busy || !gratuits.includes('pdf')}
                    style={{
                      ...btn(false), width: '100%', justifyContent: 'center',
                      opacity: gratuits.includes('pdf') ? 1 : 0.45, cursor: gratuits.includes('pdf') ? 'pointer' : 'not-allowed',
                    }}
                    title={gratuits.includes('pdf') ? 'Aucun appel IA' : "Le cours écrit n'existe pas encore"}>
                    {busy === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
                    PDF {gratuits.includes('pdf') && <span style={{ fontSize: 10.5, color: C.ok }}>· gratuit</span>}
                  </button>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                    <button type="button" onClick={extractCourse} disabled={!!busy || type !== 'replay'}
                      style={{
                        ...btn(false), justifyContent: 'center',
                        opacity: type === 'replay' ? 1 : 0.45,
                        cursor: busy ? 'wait' : type === 'replay' ? 'pointer' : 'not-allowed',
                      }}>
                      {busy === 'extract-course' ? <Loader2 size={14} className="animate-spin" /> : <BookOpen size={14} />}
                      Voir le cours extrait
                    </button>
                    <button type="button" onClick={sendExtractedCourseToMasterclassFactory} disabled={!extractedCourse || !!busy}
                      style={{ ...btn(Boolean(extractedCourse)), justifyContent: 'center', opacity: extractedCourse ? 1 : 0.45 }}>
                      <ArrowUpRight size={14} /> Envoyer au Masterclass Factory
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
    </div>
  );
}
