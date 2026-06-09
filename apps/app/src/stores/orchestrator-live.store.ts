/**
 * Orchestrator Live Store — Zustand
 * État partagé entre OrchestratorLiveDashboard, SmartboardStreaming et leurs V2.
 *
 * Alimente :
 *   - OrchestratorLiveDashboardPage  (agents, chapters, logs, queue)
 *   - SmartboardStreamingPage        (chapters, slides, selectedChapterId, selectedStep)
 *   - OrchestratorLiveV2             (même données)
 *   - SmartboardStreamingV2          (même données)
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { getApiBaseUrl } from '@/lib/apiBase';

// ─── Helpers internes ─────────────────────────────────────────────────────────

const MAX_LOGS = 200; // cap pour éviter un memory leak sur longue session

/**
 * Table de correspondance noms factory V2 (26 seg) → noms canoniques streaming (21 seg).
 * Permet de relier les slides issus de liri-masterclass-factory aux boutons
 * de SmartboardStreamingV2 sans aucune perte de contenu.
 */
const FACTORY_TO_STREAMING: Record<string, string> = {
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

/** Normalise un nom de segment factory vers le nom canonique du streaming. */
function normalizeSegName(name: string): string {
  if (!name) return name;
  return FACTORY_TO_STREAMING[name] ?? name;
}

/** Construit des éléments de slide basiques depuis un segment LIRI. */
function buildSlideElements(seg) {
  const els = [];
  if (seg.title)
    els.push({ id: 'el_title',   type: 'title',     content: seg.title,                     x: 40,  y: 60,  width: 957, height: 60,  fontSize: 28, color: '#ffffff' });
  if (seg.content)
    els.push({ id: 'el_content', type: 'paragraph', content: seg.content,                   x: 40,  y: 140, width: 957, height: 200, fontSize: 14 });
  if (seg.oral_script)
    els.push({ id: 'el_script',  type: 'quote',     content: seg.oral_script.slice(0, 200), x: 40,  y: 360, width: 600, height: 80,  color: '#D4AF37' });
  (seg.key_points ?? []).slice(0, 3).forEach((kp, i) =>
    els.push({ id: `el_kp${i}`, type: 'bullet', content: kp, x: 40, y: 460 + i * 50, width: 600, height: 40, fontSize: 13 })
  );
  return els;
}

// ─── Valeurs initiales ────────────────────────────────────────────────────────

const INITIAL_AGENTS = [
  { id: 'coach',      name: 'Coach',      status: 'idle', currentTask: '', progress: 0, jobsProcessed: 0, error: null },
  { id: 'visual',     name: 'Visual',     status: 'idle', currentTask: '', progress: 0, jobsProcessed: 0, error: null },
  { id: 'smartboard', name: 'SmartBoard', status: 'idle', currentTask: '', progress: 0, jobsProcessed: 0, error: null },
  { id: 'quality',    name: 'Quality',    status: 'idle', currentTask: '', progress: 0, jobsProcessed: 0, error: null },
];

const INITIAL_QUEUE = {
  coach_queue:      [],
  visual_queue:     [],
  smartboard_queue: [],
  quality_queue:    [],
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useOrchestratorLiveStore = create(
  devtools(
    (set, get) => ({
      // ── État ─────────────────────────────────────────────────────────────
      projectId:         null,
      status:            'idle',   // 'idle' | 'running' | 'completed' | 'error'
      agents:            INITIAL_AGENTS,
      chapters:          [],
      slides:            [],
      logs:              [],
      queue:             INITIAL_QUEUE,
      selectedChapterId:  null,
      selectedStep:       'design',
      selectedSegment:    null,   // nom du segment LIRI ex: "JE RETIENS" (prioritaire sur selectedStep)
      pollingInterval:    null,

      // ── Sélection ─────────────────────────────────────────────────────────
      selectChapter:        (chapterId) => set({ selectedChapterId: chapterId }),
      setSelectedChapterId: (id)        => set({ selectedChapterId: id }),
      selectStep:           (step)      => set({ selectedStep: step, selectedSegment: null }),
      selectSegment:        (name)      => set({ selectedSegment: name }),

      // ── Démarrer un projet ────────────────────────────────────────────────
      startProject: async (rawText) => {
        if (!rawText?.trim()) return;
        set({ status: 'running', projectId: `proj_${Date.now()}`, logs: [], chapters: [], slides: [] });
        try {
          const res = await fetch(`${getApiBaseUrl()}/smartboard/formation-engine`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: rawText, duration: 90, level: 'intermediate' }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          const resolvedProjectId = data.id ?? data.projectId ?? get().projectId;
          set({ projectId: resolvedProjectId });
          get()._startPolling(resolvedProjectId);
        } catch (err) {
          get()._addLog({ agent: 'system', level: 'error', message: `Erreur démarrage : ${err.message}` });
          set({ status: 'error' });
        }
      },

      // ── Arrêter ───────────────────────────────────────────────────────────
      stopPolling: () => {
        const { pollingInterval } = get();
        if (pollingInterval) clearInterval(pollingInterval);
        set({ pollingInterval: null, status: get().status === 'running' ? 'idle' : get().status });
      },

      stopProject: () => get().stopPolling(),

      // ── Polling de statut ─────────────────────────────────────────────────
      _startPolling: (projectId) => {
        let pollCount = 0;
        const MAX_POLLS = 60; // ~3 min à 3s — circuit-breaker
        const interval = setInterval(async () => {
          pollCount++;
          if (pollCount > MAX_POLLS) {
            clearInterval(interval);
            set({ pollingInterval: null, status: 'error' });
            get()._addLog({ agent: 'system', level: 'error', message: 'Timeout — polling arrêté après 3 min.' });
            return;
          }
          try {
            const res = await fetch(`${getApiBaseUrl()}/masterclass-factory/${projectId}`);
            if (!res.ok) return;
            const data = await res.json();
            set({
              status:   data.status   ?? 'running',
              agents:   data.agents   ?? get().agents,
              chapters: data.chapters ?? [],
              slides:   data.slides   ?? [],
              queue:    data.queue    ?? get().queue,
              logs:     data.logs     ?? [],
            });
            if (data.status === 'completed' || data.status === 'error') {
              clearInterval(interval);
              set({ pollingInterval: null });
            }
          } catch {}
        }, 3000);
        set({ pollingInterval: interval });
      },

      pollStatus: () => {
        const { projectId } = get();
        if (projectId) get()._startPolling(projectId);
      },

      // ── Actions SmartBoard Streaming ──────────────────────────────────────
      generateCurrentSlide: async () => {
        const { projectId, selectedChapterId, selectedStep, selectedSegment, chapters } = get();
        if (!projectId || !selectedChapterId) return;

        // Contexte chapitre embarqué dans le body — évite le fallback Supabase vide
        // pour les projets Factory (projectId = 'factory_xxx' inexistant en DB)
        const activeChap = chapters.find((c: any) => c.id === selectedChapterId);
        const chapterCtx = activeChap
          ? { chapterTitle: activeChap.title, chapterSummary: activeChap.summary ?? '' }
          : {};

        // Mode segment nommé (prioritaire) ou mode étape générique
        const body = selectedSegment
          ? { projectId, chapterId: selectedChapterId, segmentName: selectedSegment, ...chapterCtx }
          : { projectId, chapterId: selectedChapterId, step: selectedStep, ...chapterCtx };

        try {
          const res = await fetch(`${getApiBaseUrl()}/smartboard/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!res.ok) return;
          const data = await res.json();
          const incoming = data.slide ?? {};

          // Dédoublonnage selon le mode
          const slides = get().slides.filter(s => {
            if (selectedSegment) return !(s.chapterId === selectedChapterId && s.segmentName === selectedSegment);
            return !(s.chapterId === selectedChapterId && s.step === selectedStep);
          });
          set({ slides: [...slides, incoming] });
          get()._addLog({
            agent: 'smartboard', level: 'success',
            message: selectedSegment
              ? `Slide "${selectedSegment}" généré`
              : `Slide "${selectedStep}" généré`,
          });
        } catch (err) {
          get()._addLog({ agent: 'smartboard', level: 'error', message: `Génération échouée : ${err.message}` });
        }
      },

      regenerateCurrentSlide: async () => {
        const { selectedSegment, selectedStep } = get();
        get()._addLog({
          agent: 'smartboard', level: 'info',
          message: `Régénération : ${selectedSegment ?? selectedStep}…`,
        });
        await get().generateCurrentSlide();
      },

      validateCurrentSlide: async () => {
        const { selectedChapterId, selectedStep, selectedSegment } = get();
        set({
          slides: get().slides.map(s => {
            const match = selectedSegment
              ? s.chapterId === selectedChapterId && s.segmentName === selectedSegment
              : s.chapterId === selectedChapterId && s.step === selectedStep;
            return match ? { ...s, state: 'validated' } : s;
          }),
        });
        get()._addLog({
          agent: 'quality', level: 'success',
          message: `Slide validé (${selectedSegment ?? selectedStep})`,
        });
      },

      nextStep: () => {
        const STEPS_ORDER = ['waiting', 'design', 'pedagogy', 'final'];
        const { selectedStep } = get();
        const idx = STEPS_ORDER.indexOf(selectedStep);
        if (idx < STEPS_ORDER.length - 1) {
          set({ selectedStep: STEPS_ORDER[idx + 1] });
        }
      },

      exportStreamJson: () => {
        const { chapters, slides, projectId } = get();
        return { projectId, chapters, slides, exportedAt: new Date().toISOString() };
      },

      // ── Charger depuis la Factory (chapitres + segments → slides) ────────
      loadFromFactory: (chapters, pedagogy) => {
        const source = pedagogy?.length ? pedagogy : chapters;
        if (!source?.length) return;

        const projectId    = `factory_${Date.now()}`;

        // ── Construction des slides (avec dédoublonnage) ──────────────────────
        const slides: any[] = [];
        const seenSlides = new Set<string>();
        // Compteur slides par chapitre (pour slides_count)
        const slideCountById: Record<string, number> = {};

        source.forEach(ch => {
          const chId = ch.id || ch.chapterId || `ch_${ch.title}`;
          (ch.segments ?? []).forEach((seg: any) => {
            const canonicalName = normalizeSegName(seg.name);
            const slideKey = `${chId}::${canonicalName}`;
            if (seenSlides.has(slideKey)) return;
            seenSlides.add(slideKey);
            slides.push({
              chapterId:   chId,
              segmentName: canonicalName,
              state:       seg.status === 'done' ? 'validated' : 'draft',
              elements:    buildSlideElements(seg),
              accentColor: null,
            });
            slideCountById[chId] = (slideCountById[chId] ?? 0) + 1;
          });
        });

        // ── Chapitres normalisés (chapter_id + slides_count + status 'completed') ─
        const storeChapters = source.map((ch: any, i: number) => {
          const chId = ch.id || ch.chapterId || `ch${i}`;
          return {
            id:          chId,
            chapter_id:  chId,   // alias pour OrchestratorLiveV2
            title:       ch.title || `Chapitre ${i + 1}`,
            summary:     ch.objective || ch.summary || '',
            status:      'completed',              // était 'done' — corrigé B1
            segments:    ch.segments || [],
            slides_count: slideCountById[chId] ?? 0, // corrigé B3
          };
        });

        get().stopPolling();
        set({
          projectId,
          status:            'completed',
          chapters:          storeChapters,
          slides,
          selectedChapterId: storeChapters[0]?.id ?? null,
          selectedSegment:   null,
          logs:              [],
          queue:             INITIAL_QUEUE,
          agents:            INITIAL_AGENTS,
        });
        get()._addLog({ agent: 'factory', level: 'success', message: `${source.length} chapitres chargés depuis la Factory (${slides.length} slides)` });
      },

      // ── Logs internes ─────────────────────────────────────────────────────
      _addLog: (entry) => {
        const logs = get().logs;
        // Cap à MAX_LOGS pour éviter un memory leak en longue session
        const capped = logs.length >= MAX_LOGS ? logs.slice(-(MAX_LOGS - 1)) : logs;
        set({ logs: [...capped, { ...entry, timestamp: new Date().toISOString() }] });
      },

      // ── Reset ─────────────────────────────────────────────────────────────
      reset: () => {
        get().stopPolling();
        set({
          projectId: null, status: 'idle',
          agents: INITIAL_AGENTS, chapters: [], slides: [],
          logs: [], queue: INITIAL_QUEUE,
          selectedChapterId: null, selectedStep: 'design', selectedSegment: null,
        });
      },
    }),
    { name: 'liri-orchestrator-live' }
  )
);
