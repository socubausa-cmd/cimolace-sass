import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { courseBuilderApi } from '@/lib/api-v2';
import { normalizeReturnTo, safeDesignerReturnPathForState } from '@/lib/returnToNavigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { AnimatePresence } from 'framer-motion';
import { useSmartboardKonvaStore } from '@/features/smartboard-konva-editor/store/useSmartboardKonvaStore';
import { useCourseCopilotStore } from '@/features/smartboard-konva-editor/store/useCourseCopilotStore';
import { syncToCanvasSlideIndex } from '@/features/smartboard-konva-editor/lib/postProdTimelineCanvasBridge';
import {
  bridgeableSlideIndexCount,
  hasDuplicateChapterSlideTargets,
  resolveSlideIndexForChapter,
  resolveChapterIndexForSlide,
} from '@/lib/chapterSlideMap';
import {
  usePostProdNleStore,
  buildPreviewFilterFromNle,
} from '@/features/smartboard-konva-editor/store/usePostProdNleStore';
import MindMapNavigation from '@/components/lesson-player/MindMapNavigation';
import NodeExplanationPanel from '@/components/lesson-player/NodeExplanationPanel';
import { ArrowLeft, Check, Clapperboard, GraduationCap, LayoutGrid, Loader2, Plus, Sparkles, Trash } from 'lucide-react';
import SplitScreenCoursePreview from '@/components/course-builder/SplitScreenCoursePreview';
import SegmentAIEditorPanel from '@/components/course-builder/SegmentAIEditorPanel';
import CoursePipelineView from '@/components/course-builder/CoursePipelineView';
import NleEngineWorkspace from '@/features/nle-engine/components/NleEngineWorkspace';
import { useNleProjectStore } from '@/features/nle-engine/store/useNleProjectStore';
import { applyNleProjectToChapterRows } from '@/lib/nleEngine/applyNleProjectToChapterRows';

const EXPORT_RESOLUTION_OPTIONS = [
  { id: '720p', label: '720p HD' },
  { id: '1080p', label: '1080p Full HD' },
  { id: '1440p', label: '1440p QHD' },
  { id: '4k', label: '4K UHD' },
];

const isUuid = (value) => {
  if (!value) return false;
  const s = String(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
};

const parseTimestampToSeconds = (value) => {
  const v = String(value || '').trim();
  if (!v) return null;
  if (/^\d+(\.\d+)?$/.test(v)) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  const m = /^(\d+):(\d{1,2})$/.exec(v);
  if (m) {
    const mm = Number(m[1]);
    const ss = Number(m[2]);
    if (!Number.isFinite(mm) || !Number.isFinite(ss) || mm < 0 || ss < 0 || ss >= 60) return null;
    return mm * 60 + ss;
  }
  return null;
};

const formatSecondsToTimeText = (seconds) => {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${mm}:${String(ss).padStart(2, '0')}`;
};

const round05 = (v) => Math.round(Number(v) * 2) / 2;

const makeSafeId = (s) =>
  String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 42) || `node-${Date.now()}`;

/** Sync dock latéral ↔ onglets internes (vue « classique » ne remonte pas pour éviter conflit source/transcript/segments). */
function mapPostProdViewToDockTool(view) {
  if (view === 'smartboard') return 'properties';
  if (view === 'nle') return 'nle';
  if (view === 'assistant') return 'assistant';
  if (view === 'pipeline') return 'pipeline';
  return null;
}

/**
 * @param {{
 *   contentId?: string;
 *   videoData?: Record<string, unknown> | null;
 *   onClose?: () => void;
 *   onValidated?: () => void;
 *   embeddedUiMode?: 'designer-dock' | null;
 *   syncedDockTool?: 'source'|'transcript'|'segments'|'nle'|'pipeline'|'assistant'|'properties' | null;
 *   onEmbeddedViewChange?: (tool: 'source'|'transcript'|'segments'|'nle'|'pipeline'|'assistant'|'properties') => void;
 * }} props
 */
const VideoPostProductionPage = ({
  contentId: contentIdProp,
  videoData: videoDataProp,
  onClose,
  onValidated,
  embeddedUiMode = null,
  syncedDockTool = null,
  onEmbeddedViewChange,
}) => {
  const { contentId: contentIdFromParams } = useParams();
  const contentId = contentIdProp || contentIdFromParams;
  const navigate = useNavigate();
  const location = useLocation();
  const embedded = typeof onClose === 'function' || typeof onValidated === 'function';
  const dockEmbed = Boolean(embedded && embeddedUiMode === 'designer-dock');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [asrLoading, setAsrLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [error, setError] = useState('');

  const [row, setRow] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [postProdView, setPostProdView] = useState('classic');
  const [smartboardMode, setSmartboardMode] = useState('pedagogical');
  const [segmentAiMap, setSegmentAiMap] = useState({});
  const [segmentAiLoading, setSegmentAiLoading] = useState(false);
  const [segmentAiSyncLoading, setSegmentAiSyncLoading] = useState(false);
  const [versionRows, setVersionRows] = useState([]);
  const [versionLoading, setVersionLoading] = useState(false);
  const [versionActionLoading, setVersionActionLoading] = useState(false);
  /** false si la ligne vient seulement de videoDataProp (non persistée) — l'IA serveur exige une ligne en base */
  const [contentPersistedInDb, setContentPersistedInDb] = useState(true);

  const [chapters, setChapters] = useState([]); // [{startText,endText,label}]
  /** URLs additionnelles pour `nleProject` clips `sourceRef` → fichier (export FFmpeg multi-entrées). */
  const [sourceVideoUrlsByRef, setSourceVideoUrlsByRef] = useState(/** @type {Record<string, string>} */ ({}));
  const [extraSourceRefInput, setExtraSourceRefInput] = useState('');
  const [extraSourceUrlInput, setExtraSourceUrlInput] = useState('');
  /** Index slide Copilot / scène Konva pour chaque chapitre (même longueur que `chapters`). */
  const [chapterSlideMap, setChapterSlideMap] = useState(/** @type {number[]} */ ([]));
  const [transcript, setTranscript] = useState([]); // [{timeText,text}]
  const [mindmapJsonText, setMindmapJsonText] = useState('');
  const [transcriptEditorOpen, setTranscriptEditorOpen] = useState(false);
  const [mindmapPreviewOpen, setMindmapPreviewOpen] = useState(false);
  const [selectedMindmapNode, setSelectedMindmapNode] = useState(null);


  const transcriptRowRefs = useRef([]);
  const transcriptScrollRef = useRef(null);
  const transcriptScrollRafRef = useRef(null);
  const [activeChapterIdx, setActiveChapterIdx] = useState(null);

  const nleProjectForPreview = useNleProjectStore((s) => s.project);
  const chaptersForPreview = useMemo(
    () => applyNleProjectToChapterRows(chapters, nleProjectForPreview),
    [chapters, nleProjectForPreview],
  );

  const activeSegment = useMemo(() => {
    if (activeChapterIdx == null) return null;
    const current = chaptersForPreview?.[activeChapterIdx];
    if (!current) return null;
    return {
      index: activeChapterIdx,
      label: String(current.label || '').trim() || `Chapitre ${activeChapterIdx + 1}`,
      startSeconds: parseTimestampToSeconds(current.startText),
      endSeconds: parseTimestampToSeconds(current.endText),
    };
  }, [activeChapterIdx, chaptersForPreview]);

  const activeAiRow = useMemo(() => {
    if (activeChapterIdx == null) return null;
    return segmentAiMap[String(activeChapterIdx)] || null;
  }, [activeChapterIdx, segmentAiMap]);

  useEffect(() => {
    if (activeChapterIdx != null) return;
    if (!Array.isArray(chapters) || chapters.length === 0) return;
    setActiveChapterIdx(0);
  }, [activeChapterIdx, chapters]);

  // Preview
  const videoRef = useRef(null);
  const clipStopAtRef = useRef(null);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [chapterIn, setChapterIn] = useState('');
  const [chapterOut, setChapterOut] = useState('');

  const canUsePostProd = useMemo(() => {
    return Boolean(videoUrl);
  }, [videoUrl]);

  const smartboardDesignerHref = useMemo(() => {
    if (embedded || !contentId || !isUuid(contentId)) return null;
    const back = `${location.pathname}${location.search || ''}`;
    return `/studio/smartboard-designer?pp=${encodeURIComponent(contentId)}&returnTo=${encodeURIComponent(back)}`;
  }, [embedded, contentId, location.pathname, location.search]);

  /** Même mécanisme que le dock : `designerReturn` pour le bandeau « Retour au designer ». */
  const courseBuilderWithDesignerReturnHref = useMemo(() => {
    if (embedded || !contentId || !isUuid(contentId)) return null;
    const designer = safeDesignerReturnPathForState(
      `/studio/smartboard-designer?pp=${encodeURIComponent(contentId)}`,
    );
    if (!designer) return null;
    return `/studio/course-builder?designerReturn=${encodeURIComponent(designer)}`;
  }, [embedded, contentId]);

  const dockSectionRefs = useRef(
    /** @type {{ preview: HTMLElement | null; chapters: HTMLElement | null; transcript: HTMLElement | null }} */ ({
      preview: null,
      chapters: null,
      transcript: null,
    }),
  );

  useEffect(() => {
    if (!dockEmbed || typeof onEmbeddedViewChange !== 'function') return;
    const t = mapPostProdViewToDockTool(postProdView);
    if (t) onEmbeddedViewChange(t);
  }, [dockEmbed, postProdView, onEmbeddedViewChange]);

  useEffect(() => {
    if (!dockEmbed || !syncedDockTool) return;
    const tool = syncedDockTool;
    const scroll = (/** @type {'preview'|'chapters'|'transcript'} */ key) => {
      window.requestAnimationFrame(() => {
        dockSectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };
    if (tool === 'source') {
      setPostProdView('classic');
      scroll('preview');
      return;
    }
    if (tool === 'segments') {
      setPostProdView('classic');
      scroll('chapters');
      return;
    }
    if (tool === 'transcript') {
      setPostProdView('classic');
      scroll('transcript');
      return;
    }
    if (tool === 'nle') {
      setPostProdView('nle');
      return;
    }
    if (tool === 'pipeline') {
      setPostProdView('pipeline');
      return;
    }
    if (tool === 'assistant') {
      setPostProdView('assistant');
      return;
    }
    if (tool === 'properties') {
      setPostProdView('smartboard');
    }
  }, [dockEmbed, syncedDockTool]);

  const loadSegmentAiRows = async (targetContentId) => {
    if (!targetContentId) return;
    setSegmentAiSyncLoading(true);
    try {
      // Rebranché sur NestJS (la RLS bloque l'accès direct Supabase ; le backend
      // service-role renvoie { rows } scopé au tenant). Remplace l'ancien select direct.
      const res = await courseBuilderApi.listSegmentAi(targetContentId);
      const rows = Array.isArray(res?.rows) ? res.rows : [];
      const nextMap = {};
      rows.forEach((item) => {
        nextMap[String(item.segment_index)] = item;
      });
      setSegmentAiMap(nextMap);
    } catch {
      setSegmentAiMap({});
    } finally {
      setSegmentAiSyncLoading(false);
    }
  };

  const invokeCourseBuilderFunction = async (name, payload) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Session utilisateur introuvable.');
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
    const paths = [
      `/.netlify/functions/course-builder-${name}`,
      `/.netlify/functions/course-builder/${name}`,
    ];
    let lastError = null;
    for (const path of paths) {
      try {
        const response = await fetch(path, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        if (response.status === 404) {
          lastError = new Error('Endpoint non trouve');
          continue;
        }
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          const msg = [body?.error, body?.hint].filter(Boolean).join(' — ') || `Erreur endpoint (${response.status})`;
          throw new Error(msg);
        }
        return body;
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error('Impossible de contacter les endpoints Course Builder');
  };

  const invokeCourseBuilderFunctionGet = async (name, params = {}) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) throw new Error('Session utilisateur introuvable.');
    const query = new URLSearchParams(params).toString();
    const paths = [
      `/.netlify/functions/course-builder-${name}${query ? `?${query}` : ''}`,
      `/.netlify/functions/course-builder/${name}${query ? `?${query}` : ''}`,
    ];
    let lastError = null;
    for (const path of paths) {
      try {
        const response = await fetch(path, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.status === 404) {
          lastError = new Error('Endpoint non trouve');
          continue;
        }
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          const msg = [body?.error, body?.hint].filter(Boolean).join(' — ') || `Erreur endpoint (${response.status})`;
          throw new Error(msg);
        }
        return body;
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error('Impossible de contacter les endpoints Course Builder');
  };

  const loadVersionRows = async (targetContentId) => {
    if (!targetContentId) return;
    setVersionLoading(true);
    try {
      const body = await courseBuilderApi.postprodVersionList(targetContentId);
      setVersionRows(Array.isArray(body?.rows) ? body.rows : []);
    } catch {
      setVersionRows([]);
    } finally {
      setVersionLoading(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError('');
      setAiLoading(false);
      setAiMessage('');
      try {
        if (!contentId || !isUuid(contentId)) {
          throw new Error('contentId invalide');
        }

        let data = null;
        const { data: dbData, error: err } = await supabase
          .from('formation_day_contents')
          .select('id,day_id,type,data')
          .eq('id', contentId)
          .maybeSingle();

        if (err) throw err;

        if (!dbData && videoDataProp) {
          // Not yet persisted — build a synthetic row from the prop
          setContentPersistedInDb(false);
          data = {
            id: contentId,
            day_id: null,
            type: 'video',
            data: videoDataProp,
          };
        } else {
          setContentPersistedInDb(Boolean(dbData));
          data = dbData;
        }

        if (!data) throw new Error('Vidéo introuvable');
        if (String(data.type || '').toLowerCase() !== 'video') throw new Error("Ce contenu n'est pas une vidéo");

        setRow(data);

        const d = data.data || {};
        const initialChapters = Array.isArray(d.chapters)
          ? d.chapters
              .map((c) => {
                const startSecs = Number.isFinite(Number(c?.startSeconds)) ? Number(c.startSeconds) : null;
                const endSecs = Number.isFinite(Number(c?.endSeconds)) ? Number(c.endSeconds) : null;
                return {
                  startText:
                    c?.startText ?? (startSecs != null ? formatSecondsToTimeText(startSecs) : ''),
                  endText:
                    c?.endText ?? (endSecs != null ? formatSecondsToTimeText(endSecs) : ''),
                  label: String(c?.label || ''),
                };
              })
              .filter((c) => c.startText || c.endText || c.label)
          : Array.isArray(d.timestamps)
            ? d.timestamps.map((t) => ({
                startText: t?.time ?? t?.timeText ?? (Number.isFinite(Number(t?.timeSeconds)) ? formatSecondsToTimeText(Number(t.timeSeconds)) : ''),
                endText: '',
                label: String(t?.label || ''),
              }))
            : [];
        setChapters(initialChapters);

        setSourceVideoUrlsByRef(
          d.sourceVideoUrlsByRef &&
            typeof d.sourceVideoUrlsByRef === 'object' &&
            !Array.isArray(d.sourceVideoUrlsByRef)
            ? { ...d.sourceVideoUrlsByRef }
            : {},
        );

        const slideMapRaw = Array.isArray(d.chapterSlideMap) ? d.chapterSlideMap : null;
        if (slideMapRaw && slideMapRaw.length === initialChapters.length) {
          setChapterSlideMap(slideMapRaw.map((n) => Math.max(0, Math.floor(Number(n) || 0))));
        } else if (initialChapters.length) {
          setChapterSlideMap(initialChapters.map((_, i) => i));
        } else {
          setChapterSlideMap([]);
        }

        setTranscript(
          Array.isArray(d.transcript)
            ? d.transcript.map((l) => ({
                timeText: l?.time ?? l?.timeText ?? (Number.isFinite(Number(l?.timeSeconds)) ? formatSecondsToTimeText(Number(l.timeSeconds)) : ''),
                text: String(l?.text || ''),
              }))
            : []
        );

        if (d.mindmap && typeof d.mindmap === 'object') {
          try {
            setMindmapJsonText(JSON.stringify(d.mindmap, null, 2));
          } catch {
            setMindmapJsonText('');
          }
        } else {
          setMindmapJsonText('');
        }

        const rawNle = d.nle && typeof d.nle === 'object' ? d.nle : {};
        usePostProdNleStore.getState().setGrade({
          exposure: Number(rawNle.exposure) || 0,
          contrast: Number(rawNle.contrast) > 0 ? Number(rawNle.contrast) : 100,
          saturation: Number(rawNle.saturation) > 0 ? Number(rawNle.saturation) : 100,
          warmth: Number(rawNle.warmth) || 0,
        });

        if (d.nleProject && typeof d.nleProject === 'object') {
          useNleProjectStore.getState().hydrate(d.nleProject);
          const mg = useNleProjectStore.getState().project.master?.colorGrade;
          if (mg && typeof mg === 'object') {
            usePostProdNleStore.getState().setGrade({
              exposure: Number(mg.exposure) || 0,
              contrast: Number(mg.contrast) > 0 ? Number(mg.contrast) : 100,
              saturation: Number(mg.saturation) > 0 ? Number(mg.saturation) : 100,
              warmth: Number(mg.warmth) || 0,
            });
          }
        } else {
          useNleProjectStore.getState().reset();
          const dur = Number(d.duration_seconds ?? d.duration) || 0;
          useNleProjectStore.getState().syncChapters(initialChapters, dur > 0 ? dur : 600);
        }

        const url = String(d.url || '');
        const storagePath = String(d.storagePath || '');

        if (storagePath) {
          const { data: signed, error: signedErr } = await supabase.storage
            .from('videos')
            .createSignedUrl(storagePath, 60 * 60);
          if (!signedErr && signed?.signedUrl) setVideoUrl(signed.signedUrl);
          else setVideoUrl(url);
        } else {
          setVideoUrl(url);
        }

        await Promise.all([loadSegmentAiRows(contentId), loadVersionRows(contentId)]);

      } catch (e) {
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [contentId, videoDataProp]);

  const generateTranscriptWithASR = async () => {
    if (!videoUrl) {
      setError('URL vidéo manquante.');
      return;
    }
    if (asrLoading) return;

    setAsrLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase.functions.invoke('generate-transcript', {
        body: { url: videoUrl, language: 'fr' },
      });

      if (err) {
        let detail = '';
        try { const body = await err.context?.json?.(); detail = body?.details || body?.error || ''; } catch { /* ignore */ }
        throw new Error(detail || err.message || 'Edge Function error');
      }
      const out = Array.isArray(data?.transcript) ? data.transcript : [];
      if (out.length === 0) throw new Error('Transcription vide');

      setTranscript(
        out.map((l) => ({
          timeText: String(l?.time || ''),
          text: String(l?.text || ''),
        }))
      );
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setAsrLoading(false);
    }
  };

  const generateMindmapFromChapters = () => {
    const normalized = (chapters || [])
      .map((c, idx) => {
        const start = parseTimestampToSeconds(c?.startText);
        return {
          idx,
          id: makeSafeId(c?.label || `chapitre-${idx + 1}`),
          label: String(c?.label || '').trim() || `Chapitre ${idx + 1}`,
          startSeconds: Number.isFinite(start) ? start : null,
        };
      })
      .filter((c) => c.label);

    const root = {
      id: 'root',
      label: 'Plan',
      time: '0:00',
      children: normalized.map((c) => ({
        id: c.id,
        label: c.label,
        time: c.startSeconds != null ? formatSecondsToTimeText(c.startSeconds) : '0:00',
        children: [],
      })),
    };

    setMindmapJsonText(JSON.stringify(root, null, 2));
  };

  const generateMindmapWithAI = async () => {
    if (!contentId) return;
    if (aiLoading) return;
    setAiLoading(true);
    setError('');
    setAiMessage('⏳ Démarrage de la génération…');
    const progressTimers = [
      window.setTimeout(() => setAiMessage('🔗 Connexion au modèle IA…'), 10_000),
      window.setTimeout(() => setAiMessage('🧠 Analyse de la transcription…'), 25_000),
      window.setTimeout(() => setAiMessage('✍️ Rédaction des explications par l\'IA…'), 55_000),
      window.setTimeout(() => setAiMessage('🔧 Structuration de la mindmap…'), 85_000),
      window.setTimeout(() => setAiMessage('⌛ Finalisation… encore quelques secondes'), 130_000),
    ];
    try {
      // Ensure the session is valid with a 10s timeout to avoid infinite hang.
      const userResult = await Promise.race([
        supabase.auth.getUser(),
        new Promise((_, reject) =>
          window.setTimeout(() => reject(new Error('getUser timeout')), 10_000)
        ),
      ]);
      const { data: userData, error: userErr } = userResult || {};
      if (userErr || !userData?.user) {
        console.warn('[generate-mindmap] getUser failed, signing out', userErr?.message);
        await supabase.auth.signOut();
        window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }
      console.info('[generate-mindmap] user OK:', userData.user.id);

      const { normalizedChapterSegments, normalizedTranscript } = buildSavePayload({ validateMindmap: false, validateChapters: false });

      if (!normalizedTranscript || normalizedTranscript.length === 0) {
        throw new Error("Ajoute au moins une ligne de transcription avant de lancer l'IA.");
      }

      const title = String(row?.data?.title || row?.data?.name || '').trim();

      const slimTranscript = (normalizedTranscript || []).slice(0, 150);
      const slimChapters = (normalizedChapterSegments || []).slice(0, 40);

      // Direct fetch bypasses all supabase-js internal token/signal handling that can hang.
      // verify_jwt=false means no valid JWT required — any Authorization value is accepted.
      const { data: sessionSnap } = await supabase.auth.getSession();
      const bearerToken = sessionSnap?.session?.access_token || '';

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const abortController = new AbortController();
      const abortTimeout = window.setTimeout(() => abortController.abort(), 180_000);

      console.time('[generate-mindmap] fetch');
      let fetchRes;
      try {
        fetchRes = await fetch(`${supabaseUrl}/functions/v1/generate-mindmap`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseAnonKey,
            ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
          },
          body: JSON.stringify({ title, chapters: slimChapters, transcript: slimTranscript }),
          signal: abortController.signal,
        });
        console.timeEnd('[generate-mindmap] fetch');
        console.info('[generate-mindmap] http status:', fetchRes.status);
      } catch (fetchErr) {
        console.timeEnd('[generate-mindmap] fetch');
        if (abortController.signal.aborted) {
          throw new Error('Timeout IA (3 min): la génération prend trop de temps. Réessaie.');
        }
        throw fetchErr;
      } finally {
        window.clearTimeout(abortTimeout);
      }

      if (!fetchRes.ok) {
        const errText = await fetchRes.text().catch(() => '');
        throw new Error(`Edge Function error ${fetchRes.status}: ${errText}`);
      }
      const data = await fetchRes.json().catch(() => null);

      if (data?.warning) {
        setAiMessage(String(data.warning));
      } else {
        setAiMessage('Mindmap générée.');
      }

      if (!data?.mindmap) {
        console.error('[generate-mindmap] unexpected payload', data);
        throw new Error('Réponse IA invalide (mindmap manquante)');
      }

      setMindmapJsonText(JSON.stringify(data.mindmap, null, 2));
    } catch (e) {
      console.error('[generate-mindmap] failed', e);
      const status = e?.context?.status;
      const body = e?.context?.body;
      const more = status || body ? ` (status: ${status ?? '—'}, body: ${typeof body === 'string' ? body : JSON.stringify(body)})` : '';
      const hint = status === 401 ? ' Vérifie que tu es bien connecté sur le même projet Supabase (token issu de ybmcz...) et réessaie après refresh.' : '';
      setError(`${String(e?.message || e)}${more}${hint}`);
      setAiMessage('');
    } finally {
      progressTimers.forEach((id) => window.clearTimeout(id));
      setAiLoading(false);
    }
  };

  const seekTo = (seconds) => {
    if (!videoRef.current) return;
    const d = Number(videoRef.current.duration || previewDuration || 0);
    const next = Math.max(0, Math.min(Number(seconds) || 0, Number.isFinite(d) && d > 0 ? d : Number.MAX_SAFE_INTEGER));
    try {
      videoRef.current.currentTime = next;
      setPreviewCurrentTime(next);
      videoRef.current.play?.().catch?.(() => {});
    } catch {
      // ignore
    }
  };

  const seekToRef = useRef(seekTo);
  seekToRef.current = seekTo;

  const konvaSceneIndex = useSmartboardKonvaStore((s) => {
    const scenes = s.project?.scenes ?? [];
    const id = s.project?.activeSceneId;
    const ix = scenes.findIndex((sc) => sc.id === id);
    return ix >= 0 ? ix : 0;
  });

  const copilotSlideCount = useCourseCopilotStore((s) =>
    Array.isArray(s.course?.slides) ? s.course.slides.length : 0
  );
  const sceneCount = useSmartboardKonvaStore((s) => s.project?.scenes?.length ?? 0);
  const bridgeableSlideCount = useMemo(
    () => bridgeableSlideIndexCount(copilotSlideCount, sceneCount),
    [copilotSlideCount, sceneCount]
  );
  const duplicateChapterSlides = useMemo(
    () => hasDuplicateChapterSlideTargets(chapterSlideMap),
    [chapterSlideMap]
  );

  useEffect(() => {
    const len = chapters?.length ?? 0;
    const sc = bridgeableSlideCount;
    if (!len) {
      setChapterSlideMap([]);
      return;
    }
    setChapterSlideMap((prev) => {
      if (!prev || prev.length !== len) {
        return Array.from({ length: len }, (_, i) => {
          if (prev && prev[i] != null && Number.isFinite(prev[i])) {
            return Math.max(0, Math.min(Math.floor(Number(prev[i])), sc - 1));
          }
          return Math.min(i, sc - 1);
        });
      }
      return prev.map((v) =>
        Math.max(0, Math.min(Number.isFinite(v) ? Math.floor(Number(v)) : 0, sc - 1))
      );
    });
  }, [chapters.length, bridgeableSlideCount]);

  const nleGrade = usePostProdNleStore((s) => s.grade);
  const nleFilterStyle = useMemo(() => ({ filter: buildPreviewFilterFromNle(nleGrade) }), [nleGrade]);

  /** Chapitre (timeline) → scène Konva + slide Copilot (designer dock), via `chapterSlideMap`. */
  useEffect(() => {
    if (!dockEmbed) return;
    if (activeChapterIdx == null) return;
    if (!(chapters || []).length) return;
    const slideIdx = resolveSlideIndexForChapter(
      activeChapterIdx,
      chapterSlideMap,
      bridgeableSlideCount,
      chapters.length
    );
    syncToCanvasSlideIndex(slideIdx);
  }, [dockEmbed, activeChapterIdx, chapters, chapterSlideMap, bridgeableSlideCount]);

  /** Scène active sur le canvas → chapitre + seek vidéo (résolution inverse via `chapterSlideMap`). */
  useEffect(() => {
    if (!dockEmbed) return;
    if (!(chapters || []).length) return;
    const ch = resolveChapterIndexForSlide(konvaSceneIndex, chapterSlideMap, chapters.length);
    if (ch === activeChapterIdx) return;
    setActiveChapterIdx(ch);
    const start = parseTimestampToSeconds(chaptersForPreview[ch]?.startText);
    if (start != null) seekToRef.current(start);
  }, [dockEmbed, konvaSceneIndex, chapters, chaptersForPreview, chapterSlideMap, activeChapterIdx]);

  const captureCurrentTime = () => {
    if (!videoRef.current) return null;
    const t = Number(videoRef.current.currentTime || 0);
    return Number.isFinite(t) && t >= 0 ? round05(t) : 0;
  };

  const getLastChapterEndSeconds = () => {
    const ends = (chapters || [])
      .map((c) => parseTimestampToSeconds(c?.endText))
      .filter((n) => Number.isFinite(n) && n >= 0);
    if (ends.length === 0) return 0;
    return Math.max(...ends);
  };

  const validateChaptersProgressive = (arr) => {
    const normalized = (arr || [])
      .map((c, idx) => {
        const start = parseTimestampToSeconds(c?.startText);
        const end = parseTimestampToSeconds(c?.endText);
        const label = String(c?.label || '').trim();
        return { idx, start, end, label };
      })
      .filter((c) => c.start != null || c.end != null || c.label);

    let prevEnd = 0;
    for (const c of normalized) {
      if (!Number.isFinite(c.start) || !Number.isFinite(c.end)) {
        return { ok: false, message: `Chapitre #${c.idx + 1}: IN/OUT invalide` };
      }
      if (c.start < prevEnd - 1e-6) {
        return { ok: false, message: `Chapitre #${c.idx + 1}: IN doit être >= fin du chapitre précédent` };
      }
      if (c.end <= c.start + 1e-6) {
        return { ok: false, message: `Chapitre #${c.idx + 1}: OUT doit être > IN` };
      }
      prevEnd = c.end;
    }
    return { ok: true };
  };

  const setInSafe = (next) => {
    const minStart = getLastChapterEndSeconds();
    const s = next === '' ? '' : String(round05(Math.max(minStart, Math.max(0, Number(next)))));
    if (s === '') {
      setChapterIn('');
      return;
    }
    const currentOut = chapterOut === '' ? '' : String(round05(Number(chapterOut)));
    setChapterIn(s);
    if (currentOut !== '' && Number(currentOut) < Number(s)) {
      setChapterOut(s);
    }
  };

  const setOutSafe = (next) => {
    const minStart = getLastChapterEndSeconds();
    const e = next === '' ? '' : String(round05(Math.max(minStart, Math.max(0, Number(next)))));
    if (e === '') {
      setChapterOut('');
      return;
    }
    const currentIn = chapterIn === '' ? '' : String(round05(Number(chapterIn)));
    if (currentIn !== '' && Number(e) < Number(currentIn)) {
      setChapterOut(currentIn);
      return;
    }
    setChapterOut(e);
  };

  const commitChapterProgressive = () => {
    if (chapterIn === '') {
      setError('Définis IN avant de valider un chapitre.');
      return;
    }
    if (chapterOut === '') {
      setError('Définis OUT avant de valider un chapitre.');
      return;
    }
    const minStart = getLastChapterEndSeconds();
    const start = Number(chapterIn);
    const end = Number(chapterOut);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      setError('IN/OUT invalide.');
      return;
    }
    if (start < minStart - 1e-6) {
      setError(`IN doit être >= ${formatSecondsToTimeText(minStart)}.`);
      return;
    }
    if (end <= start + 1e-6) {
      setError('OUT doit être > IN.');
      return;
    }

    setError('');
    setChapters([...(chapters || []), { startText: formatSecondsToTimeText(start), endText: formatSecondsToTimeText(end), label: '' }]);
    clipStopAtRef.current = null;
    setChapterIn(String(round05(end)));
    setChapterOut('');
  };

  const previewSegment = () => {
    if (!videoRef.current) return;
    const start = chapterIn === '' ? null : Number(chapterIn);
    const end = chapterOut === '' ? null : Number(chapterOut);
    if (!Number.isFinite(start) || start == null) return;

    const d = Number(videoRef.current.duration || 0);
    const safeEnd = Number.isFinite(end) && end != null
      ? end
      : (Number.isFinite(d) && d > 0 ? Math.min(start + 10, d) : start + 10);

    const s = Math.max(0, Math.min(start, safeEnd));
    const e = Math.max(0, Math.max(start, safeEnd));
    videoRef.current.currentTime = s;
    clipStopAtRef.current = e;
    videoRef.current.play();
  };

  const scrollTranscriptEditorToChapterStart = (chapterStartSeconds) => {
    const target = Number(chapterStartSeconds);
    if (!Number.isFinite(target) || target < 0) return;

    const lines = transcript || [];
    let idx = lines.findIndex((l) => {
      const s = parseTimestampToSeconds(l?.timeText);
      return Number.isFinite(s) && s >= target;
    });
    if (idx < 0) idx = Math.max(0, lines.length - 1);

    const el = transcriptRowRefs.current?.[idx];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  };

  const getActiveChapterIndexForSeconds = (seconds) => {
    const t = Number(seconds);
    if (!Number.isFinite(t) || t < 0) return null;

    const normalized = (chaptersForPreview || [])
      .map((c, idx) => {
        const start = parseTimestampToSeconds(c?.startText);
        const end = parseTimestampToSeconds(c?.endText);
        return {
          idx,
          start: Number.isFinite(start) ? start : null,
          end: Number.isFinite(end) ? end : null,
        };
      })
      .filter((c) => c.start != null);

    if (normalized.length === 0) return null;

    // Ensure progressive ordering (UI already enforces it, but keep it safe)
    normalized.sort((a, b) => a.start - b.start);

    for (let i = 0; i < normalized.length; i += 1) {
      const cur = normalized[i];
      const next = normalized[i + 1];
      const start = cur.start;
      const end = cur.end != null ? cur.end : (next?.start != null ? next.start : Number.POSITIVE_INFINITY);
      if (t >= start && t < end) return cur.idx;
    }

    return normalized[normalized.length - 1].idx;
  };

  useEffect(() => {
    const idx = getActiveChapterIndexForSeconds(previewCurrentTime);
    if (idx == null) return;
    setActiveChapterIdx((prev) => (prev === idx ? prev : idx));
  }, [previewCurrentTime, chaptersForPreview]);

  const syncActiveChapterFromScroll = () => {
    if (!transcriptScrollRef.current) return;
    const container = transcriptScrollRef.current;
    const scrollTop = container.scrollTop;

    const refs = transcriptRowRefs.current || [];
    let firstVisibleIdx = -1;
    for (let i = 0; i < refs.length; i += 1) {
      const el = refs[i];
      if (!el) continue;
      if (el.offsetTop >= scrollTop - 4) {
        firstVisibleIdx = i;
        break;
      }
    }
    if (firstVisibleIdx < 0) firstVisibleIdx = 0;

    const line = (transcript || [])[firstVisibleIdx];
    const secs = parseTimestampToSeconds(line?.timeText);
    if (secs == null) return;

    const idx = getActiveChapterIndexForSeconds(secs);
    setActiveChapterIdx((prev) => (prev === idx ? prev : idx));
  };

  const buildSavePayload = ({ validateMindmap = true, validateChapters = true } = {}) => {
    if (validateChapters) {
      const chaptersCheck = validateChaptersProgressive(chapters || []);
      if (!chaptersCheck.ok) {
        throw new Error(chaptersCheck.message || 'Chapitres invalides');
      }
    }

    const normalizedChapterSegments = (chapters || [])
      .map((c) => {
        const start = parseTimestampToSeconds(c?.startText);
        const end = parseTimestampToSeconds(c?.endText);
        return {
          startSeconds: start,
          endSeconds: end,
          label: String(c?.label || '').trim(),
        };
      })
      .filter(
        (c) =>
          Number.isFinite(c.startSeconds) &&
          c.startSeconds >= 0 &&
          Number.isFinite(c.endSeconds) &&
          c.endSeconds >= c.startSeconds &&
          c.label
      )
      .sort((a, b) => a.startSeconds - b.startSeconds);

    if (validateChapters) {
      for (let i = 1; i < normalizedChapterSegments.length; i += 1) {
        const prev = normalizedChapterSegments[i - 1];
        const cur = normalizedChapterSegments[i];
        if (cur.startSeconds < prev.endSeconds) {
          throw new Error('Chapitres invalides: un chapitre ne peut pas commencer avant la fin du précédent.');
        }
      }
    }

    const normalizedTimestamps = normalizedChapterSegments.map((c) => ({
      timeSeconds: c.startSeconds,
      label: c.label,
    }));

    const normalizedTranscript = (transcript || [])
      .map((l) => {
        const secs = parseTimestampToSeconds(l?.timeText);
        return {
          timeSeconds: secs,
          text: String(l?.text || '').trim(),
        };
      })
      .filter((l) => Number.isFinite(l.timeSeconds) && l.timeSeconds >= 0 && l.text)
      .sort((a, b) => a.timeSeconds - b.timeSeconds);

    let normalizedMindmap;
    if (validateMindmap) {
      const mmText = String(mindmapJsonText || '').trim();
      if (mmText) {
        const parsed = JSON.parse(mmText);
        if (!parsed || typeof parsed !== 'object') throw new Error('Mindmap invalide');
        if (!String(parsed.id || '').trim() || !String(parsed.label || '').trim()) {
          throw new Error('Mindmap: champs requis id + label');
        }
        normalizedMindmap = parsed;
      } else {
        normalizedMindmap = null;
      }
    }

    return { normalizedChapterSegments, normalizedTimestamps, normalizedTranscript, normalizedMindmap };
  };

  const handleGenerateSegmentAi = async ({ applyAll = false, mode = smartboardMode } = {}) => {
    if (!contentId) return;
    if (!applyAll && (activeChapterIdx == null || activeChapterIdx < 0)) {
      setError('Sélectionne un segment avant de générer l\'assistance IA.');
      return;
    }
    setSegmentAiLoading(true);
    setError('');
    try {
      // Always pass chapters + transcript so the server can work even without a DB row
      const chaptersPayload = chapters.map((c, idx) => ({
        label: c.label || `Chapitre ${idx + 1}`,
        startText: c.startText,
        endText: c.endText,
        startSeconds: parseTimestampToSeconds(c.startText),
        endSeconds: parseTimestampToSeconds(c.endText),
      }));
      const transcriptPayload = transcript.map((l) => ({
        timeText: l.timeText,
        timeSeconds: parseTimestampToSeconds(l.timeText),
        text: l.text,
      }));
      const result = await courseBuilderApi.segmentAiGenerate({
        contentId,
        segmentIndex: activeChapterIdx,
        applyAll,
        mode,
        chapters: chaptersPayload,
        transcript: transcriptPayload,
      });
      // If server returned rows directly (e.g. table missing), merge them into local state
      if (Array.isArray(result?.rows) && result.rows.length > 0) {
        setSegmentAiMap((prev) => {
          const next = { ...prev };
          result.rows.forEach((r) => {
            next[String(r.segment_index)] = r;
          });
          return next;
        });
      }
      await loadSegmentAiRows(contentId);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSegmentAiLoading(false);
    }
  };

  const patchLocalAiField = (field, value) => {
    if (activeChapterIdx == null) return;
    const key = String(activeChapterIdx);
    setSegmentAiMap((prev) => {
      const current = prev[key] || {
        content_id: contentId,
        segment_index: activeChapterIdx,
        status: 'draft',
      };
      return {
        ...prev,
        [key]: {
          ...current,
          [field]: value,
        },
      };
    });
  };

  const persistLocalAiFieldChanges = async () => {
    if (activeChapterIdx == null) return;
    const key = String(activeChapterIdx);
    const payload = segmentAiMap[key];
    if (!payload) return;
    setSegmentAiLoading(true);
    try {
      const { error: upsertErr } = await supabase
        .from('course_segment_ai_content')
        .upsert(
          {
            ...payload,
            content_id: contentId,
            segment_index: activeChapterIdx,
            created_by: payload.created_by || (await supabase.auth.getUser()).data?.user?.id || null,
          },
          { onConflict: 'content_id,segment_index' }
        );
      if (upsertErr) throw upsertErr;
      await loadSegmentAiRows(contentId);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSegmentAiLoading(false);
    }
  };

  const handleApproveSegmentAi = async (approved = true) => {
    if (!contentId || activeChapterIdx == null) return;
    setSegmentAiLoading(true);
    setError('');
    try {
      await courseBuilderApi.segmentAiApprove({
        contentId,
        segmentIndex: activeChapterIdx,
        approved,
      });
      await loadSegmentAiRows(contentId);
    } catch (e) {
      const msg = String(e?.message || e);
      // If the table doesn't exist yet, update local state only (graceful degradation)
      if (msg.toLowerCase().includes('schema cache') || msg.toLowerCase().includes('does not exist') || msg.toLowerCase().includes('42p01')) {
        const key = String(activeChapterIdx);
        setSegmentAiMap((prev) => {
          const current = prev[key] || {};
          return { ...prev, [key]: { ...current, status: approved ? 'approved' : 'rejected' } };
        });
      } else {
        setError(msg);
      }
    } finally {
      setSegmentAiLoading(false);
    }
  };

  const handleSaveVersion = async () => {
    if (!contentId) return;
    setVersionActionLoading(true);
    setError('');
    try {
      const payload = buildSavePayload({ validateMindmap: false, validateChapters: false });
      await courseBuilderApi.postprodVersionSave({
        contentId,
        snapshotLabel: `Snapshot ${new Date().toLocaleString()}`,
        snapshot: {
          transcript: payload.normalizedTranscript,
          chapters: payload.normalizedChapterSegments,
          timestamps: payload.normalizedTimestamps,
          dataPatch: {
            mindmap: (() => {
              try {
                const txt = String(mindmapJsonText || '').trim();
                return txt ? JSON.parse(txt) : null;
              } catch {
                return null;
              }
            })(),
            nle: usePostProdNleStore.getState().grade,
            chapterSlideMap: [...(chapterSlideMap || [])],
            nleProject: (() => {
              const g = usePostProdNleStore.getState().grade;
              const base = useNleProjectStore.getState().getSerializableProject();
              return { ...base, master: { ...base.master, colorGrade: { ...g } } };
            })(),
            sourceVideoUrlsByRef: Object.fromEntries(
              Object.entries(sourceVideoUrlsByRef || {}).filter(([k, v]) => String(k).trim() && String(v).trim()),
            ),
          },
        },
      });
      await loadVersionRows(contentId);
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setVersionActionLoading(false);
    }
  };

  const handleRestoreVersion = async (versionId) => {
    if (!versionId) return;
    setVersionActionLoading(true);
    setError('');
    try {
      await courseBuilderApi.postprodVersionRestore({ versionId });
      window.location.reload();
    } catch (e) {
      setError(String(e?.message || e));
      setVersionActionLoading(false);
    }
  };

  const mindmapPreview = useMemo(() => {
    const txt = String(mindmapJsonText || '').trim();
    if (!txt) return null;
    try {
      const parsed = JSON.parse(txt);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch {
      return null;
    }
  }, [mindmapJsonText]);

  useEffect(() => {
    if (!mindmapPreviewOpen) {
      setSelectedMindmapNode(null);
    }
  }, [mindmapPreviewOpen]);


  const getMindmapNodeTimeSeconds = (node) => {
    if (!node) return null;
    const raw = node?.timeSeconds ?? node?.time;
    if (raw == null) return null;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    const secs = parseTimestampToSeconds(raw);
    return secs == null ? null : secs;
  };

  const getReturnTo = () => {
    const stateReturnTo = location?.state?.returnTo;
    if (stateReturnTo && typeof stateReturnTo === 'string') return stateReturnTo;
    try {
      const params = new URLSearchParams(location?.search || '');
      const q = params.get('returnTo');
      if (q && typeof q === 'string') return decodeURIComponent(q);
    } catch {
      // ignore
    }
    return null;
  };

  const getFallbackReturnTo = () => {
    // If the user opened post-production directly (or refreshed), we still want
    // to bring them back to the formation builder instead of relying on history.
    return '/owner-dashboard?tab=formations';
  };

  const save = async () => {
    if (!row?.id) return;
    setSaving(true);
    setError('');
    try {
      const { normalizedChapterSegments, normalizedTimestamps, normalizedTranscript, normalizedMindmap } = buildSavePayload({ validateChapters: false });

      const nextData = {
        ...(row.data || {}),
        chapters: normalizedChapterSegments,
        timestamps: normalizedTimestamps,
        transcript: normalizedTranscript,
      };

      if (normalizedMindmap !== undefined) {
        nextData.mindmap = normalizedMindmap;
      }

      nextData.nle = usePostProdNleStore.getState().grade;
      nextData.chapterSlideMap = [...(chapterSlideMap || [])];
      {
        const g = usePostProdNleStore.getState().grade;
        const base = useNleProjectStore.getState().getSerializableProject();
        nextData.nleProject = { ...base, master: { ...base.master, colorGrade: { ...g } } };
      }
      try {
        const lsKey = row?.id ? `liri_export_resolution_${row.id}` : null;
        const ls = lsKey ? localStorage.getItem(lsKey) : null;
        if (ls && EXPORT_RESOLUTION_OPTIONS.some((o) => o.id === ls)) {
          nextData.exportResolution = ls;
        }
      } catch {
        /* ignore */
      }

      nextData.sourceVideoUrlsByRef = Object.fromEntries(
        Object.entries(sourceVideoUrlsByRef || {}).filter(([k, v]) => String(k).trim() && String(v).trim()),
      );

      const { error: err } = await supabase
        .from('formation_day_contents')
        .update({ data: nextData })
        .eq('id', row.id);

      if (err) throw err;

      if (embedded) {
        if (typeof onValidated === 'function') onValidated();
        if (typeof onClose === 'function') onClose();
      } else {
        const returnTo = normalizeReturnTo(getReturnTo());
        if (returnTo) {
          navigate(returnTo);
        } else {
          navigate(getFallbackReturnTo());
        }
      }
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div
        className={
          embedded
            ? 'h-full min-h-[180px] bg-[#0F1419] text-white flex items-center justify-center'
            : 'min-h-screen bg-[#0F1419] text-white flex items-center justify-center'
        }
      >
        <Loader2 className="w-6 h-6 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  return (
    <div className={embedded ? 'h-full bg-[#0F1419] text-white overflow-auto' : 'min-h-screen bg-[#0F1419] text-white'}>
      <div className={embedded ? (dockEmbed ? 'p-3' : 'p-6') : 'p-6'}>
        <div className="max-w-6xl mx-auto space-y-6">
        {dockEmbed ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-white/85">Post-production — zone centrale</p>
              <p className="truncate font-mono text-[9px] text-white/35">{contentId || '—'}</p>
            </div>
            <Button
              type="button"
              onClick={save}
              disabled={saving}
              size="sm"
              className="shrink-0 bg-[#D4AF37] text-black hover:bg-yellow-500 font-bold"
            >
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Valider
            </Button>
          </div>
        ) : null}
        {!dockEmbed ? (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              className="border-white/10 text-white hover:bg-white/5"
              onClick={() => {
                if (embedded) {
                  if (typeof onClose === 'function') onClose();
                  return;
                }
                const returnTo = normalizeReturnTo(getReturnTo());
                if (returnTo) {
                  navigate(returnTo);
                } else {
                  navigate(getFallbackReturnTo());
                }
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Retour
            </Button>
            <div>
              <div className="text-lg font-bold">Post-production vidéo</div>
              <div className="text-xs text-gray-400">contentId: {contentId}</div>
            </div>
            {smartboardDesignerHref ? (
              <Button
                variant="outline"
                className="border-cyan-500/35 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
                asChild
              >
                <Link to={smartboardDesignerHref} title="Ouvrir ce contenu dans le SmartBoard Designer (post-production intégrée)">
                  <LayoutGrid className="w-4 h-4 mr-2" />
                  SmartBoard Designer
                </Link>
              </Button>
            ) : null}
            {courseBuilderWithDesignerReturnHref ? (
              <Button
                variant="outline"
                className="border-amber-500/35 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
                asChild
              >
                <Link
                  to={courseBuilderWithDesignerReturnHref}
                  title="Configurateur de formation — retour vers ce contenu dans le designer (bandeau en haut)"
                >
                  <GraduationCap className="w-4 h-4 mr-2" />
                  Configurateur
                </Link>
              </Button>
            ) : null}
          </div>

          <Button onClick={save} disabled={saving} className="bg-[#D4AF37] text-black hover:bg-yellow-500 font-bold">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            Valider
          </Button>
        </div>
        ) : null}

        {!dockEmbed ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={postProdView === 'classic' ? 'default' : 'outline'}
            className={postProdView === 'classic' ? 'bg-[#D4AF37] text-black hover:bg-yellow-500' : 'border-white/10 text-white hover:bg-white/5'}
            onClick={() => setPostProdView('classic')}
          >
            Workflow classique
          </Button>
          <Button
            type="button"
            size="sm"
            variant={postProdView === 'smartboard' ? 'default' : 'outline'}
            className={postProdView === 'smartboard' ? 'bg-[#D4AF37] text-black hover:bg-yellow-500' : 'border-white/10 text-white hover:bg-white/5'}
            onClick={() => setPostProdView('smartboard')}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            SmartBoard
          </Button>
          <Button
            type="button"
            size="sm"
            variant={postProdView === 'assistant' ? 'default' : 'outline'}
            className={postProdView === 'assistant' ? 'bg-[#D4AF37] text-black hover:bg-yellow-500' : 'border-white/10 text-white hover:bg-white/5'}
            onClick={() => setPostProdView('assistant')}
          >
            Assistance IA
          </Button>
          <Button
            type="button"
            size="sm"
            variant={postProdView === 'nle' ? 'default' : 'outline'}
            className={postProdView === 'nle' ? 'bg-[#D4AF37] text-black hover:bg-yellow-500' : 'border-white/10 text-white hover:bg-white/5'}
            onClick={() => setPostProdView('nle')}
          >
            <Clapperboard className="w-4 h-4 mr-2" />
            Montage NLE
          </Button>
          <Button
            type="button"
            size="sm"
            variant={postProdView === 'pipeline' ? 'default' : 'outline'}
            className={postProdView === 'pipeline' ? 'bg-[#D4AF37] text-black hover:bg-yellow-500' : 'border-white/10 text-white hover:bg-white/5'}
            onClick={() => setPostProdView('pipeline')}
          >
            ⚙ Pipeline
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Label className="text-xs text-gray-400">Mode</Label>
            <select
              value={smartboardMode}
              onChange={(e) => setSmartboardMode(e.target.value)}
              className="h-8 rounded-md border border-white/10 bg-[#0F1419] px-2 text-xs text-white"
            >
              <option value="raw">Brut</option>
              <option value="pedagogical">Pedagogique</option>
              <option value="reformulation">Reformulation IA</option>
              <option value="masterclass">Masterclass</option>
            </select>
          </div>
        </div>
        ) : null}

        {dockEmbed && (postProdView === 'smartboard' || postProdView === 'assistant') ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-[#111827]/40 px-3 py-2">
            <Label className="text-xs text-gray-400">Mode SmartBoard</Label>
            <select
              value={smartboardMode}
              onChange={(e) => setSmartboardMode(e.target.value)}
              className="h-8 rounded-md border border-white/10 bg-[#0F1419] px-2 text-xs text-white"
            >
              <option value="raw">Brut</option>
              <option value="pedagogical">Pedagogique</option>
              <option value="reformulation">Reformulation IA</option>
              <option value="masterclass">Masterclass</option>
            </select>
          </div>
        ) : null}

        <div className="rounded-lg border border-white/10 bg-[#111827]/40 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-white/10 text-white hover:bg-white/5"
              onClick={() => void handleSaveVersion()}
              disabled={versionActionLoading}
            >
              Sauvegarder un snapshot
            </Button>
            <select
              className="h-8 rounded-md border border-white/10 bg-[#0F1419] px-2 text-xs text-white min-w-[260px]"
              defaultValue=""
              onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                void handleRestoreVersion(id);
              }}
              disabled={versionLoading || versionActionLoading}
            >
              <option value="">Restaurer une version...</option>
              {versionRows.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.snapshot_label || 'Snapshot'} - {new Date(row.created_at).toLocaleString()}
                </option>
              ))}
            </select>
            {versionLoading ? <span className="text-xs text-gray-400">Chargement historique...</span> : null}
          </div>
        </div>

        {!contentPersistedInDb ? (
          <div className="border border-amber-500/30 bg-amber-500/10 rounded p-3 text-sm text-amber-100">
            <strong className="text-amber-200">Mode brouillon :</strong> cette vidéo n'est pas encore enregistrée en base. La génération IA fonctionnera en mode local (les résultats ne seront pas persistés côté serveur). Pour une sauvegarde définitive, enregistrez la formation dans le configurateur puis rouvrez la post-production.
          </div>
        ) : null}

        {error ? (
          <div className="border border-red-500/30 bg-red-500/10 rounded p-3 text-sm text-red-200">{error}</div>
        ) : null}

        {dockEmbed && (chapters || []).length > 0 ? (
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-950/25 px-3 py-2 text-[10px] leading-snug text-cyan-100/85">
            <strong className="text-cyan-200/95">Timeline ↔ canvas :</strong> chapitre actif et scène Konva sont alignés
            par index (plan Copilot). Changez de chapitre ici ou de scène dans le designer — la vidéo seek au début du
            segment correspondant.
          </div>
        ) : null}

        <div className={postProdView !== 'classic' ? 'hidden' : 'grid grid-cols-1 lg:grid-cols-2 gap-6'}>
          <Card
            ref={(el) => { dockSectionRefs.current.preview = el; }}
            className="bg-[#192734] border-white/10"
          >
            <CardContent className="p-4 space-y-3">
              <div className="text-sm font-bold">Prévisualisation</div>

              {!canUsePostProd ? (
                <div className="text-sm text-gray-400">URL vidéo manquante.</div>
              ) : (
                <>
                  <div className="border border-white/10 rounded overflow-hidden bg-black">
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      className="w-full aspect-video"
                      style={nleFilterStyle}
                      controls
                      onLoadedMetadata={(e) => {
                        const d = Number(e?.currentTarget?.duration || 0);
                        setPreviewDuration(Number.isFinite(d) ? d : 0);
                      }}
                      onTimeUpdate={(e) => {
                        const t = Number(e?.currentTarget?.currentTime || 0);
                        const d = Number(e?.currentTarget?.duration || 0);
                        const stopAt = clipStopAtRef.current;
                        if (stopAt != null && Number.isFinite(stopAt) && Number.isFinite(t) && t >= stopAt - 0.05) {
                          e.currentTarget.pause();
                          clipStopAtRef.current = null;
                        }
                        setPreviewCurrentTime(Number.isFinite(t) ? t : 0);
                        setPreviewDuration(Number.isFinite(d) ? d : 0);
                      }}
                    />
                  </div>

                  <div className="space-y-2 touch-none">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>Navigation</span>
                      <span>{formatSecondsToTimeText(previewCurrentTime)} / {formatSecondsToTimeText(previewDuration)}</span>
                    </div>
                    <Slider
                      value={[previewDuration ? (previewCurrentTime / previewDuration) * 100 : 0]}
                      max={100}
                      step={0.1}
                      onValueChange={(v) => {
                        const pct = Array.isArray(v) ? v[0] : 0;
                        const next = previewDuration ? (pct / 100) * previewDuration : 0;
                        seekTo(next);
                      }}
                    />
                  </div>

                  <div className="border border-white/10 rounded-lg p-3 bg-black/20 space-y-3">
                    <div className="text-xs text-gray-400 uppercase tracking-wider">IN/OUT</div>
                    <div className="text-xs text-gray-400">IN: {chapterIn === '' ? '—' : `${chapterIn}s`} • OUT: {chapterOut === '' ? '—' : `${chapterOut}s`}</div>
                    <div className="text-xs text-gray-500">Début minimum (fin du dernier chapitre): {formatSecondsToTimeText(getLastChapterEndSeconds())}</div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="border-white/10 text-white hover:bg-white/5" onClick={() => {
                        const t = captureCurrentTime();
                        if (t == null) return;
                        setInSafe(t);
                      }}>Définir IN</Button>
                      <Button size="sm" variant="outline" className="border-white/10 text-white hover:bg-white/5" onClick={() => {
                        const t = captureCurrentTime();
                        if (t == null) return;
                        setOutSafe(t);
                      }}>Définir OUT</Button>
                      <Button size="sm" className="bg-[#D4AF37] text-black hover:bg-yellow-500 font-bold" disabled={chapterIn === ''} onClick={previewSegment}>Prévisualiser</Button>
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        disabled={chapterIn === '' || chapterOut === ''}
                        onClick={commitChapterProgressive}
                        title="Valider le chapitre (progressif)"
                      >
                        <Check className="w-4 h-4 mr-2" /> Valider chapitre
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-gray-300 hover:bg-white/5"
                        onClick={() => {
                          clipStopAtRef.current = null;
                          setChapterIn('');
                          setChapterOut('');
                        }}
                      >
                        Réinitialiser
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card
              ref={(el) => { dockSectionRefs.current.chapters = el; }}
              className="bg-[#192734] border-white/10"
            >
              <CardContent className="p-4 space-y-3">
                <div className="text-sm font-bold">Chapitres</div>
                <div className="space-y-2">
                  {(chapters || []).map((c, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <Input
                        className="col-span-3 bg-[#0F1419] border-white/10"
                        value={c?.startText || ''}
                        onChange={(e) => {
                          const next = [...(chapters || [])];
                          next[idx] = { ...next[idx], startText: e.target.value };
                          setChapters(next);
                        }}
                        placeholder="0:00"
                      />
                      <Input
                        className="col-span-3 bg-[#0F1419] border-white/10"
                        value={c?.endText || ''}
                        onChange={(e) => {
                          const next = [...(chapters || [])];
                          next[idx] = { ...next[idx], endText: e.target.value };
                          setChapters(next);
                        }}
                        placeholder="0:10"
                      />
                      <Input
                        className="col-span-5 bg-[#0F1419] border-white/10"
                        value={c?.label || ''}
                        onChange={(e) => {
                          const next = [...(chapters || [])];
                          next[idx] = { ...next[idx], label: e.target.value };
                          setChapters(next);
                        }}
                        placeholder="Titre du chapitre"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="col-span-1 border-white/10 text-white hover:bg-white/5"
                        onClick={() => {
                          const secs = parseTimestampToSeconds(c?.startText);
                          if (secs == null) return;
                          setActiveChapterIdx(idx);
                          seekTo(secs);
                        }}
                        title="Aller au temps"
                      >
                        Go
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="col-span-1 text-red-300 hover:text-red-200 hover:bg-white/5"
                        onClick={() => {
                          const next = (chapters || []).filter((_, i) => i !== idx);
                          setChapters(next);
                          const lastEnd = (() => {
                            const ends = next
                              .map((x) => parseTimestampToSeconds(x?.endText))
                              .filter((n) => Number.isFinite(n) && n >= 0);
                            return ends.length ? Math.max(...ends) : 0;
                          })();
                          setInSafe(lastEnd);
                          setChapterOut('');
                        }}
                        title="Supprimer"
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {(chapters || []).length > 0 ? (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
                    <div className="text-xs text-gray-400 uppercase tracking-wider">Chapitre → slide canvas</div>
                    <div className="text-[11px] text-gray-500">
                      Indices alignés sur le plan Copilot et les scènes Konva (1…{bridgeableSlideCount}).{' '}
                      {dockEmbed
                        ? 'Synchro timeline ↔ SmartBoard active dans le designer.'
                        : 'La synchro automatique avec le canvas est disponible dans le designer.'}
                    </div>
                    {duplicateChapterSlides ? (
                      <div className="text-[11px] text-amber-200/90 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1.5">
                        Plusieurs chapitres pointent vers le même slide : au changement de scène, la timeline suit le
                        chapitre de plus petit index.
                      </div>
                    ) : null}
                    {(chapters || []).map((c, idx) => (
                      <div key={`ch-slide-map-${idx}`} className="flex items-center gap-2 text-sm min-w-0">
                        <span
                          className="text-gray-300 truncate flex-1 min-w-0"
                          title={String(c?.label || '').trim() || `Chapitre ${idx + 1}`}
                        >
                          {String(c?.label || '').trim() || `Chapitre ${idx + 1}`}
                        </span>
                        <select
                          className="shrink-0 bg-[#0F1419] border border-white/10 rounded px-2 py-1 text-xs text-white max-w-[140px]"
                          value={Math.min(
                            chapterSlideMap[idx] ?? idx,
                            Math.max(bridgeableSlideCount - 1, 0)
                          )}
                          onChange={(e) => {
                            const v = Math.max(0, parseInt(e.target.value, 10) || 0);
                            const len = (chapters || []).length;
                            setChapterSlideMap((prev) => {
                              const base = Array.from({ length: len }, (_, i) =>
                                prev && prev[i] != null && Number.isFinite(prev[i])
                                  ? Math.floor(Number(prev[i]))
                                  : i
                              );
                              base[idx] = v;
                              return base;
                            });
                          }}
                        >
                          {Array.from({ length: bridgeableSlideCount }, (_, si) => (
                            <option key={si} value={si}>
                              Slide {si + 1}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="text-xs text-gray-400">
                  Valide toujours un chapitre par IN/OUT (progressif). Pour revenir en arrière, supprime un chapitre.
                </div>
              </CardContent>
            </Card>

            <Card
              ref={(el) => { dockSectionRefs.current.transcript = el; }}
              className="bg-[#192734] border-white/10"
            >
              <CardContent className="p-4 space-y-3">
                <div className="text-sm font-bold">Transcription</div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="bg-[#D4AF37] text-black hover:bg-yellow-500 font-bold"
                    aria-disabled={asrLoading}
                    onClick={generateTranscriptWithASR}
                  >
                    {asrLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Générer transcription (IA)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/10 text-white hover:bg-white/5"
                    disabled={(transcript || []).length === 0}
                    onClick={() => setTranscriptEditorOpen(true)}
                  >
                    Ouvrir éditeur
                  </Button>
                </div>
                {(transcript || []).length === 0 ? (
                  <div className="text-sm text-gray-400">Aucune transcription.</div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-400">
                      {(transcript || []).length} lignes (aperçu)
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-gray-200 max-h-[220px] overflow-auto space-y-2">
                      {(transcript || []).slice(0, 8).map((l, idx) => (
                        <div key={`t-preview-${idx}`} className="leading-relaxed">
                          <span className="text-gray-400 mr-2">[{l?.timeText || '—'}]</span>
                          <span>{String(l?.text || '').slice(0, 260)}</span>
                          {String(l?.text || '').length > 260 ? <span className="text-gray-400">…</span> : null}
                        </div>
                      ))}
                      {(transcript || []).length > 8 ? (
                        <div className="text-xs text-gray-400">… aperçu tronqué. Ouvre l'éditeur pour corriger.</div>
                      ) : null}
                    </div>
                  </div>
                )}

                <Dialog open={transcriptEditorOpen} onOpenChange={setTranscriptEditorOpen}>
                  <DialogContent className="max-w-[98vw] w-full h-[92vh] bg-[#0F1419] border-white/10 p-0 overflow-hidden text-white">
                    <DialogTitle className="sr-only">Éditeur de transcription</DialogTitle>
                    <div className="h-full flex flex-col min-h-0">
                      <div className="h-14 px-4 flex items-center justify-between border-b border-white/10 bg-black/20">
                        <div className="font-bold text-sm">Éditeur de transcription</div>
                        <Button variant="outline" className="border-white/10 text-white hover:bg-white/5" onClick={() => setTranscriptEditorOpen(false)}>Fermer</Button>
                      </div>
                      <div className="flex-1 min-h-0 flex">
                        <div className="w-[240px] border-r border-white/10 bg-black/20 overflow-auto p-3">
                          <div className="text-[11px] text-gray-300 uppercase tracking-wider mb-2">Chapitres</div>
                          {(chapters || []).length === 0 ? (
                            <div className="text-xs text-gray-400">Aucun chapitre.</div>
                          ) : (
                            <div className="space-y-1">
                              {(chapters || []).map((c, idx) => {
                                const s = parseTimestampToSeconds(c?.startText);
                                const e = parseTimestampToSeconds(c?.endText);
                                const label = String(c?.label || '').trim() || `Chapitre ${idx + 1}`;
                                const active = activeChapterIdx === idx;
                                return (
                                  <button
                                    key={`chap-nav-${idx}`}
                                    type="button"
                                    className={active
                                      ? 'w-full text-left rounded-md border border-blue-400/60 bg-blue-500/10 px-2 py-2'
                                      : 'w-full text-left rounded-md border border-white/10 px-2 py-2 hover:bg-white/5'
                                    }
                                    onClick={() => {
                                      setActiveChapterIdx(idx);
                                      scrollTranscriptEditorToChapterStart(s ?? 0);
                                    }}
                                  >
                                    <div className="text-xs text-white font-semibold truncate">{label}</div>
                                    <div className="text-[11px] text-gray-400">
                                      {s != null ? formatSecondsToTimeText(s) : '—'}
                                      {e != null ? ` → ${formatSecondsToTimeText(e)}` : ''}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div
                          ref={transcriptScrollRef}
                          className="flex-1 min-h-0 overflow-auto p-4 space-y-2"
                          onScroll={() => {
                            if (transcriptScrollRafRef.current) return;
                            transcriptScrollRafRef.current = window.requestAnimationFrame(() => {
                              transcriptScrollRafRef.current = null;
                              syncActiveChapterFromScroll();
                            });
                          }}
                        >
                          {(transcript || []).map((l, idx) => (
                          <div key={`t-edit-${idx}`} ref={(el) => { transcriptRowRefs.current[idx] = el; }} className="grid grid-cols-12 gap-2 items-start">
                            <Input
                              className="col-span-3 bg-[#0F1419] border-white/10"
                              value={l?.timeText || ''}
                              onChange={(e) => {
                                const next = [...(transcript || [])];
                                next[idx] = { ...next[idx], timeText: e.target.value };
                                setTranscript(next);
                              }}
                              placeholder="0:12"
                            />
                            <Textarea
                              className="col-span-8 bg-[#0F1419] border-white/10 min-h-[42px]"
                              value={l?.text || ''}
                              onChange={(e) => {
                                const next = [...(transcript || [])];
                                next[idx] = { ...next[idx], text: e.target.value };
                                setTranscript(next);
                              }}
                              placeholder="Texte prononcé..."
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="col-span-1 text-red-300 hover:text-red-200 hover:bg-white/5"
                              onClick={() => setTranscript((transcript || []).filter((_, i) => i !== idx))}
                              title="Supprimer"
                            >
                              <Trash className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        </div>
                      </div>
                      <div className="p-4 border-t border-white/10 bg-black/20 flex justify-between">
                        <Button
                          type="button"
                          variant="outline"
                          className="border-white/10 text-white hover:bg-white/5"
                          onClick={() => setTranscript([...(transcript || []), { timeText: '', text: '' }])}
                        >
                          <Plus className="w-4 h-4 mr-2" /> Ajouter une ligne
                        </Button>
                        <Button className="bg-[#D4AF37] text-black hover:bg-yellow-500 font-bold" onClick={() => setTranscriptEditorOpen(false)}>
                          <Check className="w-4 h-4 mr-2" /> OK
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            <Card className="bg-[#192734] border-white/10">
              <CardContent className="p-4 space-y-3">
                <div className="text-sm font-bold">Mindmap (JSON)</div>
                <div className="space-y-2">
                  <Label className="text-xs text-gray-400">Champs requis: id + label</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-white/10 text-white hover:bg-white/5"
                      onClick={generateMindmapFromChapters}
                    >
                      Générer depuis chapitres
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-white/10 text-white hover:bg-white/5"
                      disabled={!mindmapPreview}
                      onClick={() => setMindmapPreviewOpen(true)}
                      title={!mindmapPreview ? 'Mindmap invalide ou vide' : 'Voir le rendu'}
                    >
                      Voir rendu
                    </Button>
                    <Button
                      type="button"
                      className="bg-[#D4AF37] text-black hover:bg-yellow-500 font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={aiLoading}
                      onClick={generateMindmapWithAI}
                    >
                      {aiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      {aiLoading ? 'Génération en cours…' : 'Améliorer avec IA'}
                    </Button>
                  </div>
                  {aiLoading && aiMessage ? (
                    <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
                      <Loader2 className="w-3 h-3 animate-spin flex-shrink-0 text-yellow-400" />
                      <span>{aiMessage}</span>
                    </div>
                  ) : aiMessage ? (
                    <div className="text-xs text-gray-400">{aiMessage}</div>
                  ) : null}
                  <Textarea
                    value={mindmapJsonText}
                    onChange={(e) => setMindmapJsonText(e.target.value)}
                    className="bg-[#0F1419] border-white/10 min-h-[220px] font-mono text-xs"
                    placeholder={`{\n  "id": "root",\n  "label": "Sujet",\n  "time": "0:00",\n  "children": []\n}`}
                  />

                  <Dialog open={mindmapPreviewOpen} onOpenChange={setMindmapPreviewOpen}>
                    <DialogContent className="max-w-[98vw] w-full h-[92vh] bg-[#0F1419] border-white/10 p-0 overflow-hidden text-white">
                      <DialogTitle className="sr-only">Aperçu Mindmap</DialogTitle>
                      <div className="h-full flex flex-col min-h-0">
                        <div className="h-14 px-4 flex items-center justify-between border-b border-white/10 bg-black/20">
                          <div className="font-bold text-sm">Aperçu Mindmap</div>
                          <Button variant="outline" className="border-white/10 text-white hover:bg-white/5" onClick={() => setMindmapPreviewOpen(false)}>Fermer</Button>
                        </div>
                        <div className="flex-1 min-h-0 flex">
                          <div className="flex-1 min-h-0 p-4">
                            <MindMapNavigation
                              mindmap={mindmapPreview}
                              onSeek={(t) => seekTo(t)}
                              onSelectNode={(n) => setSelectedMindmapNode(n)}
                              selectedNodeId={selectedMindmapNode?.id || null}
                              heightClassName="h-[calc(92vh-7.5rem)]"
                            />
                          </div>
                          <div
                            className="flex-shrink-0 overflow-hidden"
                            style={{ width: selectedMindmapNode ? '420px' : '0px', transition: 'width 0.32s cubic-bezier(0.4,0,0.2,1)' }}
                          >
                            <AnimatePresence mode="wait">
                              {selectedMindmapNode && (
                                <NodeExplanationPanel
                                  key={selectedMindmapNode.id}
                                  node={selectedMindmapNode}
                                  videoTitle={String(row?.data?.title || row?.data?.name || '')}
                                  transcript={(transcript || []).map((l) => ({ time: l?.timeText, text: l?.text }))}
                                  onSeek={seekTo}
                                  onClose={() => setSelectedMindmapNode(null)}
                                  onSelectNode={(n) => setSelectedMindmapNode(n)}
                                />
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {postProdView !== 'classic' && postProdView !== 'pipeline' ? (
          <SplitScreenCoursePreview
            videoUrl={videoUrl}
            videoRef={videoRef}
            videoStyle={nleFilterStyle}
            currentTime={previewCurrentTime}
            duration={previewDuration}
            onSeek={seekTo}
            segments={chaptersForPreview}
            aiMap={segmentAiMap}
            mode={smartboardMode}
            aiStatusText={segmentAiSyncLoading ? 'Synchronisation...' : ''}
            activeChapterIdx={activeChapterIdx}
            onSelectChapter={(idx) => {
              const secs = parseTimestampToSeconds(chaptersForPreview?.[idx]?.startText);
              setActiveChapterIdx(idx);
              if (secs != null) seekTo(secs);
            }}
          />
        ) : null}

        {postProdView === 'nle' ? (
          <div className="mt-4 space-y-3">
            <NleEngineWorkspace
              previewDuration={previewDuration}
              chapters={chapters}
              currentTime={previewCurrentTime}
              onSeek={seekTo}
            />
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-xs space-y-3">
              <p className="text-[11px] font-semibold text-[#D4AF37]/90">Sources vidéo additionnelles</p>
              <p className="text-[10px] text-white/45 leading-relaxed">
                Pour chaque ref utilisée sur un clip V1 (champ <span className="font-mono text-white/70">sourceRef</span>
                ), indique l'URL du fichier. L\'export FFmpeg charge <span className="font-mono text-white/70">data.url</span>{' '}
                comme entrée 0, puis les URLs ci-dessous comme entrées 1, 2… (ordre alphabétique des refs).
              </p>
              {Object.keys(sourceVideoUrlsByRef).length > 0 ? (
                <ul className="space-y-2">
                  {Object.entries(sourceVideoUrlsByRef).map(([ref, url]) => (
                    <li key={ref} className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] text-[#D4AF37]/90 w-24 shrink-0 truncate" title={ref}>
                        {ref}
                      </span>
                      <Input
                        className="h-8 flex-1 min-w-[200px] bg-[#0F1419] border-white/10 font-mono text-[10px]"
                        value={url}
                        onChange={(e) =>
                          setSourceVideoUrlsByRef((prev) => ({ ...prev, [ref]: e.target.value }))
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-white/50 shrink-0"
                        onClick={() =>
                          setSourceVideoUrlsByRef((prev) => {
                            const next = { ...prev };
                            delete next[ref];
                            return next;
                          })
                        }
                      >
                        Retirer
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[10px] text-white/35">Aucune source additionnelle.</p>
              )}
              <div className="flex flex-wrap items-end gap-2 pt-1 border-t border-white/10">
                <div className="min-w-[100px]">
                  <Label className="text-[10px] text-white/40">Ref</Label>
                  <Input
                    className="h-8 mt-0.5 bg-[#0F1419] border-white/10 font-mono text-[10px]"
                    placeholder="ex. broll"
                    value={extraSourceRefInput}
                    onChange={(e) => setExtraSourceRefInput(e.target.value)}
                  />
                </div>
                <div className="flex-1 min-w-[220px]">
                  <Label className="text-[10px] text-white/40">URL fichier vidéo</Label>
                  <Input
                    className="h-8 mt-0.5 bg-[#0F1419] border-white/10 font-mono text-[10px]"
                    placeholder="https://…"
                    value={extraSourceUrlInput}
                    onChange={(e) => setExtraSourceUrlInput(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-white/10 text-white hover:bg-white/5"
                  onClick={() => {
                    const k = extraSourceRefInput.trim();
                    const u = extraSourceUrlInput.trim();
                    if (!k || !u) return;
                    if (k === 'main') return;
                    setSourceVideoUrlsByRef((prev) => ({ ...prev, [k]: u }));
                    setExtraSourceRefInput('');
                    setExtraSourceUrlInput('');
                  }}
                >
                  Ajouter
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {postProdView === 'assistant' ? (
          <div className="space-y-3">
            <SegmentAIEditorPanel
              contentId={contentId}
              segmentIndex={activeChapterIdx}
              segmentLabel={activeSegment?.label || ''}
              value={activeAiRow}
              loading={segmentAiLoading}
              persistedInDb={contentPersistedInDb}
              onGenerate={() => void handleGenerateSegmentAi({ applyAll: false })}
              onGenerateAll={() => void handleGenerateSegmentAi({ applyAll: true })}
              onApprove={() => void handleApproveSegmentAi(true)}
              onReject={() => void handleApproveSegmentAi(false)}
              onChangeField={patchLocalAiField}
              onIllustrationUpdated={() => void loadSegmentAiRows(contentId)}
            />
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                className="border-white/10 text-white hover:bg-white/5"
                onClick={() => void persistLocalAiFieldChanges()}
                disabled={segmentAiLoading || activeChapterIdx == null}
              >
                Enregistrer modifications IA
              </Button>
            </div>
          </div>
        ) : null}

        {postProdView === 'pipeline' ? (
          <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ height: '70vh' }}>
            <CoursePipelineView
              contentId={contentId}
              videoUrl={videoUrl}
              chapters={chapters}
              transcript={transcript}
              segmentAiMap={segmentAiMap}
              mindmapJsonText={mindmapJsonText}
              contentPersistedInDb={contentPersistedInDb}
              invokeFn={invokeCourseBuilderFunction}
              invokeFnGet={invokeCourseBuilderFunctionGet}
              onChaptersUpdate={(newChapters) => {
                setChapters(newChapters);
                setActiveChapterIdx(0);
              }}
              onTranscriptUpdate={(lines) => {
                setTranscript(lines);
              }}
              onSegmentAiMapUpdate={(nextMap) => {
                setSegmentAiMap(nextMap);
              }}
              onMindmapUpdate={(jsonText) => {
                setMindmapJsonText(jsonText);
              }}
            />
          </div>
        ) : null}

        {postProdView !== 'pipeline' && (
          <RenderExportPanel
            contentId={contentId}
            slideFrameCount={Array.isArray(row?.data?.renderSlideFrames) ? row.data.renderSlideFrames.length : 0}
            defaultExportResolution={row?.data?.exportResolution}
            invokeFn={invokeCourseBuilderFunction}
            invokeFnGet={invokeCourseBuilderFunctionGet}
          />
        )}
        </div>
      </div>
    </div>
  );
};

// ─── Render Export Panel ─────────────────────────────────────────────────────
const STATUS_LABELS = {
  queued:           { label: 'En file…',          color: 'text-gray-400',    pulse: true  },
  preparing_assets: { label: 'Préparation…',       color: 'text-blue-400',   pulse: true  },
  rendering:        { label: 'Rendu en cours…',    color: 'text-amber-400',  pulse: true  },
  packaging:        { label: 'Finalisation…',      color: 'text-purple-400', pulse: true  },
  completed:        { label: 'Terminé',            color: 'text-emerald-400', pulse: false },
  failed:           { label: 'Échec',              color: 'text-red-400',    pulse: false },
  cancelled:        { label: 'Annulé',             color: 'text-gray-500',   pulse: false },
};

function RenderExportPanel({
  contentId,
  slideFrameCount = 0,
  defaultExportResolution = '1080p',
  invokeFn,
  invokeFnGet,
}) {
  const storageKey = contentId ? `liri_export_resolution_${contentId}` : null;
  const [exportResolution, setExportResolution] = React.useState(() => {
    if (storageKey) {
      try {
        const s = localStorage.getItem(storageKey);
        if (EXPORT_RESOLUTION_OPTIONS.some((o) => o.id === s)) return s;
      } catch {
        /* ignore */
      }
    }
    const d = String(defaultExportResolution || '1080p').toLowerCase();
    return EXPORT_RESOLUTION_OPTIONS.some((o) => o.id === d) ? d : '1080p';
  });

  React.useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, exportResolution);
    } catch {
      /* ignore */
    }
  }, [storageKey, exportResolution]);

  const [renderMode, setRenderMode] = React.useState('pedagogical');
  const [jobs, setJobs] = React.useState([]);
  const [jobsLoading, setJobsLoading] = React.useState(false);
  const [enqueueLoading, setEnqueueLoading] = React.useState(false);
  const [renderError, setRenderError] = React.useState('');
  const pollRef = React.useRef(null);

  const fetchJobs = React.useCallback(async () => {
    if (!contentId) return;
    setJobsLoading(true);
    try {
      const body = await invokeFnGet('render-status', { contentId });
      setJobs(Array.isArray(body?.jobs) ? body.jobs : []);
    } catch {
      // silent
    } finally {
      setJobsLoading(false);
    }
  }, [contentId, invokeFnGet]);

  React.useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // Poll while any job is active
  React.useEffect(() => {
    const hasActive = jobs.some((j) => ['queued', 'preparing_assets', 'rendering', 'packaging'].includes(j.status));
    if (hasActive && !pollRef.current) {
      pollRef.current = window.setInterval(fetchJobs, 4000);
    } else if (!hasActive && pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {};
  }, [jobs, fetchJobs]);

  React.useEffect(() => () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
  }, []);

  const handleEnqueue = async () => {
    if (!contentId) return;
    setEnqueueLoading(true);
    setRenderError('');
    try {
      await invokeFn('render-enqueue', { contentId, renderMode, exportResolution });
      await fetchJobs();
    } catch (e) {
      setRenderError(String(e?.message || e));
    } finally {
      setEnqueueLoading(false);
    }
  };

  const latestJob = jobs[0] || null;

  return (
    <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#0d1522] p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[#D4AF37]/60 font-semibold">🎬 Vidéo de sortie</p>
          <p className="text-sm text-white font-medium mt-0.5">Exporter la vidéo avec SmartBoard intégré</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Export jusqu'en 4K, split-screen formateur + slide, audio AAC haut débit, réglages NLE conservés.
            {slideFrameCount > 0 ? (
              <span className="text-emerald-400/90"> · {slideFrameCount} plan(s) capturé(s)</span>
            ) : (
              <span className="text-gray-400"> · Capturer les plans depuis le designer (panneau export vidéo)</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={exportResolution}
            onChange={(e) => setExportResolution(e.target.value)}
            title="Résolution du fichier final"
            className="h-8 rounded-md border border-white/10 bg-[#0F1419] px-2 text-xs text-white"
          >
            {EXPORT_RESOLUTION_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          <select
            value={renderMode}
            onChange={(e) => setRenderMode(e.target.value)}
            className="h-8 rounded-md border border-white/10 bg-[#0F1419] px-2 text-xs text-white"
          >
            <option value="pedagogical">Pédagogique</option>
            <option value="reformulation">Reformulation IA</option>
            <option value="masterclass">Masterclass</option>
            <option value="raw">Brut</option>
          </select>
          <Button
            type="button"
            className="bg-[#D4AF37] text-black hover:bg-amber-500 font-bold"
            onClick={handleEnqueue}
            disabled={enqueueLoading || !contentId}
          >
            {enqueueLoading
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : null}
            {enqueueLoading ? 'Lancement…' : 'Générer la vidéo'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-white/10 text-white hover:bg-white/5"
            onClick={fetchJobs}
            disabled={jobsLoading}
            title="Actualiser"
          >
            <Loader2 className={`w-3.5 h-3.5 ${jobsLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {renderError && (
        <div className="text-sm text-red-300 border border-red-500/20 bg-red-500/10 rounded-lg p-3">{renderError}</div>
      )}

      {/* Jobs list */}
      {jobs.length > 0 && (
        <div className="space-y-2">
          {jobs.slice(0, 5).map((job) => {
            const s = STATUS_LABELS[job.status] || { label: job.status, color: 'text-gray-400', pulse: false };
            const workerErr = job.manifest_json?.worker_error || job.error_message;
            return (
              <div key={job.id} className="rounded-xl border border-white/10 bg-white/3 px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${s.color} ${s.pulse ? 'animate-pulse' : ''}`}>
                      {s.label}
                    </span>
                    <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full font-mono">{job.render_mode}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                    {new Date(job.created_at).toLocaleString('fr-FR')}
                  </p>
                  {workerErr && (
                    <p className="text-xs text-red-400 mt-1 truncate max-w-sm" title={workerErr}>{workerErr}</p>
                  )}
                </div>
                {job.status === 'completed' && job.output_video_url && (
                  <a
                    href={job.output_video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/25 transition-colors font-semibold"
                  >
                    ⬇ Télécharger MP4
                  </a>
                )}
                {['queued', 'preparing_assets', 'rendering', 'packaging'].includes(job.status) && (
                  <div className="shrink-0 flex items-center gap-1.5 text-xs text-gray-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    En cours…
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {jobs.length === 0 && !jobsLoading && (
        <p className="text-xs text-gray-600 text-center py-2">Aucun rendu pour ce contenu. Clique sur "Générer la vidéo" pour démarrer.</p>
      )}
    </div>
  );
}

export default VideoPostProductionPage;
