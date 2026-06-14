import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { courseBuilderApi } from '@/lib/api-v2';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Video, Mic, MicOff, VideoOff, Play, Pause, Square, RotateCcw,
  ChevronRight, ChevronLeft, Sparkles, BookOpen, MessageSquare,
  CheckCircle, Circle, Camera, Settings, Monitor, Smartphone,
  Loader2, Check, AlertCircle, Plus, Trash2, X, Upload,
  LayoutPanelLeft, Leaf, Brain, Palette, Image as ImageIcon, ArrowRight,
} from 'lucide-react';
import SmartboardEditorPanel from '@/components/school/formations/SmartboardEditorPanel';
import SmartboardCanvasEditor from '@/components/school/formations/SmartboardCanvasEditor';
import { canvasObjectsToSlideElements } from '@/lib/smartboardCanvasModel';
import {
  DEFAULT_SMARTBOARD_EDGE_FEATHER,
  resolveSmartboardEdgeFeatherPercent,
  smartboardEdgeFeatherMaskStyle,
} from '@/lib/smartboardImmersiveMask';

const SlideParallaxStageLazy = React.lazy(() => import('@/components/liri/live-room/SlideParallaxStage'));

// ─── coaching tips cycling during recording ──────────────────────────────────
const COACHING_TIPS = [
  { icon: '💬', text: 'Parle plus simplement — utilise des mots du quotidien.' },
  { icon: '🎯', text: 'Donne un exemple concret tiré de la vie réelle.' },
  { icon: '✂️', text: 'Résume cette idée en une seule phrase percutante.' },
  { icon: '⏭️', text: 'Passe au point suivant quand tu es prêt.' },
  { icon: '📖', text: 'Explique ce terme difficile avec tes propres mots.' },
  { icon: '🔗', text: 'Ajoute une analogie : « c\'est comme si… ».' },
  { icon: '❓', text: 'Implique l\'apprenant : « Est-ce que vous voyez ce que je veux dire ? ».' },
  { icon: '🔊', text: 'Ralentis ton débit — marque une pause avant le point suivant.' },
  { icon: '🏗️', text: 'Structure : intro → développement → conclusion.' },
  { icon: '💡', text: 'Partage une anecdote personnelle pour ancrer le concept.' },
];

const formatTime = (secs) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const newUuid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

// ─── SmartBoard design templates ─────────────────────────────────────────────
const SB_TEMPLATES = {
  dark_gold: {
    label: 'Or Premium',
    bg: 'linear-gradient(135deg,#0a0e1a 0%,#10162b 60%,#0d1220 100%)',
    accent: '#D4AF37',
    titleColor: '#D4AF37',
    textColor: '#e2e8f0',
    tagBg: 'rgba(212,175,55,0.15)',
    tagText: '#D4AF37',
    border: 'rgba(212,175,55,0.25)',
    numBg: 'rgba(212,175,55,0.2)',
  },
  midnight: {
    label: 'Minuit',
    bg: 'linear-gradient(135deg,#000000 0%,#111827 100%)',
    accent: '#ffffff',
    titleColor: '#ffffff',
    textColor: '#d1d5db',
    tagBg: 'rgba(255,255,255,0.1)',
    tagText: '#ffffff',
    border: 'rgba(255,255,255,0.15)',
    numBg: 'rgba(255,255,255,0.1)',
  },
  cosmic: {
    label: 'Cosmique',
    bg: 'linear-gradient(135deg,#0d0021 0%,#1a0540 50%,#07001a 100%)',
    accent: '#a78bfa',
    titleColor: '#c4b5fd',
    textColor: '#e9d5ff',
    tagBg: 'rgba(167,139,250,0.2)',
    tagText: '#a78bfa',
    border: 'rgba(167,139,250,0.3)',
    numBg: 'rgba(167,139,250,0.15)',
  },
  forest: {
    label: 'Forêt',
    bg: 'linear-gradient(135deg,#031a0e 0%,#052e16 60%,#0a1a0d 100%)',
    accent: '#4ade80',
    titleColor: '#86efac',
    textColor: '#d1fae5',
    tagBg: 'rgba(74,222,128,0.15)',
    tagText: '#4ade80',
    border: 'rgba(74,222,128,0.25)',
    numBg: 'rgba(74,222,128,0.12)',
  },
  academic: {
    label: 'Académique',
    bg: 'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)',
    accent: '#f59e0b',
    titleColor: '#fcd34d',
    textColor: '#e2e8f0',
    tagBg: 'rgba(245,158,11,0.15)',
    tagText: '#f59e0b',
    border: 'rgba(245,158,11,0.25)',
    numBg: 'rgba(245,158,11,0.15)',
  },
};

/** Canvas text wrapping helper */
function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let curY = y;
  for (const word of words) {
    const test = line + (line ? ' ' : '') + word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, curY);
      line = word;
      curY += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, curY);
}

/** Génère une mise en page élégante pour un slide SmartBoard depuis un segment */
function generateSbLayout(seg, theme) {
  const t = SB_TEMPLATES[theme] || SB_TEMPLATES.dark_gold;
  return {
    title: seg.title,
    points: seg.points.filter(Boolean),
    theme,
    t,
    immersive_edge_feather: seg.immersive_edge_feather,
  };
}

// ─── Source labels ────────────────────────────────────────────────────────────
const SOURCE_LABELS = {
  webcam:       { icon: '🎥', label: 'Webcam PC' },
  screen:       { icon: '🖥️', label: 'Capture écran' },
  external:     { icon: '📷', label: 'Caméra externe' },
  phone_stream: { icon: '📱', label: 'Caméra téléphone' },
};

// ─── Pipeline IA post-captation ───────────────────────────────────────────────
function PipelinePanel({ segments, formTitle, recordingTime, onClose }) {
  const [status, setStatus]   = useState('idle'); // idle | running | done | error
  const [result, setResult]   = useState(null);
  const [error,  setError]    = useState('');
  const [step,   setStep]     = useState('');

  const runPipeline = async () => {
    setStatus('running');
    setError('');
    try {
      setStep('Segmentation automatique…');
      const transcript = segments
        .map((s) => `${s.title}:\n${(s.points || []).join('. ')}`)
        .join('\n\n');

      // Rebranché sur NestJS (les edges course-builder-pipeline-* n'existent pas → 404).
      const segData = await courseBuilderApi.pipelineAutoSegment({ contentId: 'draft', transcriptText: transcript });

      setStep('Génération du Master Script…');
      const scriptData = await courseBuilderApi.pipelineMasterScript({
        segments: segData.segments,
        transcript: segData.transcript,
        courseTitle: formTitle || 'Cours',
      });

      setResult({ ...segData, scriptSections: scriptData.sections });
      setStatus('done');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  if (status === 'idle') {
    return (
      <div className="border border-emerald-500/30 bg-emerald-500/10 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-6 h-6 text-emerald-400" />
          <p className="text-sm font-semibold text-emerald-300">Vidéo téléversée !</p>
        </div>
        <p className="text-xs text-gray-400">Lance la pipeline IA pour segmenter, transcrire et générer le Master Script.</p>
        <div className="flex gap-2">
          <Button size="sm" onClick={runPipeline} className="flex-1 bg-[#D4AF37] text-black hover:bg-amber-400 font-bold text-xs">
            ✨ Lancer la pipeline IA
          </Button>
          <Button size="sm" variant="outline" onClick={onClose} className="border-white/10 text-gray-300 hover:text-white text-xs">
            Fermer
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'running') {
    return (
      <div className="border border-[#D4AF37]/30 bg-[#D4AF37]/5 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Loader2 className="w-5 h-5 text-[#D4AF37] animate-spin" />
          <p className="text-sm font-semibold text-[#D4AF37]">Pipeline en cours…</p>
        </div>
        <p className="text-xs text-gray-400">{step}</p>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full bg-[#D4AF37] rounded-full animate-pulse w-2/3" />
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="border border-red-500/30 bg-red-500/10 rounded-xl p-4 space-y-2">
        <p className="text-sm text-red-300 font-semibold">Erreur pipeline</p>
        <p className="text-xs text-red-400">{error}</p>
        <Button size="sm" onClick={runPipeline} variant="outline" className="border-red-500/30 text-red-300 text-xs">
          Réessayer
        </Button>
      </div>
    );
  }

  // done
  return (
    <div className="border border-emerald-500/30 bg-emerald-500/10 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle className="w-5 h-5 text-emerald-400" />
        <p className="text-sm font-semibold text-emerald-300">Pipeline terminée !</p>
      </div>
      <div className="space-y-1.5 text-xs text-gray-400">
        <p>✅ {result?.segments?.length || 0} segments détectés</p>
        <p>✅ {result?.scriptSections?.length || 0} sections de script générées</p>
        {result?.summary && <p className="text-white/60 italic leading-relaxed">"{result.summary.slice(0, 120)}…"</p>}
      </div>
      <Button size="sm" onClick={onClose} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs">
        Fermer le studio
      </Button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CaptureStudioModal({ open, onClose, onVideoReady, initialTitle = '', source = 'webcam' }) {
  // phase: setup | recording | paused | preview | uploading | done
  const [phase, setPhase] = useState('setup');

  // Setup form
  const [formTitle, setFormTitle] = useState(initialTitle);
  const [formDescription, setFormDescription] = useState('');
  const [segments, setSegments] = useState([
    { id: '1', title: 'Introduction', points: ['Objectifs du cours', 'Présentation du sujet'] },
    { id: '2', title: 'Développement', points: ['Point principal 1', 'Point principal 2'] },
    { id: '3', title: 'Conclusion', points: ['Résumé', 'À retenir'] },
  ]);

  // Devices
  const [videoDevices, setVideoDevices] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [orientation, setOrientation] = useState('landscape');
  const [videoMuted, setVideoMuted] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);

  // Recording state
  const [recordingTime, setRecordingTime] = useState(0);
  const [activeSegmentIdx, setActiveSegmentIdx] = useState(0);
  const [activePointIdx, setActivePointIdx] = useState(0);
  const [activeTab, setActiveTab] = useState('plan');
  const [tipIdx, setTipIdx] = useState(0);
  const [completedPoints, setCompletedPoints] = useState(new Set());

  // Post-recording
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');

  // ── SmartBoard ──────────────────────────────────────────────────────────
  const [showSmartboard, setShowSmartboard] = useState(true);
  const [sbTheme, setSbTheme] = useState('dark_gold');
  const [sbCustomSlides, setSbCustomSlides] = useState({});       // overrides par segment id
  // greenScreen state removed — replaced by chromaKeyEnabled for real pixel-level removal
  const [aiGenerating, setAiGenerating] = useState(false);
  const [sbEditMode, setSbEditMode] = useState(false);           // édition manuelle du slide
  const [editedTitle, setEditedTitle] = useState('');
  const [editedPoints, setEditedPoints] = useState([]);
  const [editedProgressiveEnabled, setEditedProgressiveEnabled] = useState(false);
  const [editedProgressiveCoreIdea, setEditedProgressiveCoreIdea] = useState('');
  const [editedProgressiveSteps, setEditedProgressiveSteps] = useState([]);
  const [sbBgImage, setSbBgImage] = useState('');                // image de fond custom
  const [sbBgCss, setSbBgCss] = useState('');                   // fond CSS override (depuis l'éditeur)
  const [sbAccentColor, setSbAccentColor] = useState('');       // couleur accent override
  const [sbBulletStyle, setSbBulletStyle] = useState('');       // style de puce override
  const [sbLayout, setSbLayout] = useState('left');             // disposition du slide
  /** 0–100 : fondu des bords (style Photoshop) pour fondre le SmartBoard dans l'écran intelligent */
  const [sbEdgeFeather, setSbEdgeFeather] = useState(DEFAULT_SMARTBOARD_EDGE_FEATHER);
  /** classic = titre + puces (aperçu liste) · canvas = studio type Canva 1037×750 */
  const [sbStudioEditorMode, setSbStudioEditorMode] = useState('classic');
  const [editedCanvasObjects, setEditedCanvasObjects] = useState([]);
  // ── Pédagogie augmentée ─────────────────────────────────────────────────
  const [showTransitionModal, setShowTransitionModal] = useState(false);
  const [pendingNextSeg, setPendingNextSeg] = useState(null);
  const [pedagogyText, setPedagogyText] = useState('');
  const [pedagogyGenerating, setPedagogyGenerating] = useState(false);

  // Chroma key (real green-screen removal)
  const [chromaKeyEnabled, setChromaKeyEnabled] = useState(true);
  const [chromaSensitivity, setChromaSensitivity] = useState(120);

  // Refs
  const liveVideoRef = useRef(null);
  const previewVideoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const tipTimerRef = useRef(null);
  const compositeCanvasRef = useRef(null);
  const chromaTmpCanvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const compositeStreamRef = useRef(null);

  // ── enumerate devices ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    navigator.mediaDevices.enumerateDevices().then((devs) => {
      setVideoDevices(devs.filter((d) => d.kind === 'videoinput'));
      setAudioDevices(devs.filter((d) => d.kind === 'audioinput'));
    }).catch(() => {});
  }, [open]);

  // ── open stream based on source type ─────────────────────────────────────
  const openCamera = useCallback(async () => {
    try {
      const recState = recorderRef.current?.state;
      if (recState === 'recording' || recState === 'paused') return;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      let stream;
      if (source === 'screen') {
        // Screen capture — getDisplayMedia + optional mic
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
          audio: true,
        });
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true, video: false });
          // merge audio track from mic into display stream
          const micTrack = audioStream.getAudioTracks()[0];
          if (micTrack) displayStream.addTrack(micTrack);
        } catch { /* mic optional for screen capture */ }
        stream = displayStream;
        // Stop screen capture when user clicks browser's "Stop sharing"
        displayStream.getVideoTracks()[0].onended = () => {
          if (streamRef.current === displayStream) openCamera();
        };
      } else if (source === 'external') {
        // Prefer non-built-in / external camera
        const devs = await navigator.mediaDevices.enumerateDevices();
        const externalCams = devs.filter((d) => d.kind === 'videoinput' && !d.label.toLowerCase().includes('built-in') && !d.label.toLowerCase().includes('facetime'));
        const preferredDeviceId = selectedVideoDevice || (externalCams[0]?.deviceId) || undefined;
        stream = await navigator.mediaDevices.getUserMedia({
          video: preferredDeviceId ? { deviceId: { exact: preferredDeviceId } } : true,
          audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true,
        });
      } else {
        // webcam (default)
        stream = await navigator.mediaDevices.getUserMedia({
          video: selectedVideoDevice ? { deviceId: { exact: selectedVideoDevice } } : true,
          audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true,
        });
      }
      streamRef.current = stream;
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('[CaptureStudio] stream error', err);
    }
  }, [source, selectedVideoDevice, selectedAudioDevice]);

  useEffect(() => {
    if (open && phase === 'setup') {
      openCamera();
    }
    return () => {
      if (phase === 'preview' || phase === 'uploading' || phase === 'done') {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      }
    };
  }, [open, phase, openCamera]);

  // Rebind existing stream to the <video> when phase transitions to recording/paused
  useEffect(() => {
    const vid = liveVideoRef.current;
    const stream = streamRef.current;
    if ((phase === 'recording' || phase === 'paused') && vid && stream) {
      if (vid.srcObject !== stream) {
        vid.srcObject = stream;
      }
      // Ensure playback is started — autoPlay alone doesn't fire after programmatic srcObject set
      if (vid.paused) vid.play().catch(() => {});
    }
  }, [phase]);

  // ── clean up on close ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      compositeStreamRef.current?.getTracks().forEach((t) => t.stop());
      compositeStreamRef.current = null;
      compositeCanvasRef.current = null;
      chromaTmpCanvasRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      clearInterval(timerRef.current);
      clearInterval(tipTimerRef.current);
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      setPhase('setup');
      setRecordingTime(0);
      setRecordedBlob(null);
      setPreviewObjectUrl('');
      setUploadProgress(0);
      setUploadError('');
      setCompletedPoints(new Set());
      setActiveSegmentIdx(0);
      setActivePointIdx(0);
      setSbCustomSlides({});
      setPedagogyText('');
      setShowTransitionModal(false);
      setSbEditMode(false);
      setSbBgCss('');
      setSbAccentColor('');
      setSbBulletStyle('');
      setSbLayout('left');
    }
  }, [open]);

  // ── mirror video mute ───────────────────────────────────────────────────
  useEffect(() => {
    if (!streamRef.current) return;
    streamRef.current.getVideoTracks().forEach((t) => { t.enabled = !videoMuted; });
  }, [videoMuted]);
  useEffect(() => {
    if (!streamRef.current) return;
    streamRef.current.getAudioTracks().forEach((t) => { t.enabled = !audioMuted; });
  }, [audioMuted]);

  // ── Composite canvas renderer (SmartBoard + chroma-keyed video) ─────────
  const currentSlideRef = useRef(null);
  const segmentsRef = useRef(segments);
  const activeSegIdxRef = useRef(activeSegmentIdx);
  const completedPtsRef = useRef(completedPoints);
  const formTitleRef = useRef(formTitle);
  const showSmartboardRef = useRef(showSmartboard);
  const chromaEnabledRef = useRef(chromaKeyEnabled);
  const chromaSensRef = useRef(chromaSensitivity);

  useEffect(() => { currentSlideRef.current = currentSlide; }, [currentSlide]);
  useEffect(() => { segmentsRef.current = segments; }, [segments]);
  useEffect(() => { activeSegIdxRef.current = activeSegmentIdx; }, [activeSegmentIdx]);
  useEffect(() => { completedPtsRef.current = completedPoints; }, [completedPoints]);
  useEffect(() => { formTitleRef.current = formTitle; }, [formTitle]);
  useEffect(() => { showSmartboardRef.current = showSmartboard; }, [showSmartboard]);
  useEffect(() => { chromaEnabledRef.current = chromaKeyEnabled; }, [chromaKeyEnabled]);
  useEffect(() => { chromaSensRef.current = chromaSensitivity; }, [chromaSensitivity]);

  // Polyfill roundRect for browsers that don't support it yet
  const roundRectPath = useCallback((ctx, rx, ry, rw, rh, radius) => {
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(rx, ry, rw, rh, radius);
    } else {
      const r = Math.min(radius, rw / 2, rh / 2);
      ctx.moveTo(rx + r, ry);
      ctx.lineTo(rx + rw - r, ry);
      ctx.arcTo(rx + rw, ry, rx + rw, ry + r, r);
      ctx.lineTo(rx + rw, ry + rh - r);
      ctx.arcTo(rx + rw, ry + rh, rx + rw - r, ry + rh, r);
      ctx.lineTo(rx + r, ry + rh);
      ctx.arcTo(rx, ry + rh, rx, ry + rh - r, r);
      ctx.lineTo(rx, ry + r);
      ctx.arcTo(rx, ry, rx + r, ry, r);
      ctx.closePath();
    }
  }, []);

  const drawSmartBoardToCanvas = useCallback((ctx, x, y, w, h, slide) => {
    if (!slide) return;
    const t = slide.t;
    // Background
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const colors = (t.bg || '').match(/#[0-9a-fA-F]{6}/g) || ['#0a0e1a', '#10162b'];
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    colors.forEach((c, i) => grad.addColorStop(i / Math.max(1, colors.length - 1), c));
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    const pad = Math.round(w * 0.07);
    const segs = segmentsRef.current;
    const segIdx = activeSegIdxRef.current;

    // Chapter badge
    ctx.fillStyle = t.tagBg || 'rgba(212,175,55,0.15)';
    const badgeText = `CHAPITRE ${segIdx + 1} / ${segs.length}`;
    ctx.font = `bold ${Math.round(h * 0.018)}px system-ui`;
    const badgeW = ctx.measureText(badgeText).width + 24;
    const badgeH = Math.round(h * 0.035);
    const badgeY = y + pad;
    ctx.beginPath();
    roundRectPath(ctx, x + pad, badgeY, badgeW, badgeH, badgeH / 2);
    ctx.fill();
    ctx.fillStyle = t.tagText || '#D4AF37';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, x + pad + 12, badgeY + badgeH / 2);

    // Title
    const titleSize = Math.round(h * 0.055);
    ctx.font = `bold ${titleSize}px Georgia, serif`;
    ctx.fillStyle = t.titleColor || '#D4AF37';
    ctx.textBaseline = 'top';
    const titleY = badgeY + badgeH + Math.round(h * 0.04);
    const maxTitleW = w - pad * 2;
    wrapText(ctx, slide.title || '', x + pad, titleY, maxTitleW, titleSize * 1.2);

    // Points
    const titleLines = Math.ceil(ctx.measureText(slide.title || '').width / maxTitleW) || 1;
    let pY = titleY + titleLines * titleSize * 1.2 + Math.round(h * 0.04);
    const ptSize = Math.round(h * 0.028);
    const pts = slide.points || [];
    pts.forEach((pt, i) => {
      if (!pt) return;
      const done = completedPtsRef.current.has(`${segIdx}-${i}`);
      // Number circle
      const circR = Math.round(ptSize * 0.7);
      ctx.fillStyle = done ? 'rgba(74,222,128,0.3)' : (t.numBg || 'rgba(212,175,55,0.2)');
      ctx.beginPath();
      ctx.arc(x + pad + circR, pY + circR, circR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = done ? '#4ade80' : (t.accent || '#D4AF37');
      ctx.font = `bold ${Math.round(ptSize * 0.7)}px system-ui`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(done ? '✓' : String(i + 1).padStart(2, '0'), x + pad + circR, pY + circR);
      ctx.textAlign = 'left';
      // Text
      ctx.fillStyle = done ? 'rgba(200,200,200,0.4)' : (t.textColor || '#e2e8f0');
      ctx.font = `${ptSize}px system-ui`;
      ctx.textBaseline = 'top';
      ctx.fillText(pt, x + pad + circR * 2 + 12, pY + circR - ptSize / 2, maxTitleW - circR * 2 - 20);
      pY += circR * 2 + Math.round(h * 0.02);
    });

    // Course title watermark
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = t.accent || '#D4AF37';
    ctx.font = `${Math.round(h * 0.015)}px system-ui`;
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'right';
    ctx.fillText((formTitleRef.current || '').toUpperCase(), x + w - pad, y + h - pad);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.restore();
  }, [roundRectPath]);

  const drawVideoFrame = useCallback((ctx, video, dx, dy, dw, dh, useChroma) => {
    if (!video || !video.videoWidth) return;
    if (!useChroma) {
      ctx.drawImage(video, dx, dy, dw, dh);
      return;
    }
    // Chroma-key: draw to temp canvas, process pixels, composite
    if (!chromaTmpCanvasRef.current) {
      chromaTmpCanvasRef.current = document.createElement('canvas');
    }
    const tmp = chromaTmpCanvasRef.current;
    tmp.width = dw;
    tmp.height = dh;
    const tctx = tmp.getContext('2d', { willReadFrequently: true });
    tctx.drawImage(video, 0, 0, dw, dh);
    const imgData = tctx.getImageData(0, 0, dw, dh);
    const d = imgData.data;
    const sens = chromaSensRef.current;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (g > 60 && g > r * 1.2 && g > b * 1.2 && (g - r) + (g - b) > sens) {
        d[i + 3] = 0;
      }
    }
    tctx.putImageData(imgData, 0, 0);
    ctx.drawImage(tmp, dx, dy, dw, dh);
  }, []);

  const renderCompositeLoop = useCallback(() => {
    const canvas = compositeCanvasRef.current;
    const video = liveVideoRef.current;
    if (!canvas || !video) { animFrameRef.current = requestAnimationFrame(renderCompositeLoop); return; }
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const slide = currentSlideRef.current;
    const showSb = showSmartboardRef.current && slide;

    if (showSb) {
      const sbW = Math.round(W * 0.62);
      drawSmartBoardToCanvas(ctx, 0, 0, sbW, H, slide);
      const vidW = W - sbW;
      // Dark background behind video area
      ctx.fillStyle = '#050505';
      ctx.fillRect(sbW, 0, vidW, H);
      drawVideoFrame(ctx, video, sbW, 0, vidW, H, chromaEnabledRef.current);
    } else {
      drawVideoFrame(ctx, video, 0, 0, W, H, chromaEnabledRef.current);
    }

    animFrameRef.current = requestAnimationFrame(renderCompositeLoop);
  }, [drawSmartBoardToCanvas, drawVideoFrame]);

  // Start/stop composite render loop
  useEffect(() => {
    if (phase === 'recording' || phase === 'paused') {
      if (!compositeCanvasRef.current) {
        const c = document.createElement('canvas');
        c.width = 1920;
        c.height = 1080;
        compositeCanvasRef.current = c;
      }
      renderCompositeLoop();
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [phase, renderCompositeLoop]);

  // ── start recording ───────────────────────────────────────────────────────
  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];

    // Create composite canvas for recording
    if (!compositeCanvasRef.current) {
      const c = document.createElement('canvas');
      c.width = 1920;
      c.height = 1080;
      compositeCanvasRef.current = c;
    }

    // Composite stream: canvas video + camera audio
    const canvasStream = compositeCanvasRef.current.captureStream(30);
    const audioTrack = streamRef.current.getAudioTracks()[0];
    if (audioTrack) canvasStream.addTrack(audioTrack.clone());
    compositeStreamRef.current = canvasStream;

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : '';
    const recorder = new MediaRecorder(canvasStream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 4_000_000,
    });
    recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      if (blob.size === 0) {
        setUploadError('Aucune donnée enregistrée. Vérifiez les permissions caméra/micro.');
        setPhase('setup');
        return;
      }
      setRecordedBlob(blob);
      const url = URL.createObjectURL(blob);
      setPreviewObjectUrl(url);
      setPhase('preview');
    };
    recorder.start(250);
    recorderRef.current = recorder;
    setPhase('recording');
    setRecordingTime(0);
    timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    tipTimerRef.current = setInterval(() => setTipIdx((i) => (i + 1) % COACHING_TIPS.length), 30000);
  };

  const pauseRecording = () => {
    recorderRef.current?.pause();
    clearInterval(timerRef.current);
    clearInterval(tipTimerRef.current);
    setPhase('paused');
  };

  const resumeRecording = () => {
    recorderRef.current?.resume();
    timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    tipTimerRef.current = setInterval(() => setTipIdx((i) => (i + 1) % COACHING_TIPS.length), 30000);
    setPhase('recording');
  };

  const stopRecording = () => {
    try { recorderRef.current?.requestData(); } catch { /* ignore */ }
    recorderRef.current?.stop();
    clearInterval(timerRef.current);
    clearInterval(tipTimerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    compositeStreamRef.current?.getTracks().forEach((t) => t.stop());
    compositeStreamRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const resetRecording = () => {
    setRecordedBlob(null);
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    setPreviewObjectUrl('');
    setRecordingTime(0);
    setCompletedPoints(new Set());
    setActiveSegmentIdx(0);
    setActivePointIdx(0);
    setPhase('setup');
  };

  // ── upload to Supabase ───────────────────────────────────────────────────
  const uploadVideo = async () => {
    if (!recordedBlob) return;
    setPhase('uploading');
    setUploadError('');
    setUploadProgress(0);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase env manquant');

      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Session manquante. Connecte-toi.');

      const ext = recordedBlob.type.includes('mp4') ? 'mp4' : 'webm';
      const fileName = `capture-${Date.now()}.${ext}`;
      const path = `captures/${fileName}`;

      const { data: publicData } = supabase.storage.from('videos').getPublicUrl(path);
      const publicUrl = publicData?.publicUrl || '';

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/videos/${encodeURIComponent(path).replace(/%2F/g, '/')}`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('apikey', supabaseAnonKey);
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.setRequestHeader('content-type', recordedBlob.type || 'video/webm');
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onerror = () => reject(new Error('Erreur réseau pendant le téléversement'));
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(xhr.responseText || `Upload échoué (${xhr.status})`));
        xhr.send(recordedBlob);
      });

      setUploadProgress(100);
      setPhase('done');
      const durationMins = Math.max(1, Math.round(recordingTime / 60));
      onVideoReady?.({
        id: newUuid(),
        title: formTitle || 'Vidéo capturée',
        description: formDescription,
        type: 'upload',
        url: publicUrl,
        storagePath: path,
        duration: durationMins,
      });
    } catch (err) {
      setUploadError(String(err?.message || err));
      setPhase('preview');
    }
  };

  // ── segment helpers ──────────────────────────────────────────────────────
  const addSegment = () => setSegments((prev) => [...prev, { id: newUuid(), title: `Segment ${prev.length + 1}`, points: [''] }]);
  const removeSegment = (id) => setSegments((prev) => prev.filter((s) => s.id !== id));
  const updateSegment = (id, field, value) => setSegments((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s));
  const updatePoint = (segId, idx, value) => setSegments((prev) => prev.map((s) => s.id === segId ? { ...s, points: s.points.map((p, i) => i === idx ? value : p) } : s));
  const addPoint = (segId) => setSegments((prev) => prev.map((s) => s.id === segId ? { ...s, points: [...s.points, ''] } : s));
  const removePoint = (segId, idx) => setSegments((prev) => prev.map((s) => s.id === segId ? { ...s, points: s.points.filter((_, i) => i !== idx) } : s));

  const togglePointDone = (segIdx, ptIdx) => {
    const key = `${segIdx}-${ptIdx}`;
    setCompletedPoints((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const activeSeg = segments[activeSegmentIdx] || null;
  const tip = COACHING_TIPS[tipIdx % COACHING_TIPS.length];

  const captureStudioFeatherMaskStyle = smartboardEdgeFeatherMaskStyle(
    resolveSmartboardEdgeFeatherPercent(
      {
        immersive_edge_feather: sbEditMode
          ? sbEdgeFeather
          : (sbCustomSlides[activeSeg?.id] || activeSeg)?.immersive_edge_feather,
      },
      true,
    ),
  );

  // ── SmartBoard helpers ──────────────────────────────────────────────────
  const currentSlide = activeSeg
    ? (() => {
        const base = generateSbLayout(sbCustomSlides[activeSeg.id] || activeSeg, sbTheme);
        // Apply editor overrides on top
        if (sbAccentColor) { base.t = { ...base.t, accent: sbAccentColor, titleColor: sbAccentColor, tagText: sbAccentColor }; }
        if (sbBgCss)       { base.t = { ...base.t, bg: sbBgCss }; }
        if (sbBulletStyle) { base.bulletStyle = sbBulletStyle; }
        base.layout = sbLayout;
        return base;
      })()
    : null;

  const segDisplaySrc = activeSeg ? (sbCustomSlides[activeSeg.id] || activeSeg) : null;
  const showCanvasInfographic = Boolean(
    activeSeg
    && Array.isArray(segDisplaySrc?.sb_canvas_objects)
    && segDisplaySrc.sb_canvas_objects.length > 0,
  );

  const openEdit = () => {
    if (!activeSeg) return;
    const src = sbCustomSlides[activeSeg.id] || activeSeg;
    setEditedTitle(src.title);
    setEditedPoints([...src.points]);
    setEditedProgressiveEnabled(Boolean(src.progressive_enabled || src.progressiveBuildCanvas));
    setEditedProgressiveCoreIdea(src.core_idea || src.progressive_core_idea || '');
    setEditedProgressiveSteps(
      Array.isArray(src.progressive_steps)
        ? [...src.progressive_steps]
        : Array.isArray(src.points)
          ? src.points.filter(Boolean).slice(0, 8)
          : []
    );
    const ef = src.immersive_edge_feather;
    setSbEdgeFeather(ef === undefined || ef === null ? DEFAULT_SMARTBOARD_EDGE_FEATHER : Math.min(100, Math.max(0, Number(ef))));
    const canvasObjs = Array.isArray(src.sb_canvas_objects) ? src.sb_canvas_objects : [];
    setEditedCanvasObjects(canvasObjs.map((o) => ({ ...o })));
    setSbStudioEditorMode(canvasObjs.length > 0 ? 'canvas' : 'classic');
    setSbEditMode(true);
  };

  const saveEdit = () => {
    if (!activeSeg) return;
    setSbCustomSlides((prev) => {
      const prevCustom = prev[activeSeg.id];
      const base = prevCustom ? { ...activeSeg, ...prevCustom } : { ...activeSeg };
      return {
        ...prev,
        [activeSeg.id]: {
          ...base,
          title: editedTitle,
          points: editedPoints,
          progressive_enabled: editedProgressiveEnabled,
          core_idea: editedProgressiveCoreIdea,
          progressive_steps: editedProgressiveEnabled ? editedProgressiveSteps.filter(Boolean) : [],
          immersive_edge_feather: sbEdgeFeather,
          sb_canvas_objects: editedCanvasObjects,
        },
      };
    });
    setSbEditMode(false);
    setSbStudioEditorMode('classic');
  };

  const resetSlide = () => {
    if (!activeSeg) return;
    setSbCustomSlides((prev) => { const n = { ...prev }; delete n[activeSeg.id]; return n; });
  };

  /** Génération IA : reformule les points du slide courant en layout enrichi */
  const generateAiSlide = async () => {
    if (!activeSeg) return;
    setAiGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/.netlify/functions/capture-studio-slide-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          mode: 'slide',
          title: activeSeg.title,
          points: activeSeg.points.filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error('AI unavailable');
      const data = await res.json();
      setSbCustomSlides((prev) => {
        const prevC = prev[activeSeg.id];
        const base = prevC ? { ...activeSeg, ...prevC } : { ...activeSeg };
        return {
          ...prev,
          [activeSeg.id]: {
            ...base,
            title: data.title || base.title,
            points: data.points?.length ? data.points : base.points,
            subtitle: data.subtitle || base.subtitle || '',
            core_idea: data.core_idea || base.core_idea || '',
            progressive_steps: Array.isArray(data.progressive_steps) ? data.progressive_steps : (base.progressive_steps || []),
            visual_type: data.visual_type || base.visual_type || '',
            graphic_style: data.graphic_style || base.graphic_style || '',
          },
        };
      });
    } catch {
      /* silently fail — keep current slide */
    } finally {
      setAiGenerating(false);
    }
  };

  const applyTemplate = (tpl) => {
    if (!tpl?.apply) return;
    const a = tpl.apply;
    if (a.bg)           setSbBgCss(a.bg);
    if (a.accentColor)  setSbAccentColor(a.accentColor);
    if (a.bulletStyle !== undefined) setSbBulletStyle(a.bulletStyle);
    if (a.layout)       setSbLayout(a.layout);
    const ac = tpl.applyContent;
    if (ac && typeof ac === 'object') {
      if (typeof ac.title === 'string') setEditedTitle(ac.title);
      if (Array.isArray(ac.points) && ac.points.length > 0) {
        setEditedPoints(ac.points.map((p) => String(p ?? '')));
      }
    }
  };

  const requestNextChapter = () => {
    const next = activeSegmentIdx + 1;
    if (next >= segments.length) { stopRecording(); return; }
    setPendingNextSeg(next);
    setPedagogyText('');
    setShowTransitionModal(true);
  };

  const confirmNextChapter = async (usePedagogy) => {
    setShowTransitionModal(false);
    if (usePedagogy && pendingNextSeg !== null) {
      setPedagogyGenerating(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const seg = segments[activeSegmentIdx];
        const res = await fetch('/.netlify/functions/capture-studio-slide-ai', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify({
            mode: 'transition',
            title: seg.title,
            points: seg.points.filter(Boolean),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setPedagogyText(data?.text?.trim() || '');
        }
      } catch { /* silently ignore */ }
      finally { setPedagogyGenerating(false); }
    }
    if (pendingNextSeg !== null) {
      setActiveSegmentIdx(pendingNextSeg);
      setActivePointIdx(0);
      setPendingNextSeg(null);
    }
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent className="max-w-[98vw] w-full h-[96vh] bg-gradient-to-b from-[#0b1222] via-[#070d18] to-[#050a14] border-white/15 shadow-[0_35px_120px_rgba(0,0,0,0.65)] p-0 overflow-hidden text-white flex flex-col">
        <DialogTitle className="sr-only">Capture Studio — {formTitle || 'Nouveau cours'}</DialogTitle>

        {/* ── SETUP PHASE ────────────────────────────────────────────── */}
        {phase === 'setup' && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/25 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 flex items-center justify-center text-base">
                  {SOURCE_LABELS[source]?.icon || '🎥'}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Capture Studio — {SOURCE_LABELS[source]?.label || 'Webcam'}</h2>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Prépare ton cours avant de commencer</p>
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={onClose} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 h-full">
                {/* Left: Course info + segments */}
                <div className="p-6 space-y-5 border-r border-white/5">
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-[#D4AF37] font-semibold mb-3">Informations du cours</p>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-gray-400 mb-1 block">Titre de la vidéo</Label>
                        <Input
                          value={formTitle}
                          onChange={(e) => setFormTitle(e.target.value)}
                          className="bg-[#0F1419] border-white/10"
                          placeholder="Ex: Introduction à la thermodynamique"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-400 mb-1 block">Description (optionnel)</Label>
                        <Textarea
                          value={formDescription}
                          onChange={(e) => setFormDescription(e.target.value)}
                          className="bg-[#0F1419] border-white/10 min-h-[64px]"
                          placeholder="Décris brièvement ce que tu vas enseigner..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Segment planner */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[11px] uppercase tracking-widest text-[#D4AF37] font-semibold">Plan du cours</p>
                      <button type="button" onClick={addSegment} className="flex items-center gap-1 text-xs text-[#D4AF37] hover:text-amber-400 transition-colors">
                        <Plus className="w-3.5 h-3.5" /> Ajouter un segment
                      </button>
                    </div>
                    <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                      {segments.map((seg, si) => (
                        <div key={seg.id} className="rounded-xl border border-white/8 bg-[#0F1827] p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] text-[10px] font-bold flex items-center justify-center flex-shrink-0">{si + 1}</span>
                            <Input
                              value={seg.title}
                              onChange={(e) => updateSegment(seg.id, 'title', e.target.value)}
                              className="bg-[#0a111d] border-white/10 text-sm h-8 flex-1"
                              placeholder="Titre du segment"
                            />
                            {segments.length > 1 && (
                              <button type="button" onClick={() => removeSegment(seg.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="space-y-1.5 pl-7">
                            {seg.points.map((pt, pi) => (
                              <div key={pi} className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]/40 flex-shrink-0" />
                                <Input
                                  value={pt}
                                  onChange={(e) => updatePoint(seg.id, pi, e.target.value)}
                                  className="bg-[#0a111d] border-white/8 h-7 text-xs flex-1"
                                  placeholder="Point à aborder..."
                                />
                                {seg.points.length > 1 && (
                                  <button type="button" onClick={() => removePoint(seg.id, pi)} className="text-gray-700 hover:text-red-400 transition-colors">
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                            <button type="button" onClick={() => addPoint(seg.id)} className="text-[10px] text-gray-500 hover:text-[#D4AF37] transition-colors flex items-center gap-1 ml-3.5">
                              <Plus className="w-3 h-3" /> Ajouter un point
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Camera preview + settings */}
                <div className="p-6 space-y-5">
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-[#D4AF37] font-semibold mb-3">Aperçu caméra</p>
                    <div className={`relative bg-black rounded-xl overflow-hidden border border-white/10 ${orientation === 'portrait' ? 'aspect-[9/16] max-h-64' : 'aspect-video'}`}>
                      <video
                        ref={liveVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                        style={{ transform: source === 'screen' ? 'none' : 'scaleX(-1)' }}
                      />
                      {/* Safety frame */}
                      <div className="absolute inset-[5%] border border-dashed border-white/20 rounded-lg pointer-events-none" />
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => setVideoMuted((v) => !v)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${videoMuted ? 'bg-red-500/80' : 'bg-white/10 hover:bg-white/20'}`}
                        >
                          {videoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAudioMuted((v) => !v)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${audioMuted ? 'bg-red-500/80' : 'bg-white/10 hover:bg-white/20'}`}
                        >
                          {audioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Device + orientation settings */}
                  <div className="space-y-3">
                    <p className="text-[11px] uppercase tracking-widest text-[#D4AF37] font-semibold">Paramètres</p>
                    {videoDevices.length > 0 && (
                      <div>
                        <Label className="text-xs text-gray-400 mb-1 block">Caméra</Label>
                        <select
                          value={selectedVideoDevice}
                          onChange={(e) => setSelectedVideoDevice(e.target.value)}
                          className="w-full text-sm bg-[#0F1419] border border-white/10 rounded-md px-3 py-2 text-white"
                        >
                          {videoDevices.map((d) => (
                            <option key={d.deviceId} value={d.deviceId}>{d.label || `Caméra ${d.deviceId.slice(0, 8)}`}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {audioDevices.length > 0 && (
                      <div>
                        <Label className="text-xs text-gray-400 mb-1 block">Microphone</Label>
                        <select
                          value={selectedAudioDevice}
                          onChange={(e) => setSelectedAudioDevice(e.target.value)}
                          className="w-full text-sm bg-[#0F1419] border border-white/10 rounded-md px-3 py-2 text-white"
                        >
                          {audioDevices.map((d) => (
                            <option key={d.deviceId} value={d.deviceId}>{d.label || `Micro ${d.deviceId.slice(0, 8)}`}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <Label className="text-xs text-gray-400 mb-2 block">Orientation</Label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setOrientation('landscape')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs border transition-colors ${orientation === 'landscape' ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]' : 'border-white/10 text-gray-400 hover:border-white/20'}`}
                        >
                          <Monitor className="w-4 h-4" /> Paysage
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrientation('portrait')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs border transition-colors ${orientation === 'portrait' ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]' : 'border-white/10 text-gray-400 hover:border-white/20'}`}
                        >
                          <Smartphone className="w-4 h-4" /> Portrait
                        </button>
                      </div>
                    </div>
                  </div>

                  <Button
                    className="w-full bg-[#D4AF37] text-black hover:bg-amber-400 font-bold h-12 text-base"
                    onClick={startRecording}
                    disabled={!formTitle.trim() || segments.length === 0}
                  >
                    <Camera className="w-5 h-5 mr-2" />
                    Commencer l'enregistrement
                  </Button>
                  {!formTitle.trim() && (
                    <p className="text-xs text-amber-400 text-center">Saisis d'abord le titre du cours.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── RECORDING / PAUSED PHASE ───────────────────────────────── */}
        {(phase === 'recording' || phase === 'paused') && (
          <div className="flex h-full overflow-hidden relative bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.08),transparent_35%)]">

            {/* ══ SmartBoard canvas (left, ~65%) ══════════════════════════ */}
            {showSmartboard && currentSlide && (
              <div className="relative flex-1 flex flex-col overflow-hidden bg-[#05070c]">
                {/* SmartBoard toolbar — hors masque pour rester net */}
                <div className="relative z-20 flex items-center gap-2 px-4 py-2 bg-black/35 backdrop-blur-xl border-b border-white/10 flex-shrink-0">
                  <LayoutPanelLeft className="w-3.5 h-3.5" style={{ color: currentSlide.t.accent }} />
                  <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: currentSlide.t.accent }}>SmartBoard</span>
                  <div className="flex-1" />
                  {/* Theme picker */}
                  <div className="flex gap-1 items-center">
                    {Object.entries(SB_TEMPLATES).map(([key, tpl]) => (
                      <button
                        key={key}
                        type="button"
                        title={tpl.label}
                        onClick={() => setSbTheme(key)}
                        className="w-4 h-4 rounded-full border-2 transition-all"
                        style={{
                          background: tpl.accent,
                          borderColor: sbTheme === key ? '#ffffff' : 'transparent',
                          transform: sbTheme === key ? 'scale(1.25)' : 'scale(1)',
                        }}
                      />
                    ))}
                  </div>
                  <div className="w-px h-4 bg-white/20" />
                  {/* Bg image upload */}
                  <label className="cursor-pointer" title="Image de fond">
                    <ImageIcon className="w-3.5 h-3.5 text-gray-400 hover:text-white" />
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) { const u = URL.createObjectURL(f); setSbBgImage(u); }
                    }} />
                  </label>
                  {sbBgImage && <button type="button" onClick={() => setSbBgImage('')} className="text-[10px] text-red-400 hover:text-red-300">✕ fond</button>}
                  <div className="w-px h-4 bg-white/20" />
                  {/* AI generate */}
                  <button
                    type="button"
                    onClick={generateAiSlide}
                    disabled={aiGenerating}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md transition-colors hover:bg-white/10 border border-white/10"
                    style={{ color: currentSlide.t.accent }}
                    title="Générer la mise en page avec l'IA"
                  >
                    {aiGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    IA
                  </button>
                  {/* Edit */}
                  {sbEditMode && (
                    <>
                      <button
                        type="button"
                        onClick={() => setSbStudioEditorMode('classic')}
                        className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                          sbStudioEditorMode === 'classic'
                            ? 'border-[#D4AF37]/50 bg-[#D4AF37]/15 text-[#D4AF37]'
                            : 'border-white/10 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        Liste
                      </button>
                      <button
                        type="button"
                        onClick={() => setSbStudioEditorMode('canvas')}
                        className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                          sbStudioEditorMode === 'canvas'
                            ? 'border-[#D4AF37]/50 bg-[#D4AF37]/15 text-[#D4AF37]'
                            : 'border-white/10 text-white/60 hover:bg-white/10'
                        }`}
                      >
                        Studio
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={sbEditMode ? saveEdit : openEdit}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md text-white/70 hover:text-white hover:bg-white/10 border border-white/10 transition-colors"
                  >
                    {sbEditMode ? <Check className="w-3 h-3 text-emerald-400" /> : <Settings className="w-3 h-3" />}
                    {sbEditMode ? 'Valider' : 'Éditer'}
                  </button>
                  {!sbEditMode && (
                    <button type="button" onClick={resetSlide} className="text-[10px] text-gray-500 hover:text-red-400 transition-colors px-1 border border-white/10 rounded-md py-1" title="Réinitialiser le slide">↺</button>
                  )}
                </div>

                {/* Zone slide : fond + fondu bords (immersif) */}
                <div
                  className="relative flex-1 flex flex-col min-h-0 overflow-hidden"
                  style={captureStudioFeatherMaskStyle}
                >
                  <div
                    className="absolute inset-0 z-0"
                    style={{ background: sbBgImage ? `url(${sbBgImage}) center/cover` : currentSlide.t.bg }}
                  />
                  <div
                    className={`absolute inset-0 z-[1] pointer-events-none ${
                      showCanvasInfographic && !sbEditMode ? 'bg-transparent' : 'bg-black/15'
                    }`}
                  />

                {/* Pédagogie augmentée banner */}
                {pedagogyText && (
                  <div className="relative z-10 mx-4 mt-3 rounded-xl border px-4 py-3 text-sm leading-relaxed"
                    style={{ borderColor: currentSlide.t.border, background: currentSlide.t.tagBg, color: currentSlide.t.textColor }}>
                    <span className="text-[10px] uppercase tracking-widest font-bold block mb-1" style={{ color: currentSlide.t.accent }}>Synthèse pédagogique</span>
                    {pedagogyText}
                    <button type="button" onClick={() => setPedagogyText('')} className="absolute top-2 right-2 text-gray-500 hover:text-white"><X className="w-3 h-3" /></button>
                  </div>
                )}

                {/* ── SmartBoard slide content ── */}
                {sbEditMode && sbStudioEditorMode === 'canvas' ? (
                  <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
                    <SmartboardCanvasEditor
                      objects={editedCanvasObjects}
                      onObjectsChange={setEditedCanvasObjects}
                    />
                  </div>
                ) : sbEditMode ? (
                  <div className="relative z-10 flex flex-1 flex-col justify-center overflow-hidden px-10 py-8 opacity-80">
                    <div className="mb-4">
                      <span
                        className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
                        style={{
                          background: currentSlide?.t?.tagBg,
                          color: currentSlide?.t?.tagText,
                          borderColor: currentSlide?.t?.border,
                        }}
                      >
                        Mode édition — aperçu liste
                      </span>
                    </div>
                    <h2 className="mb-6 font-serif text-4xl font-bold leading-tight" style={{ color: currentSlide?.t?.titleColor }}>
                      {editedTitle || currentSlide?.title}
                    </h2>
                    <ul className="space-y-3">
                      {editedPoints.filter(Boolean).map((pt, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span
                            className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
                            style={{
                              background: currentSlide?.t?.numBg,
                              color: currentSlide?.t?.accent,
                              border: `1px solid ${currentSlide?.t?.border}`,
                            }}
                          >
                            {sbBulletStyle || String(i + 1).padStart(2, '0')}
                          </span>
                          <span className="text-base leading-relaxed" style={{ color: currentSlide?.t?.textColor }}>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : showCanvasInfographic ? (
                  <div className="relative z-10 mx-3 mb-3 mt-1 min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl ring-1 ring-white/10">
                    <React.Suspense
                      fallback={(
                        <div className="flex h-full min-h-[280px] w-full items-center justify-center bg-[#f7f6f3] text-xs text-gray-500">
                          Chargement du studio…
                        </div>
                      )}
                    >
                      <SlideParallaxStageLazy
                        slide={{
                          id: String(activeSeg.id),
                          layoutType: 'free',
                          canvasStudioPaper: true,
                          elements: canvasObjectsToSlideElements(segDisplaySrc.sb_canvas_objects),
                        }}
                        spotlight={false}
                        progressivePlayback={false}
                        legacyPresentationMode
                        immersiveEdgeDefault={false}
                      />
                    </React.Suspense>
                  </div>
                ) : (
                  <div className="relative z-10 flex flex-1 flex-col justify-center overflow-hidden px-10 py-8">
                    <div className="mb-6">
                      <span
                        className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
                        style={{ background: currentSlide.t.tagBg, color: currentSlide.t.tagText, border: `1px solid ${currentSlide.t.border}` }}
                      >
                        Chapitre {activeSegmentIdx + 1} / {segments.length}
                      </span>
                    </div>
                    <h2
                      className="mb-8 font-serif font-bold leading-tight"
                      style={{ color: currentSlide.t.titleColor, fontSize: 'clamp(1.6rem, 4vw, 3rem)' }}
                    >
                      {currentSlide.title}
                    </h2>
                    <ul className="space-y-4">
                      {currentSlide.points.map((pt, i) => {
                        const done = completedPoints.has(`${activeSegmentIdx}-${i}`);
                        return (
                          <li
                            key={i}
                            className="group flex cursor-pointer items-start gap-4"
                            style={{ opacity: done ? 0.4 : 1 }}
                            onClick={() => togglePointDone(activeSegmentIdx, i)}
                          >
                            <span
                              className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all group-hover:scale-110"
                              style={{
                                background: done ? 'rgba(74,222,128,0.3)' : currentSlide.t.numBg,
                                color: done ? '#4ade80' : currentSlide.t.accent,
                                border: `1px solid ${currentSlide.t.border}`,
                              }}
                            >
                              {done ? '✓' : String(i + 1).padStart(2, '0')}
                            </span>
                            <span
                              className="text-base leading-relaxed"
                              style={{ color: currentSlide.t.textColor, textDecoration: done ? 'line-through' : 'none' }}
                            >
                              {pt}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="absolute bottom-6 right-8 text-[10px] uppercase tracking-[0.3em] opacity-25" style={{ color: currentSlide.t.accent }}>
                      {formTitle}
                    </div>
                  </div>
                )}
                </div>
              </div>
            )}

            {/* ══ Canva-like editor panel (shown when sbEditMode) ══════ */}
            {sbEditMode && showSmartboard && (
              <SmartboardEditorPanel
                title={editedTitle}
                points={editedPoints}
                progressiveEnabled={editedProgressiveEnabled}
                progressiveCoreIdea={editedProgressiveCoreIdea}
                progressiveSteps={editedProgressiveSteps}
                bg={sbBgCss || currentSlide?.t?.bg || ''}
                accentColor={sbAccentColor || currentSlide?.t?.accent || '#D4AF37'}
                bulletStyle={sbBulletStyle}
                layout={sbLayout}
                onTitleChange={setEditedTitle}
                onPointsChange={setEditedPoints}
                onProgressiveEnabledChange={setEditedProgressiveEnabled}
                onProgressiveCoreIdeaChange={setEditedProgressiveCoreIdea}
                onProgressiveStepsChange={setEditedProgressiveSteps}
                onBgChange={(css) => setSbBgCss(css)}
                onAccentColorChange={(c) => setSbAccentColor(c)}
                onBulletStyleChange={(s) => setSbBulletStyle(s)}
                onLayoutChange={(l) => setSbLayout(l)}
                edgeFeatherPercent={sbEdgeFeather}
                onEdgeFeatherChange={setSbEdgeFeather}
                onAddIcon={(icon) => setEditedPoints((prev) => {
                  const last = prev[prev.length - 1] || '';
                  if (!last) return prev.map((p, i) => i === prev.length - 1 ? icon : p);
                  return [...prev, icon + ' '];
                })}
                onAddDecorator={(dec) => {/* add to notes or display */}}
                onApplyTemplate={applyTemplate}
                onSave={saveEdit}
                onClose={() => setSbEditMode(false)}
              />
            )}

            {/* ══ Portrait video + controls (right ~35%) ══════════════════ */}
            <div
              className="relative flex-shrink-0 flex flex-col overflow-hidden"
              style={{ width: showSmartboard ? '360px' : '100%' }}
            >
              <div className="absolute inset-0 bg-[#050505]" />

              {/* REC / PAUSE badge */}
              <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5">
                {phase === 'recording' ? (
                  <span className="flex items-center gap-1 bg-red-600 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider animate-pulse shadow-[0_0_16px_rgba(220,38,38,0.7)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" /> REC
                  </span>
                ) : (
                  <span className="flex items-center gap-1 bg-yellow-600 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" /> PAUSE
                  </span>
                )}
                <span className="text-white text-[10px] font-mono bg-black/70 border border-white/15 rounded-full px-2 py-0.5">{formatTime(recordingTime)}</span>
              </div>

              {/* Chroma key controls */}
              <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-1">
                <button
                  type="button"
                  onClick={() => setChromaKeyEnabled((v) => !v)}
                  className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold transition-colors border border-white/20"
                  style={{ background: chromaKeyEnabled ? 'rgba(0,177,64,0.8)' : 'rgba(0,0,0,0.6)', color: chromaKeyEnabled ? '#fff' : '#6b7280' }}
                  title="Suppression fond vert"
                >
                  <Leaf className="w-3 h-3" /> Fond vert
                </button>
                {chromaKeyEnabled && (
                  <div className="flex items-center gap-1.5 bg-black/70 rounded-full px-2 py-1 border border-white/15">
                    <span className="text-[9px] text-gray-400">Sensibilité</span>
                    <input
                      type="range"
                      min={40}
                      max={220}
                      value={chromaSensitivity}
                      onChange={(e) => setChromaSensitivity(Number(e.target.value))}
                      className="w-16 h-1 accent-green-500"
                    />
                  </div>
                )}
              </div>

              {/* Live video (hidden if chroma — shown via CSS canvas overlay) */}
              <video
                ref={liveVideoRef}
                autoPlay
                muted
                playsInline
                className="relative z-10 w-full h-full object-cover"
                style={{ transform: source === 'screen' ? 'none' : 'scaleX(-1)' }}
              />

              {/* Safety frame */}
              <div className="absolute inset-[6%] z-20 border border-dashed border-white/25 rounded-xl pointer-events-none" />

              {/* SmartBoard toggle + inline plan editor */}
              <div className="absolute bottom-24 left-0 right-0 z-20 flex flex-col items-center gap-2 px-3">
                <button
                  type="button"
                  onClick={() => setShowSmartboard((v) => !v)}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold transition-colors border"
                  style={{
                    background: showSmartboard ? 'rgba(212,175,55,0.2)' : 'rgba(0,0,0,0.6)',
                    borderColor: showSmartboard ? '#D4AF37' : 'rgba(255,255,255,0.15)',
                    color: showSmartboard ? '#D4AF37' : '#9ca3af',
                  }}
                >
                  <LayoutPanelLeft className="w-3 h-3" />
                  {showSmartboard ? 'Masquer SmartBoard' : 'Afficher SmartBoard'}
                </button>
              </div>

              {/* Controls bottom */}
              <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/95 via-black/55 to-transparent p-3 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setVideoMuted((v) => !v)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${videoMuted ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}
                >
                  {videoMuted ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setAudioMuted((v) => !v)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${audioMuted ? 'bg-red-500' : 'bg-white/10 hover:bg-white/20'}`}
                >
                  {audioMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>
                {phase === 'recording' ? (
                  <button type="button" onClick={pauseRecording} className="w-10 h-10 rounded-full bg-yellow-500/80 hover:bg-yellow-500 flex items-center justify-center transition-colors">
                    <Pause className="w-4 h-4 text-black" />
                  </button>
                ) : (
                  <button type="button" onClick={resumeRecording} className="w-10 h-10 rounded-full bg-green-500/80 hover:bg-green-500 flex items-center justify-center transition-colors">
                    <Play className="w-4 h-4 text-black" />
                  </button>
                )}
                <button type="button" onClick={stopRecording} className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors">
                  <Square className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={requestNextChapter}
                  className="w-9 h-9 rounded-full bg-[#D4AF37]/80 hover:bg-[#D4AF37] flex items-center justify-center transition-colors"
                  title="Chapitre suivant"
                >
                  <ArrowRight className="w-4 h-4 text-black" />
                </button>
              </div>
            </div>

            {/* ══ Editing + assistant panel (always visible, scrollable) ══ */}
            <div className="w-[300px] flex-shrink-0 bg-gradient-to-b from-[#101a2f] to-[#0a1120] border-l border-white/10 flex flex-col">
              <div className="flex border-b border-white/10">
                {[
                  { id: 'plan', icon: BookOpen, label: 'Plan' },
                  { id: 'script', icon: MessageSquare, label: 'Script' },
                  { id: 'copilot', icon: Sparkles, label: 'Copilot' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${activeTab === tab.id ? 'text-[#D4AF37] border-b-2 border-[#D4AF37]' : 'text-gray-400 hover:text-white'}`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto">
                {activeTab === 'plan' && (
                  <div className="p-4 space-y-2">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Édite le plan — le SmartBoard se met à jour en direct</p>
                    {segments.map((seg, si) => (
                      <div key={seg.id} className={`rounded-xl border p-3 transition-colors ${si === activeSegmentIdx ? 'border-[#D4AF37]/50 bg-[#D4AF37]/5' : 'border-white/8 bg-white/[0.02]'}`}>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => { setActiveSegmentIdx(si); setActivePointIdx(0); }}
                            className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 ${si === activeSegmentIdx ? 'bg-[#D4AF37] text-black' : 'bg-white/10 text-gray-400'}`}>{si + 1}</button>
                          <Input
                            value={seg.title}
                            onChange={(e) => updateSegment(seg.id, 'title', e.target.value)}
                            className="bg-transparent border-white/10 h-7 text-xs flex-1 text-white"
                          />
                        </div>
                        {si === activeSegmentIdx && (
                          <div className="mt-2 space-y-1.5 pl-7">
                            {seg.points.map((pt, pi) => {
                              const done = completedPoints.has(`${si}-${pi}`);
                              return (
                                <div key={pi} className="flex items-center gap-1.5">
                                  <button type="button" onClick={() => togglePointDone(si, pi)} className="flex-shrink-0">
                                    {done ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Circle className="w-3.5 h-3.5 text-gray-500" />}
                                  </button>
                                  <Input
                                    value={pt}
                                    onChange={(e) => updatePoint(seg.id, pi, e.target.value)}
                                    className={`bg-transparent border-white/8 h-6 text-[11px] flex-1 ${done ? 'text-gray-500 line-through' : 'text-gray-200'}`}
                                  />
                                  {seg.points.length > 1 && (
                                    <button type="button" onClick={() => removePoint(seg.id, pi)} className="text-gray-700 hover:text-red-400"><X className="w-3 h-3" /></button>
                                  )}
                                </div>
                              );
                            })}
                            <button type="button" onClick={() => addPoint(seg.id)} className="text-[10px] text-gray-500 hover:text-[#D4AF37] flex items-center gap-1 ml-5">
                              <Plus className="w-3 h-3" /> Point
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={addSegment} className="flex items-center gap-1 text-xs text-[#D4AF37] hover:text-amber-400 pt-1">
                      <Plus className="w-3.5 h-3.5" /> Segment
                    </button>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" className="flex-1 border-white/10 text-gray-300 text-xs" onClick={() => setActiveSegmentIdx((i) => Math.max(0, i - 1))} disabled={activeSegmentIdx === 0}>
                        <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Préc.
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 border-white/10 text-gray-300 text-xs" onClick={() => requestNextChapter()} disabled={activeSegmentIdx === segments.length - 1}>
                        Suiv. <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
                {activeTab === 'script' && (
                  <div className="p-4 space-y-4">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500">Téléprompteur</p>
                    {activeSeg && (
                      <>
                        <div className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/5 p-3">
                          <p className="text-[10px] text-[#D4AF37] uppercase tracking-wider mb-1">Segment actif</p>
                          <h3 className="text-sm font-bold text-white">{activeSeg.title}</h3>
                        </div>
                        <div className="space-y-2">
                          {activeSeg.points.filter(Boolean).map((pt, pi) => {
                            const done = completedPoints.has(`${activeSegmentIdx}-${pi}`);
                            return (
                              <div key={pi} className={`rounded-lg p-2.5 border text-xs transition-all cursor-pointer ${pi === activePointIdx ? 'border-[#D4AF37]/40 bg-[#D4AF37]/8 text-white font-medium' : done ? 'border-white/5 bg-white/2 text-gray-500 line-through' : 'border-white/8 bg-white/3 text-gray-300'}`} onClick={() => setActivePointIdx(pi)}>
                                <span className="mr-2 text-[#D4AF37]">→</span>{pt}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
                {activeTab === 'copilot' && (
                  <div className="p-4 space-y-3">
                    <div className="rounded-2xl border border-[#D4AF37]/30 bg-gradient-to-br from-[#D4AF37]/10 to-[#D4AF37]/3 p-4">
                      <div className="text-2xl mb-2">{tip.icon}</div>
                      <p className="text-sm font-medium text-white leading-relaxed">{tip.text}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 border-white/10 text-xs" onClick={() => setTipIdx((i) => (i - 1 + COACHING_TIPS.length) % COACHING_TIPS.length)}><ChevronLeft className="w-3.5 h-3.5 mr-1" />Préc.</Button>
                      <Button size="sm" variant="outline" className="flex-1 border-white/10 text-xs" onClick={() => setTipIdx((i) => (i + 1) % COACHING_TIPS.length)}>Suiv.<ChevronRight className="w-3.5 h-3.5 ml-1" /></Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ══ Pédagogie augmentée transition modal ════════════════════ */}
            {showTransitionModal && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
                <div className="bg-gradient-to-b from-[#15243a] to-[#0d1828] border border-white/20 shadow-[0_25px_80px_rgba(0,0,0,0.55)] rounded-2xl p-6 max-w-sm w-full mx-4 space-y-5">
                  <div className="flex items-center gap-3">
                    <Brain className="w-7 h-7 text-[#D4AF37]" />
                    <div>
                      <p className="text-white font-bold">Chapitre terminé</p>
                      <p className="text-xs text-gray-400">Chapitre {activeSegmentIdx + 1} → {activeSegmentIdx + 2}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Activer la <strong className="text-[#D4AF37]">Pédagogie Augmentée</strong> ? L'IA va formuler une synthèse de transition à afficher sur le SmartBoard avant de passer au chapitre suivant.
                  </p>
                  {pedagogyGenerating && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" /> Génération de la synthèse…
                    </div>
                  )}
                  <div className="flex gap-3">
                    <Button
                      className="flex-1 bg-[#D4AF37] text-black hover:bg-amber-400 font-bold text-xs shadow-[0_10px_30px_rgba(212,175,55,0.35)]"
                      onClick={() => confirmNextChapter(true)}
                      disabled={pedagogyGenerating}
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Pédagogie IA
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-white/20 text-gray-200 text-xs hover:bg-white/5"
                      onClick={() => confirmNextChapter(false)}
                    >
                      Passer directement
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-gray-500"
                      onClick={() => setShowTransitionModal(false)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PREVIEW PHASE ───────────────────────────────────────────── */}
        {(phase === 'preview' || phase === 'done') && (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/25 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold">Enregistrement terminé</h2>
                  <p className="text-[10px] text-gray-400">Durée : {formatTime(recordingTime)}</p>
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={onClose} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">
              {/* Video preview */}
              <div className="flex-1 bg-gradient-to-b from-black to-[#04070c] flex items-center justify-center p-6">
                <div className="w-full max-w-3xl">
                  <video
                    ref={previewVideoRef}
                    src={previewObjectUrl}
                    controls
                    className="w-full rounded-xl border border-white/10"
                    style={{ maxHeight: 'calc(96vh - 200px)' }}
                  />
                </div>
              </div>
              {/* Actions */}
              <div className="w-full lg:w-72 flex-shrink-0 bg-gradient-to-b from-[#111d34] to-[#0a1120] border-t lg:border-t-0 lg:border-l border-white/10 p-6 space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-semibold mb-3">Récapitulatif</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Durée</span>
                      <span className="font-mono text-white">{formatTime(recordingTime)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Segments planifiés</span>
                      <span className="text-white">{segments.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Points cochés</span>
                      <span className="text-white">{completedPoints.size}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Taille estimée</span>
                      <span className="text-white">{recordedBlob ? `${(recordedBlob.size / 1024 / 1024).toFixed(1)} Mo` : '—'}</span>
                    </div>
                  </div>
                </div>

                {uploadError && (
                  <div className="border border-red-500/30 bg-red-500/10 rounded-lg p-3 flex items-start gap-2 text-xs text-red-200">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {uploadError}
                  </div>
                )}

                {phase === 'done' ? (
                  <PipelinePanel
                    segments={segments}
                    formTitle={formTitle}
                    recordingTime={recordingTime}
                    onClose={onClose}
                  />
                ) : (
                  <div className="space-y-3">
                    <Button
                      className="w-full bg-[#D4AF37] text-black hover:bg-amber-400 font-bold"
                      onClick={uploadVideo}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Enregistrer & Continuer
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-white/10 text-gray-300 hover:text-white"
                      onClick={resetRecording}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Recommencer
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── UPLOADING PHASE ─────────────────────────────────────────── */}
        {phase === 'uploading' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.12),transparent_45%)]">
            <div className="w-16 h-16 rounded-full bg-[#D4AF37]/20 flex items-center justify-center shadow-[0_0_35px_rgba(212,175,55,0.25)]">
              <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold">Téléversement en cours…</h3>
              <p className="text-sm text-gray-400">Ton cours est en train d'être sauvegardé</p>
            </div>
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Progression</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#D4AF37] transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
