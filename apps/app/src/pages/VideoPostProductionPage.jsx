import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import { courseBuilderApi, renderJobErrorMessage, renderJobPlayableUrl, renderJobStorageKey } from '@/lib/api-v2';
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
import { ArrowLeft, CalendarClock, Check, Clapperboard, GraduationCap, Image as ImageIcon, LayoutGrid, Loader2, Plus, Sparkles, Trash } from 'lucide-react';
import SplitScreenCoursePreview from '@/components/school/course-builder/SplitScreenCoursePreview';
import SegmentAIEditorPanel from '@/components/school/course-builder/SegmentAIEditorPanel';
import CoursePipelineView from '@/components/school/course-builder/CoursePipelineView';
import NleEngineWorkspace from '@/features/nle-engine/components/NleEngineWorkspace';
import { useNleProjectStore } from '@/features/nle-engine/store/useNleProjectStore';
import { applyNleProjectToChapterRows } from '@/lib/nleEngine/applyNleProjectToChapterRows';
// POURQUOI importer le normaliseur ici : le panneau d'export doit comparer le montage
// AFFICHÉ (store, déjà normalisé par `hydrate`) au montage ENREGISTRÉ (JSONB brut de la
// base, qui peut manquer des champs). Les passer tous les deux par `parseNleProject`
// est la seule façon de comparer des pommes avec des pommes — sinon l'écran annonçait
// « modifications non enregistrées » en permanence, y compris juste après un
// enregistrement, et l'avertissement devenait du bruit qu'on apprend à ignorer.
import { parseNleProject } from '@/lib/nleEngine/nleProjectModel';

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

/**
 * ⭐ LE CRITÈRE UNIQUE : « cette ligne de chapitre pèse-t-elle dans le montage ? »
 *
 * POURQUOI IL EXISTE. `applySegmentsFromNleV1Clips` (aperçu ET worker, port verbatim) ne
 * recale les chapitres sur l'axe du montage que si `clips.length === chapitres.length`.
 * Ce nombre était calculé par TROIS filtres différents :
 *   · les CLIPS      → syncVideoTrackFromChapters : IN/OUT lisibles et OUT > IN, libellé inventé ;
 *   · l'APERÇU       → applyNleProjectToChapterRows : AUCUN filtre, toutes les lignes brutes ;
 *   · le RENDU       → `normalizedChapterSegments` persisté en `d.chapters`, qui exigeait EN PLUS
 *                      un libellé non vide (et tolérait OUT == IN).
 * Résultat mesuré : 5 lignes dont une sans libellé → l'aperçu recalait (5 clips = 5 lignes)
 * pendant que le MP4 refusait (4 chapitres persistés ≠ 5 clips) ; 5 lignes dont une sans OUT →
 * l'inverse exact. Dans les deux cas l'écran affichait un placement de plans et le fichier en
 * produisait un autre — la divergence que l'en-tête de nleToFfmpeg.js déclare « PIRE que
 * l'absence de montage ».
 *
 * Ce prédicat est la copie du critère des CLIPS (la seule liste qui fasse foi, puisque c'est
 * elle qu'on compte en face). Toute modification ici doit être répercutée dans
 * `syncVideoTrackFromChapters` (nleProjectModel.js) et dans `normalizedChapterSegments`.
 */
const isMontageEligibleChapterRow = (c) => {
  const start = parseTimestampToSeconds(c?.startText);
  const end = parseTimestampToSeconds(c?.endText);
  return Number.isFinite(start) && start >= 0 && Number.isFinite(end) && end > start;
};

/** ISO (timestamptz) → valeur d'un input `datetime-local` (heure locale, sans secondes). */
const isoToDatetimeLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Valeur d'un input `datetime-local` → ISO (timestamptz) ; '' → null. */
const datetimeLocalInputToIso = (value) => {
  const v = String(value || '').trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

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

  /** Date de publication au calendrier élève (input `datetime-local`, '' = non publié). */
  const [publicationDateInput, setPublicationDateInput] = useState('');
  const [publishSaving, setPublishSaving] = useState(false);
  const [publishMessage, setPublishMessage] = useState('');

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
  const [cardImageLoading, setCardImageLoading] = useState(null); // null | 'all' | <cardId>
  const [cardImageProgress, setCardImageProgress] = useState({ done: 0, total: 0 });


  const transcriptRowRefs = useRef([]);
  const transcriptScrollRef = useRef(null);
  const transcriptScrollRafRef = useRef(null);
  const [activeChapterIdx, setActiveChapterIdx] = useState(null);

  const nleProjectForPreview = useNleProjectStore((s) => s.project);
  // APERÇU du recalage. On ne soumet à `applyNleProjectToChapterRows` que les lignes ÉLIGIBLES
  // au montage (cf. isMontageEligibleChapterRow) : ce sont exactement celles qui ont produit un
  // clip, donc le seul décompte qui puisse répondre `clips.length === chapitres.length` en
  // même temps que le worker. Avec le tableau brut, une ligne sans IN/OUT gonflait le compte,
  // l'aperçu refusait de recaler et laissait les lignes en temps SOURCE pendant que le MP4,
  // lui, recalait — l'écran montrait un placement, le fichier en produisait un autre.
  //
  // On RÉINJECTE ensuite les lignes recalées à leur position d'origine : la longueur et l'ordre
  // de `chaptersForPreview` restent ceux de `chapters` (tout le reste de l'écran indexe dessus :
  // activeChapterIdx, chapterSlideMap, la liste des segments…), et les lignes non éligibles
  // ressortent inchangées — ce qui est déjà ce que faisait `applyNleProjectToChapterRows`
  // pour elles, faute d'IN/OUT lisible.
  const chaptersForPreview = useMemo(() => {
    const rows = Array.isArray(chapters) ? chapters : [];
    const eligibleIdx = [];
    const eligibleRows = [];
    rows.forEach((c, i) => {
      if (!isMontageEligibleChapterRow(c)) return;
      eligibleIdx.push(i);
      eligibleRows.push(c);
    });
    if (!eligibleRows.length) return rows;
    const applied = applyNleProjectToChapterRows(eligibleRows, nleProjectForPreview);
    if (applied === eligibleRows) return rows;
    const merged = rows.slice();
    eligibleIdx.forEach((rowIdx, k) => {
      merged[rowIdx] = applied[k];
    });
    return merged;
  }, [chapters, nleProjectForPreview]);

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
          .select('id,day_id,type,data,publication_date')
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
        setPublicationDateInput(isoToDatetimeLocalInput(data.publication_date));
        setPublishMessage('');

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

    // ⭐ CE FILTRE EST LE MÊME QUE `isMontageEligibleChapterRow` — ET IL DOIT LE RESTER.
    // `chapters` persistés ici deviennent `d.chapters`, que l'API renvoie AU WORKER sous
    // `montageChapterWindows` ; c'est sur leur NOMBRE que `applySegmentsFromNleV1Clips`
    // décide d'apparier clip k ↔ chapitre k. Or la liste des CLIPS est bâtie par
    // `syncVideoTrackFromChapters` (nleProjectModel) avec un critère différent, et l'APERÇU
    // se prononçait sur un troisième (toutes les lignes brutes) : trois filtres, trois
    // longueurs possibles, donc un aperçu et un MP4 qui pouvaient prendre des régimes de
    // recalage OPPOSÉS pour la même liste.
    //
    // Ce qui a changé : (1) le libellé n'est plus une condition de survie — une ligne
    // horodatée mais pas encore nommée produisait bel et bien un clip, la jeter ici faisait
    // mentir le compte (et perdait le chapitre en base) ; on lui pose le MÊME libellé de
    // repli que le clip correspondant. (2) `endSeconds >= startSeconds` devient `>` : un
    // chapitre de durée nulle ne produit AUCUN clip et n'a jamais placé la moindre slide.
    const normalizedChapterSegments = (chapters || [])
      .map((c, idx) => {
        const start = parseTimestampToSeconds(c?.startText);
        const end = parseTimestampToSeconds(c?.endText);
        return {
          startSeconds: start,
          endSeconds: end,
          // Repli IDENTIQUE à syncVideoTrackFromChapters (`Chapitre N`, N = rang de la LIGNE)
          // pour que le chapitre et son clip portent exactement le même nom.
          label: String(c?.label || '').trim() || `Chapitre ${idx + 1}`,
        };
      })
      .filter(
        (c) =>
          Number.isFinite(c.startSeconds) &&
          c.startSeconds >= 0 &&
          Number.isFinite(c.endSeconds) &&
          c.endSeconds > c.startSeconds
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

  // ── Génération d'IMAGE par carte (overlay SmartBoard) — Mistral par défaut ──
  const callGenerateVisualImage = async (prompt) => {
    const { data: sessionSnap } = await supabase.auth.getSession();
    const bearerToken = sessionSnap?.session?.access_token || '';
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const res = await fetch(`${supabaseUrl}/functions/v1/generate-visual-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
      },
      body: JSON.stringify({ prompt, provider: 'auto' }),
    });
    if (!res.ok) throw new Error(`Image edge ${res.status}`);
    const data = await res.json().catch(() => null);
    const url = data?.imageUrl || null;
    if (!url) throw new Error(data?.error || "Pas d'image renvoyée");
    return url;
  };

  const setNodeIllustrationInTree = (node, cardId, url) => {
    if (!node || typeof node !== 'object') return node;
    const next = { ...node };
    if (String(next.id || '') === String(cardId)) next.illustrationUrl = url;
    if (Array.isArray(next.children)) next.children = next.children.map((c) => setNodeIllustrationInTree(c, cardId, url));
    return next;
  };

  const collectMindmapCards = (node, acc = []) => {
    if (!node || typeof node !== 'object') return acc;
    (node.children || []).forEach((c) => {
      if (c && c.id && (c.label || c.summary)) acc.push(c);
      collectMindmapCards(c, acc);
    });
    return acc;
  };

  const cardImagePrompt = (card) => {
    const label = String(card?.label || '').trim();
    const summary = String(card?.summary || '').trim();
    return `Illustration pédagogique claire et explicite pour le concept « ${label} ». ${summary}`.trim();
  };

  const handleGenerateCardImage = async (card) => {
    if (!card?.id || cardImageLoading) return;
    setCardImageLoading(card.id);
    setError('');
    try {
      const url = await callGenerateVisualImage(cardImagePrompt(card));
      const mm = mindmapPreview;
      if (mm) setMindmapJsonText(JSON.stringify(setNodeIllustrationInTree(mm, card.id, url), null, 2));
    } catch (e) {
      setError(`Image carte : ${e.message}`);
    } finally {
      setCardImageLoading(null);
    }
  };

  const handleGenerateAllCardImages = async () => {
    const mm = mindmapPreview;
    if (!mm || cardImageLoading) return;
    const cards = collectMindmapCards(mm).filter((c) => !c.illustrationUrl);
    if (!cards.length) {
      setError('Toutes les cartes ont déjà une image.');
      return;
    }
    setCardImageLoading('all');
    setCardImageProgress({ done: 0, total: cards.length });
    setError('');
    let tree = mm;
    for (let i = 0; i < cards.length; i += 1) {
      try {
        const url = await callGenerateVisualImage(cardImagePrompt(cards[i]));
        tree = setNodeIllustrationInTree(tree, cards[i].id, url);
        setMindmapJsonText(JSON.stringify(tree, null, 2));
      } catch (e) {
        console.warn('[card-image] échec carte', cards[i]?.id, e?.message);
      }
      setCardImageProgress({ done: i + 1, total: cards.length });
    }
    setCardImageLoading(null);
  };

  // ── Génération du CONTENU de slide riche (prompt agent) + image au nouveau style ──
  const callGenerateSlideContent = async (card) => {
    const { data: sessionSnap } = await supabase.auth.getSession();
    const bearerToken = sessionSnap?.session?.access_token || '';
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const childLabels = (card.children || []).map((c) => String(c?.label || c?.title || '').trim()).filter(Boolean).slice(0, 4);
    const res = await fetch(`${supabaseUrl}/functions/v1/generate-slide-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
      },
      body: JSON.stringify({
        card: { label: card.label, summary: card.summary, childLabels, time: card.time },
        courseTitle: String(row?.data?.title || row?.data?.name || '').trim(),
      }),
    });
    if (!res.ok) throw new Error(`Slide edge ${res.status}`);
    const data = await res.json().catch(() => null);
    if (!data?.slide) throw new Error(data?.error || 'pas de slide');
    return data.slide;
  };

  const setNodeFieldsInTree = (node, cardId, patch) => {
    if (!node || typeof node !== 'object') return node;
    const next = { ...node };
    if (String(next.id || '') === String(cardId)) Object.assign(next, patch);
    if (Array.isArray(next.children)) next.children = next.children.map((c) => setNodeFieldsInTree(c, cardId, patch));
    return next;
  };

  const handleGenerateRichSlides = async () => {
    const mm = mindmapPreview;
    if (!mm || cardImageLoading) return;
    const cards = collectMindmapCards(mm);
    if (!cards.length) {
      setError('Aucune carte à enrichir.');
      return;
    }
    setCardImageLoading('slides');
    setCardImageProgress({ done: 0, total: cards.length });
    setError('');
    let tree = mm;
    for (let i = 0; i < cards.length; i += 1) {
      try {
        const slide = await callGenerateSlideContent(cards[i]);
        const patch = { slideContent: slide };
        try {
          const prompt = slide.imagePrompt || cardImagePrompt(cards[i]);
          const url = await callGenerateVisualImage(prompt);
          if (url) patch.illustrationUrl = url;
        } catch (e) {
          console.warn('[rich-slide] image échec', cards[i]?.id, e?.message);
        }
        tree = setNodeFieldsInTree(tree, cards[i].id, patch);
        setMindmapJsonText(JSON.stringify(tree, null, 2));
      } catch (e) {
        console.warn('[rich-slide] échec', cards[i]?.id, e?.message);
      }
      setCardImageProgress({ done: i + 1, total: cards.length });
    }
    setCardImageLoading(null);
  };


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
    // STUDIO LIRI (dans le portail) — surtout PAS /owner-dashboard (chrome ISNA Academy).
    return '/studio/liri/formation';
  };

  /**
   * Persiste uniquement la date de publication au calendrier (colonne `publication_date`).
   * Indépendant du « Valider » global pour ne pas exiger des chapitres valides juste
   * pour programmer la mise en ligne d'une vidéo. Vider le champ dépublie (NULL).
   */
  const handlePublishToCalendar = async () => {
    if (!row?.id) return;
    if (!contentPersistedInDb) {
      setPublishMessage("Enregistre d'abord la vidéo (mode brouillon non persisté).");
      return;
    }
    setPublishSaving(true);
    setPublishMessage('');
    setError('');
    try {
      const iso = datetimeLocalInputToIso(publicationDateInput);
      const { error: err } = await supabase
        .from('formation_day_contents')
        .update({ publication_date: iso })
        .eq('id', row.id);
      if (err) throw err;
      setRow((prev) => (prev ? { ...prev, publication_date: iso } : prev));
      setPublishMessage(iso ? 'Vidéo programmée dans le calendrier élève.' : 'Vidéo retirée du calendrier.');
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setPublishSaving(false);
    }
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
      // Durée RÉELLE de la source, telle que le navigateur vient de la lire.
      // POURQUOI la persister : c'est la seule borne autoritaire de la timeline du
      // montage. Sans elle, l'API retombait sur `max(chapters.endSeconds)` — une valeur
      // qui IGNORE la queue non chapitrée de la vidéo, et qui vaut 0 sur un cours pas
      // encore chapitré. Le diaporama pouvait alors dépasser le cours et ses dernières
      // slides étaient coupées au montage, en silence.
      {
        const sourceSeconds = Number(videoRef.current?.duration || previewDuration || 0);
        if (Number.isFinite(sourceSeconds) && sourceSeconds > 0) {
          nextData.durationSeconds = Math.round(sourceSeconds * 1000) / 1000;
        }
      }
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
    const _ppSpinner = (
      <div
        className={
          embedded
            ? 'h-full min-h-[180px] bg-[#1f1e1c] text-white flex items-center justify-center'
            : 'h-full bg-[#1f1e1c] text-white flex items-center justify-center'
        }
      >
        <Loader2 className="w-6 h-6 animate-spin text-[#d97757]" />
      </div>
    );
    return embedded ? _ppSpinner : (
      <LiriPortalShell active="studio">{_ppSpinner}</LiriPortalShell>
    );
  }

  const _ppBody = (
    <div className={embedded ? 'h-full bg-[#1f1e1c] text-white overflow-auto' : 'h-full bg-[#1f1e1c] text-white overflow-auto'}>
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
              className="shrink-0 bg-[#d97757] text-black hover:bg-[#d97757] font-bold"
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
              <div className="text-xs text-[#b0ada3]">contentId: {contentId}</div>
            </div>
            {smartboardDesignerHref ? (
              <Button
                variant="outline"
                className="border-[#c2683f]/35 bg-[#c2683f]/10 text-[#e8b6a3] hover:bg-[#c2683f]/20"
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
                className="border-[#d97757]/35 bg-[#d97757]/10 text-[#f0d0c2] hover:bg-[#d97757]/20"
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

          <Button onClick={save} disabled={saving} className="bg-[#d97757] text-black hover:bg-[#d97757] font-bold">
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
            className={postProdView === 'classic' ? 'bg-[#d97757] text-black hover:bg-[#d97757]' : 'border-white/10 text-white hover:bg-white/5'}
            onClick={() => setPostProdView('classic')}
          >
            Workflow classique
          </Button>
          <Button
            type="button"
            size="sm"
            variant={postProdView === 'smartboard' ? 'default' : 'outline'}
            className={postProdView === 'smartboard' ? 'bg-[#d97757] text-black hover:bg-[#d97757]' : 'border-white/10 text-white hover:bg-white/5'}
            onClick={() => setPostProdView('smartboard')}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            SmartBoard
          </Button>
          <Button
            type="button"
            size="sm"
            variant={postProdView === 'assistant' ? 'default' : 'outline'}
            className={postProdView === 'assistant' ? 'bg-[#d97757] text-black hover:bg-[#d97757]' : 'border-white/10 text-white hover:bg-white/5'}
            onClick={() => setPostProdView('assistant')}
          >
            Assistance IA
          </Button>
          <Button
            type="button"
            size="sm"
            variant={postProdView === 'nle' ? 'default' : 'outline'}
            className={postProdView === 'nle' ? 'bg-[#d97757] text-black hover:bg-[#d97757]' : 'border-white/10 text-white hover:bg-white/5'}
            onClick={() => setPostProdView('nle')}
          >
            <Clapperboard className="w-4 h-4 mr-2" />
            Montage NLE
          </Button>
          <Button
            type="button"
            size="sm"
            variant={postProdView === 'pipeline' ? 'default' : 'outline'}
            className={postProdView === 'pipeline' ? 'bg-[#d97757] text-black hover:bg-[#d97757]' : 'border-white/10 text-white hover:bg-white/5'}
            onClick={() => setPostProdView('pipeline')}
          >
            ⚙ Pipeline
          </Button>
          {/*
            Ce sélecteur-ci pilote l'ASSISTANCE IA et la prévisualisation SmartBoard
            (`segmentAiGenerate({ mode })` + `SplitScreenCoursePreview`), PAS l'encodage.
            Il s'appelait « Mode » tout court, à deux écrans du « mode de rendu » du
            panneau d'export qui porte les mêmes quatre valeurs : on croyait régler son
            export en réglant l'IA. Le nom dit maintenant ce qu'il commande.
          */}
          <div className="ml-auto flex items-center gap-2">
            <Label className="text-xs text-[#b0ada3]">Mode SmartBoard</Label>
            <select
              value={smartboardMode}
              onChange={(e) => setSmartboardMode(e.target.value)}
              title="Style de l'assistance IA et de la prévisualisation — sans effet sur le fichier exporté"
              className="h-8 rounded-md border border-white/10 bg-[#1f1e1c] px-2 text-xs text-white"
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
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-[#30302e]/40 px-3 py-2">
            <Label className="text-xs text-[#b0ada3]">Mode SmartBoard</Label>
            <select
              value={smartboardMode}
              onChange={(e) => setSmartboardMode(e.target.value)}
              className="h-8 rounded-md border border-white/10 bg-[#1f1e1c] px-2 text-xs text-white"
            >
              <option value="raw">Brut</option>
              <option value="pedagogical">Pedagogique</option>
              <option value="reformulation">Reformulation IA</option>
              <option value="masterclass">Masterclass</option>
            </select>
          </div>
        ) : null}

        <div className="rounded-lg border border-white/10 bg-[#30302e]/40 p-3">
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
              className="h-8 rounded-md border border-white/10 bg-[#1f1e1c] px-2 text-xs text-white min-w-[260px]"
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
            {versionLoading ? <span className="text-xs text-[#b0ada3]">Chargement historique...</span> : null}
          </div>
        </div>

        {!contentPersistedInDb ? (
          <div className="border border-[#d97757]/30 bg-[#d97757]/10 rounded p-3 text-sm text-[#f0d0c2]">
            <strong className="text-[#e8b6a3]">Mode brouillon :</strong> cette vidéo n'est pas encore enregistrée en base. La génération IA fonctionnera en mode local (les résultats ne seront pas persistés côté serveur). Pour une sauvegarde définitive, enregistrez la formation dans le configurateur puis rouvrez la post-production.
          </div>
        ) : null}

        {error ? (
          <div className="border border-red-500/30 bg-red-500/10 rounded p-3 text-sm text-red-200">{error}</div>
        ) : null}

        {!dockEmbed && postProdView === 'classic' ? (
          <div className="rounded-lg border border-[#d97757]/25 bg-[#d97757]/10 p-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 shrink-0 text-[#e8b6a3]" />
              <div className="text-sm font-bold text-[#e8b6a3]">Publier au calendrier</div>
            </div>
            <p className="mt-1 text-xs text-[#e8b6a3]/70">
              Programme la mise en ligne de cette vidéo dans l'agenda des élèves (« Vidéo du cours disponible »).
              Laisse vide pour la retirer du calendrier.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="min-w-[220px]">
                <Label className="text-[11px] text-[#e8b6a3]/80">Publier au calendrier le…</Label>
                <Input
                  type="datetime-local"
                  value={publicationDateInput}
                  onChange={(e) => { setPublicationDateInput(e.target.value); setPublishMessage(''); }}
                  className="mt-1 bg-[#1f1e1c] border-white/10 text-white [color-scheme:dark]"
                />
              </div>
              <Button
                type="button"
                onClick={() => void handlePublishToCalendar()}
                disabled={publishSaving || !contentPersistedInDb}
                className="bg-[#c2683f] text-white hover:bg-[#d97757] font-bold"
              >
                {publishSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CalendarClock className="w-4 h-4 mr-2" />}
                {publicationDateInput ? 'Programmer' : 'Retirer du calendrier'}
              </Button>
              {publishMessage ? (
                <span className="text-xs text-[#e8b6a3]/80">{publishMessage}</span>
              ) : null}
            </div>
          </div>
        ) : null}

        {dockEmbed && (chapters || []).length > 0 ? (
          <div className="rounded-lg border border-[#c2683f]/20 bg-[#1f1e1c]/25 px-3 py-2 text-[10px] leading-snug text-[#e8b6a3]/85">
            <strong className="text-[#e8b6a3]/95">Timeline ↔ canvas :</strong> chapitre actif et scène Konva sont alignés
            par index (plan Copilot). Changez de chapitre ici ou de scène dans le designer — la vidéo seek au début du
            segment correspondant.
          </div>
        ) : null}

        <div className={postProdView !== 'classic' ? 'hidden' : 'grid grid-cols-1 lg:grid-cols-2 gap-6'}>
          <Card
            ref={(el) => { dockSectionRefs.current.preview = el; }}
            className="bg-[#30302e] border-white/10"
          >
            <CardContent className="p-4 space-y-3">
              <div className="text-sm font-bold">Prévisualisation</div>

              {!canUsePostProd ? (
                <div className="text-sm text-[#b0ada3]">URL vidéo manquante.</div>
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
                    <div className="flex items-center justify-between text-xs text-[#b0ada3]">
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
                    <div className="text-xs text-[#b0ada3] uppercase tracking-wider">IN/OUT</div>
                    <div className="text-xs text-[#b0ada3]">IN: {chapterIn === '' ? '—' : `${chapterIn}s`} • OUT: {chapterOut === '' ? '—' : `${chapterOut}s`}</div>
                    <div className="text-xs text-[#82807a]">Début minimum (fin du dernier chapitre): {formatSecondsToTimeText(getLastChapterEndSeconds())}</div>
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
                      <Button size="sm" className="bg-[#d97757] text-black hover:bg-[#d97757] font-bold" disabled={chapterIn === ''} onClick={previewSegment}>Prévisualiser</Button>
                      <Button
                        size="sm"
                        className="bg-[#c2683f] hover:bg-[#c2683f] text-white"
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
                        className="text-[#b0ada3] hover:bg-white/5"
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
              className="bg-[#30302e] border-white/10"
            >
              <CardContent className="p-4 space-y-3">
                <div className="text-sm font-bold">Chapitres</div>
                <div className="space-y-2">
                  {(chapters || []).map((c, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <Input
                        className="col-span-3 bg-[#1f1e1c] border-white/10"
                        value={c?.startText || ''}
                        onChange={(e) => {
                          const next = [...(chapters || [])];
                          next[idx] = { ...next[idx], startText: e.target.value };
                          setChapters(next);
                        }}
                        placeholder="0:00"
                      />
                      <Input
                        className="col-span-3 bg-[#1f1e1c] border-white/10"
                        value={c?.endText || ''}
                        onChange={(e) => {
                          const next = [...(chapters || [])];
                          next[idx] = { ...next[idx], endText: e.target.value };
                          setChapters(next);
                        }}
                        placeholder="0:10"
                      />
                      <Input
                        className="col-span-5 bg-[#1f1e1c] border-white/10"
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
                    <div className="text-xs text-[#b0ada3] uppercase tracking-wider">Chapitre → slide canvas</div>
                    <div className="text-[11px] text-[#82807a]">
                      Indices alignés sur le plan Copilot et les scènes Konva (1…{bridgeableSlideCount}).{' '}
                      {dockEmbed
                        ? 'Synchro timeline ↔ SmartBoard active dans le designer.'
                        : 'La synchro automatique avec le canvas est disponible dans le designer.'}
                    </div>
                    {duplicateChapterSlides ? (
                      <div className="text-[11px] text-[#e8b6a3]/90 rounded border border-[#d97757]/30 bg-[#d97757]/10 px-2 py-1.5">
                        Plusieurs chapitres pointent vers le même slide : au changement de scène, la timeline suit le
                        chapitre de plus petit index.
                      </div>
                    ) : null}
                    {(chapters || []).map((c, idx) => (
                      <div key={`ch-slide-map-${idx}`} className="flex items-center gap-2 text-sm min-w-0">
                        <span
                          className="text-[#b0ada3] truncate flex-1 min-w-0"
                          title={String(c?.label || '').trim() || `Chapitre ${idx + 1}`}
                        >
                          {String(c?.label || '').trim() || `Chapitre ${idx + 1}`}
                        </span>
                        <select
                          className="shrink-0 bg-[#1f1e1c] border border-white/10 rounded px-2 py-1 text-xs text-white max-w-[140px]"
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

                <div className="text-xs text-[#b0ada3]">
                  Valide toujours un chapitre par IN/OUT (progressif). Pour revenir en arrière, supprime un chapitre.
                </div>
              </CardContent>
            </Card>

            <Card
              ref={(el) => { dockSectionRefs.current.transcript = el; }}
              className="bg-[#30302e] border-white/10"
            >
              <CardContent className="p-4 space-y-3">
                <div className="text-sm font-bold">Transcription</div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="bg-[#d97757] text-black hover:bg-[#d97757] font-bold"
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
                  <div className="text-sm text-[#b0ada3]">Aucune transcription.</div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-xs text-[#b0ada3]">
                      {(transcript || []).length} lignes (aperçu)
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-[#b0ada3] max-h-[220px] overflow-auto space-y-2">
                      {(transcript || []).slice(0, 8).map((l, idx) => (
                        <div key={`t-preview-${idx}`} className="leading-relaxed">
                          <span className="text-[#b0ada3] mr-2">[{l?.timeText || '—'}]</span>
                          <span>{String(l?.text || '').slice(0, 260)}</span>
                          {String(l?.text || '').length > 260 ? <span className="text-[#b0ada3]">…</span> : null}
                        </div>
                      ))}
                      {(transcript || []).length > 8 ? (
                        <div className="text-xs text-[#b0ada3]">… aperçu tronqué. Ouvre l'éditeur pour corriger.</div>
                      ) : null}
                    </div>
                  </div>
                )}

                <Dialog open={transcriptEditorOpen} onOpenChange={setTranscriptEditorOpen}>
                  <DialogContent className="max-w-[98vw] w-full h-[92vh] bg-[#1f1e1c] border-white/10 p-0 overflow-hidden text-white">
                    <DialogTitle className="sr-only">Éditeur de transcription</DialogTitle>
                    <div className="h-full flex flex-col min-h-0">
                      <div className="h-14 px-4 flex items-center justify-between border-b border-white/10 bg-black/20">
                        <div className="font-bold text-sm">Éditeur de transcription</div>
                        <Button variant="outline" className="border-white/10 text-white hover:bg-white/5" onClick={() => setTranscriptEditorOpen(false)}>Fermer</Button>
                      </div>
                      <div className="flex-1 min-h-0 flex">
                        <div className="w-[240px] border-r border-white/10 bg-black/20 overflow-auto p-3">
                          <div className="text-[11px] text-[#b0ada3] uppercase tracking-wider mb-2">Chapitres</div>
                          {(chapters || []).length === 0 ? (
                            <div className="text-xs text-[#b0ada3]">Aucun chapitre.</div>
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
                                      ? 'w-full text-left rounded-md border border-[#d97757]/60 bg-[#c2683f]/10 px-2 py-2'
                                      : 'w-full text-left rounded-md border border-white/10 px-2 py-2 hover:bg-white/5'
                                    }
                                    onClick={() => {
                                      setActiveChapterIdx(idx);
                                      scrollTranscriptEditorToChapterStart(s ?? 0);
                                    }}
                                  >
                                    <div className="text-xs text-white font-semibold truncate">{label}</div>
                                    <div className="text-[11px] text-[#b0ada3]">
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
                              className="col-span-3 bg-[#1f1e1c] border-white/10"
                              value={l?.timeText || ''}
                              onChange={(e) => {
                                const next = [...(transcript || [])];
                                next[idx] = { ...next[idx], timeText: e.target.value };
                                setTranscript(next);
                              }}
                              placeholder="0:12"
                            />
                            <Textarea
                              className="col-span-8 bg-[#1f1e1c] border-white/10 min-h-[42px]"
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
                        <Button className="bg-[#d97757] text-black hover:bg-[#d97757] font-bold" onClick={() => setTranscriptEditorOpen(false)}>
                          <Check className="w-4 h-4 mr-2" /> OK
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            <Card className="bg-[#30302e] border-white/10">
              <CardContent className="p-4 space-y-3">
                <div className="text-sm font-bold">Mindmap (JSON)</div>
                <div className="space-y-2">
                  <Label className="text-xs text-[#b0ada3]">Champs requis: id + label</Label>
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
                      className="bg-[#d97757] text-black hover:bg-[#d97757] font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={aiLoading}
                      onClick={generateMindmapWithAI}
                    >
                      {aiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                      {aiLoading ? 'Génération en cours…' : 'Améliorer avec IA'}
                    </Button>
                  </div>
                  {aiLoading && aiMessage ? (
                    <div className="flex items-center gap-2 rounded-lg border border-[#d97757]/30 bg-[#d97757]/10 px-3 py-2 text-xs text-[#e8b6a3]">
                      <Loader2 className="w-3 h-3 animate-spin flex-shrink-0 text-[#d97757]" />
                      <span>{aiMessage}</span>
                    </div>
                  ) : aiMessage ? (
                    <div className="text-xs text-[#b0ada3]">{aiMessage}</div>
                  ) : null}
                  <Textarea
                    value={mindmapJsonText}
                    onChange={(e) => setMindmapJsonText(e.target.value)}
                    className="bg-[#1f1e1c] border-white/10 min-h-[220px] font-mono text-xs"
                    placeholder={`{\n  "id": "root",\n  "label": "Sujet",\n  "time": "0:00",\n  "children": []\n}`}
                  />

                  <Dialog open={mindmapPreviewOpen} onOpenChange={setMindmapPreviewOpen}>
                    <DialogContent className="max-w-[98vw] w-full h-[92vh] bg-[#1f1e1c] border-white/10 p-0 overflow-hidden text-white">
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
          <div className="space-y-3">
            {mindmapPreview ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#1f1e1c]/60 px-4 py-3">
                <div className="text-xs text-[#b0ada3]">
                  <span className="text-white font-semibold">Slides riches</span> — contenu pédagogique premium (titre-idée, idée centrale, objectif, à retenir) + image au bon style, par carte.
                </div>
                <div className="flex items-center gap-3">
                  {cardImageLoading ? (
                    <span className="text-xs text-[#d97757] font-mono">
                      {cardImageLoading === 'slides' ? 'Slides…' : 'Images…'} {cardImageProgress.done}/{cardImageProgress.total}
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!!cardImageLoading}
                    onClick={handleGenerateRichSlides}
                    title="Génère, pour chaque carte, le contenu pédagogique riche (titre-idée, idée centrale, objectif, à retenir) + une image au bon style"
                    className="border-[#d97757] text-[#d97757] hover:bg-[color-mix(in_srgb,var(--coral)_10%,transparent)] font-bold gap-2 h-9"
                  >
                    {cardImageLoading === 'slides' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Générer les slides riches
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!!cardImageLoading}
                    onClick={handleGenerateAllCardImages}
                    className="border-white/10 text-white hover:bg-white/5 font-medium gap-2 h-9"
                  >
                    {cardImageLoading === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                    Images seules
                  </Button>
                </div>
              </div>
            ) : null}
            <SplitScreenCoursePreview
              videoUrl={videoUrl}
              videoRef={videoRef}
              videoStyle={nleFilterStyle}
              currentTime={previewCurrentTime}
              duration={previewDuration}
              onSeek={seekTo}
              segments={chaptersForPreview}
              aiMap={segmentAiMap}
              mindmap={mindmapPreview}
              onGenerateCardImage={handleGenerateCardImage}
              cardImageLoadingId={cardImageLoading}
              mode={smartboardMode}
              aiStatusText={segmentAiSyncLoading ? 'Synchronisation...' : ''}
              activeChapterIdx={activeChapterIdx}
              onSelectChapter={(idx) => {
                const secs = parseTimestampToSeconds(chaptersForPreview?.[idx]?.startText);
                setActiveChapterIdx(idx);
                if (secs != null) seekTo(secs);
              }}
            />
          </div>
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
              <p className="text-[11px] font-semibold text-[color-mix(in_srgb,var(--coral)_90%,transparent)]">Sources vidéo additionnelles</p>
              <p className="text-[10px] text-white/45 leading-relaxed">
                Pour chaque ref utilisée sur un clip V1 (champ <span className="font-mono text-white/70">sourceRef</span>
                ), indique l'URL du fichier. L\'export FFmpeg charge <span className="font-mono text-white/70">data.url</span>{' '}
                comme entrée 0, puis les URLs ci-dessous comme entrées 1, 2… (ordre alphabétique des refs).
              </p>
              {Object.keys(sourceVideoUrlsByRef).length > 0 ? (
                <ul className="space-y-2">
                  {Object.entries(sourceVideoUrlsByRef).map(([ref, url]) => (
                    <li key={ref} className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] text-[color-mix(in_srgb,var(--coral)_90%,transparent)] w-24 shrink-0 truncate" title={ref}>
                        {ref}
                      </span>
                      <Input
                        className="h-8 flex-1 min-w-[200px] bg-[#1f1e1c] border-white/10 font-mono text-[10px]"
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
                    className="h-8 mt-0.5 bg-[#1f1e1c] border-white/10 font-mono text-[10px]"
                    placeholder="ex. broll"
                    value={extraSourceRefInput}
                    onChange={(e) => setExtraSourceRefInput(e.target.value)}
                  />
                </div>
                <div className="flex-1 min-w-[220px]">
                  <Label className="text-[10px] text-white/40">URL fichier vidéo</Label>
                  <Input
                    className="h-8 mt-0.5 bg-[#1f1e1c] border-white/10 font-mono text-[10px]"
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
            // Montage AFFICHÉ (store, vivant) vs montage ENREGISTRÉ (JSONB relu au
            // chargement) : le panneau compare les deux pour dire si le rendu partira
            // bien avec ce qu'on voit — l'API relit la base, pas le navigateur.
            nleProject={nleProjectForPreview}
            savedNleProject={row?.data?.nleProject ?? null}
            // Durée mesurée par le <video> de la prévisualisation : c'est elle qui
            // détermine la longueur du fichier produit (le worker encode avec
            // `-t <durée de la source>`).
            sourceDurationSeconds={Number(previewDuration) || 0}
            invokeFn={invokeCourseBuilderFunction}
            invokeFnGet={invokeCourseBuilderFunctionGet}
          />
        )}
        </div>
      </div>
    </div>
  );

  // ⚠️ CE `return` EST INDISPENSABLE — sans lui, le composant calculait `_ppBody`
  // puis se terminait sur `undefined` : React 19 n'affiche RIEN, sans la moindre
  // erreur en console. La page de post-production (maillon du pipeline vidéo)
  // rendait un écran BLANC en production, et le mode `embedded` avec elle (dock
  // Designer, modale du constructeur de formation). Le `return` avait été collé
  // par erreur à l'intérieur de `RenderExportPanel`, après le `return` de
  // celle-ci : du code mort, référençant `embedded`/`_ppBody` hors de portée.
  //
  // Montage = outil de création : embarqué dans la coque portail LIRI (topbar +
  // rail + pied). Le mode `embedded` (modale replay, dock) garde son conteneur
  // d'accueil et ne double PAS la coque.
  return embedded ? _ppBody : (
    <LiriPortalShell active="studio">{_ppBody}</LiriPortalShell>
  );
};

// ─── Render Export Panel ─────────────────────────────────────────────────────
// La table `course_render_jobs` ne connaît que 4 statuts (queued | rendering |
// completed | failed). Les trois autres (preparing_assets, packaging, cancelled)
// sont conservés par TOLÉRANCE : si le worker se met à publier des étapes plus
// fines, l'UI les nomme déjà au lieu d'afficher un identifiant technique brut.
// Palette chaude uniquement : l'échec est en corail (≥ 4,5:1 sur #1f1e1c), jamais
// en rouge criard.
const STATUS_LABELS = {
  queued:           { label: 'En file…',          color: 'text-[#b0ada3]', pulse: true  },
  preparing_assets: { label: 'Préparation…',      color: 'text-[#d97757]', pulse: true  },
  rendering:        { label: 'Rendu en cours…',   color: 'text-[#d97757]', pulse: true  },
  packaging:        { label: 'Finalisation…',     color: 'text-[#d97757]', pulse: true  },
  completed:        { label: 'Terminé',           color: 'text-[#9fbf8f]', pulse: false },
  failed:           { label: 'Échec du rendu',    color: 'text-[#e08a6b]', pulse: false },
  cancelled:        { label: 'Annulé',            color: 'text-[#82807a]', pulse: false },
};

// Statuts pendant lesquels on continue de sonder l'API (un seul endroit, réutilisé
// par le polling ET par l'affichage « En cours… » : les deux ne peuvent plus diverger).
const ACTIVE_RENDER_STATUSES = ['queued', 'preparing_assets', 'rendering', 'packaging'];

// Au-delà de ce délai passé en file SANS qu'aucun worker ne prenne le job, ce n'est
// plus « ça arrive » : c'est un symptôme. On le dit au formateur au lieu de le laisser
// regarder une pastille pulser pendant vingt minutes.
const QUEUE_STALL_SECONDS = 120;

// ─── CE QUE LE MOTEUR DE RENDU APPLIQUE — ET CE QU'IL IGNORE ─────────────────
//
// ⚠️ CES DEUX LISTES SONT UN CONTRAT, PAS UN ARGUMENTAIRE. Elles décrivent le
// comportement observable de deux fichiers, et de rien d'autre :
//   · apps/worker/src/jobs/courseRender.js        → renderSplitScreen (le filtergraph)
//   · apps/api/src/course-builder/course-builder.service.ts → enqueuePostprodRender
//     (ce qui est réellement MIS DANS LE PAYLOAD du job)
// Ne déplacer une ligne de « ignoré » vers « appliqué » qu'après avoir relu CES
// fichiers. La version précédente de cet écran annonçait « réglages NLE conservés » :
// le formateur coupait trois minutes d'introduction, posait un fondu au noir, cliquait
// « Générer » — et récupérait sa source entière, sans le moindre avertissement. Une
// promesse d'interface qui n'est tenue par aucun code coûte plus cher qu'une absence
// de fonctionnalité : elle fait perdre un rendu complet ET la confiance dans l'outil.
//
// ⭐ INTERRUPTEUR DE VÉRITÉ. Il commande TOUT ce que cet écran raconte du montage :
// les deux listes ci-dessous, l'annonce de la durée de sortie (source ou timeline),
// l'avertissement « montage non enregistré » (qui n'a de sens que si le rendu relit la
// base) et le contrôle avant vol des montages que le moteur refuse.
//
// ⚠️ CONDITION POUR QU'IL VAILLE `true` — les DEUX bouts de la chaîne, pas un seul :
//   1. `enqueuePostprodRender` met `nleProject` dans le payload du job (API), ET
//   2. `renderSplitScreen` fait passer la vidéo/l'audio par le traducteur avant la mise
//      en page (worker : `planMontage` / `buildMontageFilters` de `nleToFfmpeg.js`).
// Le traducteur seul ne suffit pas : tant que l'API n'envoie rien, il n'a rien à lire.
//
// ÉTAT VÉRIFIÉ LE 2026-07-27, par lecture des deux fichiers — la chaîne est complète :
//   · API  : `...(nleProject ? { nleProject, montageChapterWindows } : {})` dans le
//            payload de `enqueuePostprodRender`.
//   · worker : `planMontage(payload?.nleProject, …)` puis `VSRC = '[nle_pv]'`, et la
//            durée de sortie devient `-t outDur` (= durée du montage) au lieu de la
//            durée de la source.
// Un projet absent, vide, ou qui reprend la source à l'identique repasse par le chemin
// historique (`applied:false`) : le MP4 est alors exactement celui d'avant.
const RENDER_ENGINE_READS_MONTAGE = true;

// Liste ON : écrite d'après le contrat explicite de `apps/worker/src/jobs/nleToFfmpeg.js`
// (en-tête « CE QUI EST TRADUIT » / « CE QUI EST REFUSÉ »). Elle ne s'affiche que si le
// drapeau ci-dessus est vrai — donc jamais avant que la chaîne complète existe.
const RENDER_ENGINE_APPLIES = RENDER_ENGINE_READS_MONTAGE
  ? [
      'les coupes et les rognages de la timeline : le fichier dure ce que dure le montage',
      'l’ordre des clips, et les vides entre eux rendus en noir',
      'les fondus au noir (entrée et sortie de clip)',
      'l’opacité et le volume de chaque clip, plus le volume général',
      'le recalage des plans capturés sur le cours coupé (un plan dont le passage est coupé disparaît)',
      'la mise en page : le plan plein cadre, le formateur en médaillon en bas à droite',
      'la résolution choisie ci-contre, jusqu’en 4K, et la bande son recoupée avec l’image (AAC 192 kb/s)',
    ]
  : [
      'la mise en page : le plan plein cadre, le formateur en médaillon en bas à droite',
      'le placement des plans dans le temps, calé sur les chapitres',
      'la résolution choisie ci-contre, jusqu’en 4K',
      'la bande son de la source (recodée en AAC 192 kb/s seulement si elle ne l’est pas déjà)',
    ];
const RENDER_ENGINE_IGNORES = RENDER_ENGINE_READS_MONTAGE
  ? [
      'le fondu enchaîné : la jonction est rendue en coupe franche (utilise « Fondu au noir »)',
      'l’étalonnage (exposition, contraste, saturation, température) — l’aperçu seul le montre',
      'les clips posés sur la piste « Slides & incrustations » et sur la piste audio',
      'un montage à vitesse modifiée, à clips qui se chevauchent, ou pointant un autre fichier : le moteur refuse le montage EN BLOC et rend la source entière, en disant lequel',
    ]
  : [
      'les coupes et les rognages de la timeline : la vidéo produite dure exactement comme la source',
      'les transitions (fondu enchaîné, fondu au noir)',
      'l’étalonnage (exposition, contraste, saturation, température)',
      'le volume des clips et le volume général',
      'les clips posés sur la piste « Slides & incrustations » et sur la piste audio',
    ];

/** Nombre lu avec une valeur de repli explicite (Number(undefined) vaut NaN, pas null). */
const nleNum = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

// ── CONTRÔLE AVANT VOL : les montages que le moteur REFUSE ───────────────────
// ⚠️ MIROIR de `planMontage` (apps/worker/src/jobs/nleToFfmpeg.js). Les trois constantes
// et les quatre règles ci-dessous y portent les mêmes noms et les mêmes valeurs ; si
// elles y changent, elles doivent changer ici (grep « MONTAGE_EPSILON »).
//
// POURQUOI DOUBLER LA RÈGLE CÔTÉ ÉCRAN plutôt que d'attendre le verdict du worker : le
// verdict n'arrive qu'À LA FIN d'un encodage complet, qui peut durer une demi-heure, et
// il dit « montage refusé, source rendue entière ». Le formateur a alors attendu très
// longtemps pour recevoir exactement ce qu'il ne voulait pas. Le cas le plus fréquent
// est aussi le plus sournois : dans l'éditeur, changer Trim IN / Trim OUT ne change PAS
// la durée du clip sur la timeline — le projet décrit alors un ralenti, que le moteur
// refuse de traduire (la voix serait transposée). Autant le dire avant le clic.
const MONTAGE_EPSILON = 0.05;
const MONTAGE_MIN_SEGMENT_SECONDS = 0.04;
/** `sourceRef` qui désignent LA vidéo du cours (cf. syncVideoTrackFromChapters → 'main'). */
const MONTAGE_PRIMARY_SOURCE_REFS = new Set(['', 'main', 'source', 'primary', '0', 'principal']);

/**
 * Raisons pour lesquelles le moteur rendrait la source ENTIÈRE au lieu du montage.
 * Vide = rien ne s'oppose à la traduction. L'ordre reproduit celui du worker, qui
 * s'arrête au premier refus.
 * @param {Array<Record<string, unknown>>} primaryClips clips « source principale » de v1
 * @returns {string[]}
 */
function montageRefusals(primaryClips) {
  const reasons = [];
  if (!Array.isArray(primaryClips) || primaryClips.length === 0) return reasons;

  const foreign = primaryClips.filter(
    (c) => !MONTAGE_PRIMARY_SOURCE_REFS.has(String(c?.sourceRef ?? '').trim().toLowerCase()),
  );
  if (foreign.length) {
    reasons.push(
      `${foreign.length} clip(s) pointent un autre fichier que la vidéo du cours : le rendu ne télécharge que celle-ci.`,
    );
  }

  const parsed = [];
  for (let i = 0; i < primaryClips.length; i += 1) {
    const c = primaryClips[i];
    const label = String(c?.label || `Clip ${i + 1}`);
    const start = Number(c?.startOnTimeline);
    const dur = Number(c?.duration);
    const trimIn = Number(c?.trimIn);
    const trimOut = Number(c?.trimOut);
    if (!Number.isFinite(start) || start < 0 || !Number.isFinite(dur) || dur <= MONTAGE_MIN_SEGMENT_SECONDS) {
      reasons.push(`clip « ${label} » sans position ou sans durée exploitable.`);
      continue;
    }
    if (!Number.isFinite(trimIn) || trimIn < 0 || !Number.isFinite(trimOut) || trimOut <= trimIn + 0.02) {
      reasons.push(`clip « ${label} » sans point de sortie exploitable (Trim OUT ≤ Trim IN).`);
      continue;
    }
    const span = trimOut - trimIn;
    if (Math.abs(span - dur) > MONTAGE_EPSILON) {
      reasons.push(
        `clip « ${label} » : ${formatMediaDurationFr(dur)} sur la timeline pour ${formatMediaDurationFr(span)} de matière ` +
          '— cela décrit un ralenti/accéléré, que le rendu n’applique pas. Aligne la durée sur Trim OUT − Trim IN.',
      );
      continue;
    }
    parsed.push({ start, dur, label });
  }

  parsed.sort((a, b) => a.start - b.start || a.dur - b.dur);
  for (let i = 1; i < parsed.length; i += 1) {
    const prevEnd = parsed[i - 1].start + parsed[i - 1].dur;
    if (parsed[i].start < prevEnd - MONTAGE_EPSILON) {
      reasons.push(
        `les clips « ${parsed[i - 1].label} » et « ${parsed[i].label} » se chevauchent : rien ne dit lequel doit être visible.`,
      );
      break;
    }
  }
  return reasons;
}

/**
 * Résumé LISIBLE du montage tel qu'il est posé dans l'éditeur.
 *
 * POURQUOI : avant de lancer un encodage qui peut durer très longtemps, le formateur
 * doit voir d'un coup d'œil ce qu'il a construit ET ce qui, là-dedans, atteindra
 * réellement le fichier de sortie. C'est la même donnée que celle envoyée au serveur
 * (`data.nleProject`), lue avec les mêmes clés que `applySegmentsFromNleV1Clips`.
 */
function summarizeNleProject(project) {
  const tracks = Array.isArray(project?.tracks) ? project.tracks : [];
  const v1 = tracks.find((t) => t && t.id === 'v1');
  const v2 = tracks.find((t) => t && t.id === 'v2');
  const a1 = tracks.find((t) => t && t.id === 'a1');
  const clips = Array.isArray(v1?.clips) ? v1.clips : [];
  // Même filtre que le moteur de prévisualisation : un clip sans `sourceType` est un
  // plan de la vidéo source (défaut historique du modèle).
  const primary = clips.filter((c) => String(c?.sourceType || 'primary_video') === 'primary_video');

  let timelineEnd = 0;
  let trimmedCount = 0;
  let transitionCount = 0;
  for (const c of clips) {
    const start = nleNum(c?.startOnTimeline, 0);
    const dur = nleNum(c?.duration, 0);
    if (start + dur > timelineEnd) timelineEnd = start + dur;
    const trimIn = nleNum(c?.trimIn, 0);
    const trimOut = nleNum(c?.trimOut, 0);
    // Ce qui compte comme une COUPE : le clip ne montre pas la matière qui se trouve à
    // sa place sur la timeline (`trimIn` décalé de `startOnTimeline`), ou sa fenêtre
    // source n'a pas la longueur du rectangle dessiné.
    // ⚠️ PAS « trimIn > 0 » : après « Sync chapitres », le 2ᵉ chapitre a légitimement
    // trimIn = 40 s parce qu'il EST à 40 s. Compter ça comme une coupe affichait
    // « 3 rognages » sur un montage qui ne coupe rigoureusement rien.
    const displaced = Math.abs(trimIn - start) > 0.05;
    const windowed = trimOut > trimIn + 0.05 && Math.abs(trimOut - trimIn - dur) > 0.05;
    if (displaced || windowed) trimmedCount += 1;
    for (const key of ['transitionIn', 'transitionOut']) {
      const t = c?.[key];
      if (t && String(t.type || 'cut') !== 'cut' && nleNum(t.durationSec, 0) > 0) transitionCount += 1;
    }
  }

  const g = project?.master?.colorGrade || {};
  const graded =
    Math.abs(nleNum(g.exposure, 0)) > 0.5 ||
    Math.abs(nleNum(g.contrast, 100) - 100) > 0.5 ||
    Math.abs(nleNum(g.saturation, 100) - 100) > 0.5 ||
    Math.abs(nleNum(g.warmth, 0)) > 0.5;

  const overlayCount = Array.isArray(v2?.clips) ? v2.clips.length : 0;
  const audioCount = Array.isArray(a1?.clips) ? a1.clips.length : 0;
  return {
    clipCount: primary.length,
    // Ce qui ferait rendre la source ENTIÈRE malgré le montage — dit avant l'encodage.
    refusals: montageRefusals(primary),
    overlayCount,
    audioCount,
    timelineSeconds: Math.round(timelineEnd * 100) / 100,
    trimmedCount,
    transitionCount,
    graded,
    volumeTouched: Math.abs(nleNum(project?.mix?.masterVolumeDb, 0)) > 0.01,
    isEmpty: clips.length === 0 && overlayCount === 0 && audioCount === 0,
  };
}

/**
 * Empreinte STABLE des pistes, pour répondre à une seule question : « ce que je vois à
 * l'écran est-il bien ce qui est enregistré en base ? ». Le rendu part de la BASE
 * (l'API relit `formation_day_contents.data`), jamais de l'état du navigateur : un
 * montage non enregistré ne partira pas au rendu, et le formateur doit le savoir AVANT
 * d'attendre un encodage complet. On ne retient que les champs qui changent l'image ou
 * le son — pas les libellés, pas la sélection, pas le zoom de la timeline.
 */
function nleTracksFingerprint(project) {
  const tracks = Array.isArray(project?.tracks) ? project.tracks : [];
  return JSON.stringify(
    tracks.map((t) => ({
      id: String(t?.id || ''),
      clips: (Array.isArray(t?.clips) ? [...t.clips] : [])
        .sort((a, b) => nleNum(a?.startOnTimeline, 0) - nleNum(b?.startOnTimeline, 0))
        .map((c) => [
          String(c?.sourceType || 'primary_video'),
          String(c?.sourceRef || ''),
          Math.round(nleNum(c?.startOnTimeline, 0) * 1000),
          Math.round(nleNum(c?.duration, 0) * 1000),
          Math.round(nleNum(c?.trimIn, 0) * 1000),
          Math.round(nleNum(c?.trimOut, 0) * 1000),
          Math.round(nleNum(c?.opacity, 1) * 1000),
          Math.round(nleNum(c?.volume, 1) * 1000),
          `${c?.transitionIn?.type || 'cut'}:${Math.round(nleNum(c?.transitionIn?.durationSec, 0) * 1000)}`,
          `${c?.transitionOut?.type || 'cut'}:${Math.round(nleNum(c?.transitionOut?.durationSec, 0) * 1000)}`,
        ]),
    })),
  );
}

/** Durée d'attente en clair : « 48 s », « 3 min 07 s », « 1 h 12 min ». */
function formatElapsedFr(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')} min`;
}

/** Secondes → durée parlée pour une VIDÉO (« 1 h 04 min 20 s »). */
function formatMediaDurationFr(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s <= 0) return '';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  if (m > 0) return `${m} min ${String(sec).padStart(2, '0')} s`;
  return `${sec} s`;
}

function RenderExportPanel({
  contentId,
  slideFrameCount = 0,
  defaultExportResolution = '1080p',
  // Montage AFFICHÉ (store zustand) et montage ENREGISTRÉ (JSONB de la base) : les deux
  // sont nécessaires, parce que le rendu lit la base et pas l'écran.
  nleProject = null,
  savedNleProject = null,
  // Durée de la source mesurée par le navigateur — sert à annoncer la durée du fichier
  // produit sans la deviner.
  sourceDurationSeconds = 0,
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
  // Avertissement NON bloquant remonté par l'API au lancement (plans non placés…).
  const [enqueueNotice, setEnqueueNotice] = React.useState('');
  // Erreur de LECTURE du suivi (API injoignable / refus) — distincte de `renderError`
  // qui concerne le LANCEMENT du rendu. Avant, l'échec de `renderStatus` était avalé
  // en silence : l'écran restait figé sur « Aucun rendu » sans jamais dire pourquoi.
  const [jobsError, setJobsError] = React.useState('');
  const pollRef = React.useRef(null);

  // ── Ce que le formateur a monté, et ce qui en partira réellement au rendu ──
  const montage = React.useMemo(() => summarizeNleProject(nleProject), [nleProject]);
  // Le montage est-il déjà EN BASE ? `savedNleProject` est le JSONB brut relu au
  // chargement de la page ; l'API repart exactement de cette valeur-là.
  const hasSavedMontage = Boolean(savedNleProject && typeof savedNleProject === 'object');
  const montageUnsaved = React.useMemo(() => {
    if (!nleProject) return false;
    if (!hasSavedMontage) return !summarizeNleProject(nleProject).isEmpty;
    return nleTracksFingerprint(nleProject) !== nleTracksFingerprint(parseNleProject(savedNleProject));
  }, [nleProject, savedNleProject, hasSavedMontage]);

  // Horloge locale : elle ne sert QU'À faire vieillir les compteurs d'attente à
  // l'écran. Elle ne tourne que tant qu'un job est actif — un onglet laissé ouvert
  // sur un rendu terminé ne doit pas réveiller React chaque seconde.
  const [nowTs, setNowTs] = React.useState(() => Date.now());

  const fetchJobs = React.useCallback(async () => {
    if (!contentId) return;
    setJobsLoading(true);
    try {
      const body = await courseBuilderApi.renderStatus(contentId);
      setJobs(Array.isArray(body?.jobs) ? body.jobs : []);
      setJobsError('');
    } catch (e) {
      setJobsError(String(e?.message || e || 'Suivi des rendus indisponible.'));
    } finally {
      setJobsLoading(false);
    }
  }, [contentId, invokeFnGet]);

  React.useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // Poll while any job is active
  React.useEffect(() => {
    const hasActive = jobs.some((j) => ACTIVE_RENDER_STATUSES.includes(j.status));
    if (hasActive && !pollRef.current) {
      pollRef.current = window.setInterval(fetchJobs, 4000);
    } else if (!hasActive && pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {};
  }, [jobs, fetchJobs]);

  // Compteur d'attente : sans lui, l'écran affichait « En file… » de façon strictement
  // identique à la première seconde et au bout d'un quart d'heure. Le formateur ne
  // pouvait pas distinguer « ça travaille » de « personne ne ramasse le job ».
  React.useEffect(() => {
    const hasActive = jobs.some((j) => ACTIVE_RENDER_STATUSES.includes(j.status));
    if (!hasActive) return undefined;
    setNowTs(Date.now());
    const id = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [jobs]);

  React.useEffect(() => () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
  }, []);

  const handleEnqueue = async () => {
    if (!contentId) return;
    setEnqueueLoading(true);
    setRenderError('');
    setEnqueueNotice('');
    try {
      const res = await courseBuilderApi.renderEnqueue({ contentId, renderMode, exportResolution });
      // Un plan capturé qu'AUCUN chapitre n'illustre n'a pas d'instant dans le cours :
      // le moteur ne l'affichera pas. On le DIT au lancement, plutôt que de laisser le
      // formateur découvrir après coup un montage amputé d'une partie de ses plans.
      const unplaced = Number(res?.unplacedSlides || 0);
      if (unplaced > 0 && renderMode !== 'raw') {
        setEnqueueNotice(
          `${unplaced} plan(s) capturé(s) ne sont rattachés à aucun chapitre : ils n'apparaîtront pas dans le montage. ` +
            'Associe-les à un chapitre dans la timeline pour les inclure.',
        );
      }
      await fetchJobs();
    } catch (e) {
      setRenderError(String(e?.message || e));
    } finally {
      setEnqueueLoading(false);
    }
  };

  const latestJob = jobs[0] || null;

  // Durée du FICHIER PRODUIT. Le worker termine son encodage par `-t <outDur>`, où
  // `outDur` vaut la durée du MONTAGE quand il est appliqué, et celle de la source
  // sinon. C'est la première chose qu'on vérifie en récupérant un export : l'écran doit
  // l'annoncer avant l'attente, pas la laisser découvrir après.
  const timelineDiffers =
    !montage.isEmpty &&
    montage.timelineSeconds > 0 &&
    sourceDurationSeconds > 0 &&
    Math.abs(montage.timelineSeconds - sourceDurationSeconds) > 1;
  // La sortie suit-elle le montage ? Il faut les TROIS : que le moteur le lise, qu'il y
  // ait un montage, et qu'il ne tombe sous aucune règle de refus.
  const montageDrivesOutput =
    RENDER_ENGINE_READS_MONTAGE &&
    !montage.isEmpty &&
    montage.timelineSeconds > 0 &&
    montage.refusals.length === 0;

  return (
    <div className="rounded-2xl border border-[color-mix(in_srgb,var(--coral)_20%,transparent)] bg-[#1f1e1c] p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-[color-mix(in_srgb,var(--coral)_60%,transparent)] font-semibold">🎬 Vidéo de sortie</p>
          <p className="text-sm text-white font-medium mt-0.5">Exporter la vidéo avec SmartBoard intégré</p>
          {/*
            Ce texte DÉCRIT LE MOTEUR, il ne le vend pas. La liste détaillée de ce qui est
            appliqué (et de ce qui ne l'est pas) vit juste en dessous, dans un bloc que
            l'on ne peut pas manquer : ici on se contente de dire ce que coûte l'attente.
          */}
          <p className="text-xs text-[#82807a] mt-0.5">
            Le moteur réencode le cours entier : l'attente grandit avec la durée de la source et la résolution choisie.
            {slideFrameCount > 0 ? (
              <span className="text-[#9fbf8f]/90"> · {slideFrameCount} plan(s) capturé(s)</span>
            ) : (
              <span className="text-[#b0ada3]"> · Capturer les plans depuis le designer (panneau export vidéo)</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={exportResolution}
            onChange={(e) => setExportResolution(e.target.value)}
            title="Résolution du fichier final"
            className="h-8 rounded-md border border-white/10 bg-[#1f1e1c] px-2 text-xs text-white"
          >
            {EXPORT_RESOLUTION_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          {/*
            Seuls les modes que le MOTEUR sait produire sont sélectionnables.
            « Reformulation IA » et « Masterclass » étaient proposés mais RIEN ne les
            consommait : le worker ne lisait même pas payload.renderMode et ne connaissait
            qu'une mise en page. Choisir « Masterclass » donnait un MP4 identique, à
            l'octet près, à « Pédagogique » — après une attente de rendu complète.
            Mieux vaut une option grisée qu'un réglage qui ment.
          */}
          <select
            value={renderMode}
            onChange={(e) => setRenderMode(e.target.value)}
            title="Mise en page du fichier exporté — seuls « Pédagogique » et « Brut » sont produits par le moteur"
            className="h-8 rounded-md border border-white/10 bg-[#1f1e1c] px-2 text-xs text-white"
          >
            <option value="pedagogical">Pédagogique (slide + formateur)</option>
            <option value="raw">Brut (vidéo seule, sans slide)</option>
            <option value="reformulation" disabled>Reformulation IA — bientôt</option>
            <option value="masterclass" disabled>Masterclass — bientôt</option>
          </select>
          <Button
            type="button"
            className="bg-[#d97757] text-black hover:bg-[#d97757] font-bold"
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

      {/*
        LE CONTRAT DU MOTEUR, EN CLAIR ET AVANT LE CLIC.
        Deux colonnes, jamais repliées derrière une infobulle : ce qui atteint le
        fichier, et ce que l'éditeur laisse sur le carreau. C'est la seule information
        qui évite au formateur de découvrir, après une attente d'encodage complète,
        que son fondu au noir et ses trois minutes coupées n'ont servi à rien.
      */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[#9fbf8f]/25 bg-[#7a9b6c]/10 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9fbf8f]">
            Appliqué au fichier produit
          </p>
          <ul className="mt-1 space-y-0.5">
            {RENDER_ENGINE_APPLIES.map((line) => (
              <li key={line} className="flex gap-1.5 text-[11px] leading-snug text-[#f5f4ee]">
                <span aria-hidden="true" className="text-[#9fbf8f]">✓</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-[#d97757]/35 bg-[#d97757]/10 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#e08a6b]">
            Pas encore appliqué — le rendu ignore ces réglages
          </p>
          <ul className="mt-1 space-y-0.5">
            {RENDER_ENGINE_IGNORES.map((line) => (
              <li key={line} className="flex gap-1.5 text-[11px] leading-snug text-[#f5f4ee]">
                <span aria-hidden="true" className="text-[#e08a6b]">✕</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[10px] leading-snug text-[#b0ada3]">
            {RENDER_ENGINE_READS_MONTAGE
              ? 'Rien n’est écarté en silence : ce que le moteur n’a pas su appliquer est écrit noir sur blanc dans le message affiché avec le rendu terminé.'
              : 'Ces réglages restent enregistrés avec le cours et pilotent la prévisualisation de cet écran ; ils ne sont simplement pas encore lus par le moteur d’encodage.'}
          </p>
        </div>
      </div>

      {/*
        CE QUE CE COURS-CI CONTIENT COMME MONTAGE, et si la base le connaît.
        Le rendu part de `formation_day_contents.data`, relu par l'API : l'état du
        navigateur n'y participe jamais. Tant que `RENDER_ENGINE_READS_MONTAGE` est
        faux, cette section sert d'inventaire honnête (« voilà ce que tu as construit,
        voilà ce qu'il en restera ») ; quand il passera à vrai, elle devient l'endroit
        où l'on prévient qu'un montage non enregistré ne partira pas à l'encodage.
      */}
      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#b0ada3]">Montage de l'éditeur</p>
          {montage.isEmpty ? (
            <span className="text-xs text-[#82807a]">
              Aucun clip posé — le rendu utilise la source entière.
            </span>
          ) : (
            <span className="text-xs text-[#f5f4ee]">
              {montage.clipCount} plan(s) sur la piste caméra
              {montage.timelineSeconds > 0 ? ` · timeline de ${formatMediaDurationFr(montage.timelineSeconds)}` : ''}
              {montage.trimmedCount > 0 ? ` · ${montage.trimmedCount} coupe(s)` : ''}
              {montage.transitionCount > 0 ? ` · ${montage.transitionCount} transition(s)` : ''}
              {montage.graded ? ' · étalonnage retouché' : ''}
              {montage.overlayCount > 0 ? ` · ${montage.overlayCount} incrustation(s)` : ''}
              {montage.audioCount > 0 ? ` · ${montage.audioCount} clip(s) audio` : ''}
            </span>
          )}
        </div>
        <p className="text-[11px] leading-snug text-[#b0ada3]">
          {/*
            Une coupe change la longueur du fichier : c'est la première chose qu'on
            regarde en récupérant un export. On l'annonce AVANT l'attente, et on nomme
            l'écart quand la timeline ne dit pas la même chose que la source.
          */}
          Durée du fichier produit :{' '}
          {montageDrivesOutput ? (
            <>
              {`celle du montage, ${formatMediaDurationFr(montage.timelineSeconds)}`}
              {timelineDiffers ? ` (la source en fait ${formatMediaDurationFr(sourceDurationSeconds)}).` : '.'}
            </>
          ) : (
            <>
              {sourceDurationSeconds > 0
                ? `celle de la source, ${formatMediaDurationFr(sourceDurationSeconds)}`
                : 'celle de la source'}
              {/* Pourquoi la source alors qu'une timeline plus courte est dessinée ? Deux
                  causes possibles, et l'écran ne doit pas les confondre : soit le moteur
                  n'applique pas encore le montage, soit il le refusera (le bloc
                  d'avertissement juste en dessous nomme alors le clip fautif). */}
              {timelineDiffers && !RENDER_ENGINE_READS_MONTAGE
                ? ` — et non celle de la timeline (${formatMediaDurationFr(montage.timelineSeconds)}), les coupes n’étant pas encore appliquées.`
                : '.'}
            </>
          )}
        </p>
        {/*
          REFUS ANNONCÉ AVANT L'ENCODAGE. Sans ce bloc, le formateur découvrait le verdict
          « montage refusé, source rendue entière » à la FIN d'un rendu complet — c'est-à-dire
          après avoir attendu très longtemps pour recevoir précisément ce qu'il ne voulait pas.
        */}
        {RENDER_ENGINE_READS_MONTAGE && montage.refusals.length > 0 && (
          <div className="rounded-lg border border-[#d99a4e]/45 bg-[#d99a4e]/10 px-2.5 py-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#e6b878]">
              Ce montage sera refusé — la source serait rendue entière
            </p>
            <ul className="mt-0.5 space-y-0.5">
              {montage.refusals.map((reason) => (
                <li key={reason} className="text-[11px] leading-snug text-[#f5f4ee]">{reason}</li>
              ))}
            </ul>
            <p className="text-[10px] text-[#b0ada3] mt-1">
              Corrige le clip dans l'éditeur de montage, enregistre, puis relance le rendu.
            </p>
          </div>
        )}
        {montageUnsaved && (
          <p className="text-[11px] leading-snug text-[#e6b878]">
            {/*
              Deux messages, parce qu'il y a deux vérités. Tant que l'encodeur ignore le
              montage, prétendre qu'il faut enregistrer « avant de générer » serait un
              mensonge symétrique de celui qu'on vient de retirer : ça laisserait croire
              que le montage compte pour le rendu. Ce qui reste vrai dans les deux cas,
              c'est qu'un montage non enregistré est perdu au rechargement de la page.
            */}
            {RENDER_ENGINE_READS_MONTAGE
              ? hasSavedMontage
                ? 'Le montage affiché diffère de la version enregistrée. Le rendu relit la base : enregistre le cours avant de générer, sinon c’est l’ancien montage qui partira.'
                : 'Ce montage n’a jamais été enregistré. Le rendu relit la base : enregistre le cours avant de générer.'
              : hasSavedMontage
                ? 'Le montage affiché diffère de la version enregistrée : enregistre le cours pour ne pas le perdre au rechargement.'
                : 'Ce montage n’est pas encore enregistré : enregistre le cours pour ne pas le perdre au rechargement.'}
          </p>
        )}
      </div>

      {/* Échec du LANCEMENT (POST render-enqueue) — bordure corail, texte clair (pas de rouge criard). */}
      {renderError && (
        <div className="rounded-lg border border-[#d97757]/45 bg-[#d97757]/10 p-3">
          <p className="text-xs font-semibold text-[#e08a6b] uppercase tracking-wide">Le rendu n'a pas pu être lancé</p>
          <p className="text-sm text-[#f5f4ee] mt-1 break-words">{renderError}</p>
        </div>
      )}

      {/* Rendu LANCÉ mais incomplet par construction — avertissement, pas erreur. */}
      {enqueueNotice && !renderError && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-semibold text-[#b0ada3] uppercase tracking-wide">Rendu lancé — plans non placés</p>
          <p className="text-sm text-[#f5f4ee] mt-1 break-words">{enqueueNotice}</p>
        </div>
      )}

      {/* Échec de la LECTURE du suivi (GET render-status) — l'écran ne reste plus muet. */}
      {jobsError && (
        <div className="rounded-lg border border-[#d97757]/45 bg-[#d97757]/10 p-3">
          <p className="text-xs font-semibold text-[#e08a6b] uppercase tracking-wide">Suivi des rendus indisponible</p>
          <p className="text-sm text-[#f5f4ee] mt-1 break-words">{jobsError}</p>
          <p className="text-xs text-[#b0ada3] mt-1">Le rendu en cours n'est pas annulé : réessaie avec le bouton Actualiser.</p>
        </div>
      )}

      {/* Liste des jobs — tous les champs passent par les lecteurs tolérants de api-v2
          (renderJob*) : l'UI ne dépend plus du nom exact des colonnes servies par l'API. */}
      {jobs.length > 0 && (
        <div className="space-y-2">
          {jobs.slice(0, 5).map((job) => {
            const s = STATUS_LABELS[job.status] || { label: job.status, color: 'text-[#b0ada3]', pulse: false };
            const workerErr = renderJobErrorMessage(job);
            const playableUrl = renderJobPlayableUrl(job);
            // Le mode de rendu n'est PAS une colonne : il vit dans payload.renderMode
            // (posé par enqueuePostprodRender). On accepte quand même une éventuelle
            // colonne `render_mode` si l'API en ajoute une un jour.
            const mode = job.render_mode || job.payload?.renderMode || '';
            // Rendu terminé mais aucune URL absolue servie → l'API n'a pas (encore)
            // présigné la clé R2 du bucket privé. On le DIT au lieu de proposer un
            // lien mort qui pointerait sur l'application elle-même.
            const awaitingLink = job.status === 'completed' && !playableUrl && Boolean(renderJobStorageKey(job));
            const isActive = ACTIVE_RENDER_STATUSES.includes(job.status);
            // ── ATTENDRE SANS ÊTRE AVEUGLE ────────────────────────────────────
            // Un encodage se compte en minutes, parfois en dizaines de minutes. Sans
            // compteur, « En file… » à la première seconde et « En file… » au bout
            // d'un quart d'heure s'écrivent exactement pareil : impossible de
            // distinguer un moteur qui travaille d'un worker à l'arrêt.
            const createdMs = Date.parse(job.created_at || '');
            const updatedMs = Date.parse(job.updated_at || job.created_at || '');
            const elapsedSec = Number.isFinite(createdMs) ? Math.max(0, (nowTs - createdMs) / 1000) : 0;
            // Pour un job TERMINÉ (ou échoué), la durée utile est celle qu'il a mise à
            // s'exécuter — `updated_at` est écrit par le worker à chaque changement
            // d'état, y compris le dernier.
            const takenSec =
              Number.isFinite(createdMs) && Number.isFinite(updatedMs) && updatedMs > createdMs
                ? (updatedMs - createdMs) / 1000
                : 0;
            // Toujours en file bien après le lancement : ce n'est plus de la patience,
            // c'est un diagnostic. Le job est en base, personne ne l'a ramassé.
            const queueStalled = job.status === 'queued' && elapsedSec > QUEUE_STALL_SECONDS;
            // Le worker écrit ses REMARQUES dans la même colonne que ses ERREURS
            // (`course_render_jobs.error`) : un rendu qui a réussi peut donc porter du
            // texte — « tel réglage n'a pas été traduit », « tel plan a été déplacé ».
            // Le peindre en corail sous le titre « Message du moteur de rendu » ferait
            // lire un échec là où il y a un fichier parfaitement utilisable. On sépare
            // donc les deux lectures : avertissement doré si le rendu a abouti, alerte
            // corail seulement quand il a échoué.
            const workerNoticeIsWarning = Boolean(workerErr) && job.status !== 'failed';
            return (
              <div key={job.id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${s.color} ${s.pulse ? 'animate-pulse' : ''}`}>
                      {s.label}
                    </span>
                    {isActive && elapsedSec > 0 && (
                      <span className="text-[11px] text-[#b0ada3]">depuis {formatElapsedFr(elapsedSec)}</span>
                    )}
                    {!isActive && takenSec > 0 && (
                      <span className="text-[11px] text-[#b0ada3]">
                        {job.status === 'failed' ? 'arrêté après' : 'rendu en'} {formatElapsedFr(takenSec)}
                      </span>
                    )}
                    {mode && (
                      <span className="text-[10px] text-[#b0ada3] bg-white/5 px-2 py-0.5 rounded-full font-mono">{mode}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#b0ada3] font-mono mt-0.5">
                    {new Date(job.created_at).toLocaleString('fr-FR')}
                  </p>
                  {job.status === 'rendering' && (
                    <p className="text-[11px] text-[#b0ada3] mt-1">
                      Le moteur réencode chaque image du cours. Cette page se met à jour toute seule, tu peux la quitter.
                    </p>
                  )}
                  {queueStalled && (
                    <p className="text-[11px] text-[#e6b878] mt-1 max-w-xl leading-snug">
                      Toujours en file après {formatElapsedFr(elapsedSec)} : aucun moteur de rendu ne l'a pris en charge.
                      Le rendu n'est pas perdu — il repartira dès qu'un moteur sera disponible. Si l'attente se prolonge,
                      c'est le service de rendu qu'il faut vérifier, pas ce cours.
                    </p>
                  )}
                  {workerErr && (
                    <div
                      className={`mt-1.5 rounded-lg border px-2.5 py-1.5 max-w-xl ${
                        workerNoticeIsWarning
                          ? 'border-[#d99a4e]/45 bg-[#d99a4e]/10'
                          : 'border-[#d97757]/45 bg-[#d97757]/10'
                      }`}
                    >
                      <p
                        className={`text-[11px] font-semibold uppercase tracking-wide ${
                          workerNoticeIsWarning ? 'text-[#e6b878]' : 'text-[#e08a6b]'
                        }`}
                      >
                        {workerNoticeIsWarning
                          ? 'Le moteur signale — la vidéo est produite'
                          : 'Message du moteur de rendu'}
                      </p>
                      {/* Message BRUT du worker : jamais tronqué à l'affichage — c'est
                          la seule trace exploitable côté formateur pour comprendre
                          (source vidéo expirée, ffmpeg absent, R2 non configuré, réglage
                          de montage non traduit…). */}
                      <p className="text-xs text-[#f5f4ee] mt-0.5 break-words whitespace-pre-wrap" title={workerErr}>{workerErr}</p>
                    </div>
                  )}
                  {awaitingLink && (
                    <p className="text-[11px] text-[#e6cc92] mt-1">
                      Fichier rendu et archivé, mais son lien de lecture n'a pas encore été délivré. Actualise dans un instant.
                    </p>
                  )}
                </div>
                {job.status === 'completed' && playableUrl && (
                  <a
                    href={playableUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[#7a9b6c]/15 border border-[#7a9b6c]/30 px-3 py-1.5 text-xs text-[#9fbf8f] hover:bg-[#7a9b6c]/25 transition-colors font-semibold"
                  >
                    ⬇ Télécharger MP4
                  </a>
                )}
                {isActive && (
                  <div className="shrink-0 flex items-center gap-1.5 text-xs text-[#b0ada3]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    En cours…
                  </div>
                )}
                {job.status === 'failed' && (
                  <button
                    type="button"
                    onClick={handleEnqueue}
                    disabled={enqueueLoading || !contentId}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-[#d97757]/45 bg-[#d97757]/10 px-3 py-1.5 text-xs text-[#e08a6b] hover:bg-[#d97757]/20 transition-colors font-semibold disabled:opacity-50"
                  >
                    Relancer le rendu
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {jobs.length === 0 && !jobsLoading && !jobsError && (
        <p className="text-xs text-[#b0ada3] text-center py-2">Aucun rendu pour ce contenu. Clique sur « Générer la vidéo » pour démarrer.</p>
      )}
    </div>
  );
}

export default VideoPostProductionPage;
