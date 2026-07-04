/**
 * useMasterclassProject — Pipeline LIRI séquentiel en 4 étapes indépendantes
 *
 * Flux : Source → [Analyse] → [Blocs de sens] → [Chapitres] → [Pédagogie] → Slides → Script → Export
 *
 * Cahier des charges — ne pas confondre :
 * - **Blocs de sens** : découpage du texte brut (unités thématiques), via `splitIntoBlocks` / `buildSenseBlocks`.
 * - **Chapitres** : niveau pédagogique — soit sortie `liri-masterclass-factory` (3–7 chapitres × 21/26 segments),
 *   soit regroupement des blocs de sens (`buildChaptersFromSenseBlocks`) si la factory échoue.
 * Chaque étape est lancée manuellement, a son propre appel IA,
 * et produit un rapport consultable avant de passer à la suivante.
 *
 * Spec détaillée (analyse → blocs sémantiques → chapitres par sujet → segments) :
 * `docs/LIRI_MASTERCLASS_BLOCS_CHAPITRES_CAHIER_DES_CHARGES.md`
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { resolveApiOrigin } from '@/lib/androidApiHost';
import { supabase } from '@/lib/supabase';
import {
  validateStructuredDocument,
  buildSenseBlocksFromStructure,
  buildChaptersFromStructuredTopics,
  computeTextStats,
} from '@/lib/masterclassStructuredDocument';

// Normalise les noms de segments factory V2 → noms canoniques SmartboardStreamingV2
const FACTORY_TO_STREAMING_NAMES = {
  'Prérequis & Nouveau':    'Connaissance',
  'Tension cognitive':      'Tension',
  'Défi sans leçon':        'Expérience de pensée',
  'Recueil des erreurs':    'Erreurs attendues',
  'Leçon courte':           'Leçon simple',
  'Exemples concrets':      'Exemples',
  'Reformulation simple':   'Reformulation',
  'Atelier débat':          'Atelier',
  'Correction guidée':      'Correction',
  'Métacognition':          'JE RETIENS',
  'Test de compréhension':  'Test',
  "Défi d'application":     'Cas réel',
  'Boucle de remédiation':  'Lien conceptuel',
  'Cas réel / Témoignage':  'Cas réel',
  'Transition narrative':   'Transition',
};
const normalizeSegName = (name) => FACTORY_TO_STREAMING_NAMES[name] ?? name;

export const MASTERCLASS_STEPS = [
  { key: 'raw',       label: 'Contenu brut'        },
  { key: 'analyse',   label: 'Analyse'              },
  { key: 'blocs',     label: 'Blocs de sens'       },
  { key: 'chapitres', label: 'Chapitres'            },
  { key: 'pedagogie', label: 'Pédagogie'            },
  { key: 'slides',    label: 'Slides'               },
  { key: 'script',    label: 'Script'               },
  { key: 'export',    label: 'Export'               },
];

export const MAX_RAW_CHARS = 40000;

/** Première fenêtre d'analyse structurée (aligné sur `liri-masterclass-document-analyze`). */
export const DOCUMENT_ANALYZE_FIRST_WINDOW_CHARS = 26_000;

// ─── Texte démo (cours LIRI modèle) ──────────────────────────────────────────
const DEMO_TEXT = `La nuit porte conseil — Le secret du Katiokenie

C'est avec raison que les sages disent que la nuit porte conseil. Le mot "conseil" dans cette expression est le même code que celui qui désigne le Saint-Esprit comme Consolateur et Esprit de conseil, qui conduit dans toute la vérité.

Le conseiller ne vit pas dans le jour car le jour ne porte pas conseil. C'est la nuit que se prépare la sagesse. L'Esprit Saint habite la nuit — le monde du milieu, le Katiokenie.

L'injonction "entre dans ta chambre, ferme la porte" signifie : entre dans la somnolence, déconnecte-toi du monde de l'éveil, traverse le seuil vers le monde des songes — le monde du milieu. À ce niveau tu te trouves dans le firmament qui sépare les eaux d'en haut et les eaux d'en bas.

Dans cet état intermédiaire entre veille et sommeil profond, tu es né d'eau et tu hérites le témoignage de l'âme. Tu voyages dans le monde des eaux, qui est le monde des ancêtres.

Le secret est la somnolence : c'est le pouvoir de la nuit. C'est là que réside la véritable puissance spirituelle et la connexion au divin.`;

// ─── Phases pédagogiques LIRI ─────────────────────────────────────────────────
export const LIRI_PHASES = [
  { id: 'ouverture',            label: 'Ouverture',              color: '#D4AF37' },
  { id: 'interaction_eleves',   label: 'Interaction élèves',     color: '#f59e0b' },
  { id: 'limites_refutation',   label: 'Limites & réfutation',   color: '#f43f5e' },
  { id: 'introduction_cours',   label: 'Introduction du cours',  color: '#a78bfa' },
  { id: 'historicite',          label: 'Historicité',            color: '#38bdf8' },
  { id: 'definition',           label: 'Définition',             color: '#34d399' },
  { id: 'demonstration',        label: 'Démonstration',          color: '#fb923c' },
  { id: 'exemples',             label: 'Exemples',               color: '#a3e635' },
  { id: 'conclusion_doctrinale',label: 'Conclusion doctrinale',  color: '#c084fc' },
  { id: 'ouverture_finale',     label: 'Ouverture finale',       color: '#D4AF37' },
];

const EMPTY_PROJECT = {
  rawText:         '',
  analysis:        null,
  blocks:          null,
  factoryChapters: null,   // chapitres bruts de liri-masterclass-factory (avec segments)
  chapters:        null,
  pedagogy:        null,
  slides:          null,
  scripts:         null,
  quality:         null,
  exports:         { downloadable: {} },
};

// ─── Nettoie le texte brut (supprime UI parasites) ───────────────────────────
function cleanRawText(text) {
  // Supprime lignes courtes qui ressemblent à des éléments UI
  const lines = text.split('\n');
  const clean = lines.filter(line => {
    const t = line.trim();
    if (t.length < 15) return false;
    if (/^(Chat|Studio|BETA|Today|Saturday|Sunday|Monday|\d source|👁|How does|Explain|What role)/i.test(t)) return false;
    if (/^(Audio Overview|Slide Deck|Video Overview|Mind Map|Reports|Flashcards|Quiz|Infographic|Data Table)/i.test(t)) return false;
    return true;
  });
  return clean.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ─── Segmentation intelligente du texte ──────────────────────────────────────
function splitIntoBlocks(text) {
  const cleaned = cleanRawText(text);
  // 1. Double saut de ligne
  let parts = cleaned.split(/\n{2,}/).map(s => s.trim()).filter(s => s.length > 60);
  if (parts.length >= 3) return parts;
  // 2. Point + majuscule
  parts = cleaned.split(/(?<=[.!?])\s+(?=[A-ZÀÂÉÈÊËÎÏÔÙÛÜ])/).map(s => s.trim()).filter(s => s.length > 80);
  if (parts.length >= 3) return parts;
  // 3. Virgule si texte compact
  parts = cleaned.split(/[,;]\s+(?=[A-ZÀÂÉÈÊËÎÏÔÙÛÜ])/).map(s => s.trim()).filter(s => s.length > 50);
  if (parts.length >= 3) return parts;
  // 4. Chunks de ~400 chars sur mot entier
  const words = cleaned.split(/\s+/);
  const chunks = [];
  let current = '';
  for (const w of words) {
    if ((current + ' ' + w).length > 400 && current.length > 100) {
      chunks.push(current.trim());
      current = w;
    } else current += ' ' + w;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(s => s.length > 60);
}

/**
 * Blocs de sens (cahier des charges) : unités extraites du texte brut, sans le moule LIRI 21/26.
 * Les chapitres sont un niveau au-dessus : parcours pédagogique (regroupement de blocs ou chapitres factory).
 */
function buildSenseBlocks(text) {
  const parts = splitIntoBlocks(text);
  const cleaned = cleanRawText(text);
  const safe = parts.length > 0 ? parts : (cleaned.length > 20 ? [cleaned] : []);
  return safe.map((content, i) => {
    const trimmed = content.trim();
    const firstLine = trimmed.split(/\n/)[0]?.replace(/^[#*_\s•-]+/, '').trim() || trimmed.slice(0, 72);
    const title = firstLine.slice(0, 88) || `Bloc de sens ${i + 1}`;
    return {
      id: `blk${i + 1}`,
      order: i,
      type: 'sense_block',
      title,
      central_idea: trimmed,
      core_claim: title,
      lines_label: `Unité ${i + 1} / ${safe.length}`,
      duration_minutes: Math.max(8, Math.min(25, Math.round(trimmed.length / 120))),
    };
  });
}

/** Regroupe des blocs de sens en 3–7 chapitres (arc pédagogique) avec `source_block_ids`. */
function buildChaptersFromSenseBlocks(senseBlocks) {
  const n = senseBlocks.length;
  if (n === 0) return [];
  let chapterCount;
  if (n === 1) chapterCount = 1;
  else if (n <= 3) chapterCount = Math.min(3, n);
  else if (n <= 6) chapterCount = 3;
  else if (n <= 10) chapterCount = 4;
  else if (n <= 16) chapterCount = 5;
  else chapterCount = Math.min(7, Math.ceil(n / 3));

  const blocksPerCh = Math.ceil(n / chapterCount);
  const chapters = [];
  for (let ci = 0, bi = 0; ci < chapterCount && bi < n; ci++) {
    const group = senseBlocks.slice(bi, bi + blocksPerCh);
    bi += group.length;
    if (!group.length) break;
    chapters.push({
      id: `ch${ci}`,
      order: ci,
      title: group[0].title.slice(0, 100),
      objective: group.map((g) => g.core_claim || g.title).filter(Boolean).join(' · ').slice(0, 220),
      summary: group.map((g) => g.central_idea).join('\n\n').slice(0, 280),
      duration: `${Math.max(15, group.length * 10)} min`,
      segments: [],
      source_block_ids: group.map((g) => g.id),
      content: group.map((g) => g.central_idea).join('\n\n').slice(0, 4000),
    });
  }
  return chapters;
}

function buildFallbackFactoryChaptersFromSenseBlocks(senseBlocks, segmentNames) {
  const grouped = buildChaptersFromSenseBlocks(senseBlocks);
  const target = grouped.length > 0 ? grouped : [{
    id: 'ch0',
    order: 0,
    title: 'Introduction',
    objective: senseBlocks[0]?.central_idea?.slice(0, 200) || 'Parcours issu du texte',
    source_block_ids: senseBlocks.map((b) => b.id),
    content: senseBlocks.map((b) => b.central_idea).join('\n\n'),
  }];
  return target.map((ch, ci) => {
    const merged = senseBlocks
      .filter((b) => (ch.source_block_ids || []).includes(b.id))
      .map((b) => b.central_idea)
      .join('\n\n') || ch.content || '';
    const chunkLen = Math.max(48, Math.ceil(Math.max(merged.length, 80) / segmentNames.length));
    return {
      id: ch.id || `ch${ci}`,
      order: ci,
      title: ch.title,
      objective: ch.objective,
      duration: ch.duration || '25 min',
      segments: segmentNames.map((name, si) => ({
        segment_id: si + 1,
        name,
        title: name,
        content: merged.slice(si * chunkLen, (si + 1) * chunkLen) || merged.slice(0, 120),
        key_points: [],
        oral_script: '',
        teacher_note: '',
        interaction: '',
      })),
    };
  });
}

/** Noms des 26 segments « Échec productif » — alignés sur `liriFailureBasedCourseModel.js` (fallback local uniquement). */
const FAILURE_26_SEGMENT_NAMES = [
  'Objectif', 'Compétence', 'Prérequis & Nouveau', 'Mise en situation', 'Tension cognitive',
  'Défi sans leçon', 'Recueil des erreurs', 'Expérience de pensée', 'Révélation', 'Leçon courte',
  'Leçon développée', 'Analogies', 'Exemples concrets', 'Reformulation simple', 'Atelier débat',
  'Erreurs attendues', 'Correction guidée', 'Métacognition', 'JE RETIENS', 'Test de compréhension',
  'Défi d\'application', 'Boucle de remédiation', 'Cas réel / Témoignage', 'Niveau de maîtrise',
  'Lien conceptuel', 'Transition narrative',
];

// ─── Appel d'une EDGE FUNCTION Supabase ───────────────────────────────────────
// (Anciennement `${origin}/.netlify/functions/${endpoint}` — fonctions Netlify MORTES
//  sur cette app Vite/Vercel → 404 → fallback regex silencieux. On invoque désormais
//  les VRAIES edges Supabase, ex. `liri-masterclass-factory` — supabase.functions.invoke
//  joint automatiquement le JWT de session (requireUser côté edge).)
async function callFn(endpoint, body, _signal) {
  const { data, error } = await supabase.functions.invoke(endpoint, { body });
  if (error) {
    // Corps d'erreur structuré de l'edge (message métier) si dispo, sinon message réseau.
    let detail = '';
    try { detail = (await error.context?.json?.())?.error || ''; } catch { /* noop */ }
    throw new Error(detail || error.message || `Edge ${endpoint} indisponible`);
  }
  return data;
}

// ─── Modèles pédagogiques disponibles ────────────────────────────────────────
export const PEDAGOGICAL_MODELS = [
  {
    id:       'liri-v1',
    label:    'LIRI 21 Segments',
    sublabel: 'Méthode classique LIRI',
    desc:     'Objectif → Compétence → … → JE RETIENS → Test → Transition',
    segments: 21,
    color:    '#D4AF37',
    icon:     '🎓',
  },
  {
    id:       'failure-v2',
    label:    'Échec Productif — 26 Segments',
    sublabel: 'Apprentissage par l\'échec',
    desc:     'Essaie → Échoue → Comprends pourquoi → Reçois la leçon → Ancre → Teste',
    segments: 26,
    color:    '#f43f5e',
    icon:     '⚡',
  },
];

/** Options envoyées à `liri-masterclass-document-analyze` (2ᵉ fenêtre 26k+ , gap-fill). */
const DEFAULT_DOCUMENT_ANALYZE_OPTIONS = {
  secondWindow: false,
  gapFill:      true,
};

function normalizeDocumentAnalyzeOptions(o) {
  if (!o || typeof o !== 'object') return { ...DEFAULT_DOCUMENT_ANALYZE_OPTIONS };
  return {
    secondWindow: o.secondWindow === true,
    gapFill:      o.gapFill !== false,
  };
}

// ─── Clé de persistance localStorage ─────────────────────────────────────────
const LS_KEY = 'liri:masterclass:v1';

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveToStorage(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[useMasterclassProject] localStorage write failed:', e.message);
  }
}

function clearStorage() {
  try { localStorage.removeItem(LS_KEY); } catch { /* silencieux */ }
}

// ─────────────────────────────────────────────────────────────────────────────
export function useMasterclassProject() {
  // Restaurer depuis localStorage au montage (lazy initializer — une seule lecture)
  const _saved = useRef(loadFromStorage());
  const [step,              setStep]          = useState(_saved.current?.step ?? 0);
  const [stepStatus,        setStepStatus]    = useState(_saved.current?.stepStatus ?? {});
  const [project,           setProject]       = useState(_saved.current?.project ?? EMPTY_PROJECT);
  const [error,             setError]         = useState('');
  const [pedagogicalModel,  setPedagogicalModel] = useState(_saved.current?.pedagogicalModel ?? 'liri-v1');
  const [documentAnalyzeOptions, setDocumentAnalyzeOptionsState] = useState(
    () => normalizeDocumentAnalyzeOptions(_saved.current?.documentAnalyzeOptions),
  );
  const documentAnalyzeOptionsRef = useRef(documentAnalyzeOptions);
  useEffect(() => { documentAnalyzeOptionsRef.current = documentAnalyzeOptions; }, [documentAnalyzeOptions]);

  const setDocumentAnalyzeOptions = useCallback((patchOrFn) => {
    setDocumentAnalyzeOptionsState((prev) => {
      const next = typeof patchOrFn === 'function' ? patchOrFn(prev) : { ...prev, ...patchOrFn };
      return normalizeDocumentAnalyzeOptions(next);
    });
  }, []);

  const abortRef   = useRef(null);
  // runningRef : true uniquement pendant qu'une étape est active.
  // Remplace l'ancienne garde "abortRef && !aborted" qui bloquait les étapes suivantes
  // car le controller restait défini après un succès (pas d'abort sur succès).
  const runningRef = useRef(false);
  // Ref miroir de project pour accéder à la valeur la plus récente dans les useCallback
  // sans les recréer à chaque frappe (P2 — deps instables)
  const projectRef = useRef(project);
  useEffect(() => { projectRef.current = project; }, [project]);

  // Ref miroir de pedagogicalModel — même logique que projectRef
  // Permet à launchBlocs de lire la valeur courante sans dépendance instable
  const pedagogicalModelRef = useRef(pedagogicalModel);
  useEffect(() => { pedagogicalModelRef.current = pedagogicalModel; }, [pedagogicalModel]);

  // Cleanup AbortController au démontage (évite setState sur composant démonté)
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Persister dans localStorage — on nettoie les clés transitoires avant de sauvegarder
  // pour éviter de restaurer un état "running" ou des indicateurs de progression orphelins
  useEffect(() => {
    const cleanStatus = {};
    for (const [k, v] of Object.entries(stepStatus)) {
      if (v === 'running') continue;           // 'running' → ne pas persister
      if (k === '4_progress' || k === '4_current') continue; // progress live → transitoire
      cleanStatus[k] = v;
    }
    saveToStorage({
      step,
      stepStatus: cleanStatus,
      project,
      pedagogicalModel,
      documentAnalyzeOptions,
    });
  }, [step, stepStatus, project, pedagogicalModel, documentAnalyzeOptions]);

  const rawText = project.rawText ?? '';

  const setRawText = useCallback((text) => {
    setProject(p => {
      // Si du contenu a déjà été généré, on efface les données aval pour éviter
      // d'afficher des résultats obsolètes sur le nouveau texte (P1-3)
      const hasGenerated = p.blocks?.length || p.chapters?.length || p.pedagogy?.length;
      if (hasGenerated) {
        return {
          ...EMPTY_PROJECT,
          rawText:      text,
          courseType:   p.courseType,
          aiProvider:   p.aiProvider,
          lang:         p.lang,
        };
      }
      return { ...p, rawText: text };
    });
    if (step > 0) {
      abortRef.current?.abort(); // annuler toute génération en cours avant de réinitialiser
      setStep(0);
      setStepStatus({});
      setError('');
    }
  }, [step]);

  const loadDemo = useCallback(() => {
    abortRef.current?.abort();
    setProject({ ...EMPTY_PROJECT, rawText: DEMO_TEXT });
    setStep(0);
    setStepStatus({});
    setError('');
    // La persistance sera écrasée au prochain useEffect de sauvegarde
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    clearStorage();
    setProject(EMPTY_PROJECT);
    setStep(0);
    setStepStatus({});
    setError('');
    setDocumentAnalyzeOptionsState({ ...DEFAULT_DOCUMENT_ANALYZE_OPTIONS });
  }, []);

  /**
   * Restaure un projet complet depuis un JSON exporté.
   * Recalcule le step et le stepStatus à partir des données présentes.
   */
  const importProject = useCallback((imported) => {
    if (!imported || typeof imported !== 'object') return;
    const restored = { ...EMPTY_PROJECT, ...imported };
    setProject(restored);
    setError('');

    // Rebuilder le stepStatus depuis les données importées
    const status = {};
    if (restored.analysis)         status[1] = 'done';
    if (restored.blocks?.length)   status[2] = 'done';
    if (restored.chapters?.length) status[3] = 'done';
    if (restored.pedagogy?.length) { status[4] = 'done'; status[5] = 'done'; status[6] = 'done'; }
    setStepStatus(status);

    // Naviguer vers l'étape la plus avancée disponible
    const targetStep = restored.pedagogy?.length   ? 7
      : restored.chapters?.length  ? 3
      : restored.blocks?.length    ? 2
      : restored.analysis          ? 1
      : 0;
    setStep(targetStep);
  }, []);

  const goToStep = useCallback((idx) => {
    setStep(Math.max(0, Math.min(idx, MASTERCLASS_STEPS.length - 1)));
  }, []);

  const _setStepStatus = (stepId, status) =>
    setStepStatus(prev => ({ ...prev, [stepId]: status }));

  // ── ÉTAPE 1 — Analyse ────────────────────────────────────────────────────
  const launchAnalysis = useCallback(async () => {
    const currentRawText = projectRef.current?.rawText ?? '';   // stable ref
    if (!currentRawText.trim()) { setError('Entrez du contenu avant de lancer.'); return; }
    // Garde anti-double-clic : ignorer si une génération est déjà active
    if (runningRef.current) return;
    runningRef.current = true;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setError('');
    _setStepStatus(1, 'running');
    setStep(1);

    try {
      let analysis = null;
      const cleaned = cleanRawText(currentRawText);

      const docOpts = documentAnalyzeOptionsRef.current ?? DEFAULT_DOCUMENT_ANALYZE_OPTIONS;
      const docPromise = callFn('liri-masterclass-document-analyze', {
        rawText: cleaned,
        lang: 'fr',
        secondWindow: docOpts.secondWindow === true,
        gapFill:      docOpts.gapFill !== false,
      }, ctrl.signal).catch((e) => {
        console.warn('[launchAnalysis] liri-masterclass-document-analyze:', e.message);
        return null;
      });

      // Essai via liri-orchestrator-start (en parallèle de l'analyse structurée)
      try {
        const origin = resolveApiOrigin();
        const res = await fetch(`${origin}/.netlify/functions/liri-orchestrator-start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawText: cleaned }),
          signal: ctrl.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (data.projectId) {
          // Poll max 20s
          for (let i = 0; i < 7; i++) {
            await new Promise(r => setTimeout(r, 3000));
            if (ctrl.signal.aborted) return;
            const sr = await fetch(`${origin}/.netlify/functions/liri-orchestrator-status?projectId=${data.projectId}`);
            const sd = await sr.json().catch(() => ({}));
            // Rejeter les chapitres génériques "Chapitre 1, 2, 3" sans contenu
            const hasRealChapters = sd.chapters?.some(c =>
              c.title && !/^Chapitre\s*\d+$/i.test(c.title.trim()) && (c.objective || c.summary || c.content)
            );
            if (hasRealChapters || sd.status === 'completed') {
              const firstSentence = cleaned.split(/[.!?]\s+/)[0]?.slice(0, 100);
              analysis = {
                global_subject:      hasRealChapters ? sd.chapters[0].title : (firstSentence || cleaned.slice(0, 80)),
                target_audience:     sd.audience   || 'Chercheurs spirituels, grand public',
                estimated_duration:  sd.duration   || `${(sd.chapters?.length || 3) * 20} min`,
                level:               sd.level      || 'Intermédiaire — Avancé',
                pedagogical_tone:    sd.tone       || 'Doctrinal & Pédagogique',
                key_revelations:     sd.chapters
                  ?.map(ch => ch.objective || ch.summary || ch.title)
                  .filter(t => t && !/^Chapitre\s*\d+$/i.test(t.trim()))
                  .slice(0, 6) || [],
                chapters_count:      sd.chapters?.length || 0,
                raw_chapters:        hasRealChapters ? sd.chapters : [],
              };
              break;
            }
          }
        }
      } catch { /* fallback ci-dessous */ }

      // Fallback local si l'IA n'a pas répondu
      if (!analysis) {
        const sentences = cleaned.split(/[.!?]\s+/).filter(s => s.length > 40);
        analysis = {
          global_subject:     sentences[0]?.slice(0, 80) || cleaned.slice(0, 80),
          target_audience:    'Grand public, chercheurs',
          estimated_duration: `${Math.max(2, Math.ceil(cleaned.length / 500)) * 10} min`,
          level:              'Intermédiaire',
          pedagogical_tone:   'Pédagogique & Spirituel',
          key_revelations:    sentences.slice(0, 5).map(s => s.slice(0, 80) + '…'),
          chapters_count:     Math.max(1, Math.ceil(splitIntoBlocks(cleaned).length / 3)),
          raw_chapters:       [],
        };
      }

      const docResult = await docPromise;
      let merged = { ...analysis };
      if (docResult?.structured_document) {
        const spanEnd = Math.min(
          docResult.structure_char_end ?? cleaned.length,
          cleaned.length,
        );
        const structureText = cleaned.slice(0, spanEnd);
        const structured_document = validateStructuredDocument(structureText, docResult.structured_document);
        if (structured_document?.passages?.length) {
          const docStats = computeTextStats(cleaned);
          merged = {
            ...merged,
            structured_document,
            structure_meta: {
              truncated: !!docResult.truncated,
              structure_char_end: docResult.structure_char_end ?? cleaned.length,
              analyze_provider: docResult.provider,
              analysis_quality: docResult.analysis_quality ?? null,
              fragment_count: docResult.fragment_count ?? null,
              analysis_meta: docResult.analysis_meta ?? null,
            },
            document_stats: { ...docStats, ...(docResult.stats || {}) },
            global_subject: merged.global_subject || structured_document.central_theme,
            target_audience: merged.target_audience || structured_document.target_audience,
            level: merged.level || structured_document.knowledge_level,
            chapters_count: structured_document.recommended_chapter_order?.length || merged.chapters_count,
            key_revelations: (merged.key_revelations && merged.key_revelations.length)
              ? merged.key_revelations
              : structured_document.topics.map(t => t.one_line_summary || t.label).filter(Boolean).slice(0, 8),
            pedagogical_reordering_rationale: structured_document.pedagogical_reordering_rationale,
            concept_dependencies: structured_document.concept_dependencies,
            search_index: structured_document.search_index,
          };
        }
      }

      if (ctrl.signal.aborted) return;
      setProject(p => ({ ...p, analysis: merged }));
      _setStepStatus(1, 'done');
    } catch (err) {
      if (!ctrl.signal.aborted) { setError(err.message); _setStepStatus(1, 'error'); }
    } finally {
      runningRef.current = false;
    }
  }, []); // stable — lit rawText via projectRef

  // ── ÉTAPE 2 — Blocs de sens (texte) + génération factory optionnelle (chapitres × segments LIRI) ─
  const launchBlocs = useCallback(async () => {
    const currentProject = projectRef.current;
    if (!currentProject.analysis) { setError('Lancez d\'abord l\'analyse.'); return; }
    if (runningRef.current) return;
    runningRef.current = true;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setError('');
    _setStepStatus(2, 'running');
    setStep(2);

    try {
      let factoryChapters = null;
      const cleaned = cleanRawText(currentProject.rawText ?? '');
      /** Blocs de sens : priorité analyse structurée (horodatage), sinon heuristique `splitIntoBlocks`. */
      const meta = currentProject.analysis?.structure_meta;
      let textForStructure = cleaned;
      if (currentProject.analysis?.structured_document && meta?.structure_char_end != null) {
        textForStructure = cleaned.slice(0, Math.min(meta.structure_char_end, cleaned.length));
      }
      let blocks = buildSenseBlocksFromStructure(textForStructure, currentProject.analysis?.structured_document);
      if (!blocks?.length) {
        blocks = buildSenseBlocks(currentProject.rawText ?? '');
      }

      const SEGMENT_NAMES_21 = ['Objectif', 'Compétence', 'Connaissance', 'Mise en situation', 'Tension',
        'Expérience de pensée', 'Révélation', 'Leçon simple', 'Leçon développée', 'Analogies',
        'Exemples', 'Reformulation', 'Atelier', 'Erreurs attendues', 'Correction', 'JE RETIENS',
        'Test', 'Cas réel', 'Lien conceptuel', 'Niveau de maîtrise', 'Transition'];
      const segmentNamesFallback = pedagogicalModelRef.current === 'failure-v2'
        ? FAILURE_26_SEGMENT_NAMES
        : SEGMENT_NAMES_21;

      // ── Appel factory : produit des CHAPITRES (× 21 ou 26 segments), pas des blocs de sens ──
      try {
        const data = await callFn('liri-masterclass-factory', {
          sourceText: cleaned,
          lang: 'fr',
          courseType: 'masterclass',
          pedagogicalModel: pedagogicalModelRef.current,
        }, ctrl.signal);

        if (data.chapters?.length > 0) {
          factoryChapters = data.chapters;
          setProject((p) => ({
            ...p,
            analysis: {
              ...p.analysis,
              deck_title: data.deck_title,
              subtitle: data.subtitle,
              label: data.label,
              provider: data.provider,
            },
          }));
        }
      } catch (e) {
        console.warn('[launchBlocs] liri-masterclass-factory error:', e.message);
      }

      // Texte trop court pour segmenter : au moins une unité pour l'UI (les chapitres viennent de la factory)
      if (!blocks.length && factoryChapters?.length) {
        const syn = cleaned || factoryChapters.map((c) => c.objective || c.title).join('\n\n');
        blocks = [{
          id: 'blk1',
          order: 0,
          type: 'sense_block',
          title: 'Source / deck (non segmenté)',
          central_idea: syn.slice(0, 12000),
          core_claim: factoryChapters[0]?.title || 'Deck',
          lines_label: 'Unité 1 / 1',
          duration_minutes: 20,
        }];
      }

      if (!blocks.length && cleaned.length > 15) {
        blocks = [{
          id: 'blk1',
          order: 0,
          type: 'sense_block',
          title: 'Source complète',
          central_idea: cleaned,
          core_claim: cleaned.slice(0, 88),
          lines_label: 'Unité 1 / 1',
          duration_minutes: 20,
        }];
      }

      // Factory KO : chapitres × segments construits depuis les blocs de sens (regroupement pédagogique)
      if (!factoryChapters?.length && blocks.length > 0) {
        factoryChapters = buildFallbackFactoryChaptersFromSenseBlocks(blocks, segmentNamesFallback);
      }

      if (!blocks.length && !factoryChapters?.length) {
        setError('Texte source trop court ou illisible : impossible de créer des blocs de sens ni un deck.');
        _setStepStatus(2, 'error');
        return;
      }

      if (ctrl.signal.aborted) return;
      setProject((p) => ({ ...p, blocks, factoryChapters }));
      _setStepStatus(2, 'done');
    } catch (err) {
      if (!ctrl.signal.aborted) { setError(err.message); _setStepStatus(2, 'error'); }
    } finally {
      runningRef.current = false;
    }
  }, []);

  // ── ÉTAPE 3 — Chapitres (validation + structuration des chapitres) ──────
  const launchChapters = useCallback(async () => {
    const currentProject = projectRef.current;
    console.debug('[chapters] entry', { blocks: currentProject.blocks?.length ?? 0, factory: currentProject.factoryChapters?.length ?? 0, mutex: runningRef.current });
    if (!currentProject.blocks?.length && !currentProject.factoryChapters?.length) {
      setError('Lancez d\'abord l\'étape Blocs (segmentation + factory).');
      return;
    }
    if (runningRef.current) return;
    runningRef.current = true;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setError('');
    _setStepStatus(3, 'running');
    setStep(3);

    try {
      await new Promise(r => setTimeout(r, 600)); // mini-délai UX
      if (ctrl.signal.aborted) return;

      let chapters;

      // ── Priorité 1 : chapitres factory (21 segments déjà générés) ────────
      if (currentProject.factoryChapters?.length > 0) {
        chapters = currentProject.factoryChapters.map((ch, i) => ({
          id:           ch.id       || `ch${i}`,
          order:        ch.order    ?? i,
          title:        ch.title    || `Chapitre ${i + 1}`,
          objective:    ch.objective || '',
          duration:     ch.duration  || '25 min',
          segment_count: ch.segments?.length || 21,
          segments:     ch.segments || [],
          // Résumé pour affichage
          summary:  ch.segments?.find(s => s.segment_id === 8)?.content || ch.objective || '',
          key_retain: ch.segments?.find(s => s.segment_id === 16)?.content || '',
        }));
      } else {
        const rawChapters = currentProject.analysis?.raw_chapters || [];
        const rawBlocks = currentProject.blocks || [];
        const senseBlocks = rawBlocks.filter((b) => b.type === 'sense_block' || !b.type);
        const sd = currentProject.analysis?.structured_document;
        const allBlocksHaveSubject = senseBlocks.length > 0 && senseBlocks.every((b) => b.subject_id);

        if (rawChapters.length > 0) {
          chapters = rawChapters.map((ch, i) => ({
            id:        ch.id || `ch${i}`,
            order:     i,
            title:     ch.title || `Chapitre ${i + 1}`,
            objective: ch.objective || ch.summary || '',
            summary:   ch.summary   || '',
            duration:  ch.duration  || '20 min',
            segments:  [],
            content:   ch.content   || ch.rawText || '',
          }));
        } else if (sd?.topics?.length && allBlocksHaveSubject) {
          chapters = buildChaptersFromStructuredTopics(senseBlocks, sd).map((ch, i) => ({
            id: ch.id || `ch${i}`,
            order: i,
            title: ch.title,
            objective: ch.objective || '',
            summary: ch.summary || '',
            duration: ch.duration || '20 min',
            segments: [],
            content: ch.content || '',
            source_block_ids: ch.source_block_ids,
            subject_id: ch.subject_id,
          }));
        } else if (senseBlocks.length > 0) {
          chapters = buildChaptersFromSenseBlocks(senseBlocks).map((ch, i) => ({
            id: ch.id || `ch${i}`,
            order: i,
            title: ch.title,
            objective: ch.objective || '',
            summary: ch.summary || '',
            duration: ch.duration || '20 min',
            segments: [],
            content: ch.content || '',
            source_block_ids: ch.source_block_ids,
          }));
        } else {
          // Sessions anciennes : « blocs » sauvés comme cartes-chapitre (legacy)
          const blocks = rawBlocks;
          const CHAPTER_GROUPS = [
            { name: 'Introduction', range: [0, 1] },
            { name: 'Développement', range: [2, 3] },
            { name: 'Approfondissement', range: [4, 5] },
            { name: 'Clôture', range: [6, Math.max(6, blocks.length - 1)] },
          ];
          chapters = CHAPTER_GROUPS.map((grp, idx) => {
            const group = blocks.slice(grp.range[0], grp.range[1] + 1);
            if (!group.length) return null;
            return {
              id: `ch${idx}`,
              order: idx,
              title: grp.name,
              objective: group.map((b) => b.core_claim || b.central_idea || '').filter(Boolean).join(' · ').slice(0, 160),
              summary: group[0]?.central_idea?.slice(0, 200) || '',
              duration: `${group.length * 12} min`,
              segments: [],
            };
          }).filter(Boolean);
        }
      }

      setProject(p => ({ ...p, chapters }));
      _setStepStatus(3, 'done');
    } catch (err) {
      if (!ctrl.signal.aborted) { setError(err.message); _setStepStatus(3, 'error'); }
    } finally {
      runningRef.current = false;
    }
  }, []); // stable — lit blocks/factoryChapters/analysis via projectRef

  // ── ÉTAPE 4 — Pédagogie (segments LIRI complets / ou génération IA) ────────
  const launchPedagogy = useCallback(async () => {
    const currentProject = projectRef.current;
    if (!currentProject.chapters?.length) { setError('Lancez d\'abord les chapitres.'); return; }
    if (runningRef.current) return;
    runningRef.current = true;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setError('');
    _setStepStatus(4, 'running');
    setStep(4);

    try {
      await new Promise(r => setTimeout(r, 400));
      if (ctrl.signal.aborted) return;

      const CANONICAL_21 = ['Objectif','Compétence','Connaissance','Mise en situation','Tension',
        'Expérience de pensée','Révélation','Leçon simple','Leçon développée','Analogies',
        'Exemples','Reformulation','Atelier','Erreurs attendues','Correction','JE RETIENS',
        'Test','Cas réel','Lien conceptuel','Niveau de maîtrise','Transition'];
      const origin = resolveApiOrigin();

      const minSegmentsComplete = pedagogicalModelRef.current === 'failure-v2' ? 26 : 21;

      // Construire la pédagogie — chapitres traités séquentiellement
      const pedagogy = [];
      for (let i = 0; i < currentProject.chapters.length; i++) {
        if (ctrl.signal.aborted) return;
        const ch = currentProject.chapters[i];

        // Mise à jour du statut (progress live)
        setStepStatus(prev => ({
          ...prev,
          4:            'running',
          '4_progress': `${i + 1}/${currentProject.chapters.length}`,
          '4_current':  ch.title,
        }));

        let segments;

        if ((ch.segments?.length || 0) >= minSegmentsComplete) {
          // ── Priorité 1 : segments factory déjà complets ─────────────────────
          segments = ch.segments.map((s, si) => ({
            segment_id:   s.segment_id ?? si + 1,
            name:         normalizeSegName(s.name),
            title:        s.title || normalizeSegName(s.name),
            content:      s.content || '',
            key_points:   s.key_points || [],
            oral_script:  s.oral_script  || '',
            teacher_note: s.teacher_note || '',
            interaction:  s.interaction  || '',
            status:       'done',
          }));
        } else {
          // ── Priorité 2 : appel IA liri-pedagogy-generate ─────────────────────
          let aiSegments = null;
          try {
            const res = await fetch(`${origin}/.netlify/functions/liri-pedagogy-generate`, {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({
                chapterTitle:     ch.title,
                chapterContent:   ch.content || ch.summary || '',
                chapterObjective: ch.objective || '',
                lang:             'fr',
              }),
              signal: ctrl.signal,
            });
            if (res.ok) {
              const data = await res.json().catch(() => ({}));
              if (data.segments && typeof data.segments === 'object') {
                aiSegments = data.segments;
              }
            }
          } catch (e) {
            if (ctrl.signal.aborted) return;
            console.warn('[launchPedagogy] liri-pedagogy-generate failed:', e.message);
          }

          // Construire les segments depuis la réponse IA ou fallback
          segments = CANONICAL_21.map((name, si) => ({
            segment_id:  si + 1,
            name,
            title:       name,
            content:     aiSegments?.[name] || '',
            key_points:  [],
            oral_script: '',
            teacher_note:'',
            interaction: '',
            status:      aiSegments?.[name] ? 'done' : 'pending',
          }));
        }

        pedagogy.push({
          chapterId: ch.id,
          title:     ch.title,
          objective: ch.objective || '',
          duration:  ch.duration  || '25 min',
          segments,
        });
      }

      if (ctrl.signal.aborted) return;

      // Slides et scripts dérivés de la pédagogie
      const slides = pedagogy.map((ch, i) => {
        const objetifSeg  = ch.segments.find(s => s.segment_id === 1);
        const retiensSeg  = ch.segments.find(s => s.segment_id === 16);
        return {
          id: `sl${i}`, chapter_id: ch.chapterId,
          title:    ch.title,
          subtitle: objetifSeg?.title || ch.objective?.slice(0, 80) || '',
          content:  retiensSeg?.content || objetifSeg?.content || '',
          segments: ch.segments,
        };
      });
      const scripts = pedagogy.map((ch, i) => {
        const leconSimple = ch.segments.find(s => s.segment_id === 8);
        const leconDev    = ch.segments.find(s => s.segment_id === 9);
        return {
          id: `sc${i}`, chapter_id: ch.chapterId, title: ch.title,
          lines: [
            ch.objective || '',
            leconSimple?.oral_script || '',
            leconDev?.oral_script    || '',
          ].filter(Boolean),
          duration: ch.duration,
        };
      });

      const expectedSegCount = pedagogy[0]?.segments?.length || 21;
      const allSegmentsFilled = pedagogy.every(ch =>
        ch.segments.filter(s => s.status === 'done').length === expectedSegCount
      );

      // Calcul du score qualité dynamique basé sur les segments réellement remplis
      const totalSegs   = pedagogy.reduce((acc, ch) => acc + (ch.segments?.length ?? 0), 0);
      const filledSegs  = pedagogy.reduce((acc, ch) => acc + (ch.segments?.filter(s => s.status === 'done').length ?? 0), 0);
      const fillRate    = totalSegs > 0 ? filledSegs / totalSegs : 0;
      const qualityScore = Math.round(fillRate * 100);

      setProject(p => ({
        ...p, pedagogy, slides, scripts,
        quality: {
          score: qualityScore,
          segments_filled: filledSegs,
          segments_total:  totalSegs,
          missing_requirements: allSegmentsFilled ? [] : ['Certains segments sont en attente de génération'],
        },
        exports: { downloadable: { json: true, markdown: true, pdf: true } },
      }));
      _setStepStatus(4, 'done');
      _setStepStatus(5, 'done'); // slides déjà construits dans la même passe
      _setStepStatus(6, 'done'); // scripts idem
      setStep(5); // → Slides (puis 6 Script, puis 7 Export via CTA)
    } catch (err) {
      if (!ctrl.signal.aborted) { setError(err.message); _setStepStatus(4, 'error'); }
    } finally {
      runningRef.current = false;
    }
  }, []); // stable — lit chapters via projectRef

  // ── PONT B : le « mode automatique » enchaîne RÉELLEMENT les 4 étapes ────
  // (avant : `launchPipeline = launchAnalysis` → blocs/chapitres/pédagogie n'étaient
  // JAMAIS lancés par personne — wizard mort à l'étape 3, quel que soit le backend).
  // Chaque launch* garde ses fallbacks locaux ; on attend entre deux étapes que
  // l'état projeté (projectRef, setProject async) porte la donnée requise.
  const waitForProject = useCallback(async (pred, ms = 4000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (pred(projectRef.current || {})) return true;
      await new Promise((r) => setTimeout(r, 80));
    }
    return pred(projectRef.current || {});
  }, []);

  const launchPipeline = useCallback(async () => {
    await launchAnalysis();
    const okA = await waitForProject((p) => !!p.analysis, 6000);
    console.debug('[pipeline] analysis →', okA);
    if (!okA) return;
    await launchBlocs();
    const okB = await waitForProject((p) => (p.blocks || []).length > 0 || (p.factoryChapters || []).length > 0, 6000);
    console.debug('[pipeline] blocs →', okB, (projectRef.current?.blocks || []).length);
    if (!okB) return;
    // Laisse le mutex runningRef se libérer + l'état se propager avant l'étape suivante.
    await new Promise((r) => setTimeout(r, 200));
    await launchChapters();
    let okC = await waitForProject((p) => (p.chapters || []).length > 0, 6000);
    if (!okC) {
      console.debug('[pipeline] chapters retry (garde silencieuse ?)');
      await new Promise((r) => setTimeout(r, 400));
      await launchChapters();
      okC = await waitForProject((p) => (p.chapters || []).length > 0, 6000);
    }
    console.debug('[pipeline] chapters →', okC, (projectRef.current?.chapters || []).length);
    if (!okC) return;
    await new Promise((r) => setTimeout(r, 200));
    await launchPedagogy();
    const okP = await waitForProject((p) => (p.pedagogy || []).length > 0, 8000);
    console.debug('[pipeline] pedagogy →', okP);
  }, [launchAnalysis, launchBlocs, launchChapters, launchPedagogy, waitForProject]);

  const pipelineRunning = Object.values(stepStatus).some(s => s === 'running');
  const status = pipelineRunning ? 'running' : 'idle';

  return {
    step, goToStep,
    next: () => setStep(s => Math.min(s + 1, 7)),
    prev: () => setStep(s => Math.max(s - 1, 0)),
    launchPipeline,
    launchAnalysis,
    launchBlocs,
    launchChapters,
    launchPedagogy,
    reset,
    importProject,
    status,
    stepStatus,
    error,
    project,
    rawText,
    setRawText,
    loadDemo,
    pipelineRunning,
    MAX_RAW_CHARS,
    pedagogicalModel,
    setPedagogicalModel,
    documentAnalyzeOptions,
    setDocumentAnalyzeOptions,
    isRealBrain: false,
  };
}
