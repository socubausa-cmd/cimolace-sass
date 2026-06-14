import React, { useState, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  HelpCircle, BarChart3, FileText, Network, Zap, GraduationCap, Sparkles,
  Volume2, Plus, Trash2, Music, Upload, Loader2, Play,
  Disc3, ChevronUp, ChevronDown, LayoutList, Check, Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { runStorageWithAuthRetry } from '@/lib/supabaseResilience';
import { demoLiriAudioScenes } from '@/lib/liriAudioScene';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const INTERACTIONS_SUBSTEP_META = [
  {
    key: 'ia',
    label: 'IA & outils',
    description: 'Quiz, sondages, Neuron-Q, NeuroRecall, résumés…',
    icon: Sparkles,
  },
  {
    key: 'ambiance',
    label: 'Ambiance sonore',
    description: 'Musique de fond, playlist, volumes.',
    icon: Volume2,
  },
  {
    key: 'liri',
    label: 'Scènes LIRI',
    description: 'Pistes audio liées aux slides SmartBoard.',
    icon: Disc3,
  },
];

function Step7SubstepIndicator({ activeIndex, trackCount, liriCount }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#121A25]/90 p-3 sm:p-4">
      <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-gray-500">
        Étape 7 · Interactions & IA · {activeIndex + 1} / {INTERACTIONS_SUBSTEP_META.length}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {INTERACTIONS_SUBSTEP_META.map((meta, i) => {
          const Icon = meta.icon;
          const done = i < activeIndex;
          const current = i === activeIndex;
          const locked = i > activeIndex;
          const badge =
            meta.key === 'ambiance' && trackCount > 0
              ? trackCount
              : meta.key === 'liri' && liriCount > 0
                ? liriCount
                : null;
          return (
            <div
              key={meta.key}
              className={cn(
                'flex gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
                current && 'border-[#7B61FF]/50 bg-[#7B61FF]/10 shadow-[0_0_0_1px_rgba(123,97,255,0.12)]',
                done && !current && 'border-emerald-500/25 bg-emerald-500/5',
                locked && 'border-white/8 bg-black/25 opacity-60',
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                  current && 'bg-[#7B61FF]/25 text-[#7B61FF]',
                  done && !current && 'bg-emerald-500/20 text-emerald-400',
                  locked && 'bg-white/5 text-gray-500',
                )}
              >
                {done ? <Check className="h-4 w-4" /> : locked ? <Lock className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span className="text-xs font-semibold leading-tight text-white">{meta.label}</span>
                  {badge != null ? (
                    <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-gray-200">
                      {badge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[10px] leading-snug text-gray-500">{meta.description}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-gray-500">
        Utilisez <span className="text-gray-400">Précédent</span> et <span className="text-gray-400">Suivant</span> en bas
        pour parcourir ces trois écrans dans l'ordre avant la <span className="text-gray-400">validation finale</span>{' '}
        (étape 8).
      </p>
    </div>
  );
}

/** Identifiant stable pour lier une piste LIRI à une entrée du programme SmartBoard (brouillon). */
function smartboardLinkId(scene, index) {
  if (scene && scene.id != null && String(scene.id).trim() !== '') return String(scene.id).trim();
  return `sb_order_${index}`;
}

const AI_OPTIONS = [
  { key: 'quiz_enabled', label: 'Quiz live', desc: 'Questions à choix multiples en direct', icon: HelpCircle },
  { key: 'polls_enabled', label: 'Sondages', desc: 'Sondages rapides pendant la session', icon: BarChart3 },
  { key: 'ai_summary_enabled', label: 'Résumé IA', desc: 'Génération automatique d\'un résumé post-session', icon: FileText },
  { key: 'ai_mindmap_enabled', label: 'Mindmap IA', desc: 'Carte mentale automatique des points clés', icon: Network },
  { key: 'neuronq_enabled', label: 'Neuron-Q', desc: 'Q&A intelligent : les élèves posent des questions, l\'IA les reformule et les projette sur le SmartBoard', icon: Zap },
  { key: 'neuro_recall_enabled', label: 'NeuroRecall', desc: 'Post-live : à l\'arrêt du live, amorce automatique replay / transcription / fiche NeuroRecall (désactivé = aucun appel bootstrap)', icon: GraduationCap },
];

const PRESET_AMBIANCES = [
  { label: 'Concentration profonde', url: '/audio/ambiance-concentration.mp3', volume: 0.3 },
  { label: 'Nature & forêt', url: '/audio/ambiance-nature.mp3', volume: 0.25 },
  { label: 'Lo-fi study', url: '/audio/ambiance-lofi.mp3', volume: 0.3 },
  { label: 'Océan calme', url: '/audio/ambiance-ocean.mp3', volume: 0.2 },
  { label: 'Rituel sacré', url: '/audio/ambiance-rituel.mp3', volume: 0.35 },
  { label: 'Pluie douce', url: '/audio/ambiance-rain.mp3', volume: 0.25 },
];

export function Step7Interactions({ draft, updateDraft, interactionsSubStepIndex = 0 }) {
  const [uploading, setUploading] = useState(false);
  const [newTrackLabel, setNewTrackLabel] = useState('');
  const [ambientPreview, setAmbientPreview] = useState(null);
  const fileInputRef = useRef(null);
  const [liriUploading, setLiriUploading] = useState(false);
  const liriFileInputRef = useRef(null);
  const liriTargetIdxRef = useRef(null);
  const [liriSlidePickOpen, setLiriSlidePickOpen] = useState(false);

  const tracks = draft.ambient_tracks || [];
  const liriScenes = draft.liri_audio_scenes || [];

  const smartboardScenes = useMemo(
    () => (Array.isArray(draft.smartboard_element_scenes) ? draft.smartboard_element_scenes : []),
    [draft.smartboard_element_scenes],
  );

  /** Au moins 2 slides / scènes SmartBoard pour mixer ou enchaîner des pistes LIRI par scène. */
  const canUseLiriSceneTracks = smartboardScenes.length >= 2;

  const usedSmartboardLinkIds = useMemo(() => {
    const set = new Set();
    (liriScenes || []).forEach((row) => {
      if (row?.smartboardSceneId) set.add(String(row.smartboardSceneId));
    });
    return set;
  }, [liriScenes]);

  const smartboardPickOptions = useMemo(
    () =>
      smartboardScenes.map((scene, idx) => ({
        scene,
        index: idx,
        linkId: smartboardLinkId(scene, idx),
        label: scene?.name?.trim() || `Slide ${idx + 1}`,
      })),
    [smartboardScenes],
  );

  const availableSmartboardPicks = useMemo(
    () => smartboardPickOptions.filter((o) => !usedSmartboardLinkIds.has(o.linkId)),
    [smartboardPickOptions, usedSmartboardLinkIds],
  );

  const addLiriSceneForSmartboardPick = useCallback(
    (pick) => {
      const { linkId, label, index } = pick;
      updateDraft({
        liri_audio_enabled: true,
        liri_audio_scenes: [
          ...liriScenes,
          {
            id: `liri_${linkId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48)}_${Date.now()}`,
            smartboardSceneId: linkId,
            name: label || `Slide ${index + 1}`,
            audioUrl: '',
            volume: 0.35,
            loop: true,
          },
        ],
      });
      setLiriSlidePickOpen(false);
    },
    [liriScenes, updateDraft],
  );

  /** Une ligne LIRI par slide SmartBoard, en conservant URL / volume si déjà présents (même slide ou même index legacy). */
  const syncLiriRowsToSmartboard = useCallback(() => {
    if (!canUseLiriSceneTracks) return;
    const next = smartboardScenes.map((sc, idx) => {
      const linkId = smartboardLinkId(sc, idx);
      const byLink = liriScenes.find((r) => r.smartboardSceneId === linkId);
      const legacyAt = liriScenes[idx];
      const prev =
        byLink || (legacyAt && !legacyAt.smartboardSceneId ? legacyAt : null);
      return {
        id: prev?.id || `liri_${linkId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 56)}`,
        smartboardSceneId: linkId,
        name: sc?.name?.trim() || prev?.name || `Slide ${idx + 1}`,
        audioUrl: prev?.audioUrl || '',
        volume: typeof prev?.volume === 'number' ? prev.volume : 0.35,
        loop: prev?.loop !== false,
        smartboardPayload: prev?.smartboardPayload,
        fadeInMs: prev?.fadeInMs,
        fadeOutMs: prev?.fadeOutMs,
        ducking: prev?.ducking,
      };
    });
    updateDraft({ liri_audio_enabled: true, liri_audio_scenes: next });
  }, [canUseLiriSceneTracks, smartboardScenes, liriScenes, updateDraft]);

  const removeLiriScene = (idx) => {
    const next = liriScenes.filter((_, j) => j !== idx);
    updateDraft({
      liri_audio_scenes: next,
      liri_audio_enabled: next.length > 0 ? draft.liri_audio_enabled : false,
    });
  };

  const patchLiriScene = (idx, patch) => {
    updateDraft({
      liri_audio_scenes: liriScenes.map((s, j) => (j === idx ? { ...s, ...patch } : s)),
    });
  };

  const moveLiriScene = (idx, delta) => {
    const j = idx + delta;
    if (j < 0 || j >= liriScenes.length) return;
    const next = [...liriScenes];
    [next[idx], next[j]] = [next[j], next[idx]];
    updateDraft({ liri_audio_scenes: next });
  };

  const loadDemoLiriScenes = () => {
    if (!canUseLiriSceneTracks) return;
    const n = Math.min(demoLiriAudioScenes.length, smartboardScenes.length);
    const next = [];
    for (let idx = 0; idx < n; idx += 1) {
      const sc = smartboardScenes[idx];
      const linkId = smartboardLinkId(sc, idx);
      const demo = demoLiriAudioScenes[idx];
      next.push({
        ...demo,
        id: `demo_${linkId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}_${idx}`,
        smartboardSceneId: linkId,
        name: sc?.name?.trim() || demo.name,
      });
    }
    updateDraft({ liri_audio_enabled: true, liri_audio_scenes: next });
  };

  const handleLiriFileUpload = async (e) => {
    const file = e.target.files?.[0];
    const idx = liriTargetIdxRef.current;
    liriTargetIdxRef.current = null;
    if (!file || idx == null || idx < 0) return;
    setLiriUploading(true);
    try {
      const safeName = file.name.replace(/[^\w.-]+/g, '_');
      const path = `liri-scenes/${crypto.randomUUID?.() ?? Date.now()}-${safeName}`;
      const { error } = await runStorageWithAuthRetry(supabase, () =>
        supabase.storage.from('videos').upload(path, file, { contentType: file.type, upsert: true })
      );
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('videos').getPublicUrl(path);
      patchLiriScene(idx, { audioUrl: urlData.publicUrl });
    } catch (err) {
      console.error('[liri-scenes] upload failed', err);
    } finally {
      setLiriUploading(false);
      if (liriFileInputRef.current) liriFileInputRef.current.value = '';
    }
  };

  const addPreset = (preset) => {
    if (tracks.some((t) => t.url === preset.url)) return;
    updateDraft({ ambient_tracks: [...tracks, { ...preset }], ambient_audio_enabled: true });
  };

  const removeTrack = (idx) => {
    const next = tracks.filter((_, i) => i !== idx);
    updateDraft({ ambient_tracks: next, ambient_audio_enabled: next.length > 0 ? draft.ambient_audio_enabled : false });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^\w.-]+/g, '_');
      const path = `ambient/${crypto.randomUUID?.() ?? Date.now()}-${safeName}`;
      const { error } = await runStorageWithAuthRetry(supabase, () =>
        supabase.storage.from('videos').upload(path, file, { contentType: file.type, upsert: true })
      );
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('videos').getPublicUrl(path);
      const label = newTrackLabel.trim() || file.name.replace(/\.[^.]+$/, '');
      updateDraft({
        ambient_tracks: [...tracks, { label, url: urlData.publicUrl, volume: 0.3 }],
        ambient_audio_enabled: true,
      });
      setNewTrackLabel('');
    } catch (err) {
      console.error('[ambient] upload failed', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-1">Interactions et IA</h2>
        <p className="text-gray-400">Activez les outils pédagogiques, l&apos;IA et l&apos;ambiance sonore.</p>
        <p className="mt-2 max-w-2xl text-xs text-gray-500">
          Trois écrans successifs (comme l'étape 6) : d\'abord les <strong className="text-gray-400">outils & IA</strong>, puis
          l'<strong className="text-gray-400">ambiance</strong>, enfin les <strong className="text-gray-400">scènes LIRI</strong>{' '}
          liées au SmartBoard — avant la validation.
        </p>
      </div>

      <Step7SubstepIndicator
        activeIndex={interactionsSubStepIndex}
        trackCount={tracks.length}
        liriCount={liriScenes.length}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={interactionsSubStepIndex}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="mt-4 min-h-0 focus-visible:outline-none"
        >
          {interactionsSubStepIndex === 0 ? (
            <div className="space-y-4">
      {/* AI & Interaction tools */}
      <div>
        <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">Outils pédagogiques & IA</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {AI_OPTIONS.map(({ key, label, desc, icon: Icon }) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'p-4 rounded-xl border transition-all',
                draft[key]
                  ? 'bg-[#7B61FF]/10 border-[#7B61FF]/30'
                  : 'bg-[#0F1419]/50 border-white/10 hover:border-white/20'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-[#7B61FF]/80 flex-shrink-0" />
                  <div>
                    <Label className="text-white font-medium">{label}</Label>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                </div>
                <Switch
                  checked={draft[key] ?? false}
                  onCheckedChange={(v) => updateDraft({ [key]: v })}
                  className="data-[state=checked]:bg-[#7B61FF]"
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
            </div>
          ) : null}

          {interactionsSubStepIndex === 1 ? (
            <div className="space-y-4">
      {/* Ambient Audio */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500">Ambiance sonore</p>
            <p className="text-[11px] text-gray-600 mt-0.5">Musique de fond jouée à faible volume pendant la session</p>
          </div>
          <Switch
            checked={draft.ambient_audio_enabled ?? false}
            onCheckedChange={(v) => updateDraft({ ambient_audio_enabled: v })}
            className="data-[state=checked]:bg-[#7B61FF]"
          />
        </div>

        <AnimatePresence>
          {draft.ambient_audio_enabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 overflow-hidden"
            >
              {/* Preset ambiances */}
              <div>
                <p className="text-[11px] text-gray-500 mb-2">Ambiances prédéfinies</p>
                <div className="flex flex-wrap gap-2">
                  {PRESET_AMBIANCES.map((p) => {
                    const added = tracks.some((t) => t.url === p.url);
                    return (
                      <div
                        key={p.url}
                        className={cn(
                          'inline-flex items-stretch rounded-lg text-xs border overflow-hidden',
                          added
                            ? 'border-[#7B61FF]/40 bg-[#7B61FF]/10'
                            : 'border-white/10 bg-[#0F1419]/50'
                        )}
                      >
                        <button
                          type="button"
                          title="Préécouter"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAmbientPreview({ url: p.url, label: p.label });
                          }}
                          className="px-2 py-1.5 text-[#7B61FF] hover:bg-white/10 border-r border-white/10"
                        >
                          <Play className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => addPreset(p)}
                          disabled={added}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 transition-colors',
                            added
                              ? 'text-[#7B61FF] cursor-default'
                              : 'text-gray-300 hover:bg-white/5'
                          )}
                        >
                          <Music className="w-3 h-3 flex-shrink-0" />
                          {p.label}
                          {added && <span className="text-[9px]">✓</span>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Upload custom */}
              <div className="rounded-xl border border-white/10 bg-[#0F1419]/40 p-4 space-y-3">
                <p className="text-[11px] text-gray-500">Ajouter un fichier audio personnalisé</p>
                <div className="flex gap-2">
                  <Input
                    value={newTrackLabel}
                    onChange={(e) => setNewTrackLabel(e.target.value)}
                    placeholder="Nom de la piste (optionnel)"
                    className="bg-black/30 border-white/10 text-sm h-9 flex-1"
                  />
                  <Button
                    variant="outline"
                    className="border-white/10 text-gray-300 h-9"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                    {uploading ? 'Upload…' : 'Fichier'}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
              </div>

              {/* Current playlist */}
              {tracks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] text-gray-500">Playlist de session ({tracks.length} piste{tracks.length > 1 ? 's' : ''})</p>
                  {tracks.map((track, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border border-white/8 bg-black/20 px-3 py-2">
                      <button
                        type="button"
                        title="Préécouter"
                        onClick={() => setAmbientPreview({ url: track.url, label: track.label || `Piste ${i + 1}` })}
                        className="text-[#7B61FF]/80 hover:text-[#7B61FF] p-1 rounded-md hover:bg-white/5 flex-shrink-0"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                      <Volume2 className="w-3.5 h-3.5 text-[#7B61FF]/60 flex-shrink-0" />
                      <span className="text-sm text-white flex-1 truncate">{track.label || `Piste ${i + 1}`}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-500">Vol.</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round((track.volume || 0.3) * 100)}
                          onChange={(e) => {
                            const next = [...tracks];
                            next[i] = { ...next[i], volume: Number(e.target.value) / 100 };
                            updateDraft({ ambient_tracks: next });
                          }}
                          className="w-16 h-1 accent-[#7B61FF]"
                        />
                      </div>
                      <button type="button" onClick={() => removeTrack(i)} className="text-gray-600 hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
            </div>
          ) : null}

          {interactionsSubStepIndex === 2 ? (
            <div className="space-y-4">
      {/* Scènes audio LIRI (Arena — Web Audio, crossfade, SmartBoard) */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn('space-y-4', !canUseLiriSceneTracks && 'opacity-60')}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Disc3 className="w-5 h-5 text-[#7B61FF]/80 shrink-0" />
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">Scènes audio LIRI</p>
              <p className="text-[11px] text-gray-600 mt-0.5">
                Une piste par slide du programme SmartBoard (étape 6 — IA ou manuel). En Arène : panneau hôte, overlay optionnel.
                Il faut <strong className="text-gray-500">au moins 2 slides</strong> pour enchaîner ou mixer des scènes audio.
              </p>
            </div>
          </div>
          <Switch
            checked={canUseLiriSceneTracks && draft.liri_audio_enabled === true}
            disabled={!canUseLiriSceneTracks}
            onCheckedChange={(v) => {
              if (!canUseLiriSceneTracks) return;
              updateDraft({ liri_audio_enabled: v });
            }}
            className="data-[state=checked]:bg-[#7B61FF] shrink-0"
          />
        </div>

        {!canUseLiriSceneTracks ? (
          <p className="text-xs text-violet-200/80 rounded-xl border border-violet-500/25 bg-violet-500/[0.07] px-3 py-2.5 leading-relaxed">
            <strong className="text-violet-100/90">Indisponible pour l'instant.</strong>{' '}
            {smartboardScenes.length === 0
              ? 'Aucune scène SmartBoard dans le brouillon : configurez d\'abord le programme à l\'étape « Salle virtuelle ».'
              : `Une seule scène SmartBoard (${smartboardScenes.length}) : ajoutez au moins une slide de plus pour lier des ambiances par scène.`}{' '}
            L'<strong className="text-gray-300">ambiance sonore</strong> (écran précédent « Ambiance ») reste utilisable sans limite de slides.
          </p>
        ) : null}

        <AnimatePresence>
          {canUseLiriSceneTracks && draft.liri_audio_enabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 overflow-hidden"
            >
              <div className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 space-y-1">
                <p className="text-[11px] text-gray-400 flex items-center gap-2">
                  <LayoutList className="w-3.5 h-3.5 text-[#7B61FF]/70 shrink-0" />
                  <span>
                    Déroulé SmartBoard détecté :{' '}
                    <strong className="text-[#7B61FF]/90">{smartboardScenes.length}</strong> scène
                    {smartboardScenes.length > 1 ? 's' : ''} (Architect IA, plan mindmap IA ou manuel).
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-[#7B61FF]/35 text-[#7B61FF] hover:bg-[#7B61FF]/10"
                  disabled={availableSmartboardPicks.length === 0}
                  title={
                    availableSmartboardPicks.length === 0
                      ? 'Toutes les slides ont déjà une piste ou aucune slide libre'
                      : 'Choisir une slide SmartBoard pour cette piste'
                  }
                  onClick={() => setLiriSlidePickOpen(true)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter une scène (slide…)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-[#7B61FF]/30 text-[#c4b5fd]/90 hover:bg-[#7B61FF]/10"
                  onClick={syncLiriRowsToSmartboard}
                  title="Crée une ligne par slide SmartBoard ; conserve les fichiers déjà renseignés quand c'est possible"
                >
                  <LayoutList className="w-3.5 h-3.5 mr-1" />
                  Aligner sur tout le SmartBoard
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-white/15 text-gray-400 hover:bg-white/5"
                  onClick={loadDemoLiriScenes}
                  disabled={smartboardScenes.length < 1}
                >
                  Charger l&apos;exemple (jusqu'à 3 pistes liées)
                </Button>
              </div>

              <input
                ref={liriFileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleLiriFileUpload}
              />

              {liriScenes.length > 0 ? (
                <div className="space-y-3">
                  {liriScenes.map((scene, i) => {
                    const sbPick = scene.smartboardSceneId
                      ? smartboardPickOptions.find((o) => o.linkId === scene.smartboardSceneId)
                      : null;
                    return (
                    <div
                      key={scene.id || i}
                      className="rounded-xl border border-white/10 bg-[#0F1419]/50 p-4 space-y-3"
                    >
                      <div className="space-y-1">
                        {sbPick ? (
                          <p className="text-[10px] font-medium text-[#7B61FF]/85">
                            Slide SmartBoard {sbPick.index + 1}/{smartboardScenes.length} — {sbPick.label}
                          </p>
                        ) : (
                          <p className="text-[10px] text-violet-200/75">
                            Piste sans lien explicite — utilisez « Aligner sur tout le SmartBoard » pour la rattacher au déroulé.
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/35 w-6">{i + 1}</span>
                        <Input
                          value={scene.name || ''}
                          onChange={(e) => patchLiriScene(i, { name: e.target.value })}
                          placeholder="Nom affiché"
                          className="bg-black/30 border-white/10 text-sm h-9 flex-1"
                        />
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            title="Monter"
                            onClick={() => moveLiriScene(i, -1)}
                            disabled={i === 0}
                            className="p-1.5 rounded-lg text-white/40 hover:bg-white/10 hover:text-white disabled:opacity-20"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title="Descendre"
                            onClick={() => moveLiriScene(i, 1)}
                            disabled={i === liriScenes.length - 1}
                            className="p-1.5 rounded-lg text-white/40 hover:bg-white/10 hover:text-white disabled:opacity-20"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title="Préécouter"
                            disabled={!scene.audioUrl}
                            onClick={() => scene.audioUrl && setAmbientPreview({ url: scene.audioUrl, label: scene.name || `Scène ${i + 1}` })}
                            className="p-1.5 rounded-lg text-[#7B61FF]/80 hover:bg-[#7B61FF]/15 disabled:opacity-25"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            title="Supprimer"
                            onClick={() => removeLiriScene(i)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          value={scene.audioUrl || ''}
                          onChange={(e) => patchLiriScene(i, { audioUrl: e.target.value })}
                          placeholder="URL MP3 / audio (https://…)"
                          className="bg-black/30 border-white/10 text-sm h-9 flex-1 font-mono text-[11px]"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-white/10 h-9 shrink-0"
                          disabled={liriUploading}
                          onClick={() => {
                            liriTargetIdxRef.current = i;
                            liriFileInputRef.current?.click();
                          }}
                        >
                          {liriUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
                          Fichier
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 text-[11px] text-gray-400">
                          <span>Volume</span>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round((typeof scene.volume === 'number' ? scene.volume : 0.35) * 100)}
                            onChange={(e) => patchLiriScene(i, { volume: Number(e.target.value) / 100 })}
                            className="w-24 h-1 accent-[#7B61FF]"
                          />
                        </label>
                        <label className="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={scene.loop !== false}
                            onChange={(e) => patchLiriScene(i, { loop: e.target.checked })}
                            className="rounded border-white/20"
                          />
                          Boucle
                        </label>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-500 uppercase tracking-wide">Texte SmartBoard (optionnel)</label>
                        <textarea
                          value={scene.smartboardPayload?.content ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            patchLiriScene(i, {
                              smartboardPayload: v.trim()
                                ? { type: 'text', content: v }
                                : undefined,
                            });
                          }}
                          rows={2}
                          placeholder="Affiché dans l'overlay synchro scène…"
                          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/90 outline-none focus:border-[#7B61FF]/40 resize-none"
                        />
                      </div>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-500 border border-dashed border-white/10 rounded-xl p-4 text-center">
                  Aucune piste — choisissez une slide avec « Ajouter une scène », ou « Aligner sur tout le SmartBoard » pour créer une ligne par slide.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>

      <Dialog open={liriSlidePickOpen} onOpenChange={setLiriSlidePickOpen}>
        <DialogContent
          overlayClassName="z-[2200]"
          className="!z-[2200] bg-[#0F1419] border-[#7B61FF]/25 sm:max-w-md text-white"
        >
          <DialogHeader>
            <DialogTitle className="text-white">Choisir une slide SmartBoard</DialogTitle>
            <DialogDescription className="text-gray-400 text-xs">
              Chaque piste LIRI est rattachée à une scène du déroulé défini à l'étape « Salle virtuelle » (génération IA ou manuel).
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(60vh,420px)] overflow-y-auto space-y-2 py-2">
            {availableSmartboardPicks.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">Toutes les slides ont déjà une piste audio.</p>
            ) : (
              availableSmartboardPicks.map((o) => (
                <button
                  key={o.linkId}
                  type="button"
                  onClick={() => addLiriSceneForSmartboardPick(o)}
                  className="w-full text-left rounded-xl border border-white/10 bg-black/30 px-3 py-3 hover:border-[#7B61FF]/40 hover:bg-[#7B61FF]/10 transition-colors"
                >
                  <span className="text-[#7B61FF] font-semibold tabular-nums">{o.index + 1}.</span>{' '}
                  <span className="text-sm text-white">{o.label}</span>
                  <span className="block text-[10px] text-gray-500 mt-1">Position {o.index + 1} dans le déroulé SmartBoard</span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!ambientPreview} onOpenChange={(open) => { if (!open) setAmbientPreview(null); }}>
        <DialogContent
          overlayClassName="z-[2200]"
          className="!z-[2200] bg-[#0F1419] border-white/10 sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle className="text-white truncate">{ambientPreview?.label || 'Préécoute'}</DialogTitle>
            <DialogDescription className="text-gray-500 text-xs">
              Aperçu de l'ambiance. En session live, le volume suit le curseur de chaque piste.
            </DialogDescription>
          </DialogHeader>
          {ambientPreview?.url ? (
            <audio key={ambientPreview.url} src={ambientPreview.url} controls className="w-full mt-2 accent-[#7B61FF]" autoPlay />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
