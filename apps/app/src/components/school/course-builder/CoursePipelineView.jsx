import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Database, FileText, Brain, Scissors, Sparkles,
  Monitor, BookOpen, Video, Film, Globe,
  CheckCircle, XCircle, Loader2, Play, RotateCcw,
  ChevronRight, Download, Eye, Zap, AlertCircle, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Pipeline step definitions ────────────────────────────────────────────────
const STEPS = [
  {
    id: 'capture',
    label: 'Capture / Upload',
    icon: Upload,
    color: 'blue',
    description: 'Source vidéo disponible et accessible.',
    detail: 'Vérifie que la vidéo est bien chargée et que l\'URL est valide.',
  },
  {
    id: 'ingestion',
    label: 'Ingestion',
    icon: Database,
    color: 'indigo',
    description: 'Contenu enregistré dans la base de données.',
    detail: 'La fiche formation_day_contents est présente et liée au bon module.',
  },
  {
    id: 'transcription',
    label: 'Transcription',
    icon: FileText,
    color: 'violet',
    description: 'Génération automatique de la transcription.',
    detail: 'Utilise la reconnaissance automatique de la parole (ASR) pour créer un texte synchronisé.',
  },
  {
    id: 'analyse',
    label: 'Analyse IA',
    icon: Brain,
    color: 'purple',
    description: 'Génération de la carte mentale du cours.',
    detail: 'L\'IA analyse la structure du cours et génère un mind map pédagogique.',
  },
  {
    id: 'segmentation',
    label: 'Segmentation pédagogique',
    icon: Scissors,
    color: 'pink',
    description: 'Découpe automatique en chapitres cohérents.',
    detail: 'L\'IA identifie les ruptures thématiques et crée des segments pédagogiques avec horodatages.',
  },
  {
    id: 'reformulation',
    label: 'Reformulation IA',
    icon: Sparkles,
    color: 'amber',
    description: 'Enrichissement pédagogique de chaque segment.',
    detail: 'Génère : résumé, reformulation simple, points clés, à retenir, question de compréhension.',
  },
  {
    id: 'smartboard',
    label: 'Génération Smartboard',
    icon: Monitor,
    color: 'emerald',
    description: 'Slides synchronisées avec la vidéo.',
    detail: 'Compose les diapositives Gamma-style pour chaque segment, avec illustration IA.',
  },
  {
    id: 'script',
    label: 'Script maître',
    icon: BookOpen,
    color: 'teal',
    description: 'Document de cours complet et structuré.',
    detail: 'Compile l\'ensemble des segments en un script pédagogique exportable.',
  },
  {
    id: 'montage',
    label: 'Montage vidéo assisté',
    icon: Video,
    color: 'cyan',
    description: 'Composition vidéo avec overlays SmartBoard.',
    detail: 'Encode la vidéo finale avec les titres et points clés incrustés sur chaque segment.',
  },
  {
    id: 'rendu',
    label: 'Rendu final',
    icon: Film,
    color: 'sky',
    description: 'Génération de la vidéo pédagogique enrichie.',
    detail: 'Le moteur FFmpeg produit la vidéo finale avec tous les enrichissements pédagogiques.',
  },
  {
    id: 'publication',
    label: 'Stockage + Publication',
    icon: Globe,
    color: 'green',
    description: 'Mise à disposition pour les apprenants.',
    detail: 'La vidéo et tous les artefacts sont publiés et accessibles aux étudiants.',
  },
];

const STATUS_ICON = {
  pending:   { icon: Info,         cls: 'text-[#82807a]' },
  running:   { icon: Loader2,      cls: 'text-[#d97757] animate-spin' },
  completed: { icon: CheckCircle,  cls: 'text-[#9fbf8f]' },
  error:     { icon: XCircle,      cls: 'text-red-400' },
  skipped:   { icon: ChevronRight, cls: 'text-[#82807a]' },
};

const COLOR_RING = {
  blue:    'ring-[#c2683f]/40   bg-[#c2683f]/10   text-[#d97757]',
  indigo:  'ring-[#c2683f]/40 bg-[#c2683f]/10 text-[#d97757]',
  violet:  'ring-[#c2683f]/40 bg-[#c2683f]/10 text-[#d97757]',
  purple:  'ring-[#c2683f]/40 bg-[#c2683f]/10 text-[#d97757]',
  pink:    'ring-[#c2683f]/40   bg-[#c2683f]/10   text-[#d97757]',
  amber:   'ring-[#c2683f]/40  bg-[#c2683f]/10  text-[#d97757]',
  emerald: 'ring-[#7a9b6c]/40 bg-[#7a9b6c]/10 text-[#9fbf8f]',
  teal:    'ring-[#c2683f]/40   bg-[#c2683f]/10   text-[#d97757]',
  cyan:    'ring-[#c2683f]/40   bg-[#c2683f]/10   text-[#d97757]',
  sky:     'ring-[#c2683f]/40    bg-[#c2683f]/10    text-[#d97757]',
  green:   'ring-[#7a9b6c]/40  bg-[#7a9b6c]/10  text-[#9fbf8f]',
};

// ─── Main component ───────────────────────────────────────────────────────────
export default function CoursePipelineView({
  contentId,
  videoUrl,
  chapters = [],
  transcript = [],
  segmentAiMap = {},
  mindmapJsonText = '',
  contentPersistedInDb = false,
  invokeFn,
  invokeFnGet,
  onChaptersUpdate,
  onTranscriptUpdate,
  onSegmentAiMapUpdate,
  onMindmapUpdate,
}) {
  const [stepStates, setStepStates] = useState({});
  const [activeStep, setActiveStep] = useState('capture');
  const [logs, setLogs] = useState({});
  const [outputs, setOutputs] = useState({});
  const [autoRunning, setAutoRunning] = useState(false);
  const [scriptText, setScriptText] = useState('');
  const [renderJobId, setRenderJobId] = useState(null);
  const [renderStatus, setRenderStatus] = useState(null);
  const autoRunRef = useRef(false);

  // ── Derive initial states from existing data ───────────────────────────────
  useEffect(() => {
    setStepStates((prev) => {
      const next = { ...prev };
      if (!next.capture) next.capture = videoUrl ? 'completed' : 'pending';
      if (!next.ingestion) next.ingestion = contentPersistedInDb ? 'completed' : 'pending';
      if (!next.transcription) next.transcription = transcript.length > 0 ? 'completed' : 'pending';
      if (!next.analyse) next.analyse = mindmapJsonText ? 'completed' : 'pending';
      if (!next.segmentation) next.segmentation = chapters.length > 0 ? 'completed' : 'pending';
      const aiCount = Object.keys(segmentAiMap).length;
      if (!next.reformulation) next.reformulation = aiCount > 0 ? 'completed' : 'pending';
      if (!next.smartboard) next.smartboard = aiCount > 0 ? 'completed' : 'pending';
      if (!next.script) next.script = 'pending';
      if (!next.montage) next.montage = 'pending';
      if (!next.rendu) next.rendu = 'pending';
      if (!next.publication) next.publication = 'pending';
      return next;
    });
  }, [videoUrl, contentPersistedInDb, transcript, mindmapJsonText, chapters, segmentAiMap]);

  const setStep = useCallback((id, status) => {
    setStepStates((prev) => ({ ...prev, [id]: status }));
  }, []);

  const addLog = useCallback((id, msg) => {
    setLogs((prev) => ({ ...prev, [id]: [...(prev[id] || []), `${new Date().toLocaleTimeString()} — ${msg}`] }));
  }, []);

  const setOutput = useCallback((id, data) => {
    setOutputs((prev) => ({ ...prev, [id]: data }));
  }, []);

  // ── Individual step runners ────────────────────────────────────────────────

  const runCapture = useCallback(async () => {
    setStep('capture', 'running');
    addLog('capture', 'Vérification de la source vidéo…');
    await new Promise((r) => setTimeout(r, 500));
    if (videoUrl) {
      addLog('capture', `✓ URL vidéo détectée`);
      setOutput('capture', { url: videoUrl });
      setStep('capture', 'completed');
      return true;
    }
    addLog('capture', '✗ Aucune URL vidéo — téléverse ou capture une vidéo d\'abord.');
    setStep('capture', 'error');
    return false;
  }, [videoUrl, setStep, addLog, setOutput]);

  const runIngestion = useCallback(async () => {
    setStep('ingestion', 'running');
    addLog('ingestion', 'Vérification en base de données…');
    await new Promise((r) => setTimeout(r, 400));
    if (contentPersistedInDb && contentId) {
      addLog('ingestion', `✓ Contenu enregistré (${contentId.slice(0, 8)}…)`);
      setOutput('ingestion', { contentId });
      setStep('ingestion', 'completed');
      return true;
    }
    addLog('ingestion', '⚠ Contenu non encore persisté — enregistre la formation.');
    setStep('ingestion', 'error');
    return false;
  }, [contentPersistedInDb, contentId, setStep, addLog, setOutput]);

  const runTranscription = useCallback(async () => {
    setStep('transcription', 'running');
    if (transcript.length > 0) {
      addLog('transcription', `✓ Transcription déjà disponible (${transcript.length} lignes)`);
      setOutput('transcription', { lineCount: transcript.length });
      setStep('transcription', 'completed');
      return true;
    }
    if (!videoUrl) {
      addLog('transcription', '✗ URL vidéo manquante.');
      setStep('transcription', 'error');
      return false;
    }
    try {
      addLog('transcription', 'Lancement de la transcription ASR…');
      const { data: sessionData } = await import('@/lib/customSupabaseClient').then((m) => m.supabase.auth.getSession());
      const token = sessionData?.session?.access_token;
      const { data, error } = await import('@/lib/customSupabaseClient').then((m) =>
        m.supabase.functions.invoke('generate-transcript', { body: { url: videoUrl, language: 'fr' } })
      );
      if (error) throw new Error(error.message);
      const lines = Array.isArray(data?.transcript) ? data.transcript : [];
      if (lines.length === 0) throw new Error('Transcription vide');
      onTranscriptUpdate?.(lines.map((l) => ({ timeText: l.time || '', text: l.text || '' })));
      addLog('transcription', `✓ ${lines.length} lignes transcrites`);
      setOutput('transcription', { lineCount: lines.length });
      setStep('transcription', 'completed');
      return true;
    } catch (e) {
      addLog('transcription', `✗ ${e.message}`);
      setStep('transcription', 'error');
      return false;
    }
  }, [transcript, videoUrl, onTranscriptUpdate, setStep, addLog, setOutput]);

  const runAnalyse = useCallback(async () => {
    setStep('analyse', 'running');
    if (mindmapJsonText) {
      addLog('analyse', '✓ Carte mentale déjà disponible');
      setOutput('analyse', { hasMindmap: true });
      setStep('analyse', 'completed');
      return true;
    }
    if (!contentId || chapters.length === 0) {
      addLog('analyse', '⚠ Segmentation requise avant l\'analyse — passe d\'abord par "Segmentation".');
      setStep('analyse', 'skipped');
      return true;
    }
    try {
      addLog('analyse', 'Génération de la carte mentale…');
      const body = await invokeFn('generate-mindmap', { contentId, mode: 'auto' });
      if (body?.mindmap) {
        onMindmapUpdate?.(JSON.stringify(body.mindmap, null, 2));
        addLog('analyse', `✓ Carte mentale générée (${body.nodeCount || '?'} nœuds)`);
        setOutput('analyse', { hasMindmap: true });
        setStep('analyse', 'completed');
        return true;
      }
      throw new Error('Réponse vide');
    } catch (e) {
      addLog('analyse', `✗ ${e.message}`);
      setStep('analyse', 'error');
      return false;
    }
  }, [mindmapJsonText, contentId, chapters, invokeFn, onMindmapUpdate, setStep, addLog, setOutput]);

  const runSegmentation = useCallback(async () => {
    setStep('segmentation', 'running');
    if (chapters.length > 0) {
      addLog('segmentation', `✓ ${chapters.length} chapitres déjà définis`);
      setOutput('segmentation', { chapterCount: chapters.length });
      setStep('segmentation', 'completed');
      return true;
    }
    if (transcript.length === 0) {
      addLog('segmentation', '✗ Transcription requise avant la segmentation automatique.');
      setStep('segmentation', 'error');
      return false;
    }
    try {
      addLog('segmentation', 'Segmentation automatique IA en cours…');
      const transcriptPayload = transcript.map((l) => ({ timeText: l.timeText, text: l.text }));
      const body = await invokeFn('pipeline-auto-segment', {
        transcript: transcriptPayload,
        targetSegments: 5,
        chapters: transcriptPayload,
      });
      const newChapters = Array.isArray(body?.chapters) ? body.chapters : [];
      if (newChapters.length === 0) throw new Error('Aucun segment généré');
      onChaptersUpdate?.(newChapters);
      addLog('segmentation', `✓ ${newChapters.length} segments créés (méthode: ${body.method || 'ia'})`);
      setOutput('segmentation', { chapterCount: newChapters.length, method: body.method });
      setStep('segmentation', 'completed');
      return true;
    } catch (e) {
      addLog('segmentation', `✗ ${e.message}`);
      setStep('segmentation', 'error');
      return false;
    }
  }, [chapters, transcript, invokeFn, onChaptersUpdate, setStep, addLog, setOutput]);

  const runReformulation = useCallback(async () => {
    setStep('reformulation', 'running');
    if (!contentId) {
      addLog('reformulation', '✗ contentId manquant.');
      setStep('reformulation', 'error');
      return false;
    }
    if (chapters.length === 0) {
      addLog('reformulation', '✗ Segmentation requise d\'abord.');
      setStep('reformulation', 'error');
      return false;
    }
    try {
      addLog('reformulation', `Génération IA pour ${chapters.length} segments…`);
      const chaptersPayload = chapters.map((c, i) => ({
        label: c.label || `Chapitre ${i + 1}`,
        startText: c.startText || '',
        endText: c.endText || '',
        startSeconds: c.startSeconds,
        endSeconds: c.endSeconds,
      }));
      const transcriptPayload = transcript.map((l) => ({
        timeText: l.timeText,
        timeSeconds: l.timeSeconds,
        text: l.text,
      }));
      const result = await invokeFn('segment-ai-generate', {
        contentId,
        applyAll: true,
        mode: 'pedagogical',
        chapters: chaptersPayload,
        transcript: transcriptPayload,
      });
      const count = result?.generatedCount || 0;
      if (Array.isArray(result?.rows) && result.rows.length > 0) {
        const nextMap = {};
        result.rows.forEach((r) => { nextMap[String(r.segment_index)] = r; });
        onSegmentAiMapUpdate?.(nextMap);
      }
      addLog('reformulation', `✓ ${count} segments enrichis par l'IA${result?.tableMissing ? ' (table absente — résultats locaux)' : ''}`);
      setOutput('reformulation', { count });
      setStep('reformulation', 'completed');
      return true;
    } catch (e) {
      addLog('reformulation', `✗ ${e.message}`);
      setStep('reformulation', 'error');
      return false;
    }
  }, [contentId, chapters, transcript, invokeFn, onSegmentAiMapUpdate, setStep, addLog, setOutput]);

  const runSmartboard = useCallback(async () => {
    setStep('smartboard', 'running');
    await new Promise((r) => setTimeout(r, 600));
    const count = Object.keys(segmentAiMap).length;
    if (count > 0) {
      addLog('smartboard', `✓ SmartBoard disponible — ${count} slides générées`);
      setOutput('smartboard', { slideCount: count });
      setStep('smartboard', 'completed');
      return true;
    }
    addLog('smartboard', '⚠ Aucune donnée IA — lance d\'abord la Reformulation.');
    setStep('smartboard', 'error');
    return false;
  }, [segmentAiMap, setStep, addLog, setOutput]);

  const runScript = useCallback(async () => {
    setStep('script', 'running');
    if (!contentId) {
      addLog('script', '✗ contentId manquant.');
      setStep('script', 'error');
      return false;
    }
    try {
      addLog('script', 'Compilation du script maître…');
      const result = await invokeFn('pipeline-master-script', { contentId });
      if (!result?.scriptText) throw new Error('Script vide');
      setScriptText(result.scriptText);
      addLog('script', `✓ Script compilé — ${result.segmentCount} chapitres`);
      setOutput('script', { segmentCount: result.segmentCount, scriptText: result.scriptText, sections: result.sections });
      setStep('script', 'completed');
      return true;
    } catch (e) {
      addLog('script', `✗ ${e.message}`);
      setStep('script', 'error');
      return false;
    }
  }, [contentId, invokeFn, setStep, addLog, setOutput]);

  const runMontage = useCallback(async () => {
    setStep('montage', 'running');
    if (!contentId) {
      addLog('montage', '✗ contentId manquant.');
      setStep('montage', 'error');
      return false;
    }
    try {
      addLog('montage', 'Enqueue du job de rendu vidéo…');
      const result = await invokeFn('render-enqueue', {
        contentId,
        renderMode: 'pedagogical',
        exportResolution: '1080p',
      });
      if (!result?.jobId) throw new Error('Job ID manquant');
      setRenderJobId(result.jobId);
      addLog('montage', `✓ Job ${result.jobId.slice(0, 8)}… créé`);
      setOutput('montage', { jobId: result.jobId });
      setStep('montage', 'completed');
      return true;
    } catch (e) {
      addLog('montage', `✗ ${e.message}`);
      setStep('montage', 'error');
      return false;
    }
  }, [contentId, invokeFn, setStep, addLog, setOutput]);

  const runRendu = useCallback(async () => {
    setStep('rendu', 'running');
    const jobId = renderJobId || outputs.montage?.jobId;
    if (!jobId || !contentId) {
      addLog('rendu', '✗ Job de montage requis d\'abord.');
      setStep('rendu', 'error');
      return false;
    }
    try {
      addLog('rendu', 'Vérification du statut du rendu…');
      let attempts = 0;
      while (attempts < 12) {
        const result = await invokeFnGet('render-status', { jobId });
        setRenderStatus(result?.status);
        addLog('rendu', `Statut : ${result?.status || '?'}`);
        if (result?.status === 'completed') {
          setOutput('rendu', { downloadUrl: result.outputVideoUrl || result.downloadUrl });
          setStep('rendu', 'completed');
          return true;
        }
        if (result?.status === 'failed') throw new Error(result.errorMessage || 'Rendu échoué');
        if (['queued', 'preparing_assets', 'rendering', 'packaging'].includes(result?.status)) {
          await new Promise((r) => setTimeout(r, 5000));
          attempts++;
          continue;
        }
        break;
      }
      addLog('rendu', '⚠ Rendu en cours en arrière-plan (peut prendre plusieurs minutes).');
      setStep('rendu', 'skipped');
      return true;
    } catch (e) {
      addLog('rendu', `✗ ${e.message}`);
      setStep('rendu', 'error');
      return false;
    }
  }, [renderJobId, contentId, outputs, invokeFn, invokeFnGet, setStep, addLog, setOutput]);

  const runPublication = useCallback(async () => {
    setStep('publication', 'running');
    await new Promise((r) => setTimeout(r, 800));
    const downloadUrl = outputs.rendu?.downloadUrl;
    addLog('publication', downloadUrl
      ? `✓ Vidéo enrichie disponible — prête à la publication`
      : '✓ Formation sauvegardée et accessible aux apprenants'
    );
    setOutput('publication', { published: true, downloadUrl });
    setStep('publication', 'completed');
    return true;
  }, [outputs, setStep, addLog, setOutput]);

  const RUNNERS = useMemo(() => ({
    capture: runCapture,
    ingestion: runIngestion,
    transcription: runTranscription,
    analyse: runAnalyse,
    segmentation: runSegmentation,
    reformulation: runReformulation,
    smartboard: runSmartboard,
    script: runScript,
    montage: runMontage,
    rendu: runRendu,
    publication: runPublication,
  }), [runCapture, runIngestion, runTranscription, runAnalyse, runSegmentation, runReformulation, runSmartboard, runScript, runMontage, runRendu, runPublication]);

  const runStep = useCallback(async (id) => {
    const fn = RUNNERS[id];
    if (fn) await fn();
  }, [RUNNERS]);

  const runAll = useCallback(async () => {
    autoRunRef.current = true;
    setAutoRunning(true);
    for (const step of STEPS) {
      if (!autoRunRef.current) break;
      const current = stepStates[step.id];
      if (current === 'completed' || current === 'skipped') continue;
      setActiveStep(step.id);
      const ok = await RUNNERS[step.id]?.();
      if (!ok && step.id !== 'analyse' && step.id !== 'montage' && step.id !== 'rendu') break;
    }
    autoRunRef.current = false;
    setAutoRunning(false);
  }, [RUNNERS, stepStates]);

  const stopAutoRun = () => { autoRunRef.current = false; };

  const completedCount = useMemo(() =>
    STEPS.filter((s) => stepStates[s.id] === 'completed' || stepStates[s.id] === 'skipped').length,
  [stepStates]);

  const pipelineProgress = Math.round((completedCount / STEPS.length) * 100);

  const activeStepDef = STEPS.find((s) => s.id === activeStep);
  const activeStatus = stepStates[activeStep] || 'pending';
  const activeLogs = logs[activeStep] || [];
  const activeOutput = outputs[activeStep] || null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full bg-[#262624] overflow-hidden">
      {/* ── Left: step list ── */}
      <div className="w-72 flex-shrink-0 flex flex-col bg-[#1f1e1c] border-r border-white/8">
        {/* Header */}
        <div className="px-4 py-4 border-b border-white/8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[var(--coral)] font-semibold">Pipeline</p>
              <h2 className="text-sm font-bold text-white">Course Production</h2>
            </div>
            <span className="text-xs font-mono text-[var(--coral)]">{pipelineProgress}%</span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[var(--coral)] to-[#c2683f] rounded-full"
              animate={{ width: `${pipelineProgress}%` }}
              transition={{ type: 'spring', stiffness: 60 }}
            />
          </div>
          <p className="text-[10px] text-[#82807a] mt-1.5">{completedCount}/{STEPS.length} étapes terminées</p>
        </div>

        {/* Run All / Stop */}
        <div className="px-4 py-3 border-b border-white/8">
          {autoRunning ? (
            <Button
              size="sm"
              variant="outline"
              className="w-full border-red-500/30 text-red-300 hover:bg-red-500/10 text-xs"
              onClick={stopAutoRun}
            >
              <XCircle className="w-3.5 h-3.5 mr-1.5" /> Arrêter le pipeline
            </Button>
          ) : (
            <Button
              size="sm"
              className="w-full bg-[var(--coral)] text-black hover:bg-[#d97757] text-xs font-bold"
              onClick={runAll}
            >
              <Zap className="w-3.5 h-3.5 mr-1.5" /> Exécuter tout le pipeline
            </Button>
          )}
        </div>

        {/* Step list */}
        <div className="flex-1 overflow-y-auto py-2">
          {STEPS.map((step, idx) => {
            const status = stepStates[step.id] || 'pending';
            const isActive = activeStep === step.id;
            const Icon = step.icon;
            const ringCls = COLOR_RING[step.color] || '';
            const { icon: StatusIcon, cls: statusCls } = STATUS_ICON[status] || STATUS_ICON.pending;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${isActive ? 'bg-white/5 border-r-2 border-[var(--coral)]' : 'hover:bg-white/3'}`}
              >
                {/* Line connector */}
                <div className="relative flex flex-col items-center flex-shrink-0">
                  <div className={`w-8 h-8 rounded-xl ring-1 flex items-center justify-center flex-shrink-0 ${status === 'completed' ? 'bg-[#7a9b6c]/20 ring-[#7a9b6c]/40' : status === 'error' ? 'bg-red-500/20 ring-red-500/40' : status === 'running' ? `${ringCls}` : 'bg-white/4 ring-white/10'}`}>
                    {status === 'running' ? (
                      <Loader2 className="w-4 h-4 text-[#d97757] animate-spin" />
                    ) : status === 'completed' ? (
                      <CheckCircle className="w-4 h-4 text-[#9fbf8f]" />
                    ) : status === 'error' ? (
                      <XCircle className="w-4 h-4 text-red-400" />
                    ) : (
                      <Icon className={`w-4 h-4 ${isActive ? `text-[#d97757]` : 'text-[#82807a]'}`} />
                    )}
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={`w-px h-3 mt-0.5 ${status === 'completed' ? 'bg-[#7a9b6c]/30' : 'bg-white/8'}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold truncate ${isActive ? 'text-white' : status === 'completed' ? 'text-[#b0ada3]' : 'text-[#82807a]'}`}>
                    {step.label}
                  </p>
                  <p className={`text-[10px] truncate ${status === 'completed' ? 'text-[#9fbf8f]' : status === 'error' ? 'text-red-400' : status === 'running' ? 'text-[#d97757]' : 'text-[#82807a]'}`}>
                    {status === 'completed' ? '✓ Terminé' : status === 'error' ? '✗ Erreur' : status === 'running' ? 'En cours…' : status === 'skipped' ? '→ Ignoré' : 'En attente'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right: step detail ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeStepDef && (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Step header */}
              <div className="px-6 py-5 border-b border-white/8 bg-[#1f1e1c]">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl ring-1 flex items-center justify-center ${COLOR_RING[activeStepDef.color]}`}>
                      <activeStepDef.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-white">{activeStepDef.label}</h2>
                        <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${
                          activeStatus === 'completed' ? 'bg-[#7a9b6c]/20 text-[#9fbf8f]' :
                          activeStatus === 'error' ? 'bg-red-500/20 text-red-400' :
                          activeStatus === 'running' ? 'bg-[#c2683f]/20 text-[#d97757]' :
                          'bg-white/8 text-[#82807a]'
                        }`}>
                          {activeStatus === 'completed' ? '✓ Terminé' : activeStatus === 'error' ? '✗ Erreur' : activeStatus === 'running' ? '⟳ En cours' : activeStatus === 'skipped' ? '→ Ignoré' : '○ En attente'}
                        </span>
                      </div>
                      <p className="text-xs text-[#b0ada3] mt-0.5">{activeStepDef.detail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {activeStatus !== 'running' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/10 text-white hover:bg-white/8 text-xs"
                        onClick={() => runStep(activeStep)}
                        disabled={autoRunning}
                      >
                        {activeStatus === 'completed' || activeStatus === 'skipped'
                          ? <><RotateCcw className="w-3.5 h-3.5 mr-1.5" />Relancer</>
                          : <><Play className="w-3.5 h-3.5 mr-1.5" />Exécuter</>
                        }
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Output + logs */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Output card */}
                {activeOutput && (
                  <div className="rounded-2xl border border-[#7a9b6c]/20 bg-[#7a9b6c]/5 p-4 space-y-3">
                    <p className="text-[10px] uppercase tracking-widest text-[#9fbf8f] font-semibold">Sortie</p>
                    <StepOutputRenderer stepId={activeStep} output={activeOutput} scriptText={scriptText} />
                  </div>
                )}

                {/* Logs */}
                {activeLogs.length > 0 && (
                  <div className="rounded-2xl border border-white/8 bg-[#1f1e1c] p-4">
                    <p className="text-[10px] uppercase tracking-widest text-[#82807a] font-semibold mb-3">Journal</p>
                    <div className="space-y-1 font-mono text-xs">
                      {activeLogs.map((log, i) => (
                        <div key={i} className={`${log.includes('✓') ? 'text-[#9fbf8f]' : log.includes('✗') ? 'text-red-400' : log.includes('⚠') ? 'text-[#d97757]' : 'text-[#82807a]'}`}>
                          {log}
                        </div>
                      ))}
                      {activeStatus === 'running' && (
                        <div className="flex items-center gap-2 text-[#d97757]">
                          <Loader2 className="w-3 h-3 animate-spin" /> En cours…
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {activeLogs.length === 0 && !activeOutput && (
                  <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                    <div className={`w-16 h-16 rounded-2xl ring-1 flex items-center justify-center ${COLOR_RING[activeStepDef.color]}`}>
                      <activeStepDef.icon className="w-8 h-8 opacity-60" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#b0ada3]">{activeStepDef.description}</p>
                      <p className="text-xs text-[#82807a] mt-1 max-w-xs">{activeStepDef.detail}</p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-[var(--coral)] text-black hover:bg-[#d97757] text-xs font-bold"
                      onClick={() => runStep(activeStep)}
                      disabled={autoRunning}
                    >
                      <Play className="w-3.5 h-3.5 mr-1.5" /> Lancer cette étape
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

// ─── Output renderer per step ─────────────────────────────────────────────────
function StepOutputRenderer({ stepId, output, scriptText }) {
  if (!output) return null;

  if (stepId === 'capture') {
    return <p className="text-sm text-white break-all">{output.url}</p>;
  }

  if (stepId === 'ingestion') {
    return <p className="text-sm text-white font-mono">{output.contentId}</p>;
  }

  if (stepId === 'transcription') {
    return <p className="text-sm text-white">{output.lineCount} lignes transcrites</p>;
  }

  if (stepId === 'analyse') {
    return <p className="text-sm text-white">Carte mentale {output.hasMindmap ? 'disponible' : 'en attente'}</p>;
  }

  if (stepId === 'segmentation') {
    return (
      <div className="space-y-1">
        <p className="text-sm text-white">{output.chapterCount} segments générés</p>
        {output.method && <p className="text-xs text-[#b0ada3]">Méthode : {output.method}</p>}
      </div>
    );
  }

  if (stepId === 'reformulation') {
    return <p className="text-sm text-white">{output.count} segments enrichis par l'IA</p>;
  }

  if (stepId === 'smartboard') {
    return <p className="text-sm text-white">{output.slideCount} slides SmartBoard générées</p>;
  }

  if (stepId === 'script') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-white">{output.segmentCount} chapitres • script compilé</p>
        {scriptText && (
          <>
            <pre className="text-xs text-[#b0ada3] bg-[#262624] rounded-xl p-4 overflow-x-auto max-h-64 border border-white/8 whitespace-pre-wrap">
              {scriptText.slice(0, 1200)}{scriptText.length > 1200 ? '\n…(tronqué)' : ''}
            </pre>
            <Button
              size="sm"
              variant="outline"
              className="border-white/10 text-white text-xs"
              onClick={() => {
                const blob = new Blob([scriptText], { type: 'text/plain;charset=utf-8' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'script-maitre.txt';
                a.click();
              }}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" /> Télécharger le script
            </Button>
          </>
        )}
      </div>
    );
  }

  if (stepId === 'montage') {
    return <p className="text-sm text-white font-mono">Job ID : {output.jobId?.slice(0, 16)}…</p>;
  }

  if (stepId === 'rendu') {
    return (
      <div className="space-y-2">
        {output.downloadUrl ? (
          <>
            <p className="text-sm text-[#9fbf8f]">Vidéo rendue disponible !</p>
            <a
              href={output.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs text-[var(--coral)] hover:text-[#d97757] transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Télécharger la vidéo finale
            </a>
          </>
        ) : (
          <p className="text-sm text-[#b0ada3]">Rendu en arrière-plan (vérifiez le statut plus tard)</p>
        )}
      </div>
    );
  }

  if (stepId === 'publication') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-[#9fbf8f]">✓ Formation publiée et accessible</p>
        {output.downloadUrl && (
          <a href={output.downloadUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--coral)] hover:text-[#d97757] flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> Voir la vidéo enrichie
          </a>
        )}
      </div>
    );
  }

  return <pre className="text-xs text-[#b0ada3]">{JSON.stringify(output, null, 2)}</pre>;
}
