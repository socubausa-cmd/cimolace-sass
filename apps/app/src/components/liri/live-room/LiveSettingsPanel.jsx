import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, Video, Mic, Camera, Upload, Sliders, Sparkles,
  Volume2, Play, Pause, Layers,
  Maximize2, Image as ImageIcon, Monitor, RefreshCw, Headphones, Smartphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { designerShellMicroLabel } from '@/lib/liriDesignerShellClasses';
import { StudioDevicePicker } from '@/components/liri/live-room/StudioDevicePicker';
import { getAllSmartboardNavigatorSceneMetas } from '@/lib/smartboardNavigatorScenes';
import { SmartboardNavigatorSceneIcon } from '@/components/liri/live-room/SmartboardNavigatorSceneIcon';

// ── Audio ambiance presets ───────────────────────────────────────────────────
const AUDIO_PRESETS = [
  { id: 'none',   label: 'Aucun',       icon: '🔇', src: null },
  { id: 'nature', label: 'Nature',      icon: '🌿', src: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_8cb749b581.mp3' },
  { id: 'ocean',  label: 'Océan',       icon: '🌊', src: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d1718ab41b.mp3' },
  { id: 'rain',   label: 'Pluie',       icon: '🌧️',  src: 'https://cdn.pixabay.com/download/audio/2022/03/24/audio_9fcb7a1d0a.mp3' },
  { id: 'fire',   label: 'Feu',         icon: '🔥', src: 'https://cdn.pixabay.com/download/audio/2022/07/25/audio_b25d19c3f5.mp3' },
  { id: 'cafe',   label: 'Café',        icon: '☕', src: 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_dc39bde5b2.mp3' },
  { id: 'lo-fi',  label: 'Lo-Fi',       icon: '🎵', src: 'https://cdn.pixabay.com/download/audio/2022/10/16/audio_b5a3ad6024.mp3' },
  { id: 'focus',  label: 'Focus',       icon: '🎯', src: 'https://cdn.pixabay.com/download/audio/2022/11/17/audio_9ee6ccd4a9.mp3' },
];

// ── Virtual backgrounds ──────────────────────────────────────────────────────
const VBG_PRESETS = [
  { id: 'none',   label: 'Aucun',   color: 'transparent', thumb: null },
  { id: 'immersive', label: 'Verre IA', color: 'linear-gradient(135deg,rgba(212,175,55,0.12),rgba(9,13,20,0.5))', thumb: null },
  { id: 'blur',   label: 'Flou',    color: '#1a2a3a', thumb: null, isBlur: true },
  { id: 'studio', label: 'Studio',  color: 'linear-gradient(135deg,#0f1419,#1a2d4a)', thumb: null },
  { id: 'office', label: 'Bureau',  color: 'linear-gradient(135deg,#1a1f28,#2d3a4a)', thumb: null },
  { id: 'space',  label: 'Space',   color: 'linear-gradient(135deg,#0b0b2b,#1a0a3a)', thumb: null },
  { id: 'nature', label: 'Forêt',   color: 'linear-gradient(135deg,#0a2a0a,#1a4a1a)', thumb: null },
  { id: 'beach',  label: 'Plage',   color: 'linear-gradient(135deg,#1a3a5a,#4a8a6a)', thumb: null },
  { id: 'library', label: 'Bibliothèque', color: 'linear-gradient(135deg,#1c1410,#3d2e24)', thumb: null },
  { id: 'temple', label: 'Temple',  color: 'linear-gradient(135deg,#2a2216,#4a3824)', thumb: null },
  { id: 'stage',  label: 'Scène',   color: 'linear-gradient(135deg,#0a0612,#1f0a28)', thumb: null },
];

// ── Tab button ───────────────────────────────────────────────────────────────
function Tab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 h-8 rounded-xl text-xs font-medium transition-colors',
        active ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'
      )}
    >
      {children}
    </button>
  );
}

// ── Video settings tab ───────────────────────────────────────────────────────
function VideoTab({
  videoDevices,
  selectedCamera,
  onSelectCamera,
  blur,
  onToggleBlur,
  beauty,
  onToggleBeauty,
  vbg,
  onSelectVbg,
  chromaKey,
  onToggleChroma,
  chromaColor,
  onChromaColorChange,
  chromaSensitivity,
  onChromaSensitivityChange,
}) {
  return (
    <div className="space-y-4">
      {/* Camera — même logique que le panneau studio (interrupteur à 2 sources) */}
      <div>
        <p className={cn(designerShellMicroLabel, 'mb-2')}>Caméra</p>
        <StudioDevicePicker
          devices={videoDevices}
          activeId={selectedCamera}
          onPick={onSelectCamera}
          icon={Camera}
          kindFr="Caméra"
          emptyMessage="Aucune caméra détectée. Autorisez l'accès caméra dans le navigateur."
          switchHintTwo="Basculer entre les deux caméras"
          switchHintMany="Choisir une caméra"
        />
      </div>

      {/* Effects */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Effets vidéo</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: <Sliders className="w-3.5 h-3.5" />, label: 'Flou arrière', active: blur, toggle: onToggleBlur },
            { icon: <Sparkles className="w-3.5 h-3.5" />, label: 'Maquillage IA', active: beauty, toggle: onToggleBeauty },
          ].map((fx) => (
            <button
              key={fx.label}
              type="button"
              onClick={fx.toggle}
              className={cn(
                'h-10 rounded-xl text-[11px] flex items-center justify-center gap-1.5 border transition-colors',
                fx.active
                  ? 'bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-[var(--school-accent)]'
                  : 'bg-white/[0.04] border-white/10 text-white/60 hover:bg-white/[0.08]'
              )}
            >
              {fx.icon} {fx.label}
            </button>
          ))}
        </div>
      </div>

      {/* Virtual backgrounds */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Arrière-plan virtuel</p>
        <p className="text-[10px] text-white/35 mb-2 leading-snug">
          Effet sur votre caméra (ce que vous envoyez). En appel 1:1, le fond virtuel se voit surtout sur la prévisualisation
          locale ; le grand cadre affiche souvent l'interlocuteur. Verre IA = transparence ; Studio / Forêt = détourage MediaPipe.
          Si l'effet n\'apparaît pas, vérifier la connexion (chargement du modèle depuis le réseau).
        </p>
        <div className="grid grid-cols-3 gap-2">
          {VBG_PRESETS.map((bg) => (
            <button
              key={bg.id}
              type="button"
              onClick={() => onSelectVbg(bg.id)}
              className={cn(
                'h-14 rounded-xl border-2 overflow-hidden flex items-center justify-center text-[10px] font-medium transition-all px-0.5',
                vbg === bg.id ? 'border-[var(--school-accent)] shadow-[0_0_10px_rgba(212,175,55,0.4)]' : 'border-white/15 hover:border-white/35'
              )}
              style={{ background: bg.color || '#111' }}
            >
              <span className="text-center text-white/85 leading-tight">{bg.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Fond vert / chroma (sans IA)</p>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <input
            type="checkbox"
            checked={chromaKey}
            onChange={() => onToggleChroma?.(!chromaKey)}
            className="rounded border-white/30"
          />
          <span className="text-[11px] text-white/75">Retirer la couleur de fond (type studio vert)</span>
        </label>
        {chromaKey ? (
          <div className="mt-2 space-y-2 pl-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/45 w-16 shrink-0">Couleur</span>
              <input
                type="color"
                value={chromaColor}
                onChange={(e) => onChromaColorChange?.(e.target.value)}
                className="h-8 w-14 cursor-pointer rounded border border-white/15 bg-transparent"
              />
              <input
                type="text"
                value={chromaColor}
                onChange={(e) => onChromaColorChange?.(e.target.value)}
                className="h-8 flex-1 rounded-lg border border-white/10 bg-black/30 px-2 font-mono text-[11px] text-white"
              />
            </div>
            <div>
              <p className="text-[9px] text-white/40 mb-1">Tolérance ({chromaSensitivity})</p>
              <input
                type="range"
                min={40}
                max={200}
                value={chromaSensitivity}
                onChange={(e) => onChromaSensitivityChange?.(Number(e.target.value))}
                className="w-full accent-[var(--school-accent)]"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Audio settings tab ───────────────────────────────────────────────────────
function AudioTab({ audioDevices, selectedMic, onSelectMic, noiseCancel, onToggleNoise, preset, onSelectPreset, bgVolume, onBgVolume, bgPlaying, onToggleBgPlay, onLoadCustomAudio, onCaptureSystemAudio }) {
  const audioFileRef = useRef(null);

  const handleAudioFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onLoadCustomAudio?.(url, file.name);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      {/* Microphone — aligné panneau studio */}
      <div>
        <p className={cn(designerShellMicroLabel, 'mb-2')}>Microphone</p>
        <StudioDevicePicker
          devices={audioDevices}
          activeId={selectedMic}
          onPick={onSelectMic}
          icon={Mic}
          kindFr="Micro"
          emptyMessage="Aucun micro détecté. Vérifiez les permissions du navigateur."
          switchHintTwo="Basculer entre les deux micros"
          switchHintMany="Choisir un micro"
        />
      </div>

      {/* Audio processing */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Traitement audio</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Réduction bruit', active: noiseCancel, toggle: onToggleNoise },
            { label: 'Mode chant/voix', active: false, toggle: () => {} },
            { label: 'Mode instrument', active: false, toggle: () => {} },
            { label: 'Mode conférence', active: true, toggle: () => {} },
          ].map((fx) => (
            <button
              key={fx.label}
              type="button"
              onClick={fx.toggle}
              className={cn(
                'h-10 rounded-xl text-[11px] flex items-center justify-center gap-1.5 border transition-colors',
                fx.active
                  ? 'bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-[var(--school-accent)]'
                  : 'bg-white/[0.04] border-white/10 text-white/60 hover:bg-white/[0.08]'
              )}
            >
              {fx.label}
            </button>
          ))}
        </div>
      </div>

      {/* Background ambiance */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Ambiance / fond sonore</p>
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {AUDIO_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectPreset(p.id)}
              className={cn(
                'h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 border text-[10px] transition-all',
                preset === p.id
                  ? 'bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] text-[var(--school-accent)]'
                  : 'bg-white/[0.03] border-white/10 text-white/60 hover:bg-white/[0.07]'
              )}
            >
              <span className="text-base leading-none">{p.icon}</span>
              <span>{p.label}</span>
            </button>
          ))}
        </div>

        {/* Volume control */}
        {preset !== 'none' && (
          <div className="flex items-center gap-3 px-1 mb-3">
            <button
              type="button"
              onClick={onToggleBgPlay}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center text-white flex-shrink-0"
            >
              {bgPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <Volume2 className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
            <input
              type="range" min={0} max={100} value={bgVolume}
              onChange={(e) => onBgVolume(Number(e.target.value))}
              className="flex-1 h-1 accent-[var(--school-accent)] cursor-pointer"
            />
            <span className="text-[10px] text-white/50 w-7 text-right">{bgVolume}%</span>
          </div>
        )}

        {/* Custom audio file */}
        <button
          type="button"
          onClick={() => audioFileRef.current?.click()}
          className="w-full h-9 rounded-xl bg-white/[0.04] border border-white/12 hover:border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-[11px] text-white/60 hover:text-[var(--school-accent)] flex items-center justify-center gap-2 transition-colors mb-2"
        >
          <Upload className="w-3.5 h-3.5" />
          Téléverser un fichier audio
        </button>
        <input ref={audioFileRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioFile} />

        {/* System audio */}
        <button
          type="button"
          onClick={onCaptureSystemAudio}
          className="w-full h-9 rounded-xl bg-white/[0.04] border border-white/12 hover:border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-[11px] text-white/60 hover:text-[var(--school-accent)] flex items-center justify-center gap-2 transition-colors"
        >
          <Headphones className="w-3.5 h-3.5" />
          Partager le son de l'ordinateur
        </button>
      </div>
    </div>
  );
}

// ── SmartBoard / Partage tab ─────────────────────────────────────────────────
function SmartBoardTab({
  onLoadSlides,
  onShareScreen,
  onShareImage,
  sharingScreen,
  smartboardSceneFlags,
  onSmartboardSceneToggle,
}) {
  const sceneMetas = React.useMemo(() => getAllSmartboardNavigatorSceneMetas(), []);
  const fileInputRef = useRef(null);
  const imgInputRef = useRef(null);

  const handleSlidesFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const slides = JSON.parse(String(reader.result || '[]'));
        onLoadSlides?.(Array.isArray(slides) ? slides : []);
      } catch {
        alert('Fichier JSON invalide');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImageFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onShareImage?.(String(reader.result || ''));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">SmartBoard — Diaporama</p>
        <p className="text-[11px] text-white/40 mb-3">Chargez un fichier JSON de slides pour l'afficher dans la zone diapo du live.</p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full h-10 rounded-xl bg-white/[0.05] border border-white/15 hover:border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-xs text-white/70 hover:text-[var(--school-accent)] flex items-center justify-center gap-2 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Charger un fichier diapo (.json)
        </button>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleSlidesFile} />
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Partage d'écran</p>
        <p className="text-[11px] text-white/40 mb-3">L'écran partagé s\'affichera dans la zone SmartBoard du live.</p>
        <button
          type="button"
          onClick={onShareScreen}
          className={cn(
            'w-full h-10 rounded-xl border text-xs flex items-center justify-center gap-2 transition-colors',
            sharingScreen
              ? 'bg-red-500/15 border-red-400/35 text-red-300'
              : 'bg-white/[0.05] border-white/15 hover:border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-white/70 hover:text-[var(--school-accent)]'
          )}
        >
          <Monitor className="w-4 h-4" />
          {sharingScreen ? 'Arrêter le partage' : "Partager l'écran"}
        </button>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Partager une image</p>
        <button
          type="button"
          onClick={() => imgInputRef.current?.click()}
          className="w-full h-10 rounded-xl bg-white/[0.05] border border-white/15 hover:border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-xs text-white/70 hover:text-[var(--school-accent)] flex items-center justify-center gap-2 transition-colors"
        >
          <ImageIcon className="w-4 h-4" />
          Afficher une image dans le SmartBoard
        </button>
        <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
      </div>

      {onSmartboardSceneToggle && smartboardSceneFlags && sceneMetas.length > 0 ? (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Scènes du bandeau (joker)</p>
          <p className="text-[11px] text-white/35 mb-3">Même clés que le wizard Studio — visibles par les deux côtés du live.</p>
          <div className="grid grid-cols-2 gap-2">
            {sceneMetas.map((s) => {
              const on = smartboardSceneFlags[s.id] !== false;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSmartboardSceneToggle(s.id, !on)}
                  className={cn(
                    'h-10 rounded-xl text-[11px] flex items-center justify-center gap-1.5 border transition-colors px-1',
                    on
                      ? 'bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-[var(--school-accent)]'
                      : 'bg-white/[0.04] border-white/10 text-white/50 hover:bg-white/[0.08]',
                  )}
                  title={s.hint || s.label}
                >
                  <SmartboardNavigatorSceneIcon sceneId={s.id} className="h-4 w-4 shrink-0 opacity-95" />
                  <span className="truncate">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Options SmartBoard</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: <Layers className="w-3.5 h-3.5" />, label: 'Vue tableau' },
              { icon: <Maximize2 className="w-3.5 h-3.5" />, label: 'Plein écran' },
              { icon: <RefreshCw className="w-3.5 h-3.5" />, label: 'Réinitialiser' },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                className="h-10 rounded-xl text-[11px] text-white/60 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] flex items-center justify-center gap-1.5 transition-colors"
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LiveSettingsPanel({
  open,
  onClose,
  /** Messagerie live : forcer la maquette LIRI mobile sur grand écran (localStorage côté parent). */
  liriForceCompactLayout = false,
  onLiriForceCompactLayoutChange,
  // External video effect state (lifted to parent)
  blur = false,
  onBlurChange,
  beauty = false,
  onBeautyChange,
  vbg = 'none',
  onVbgChange,
  onSelectCamera,
  onSelectMic,
  onLoadSlides,
  onShareScreen,
  onShareImage,
  sharingScreen = false,
  smartboardSceneFlags,
  onSmartboardSceneToggle,
  chromaKey = false,
  onChromaKeyChange,
  chromaColor = '#00B140',
  onChromaColorChange,
  chromaSensitivity = 100,
  onChromaSensitivityChange,
}) {
  const [tab, setTab] = useState('video');
  const [videoDevices, setVideoDevices] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedMic, setSelectedMic] = useState('');

  // Audio
  const [noiseCancel, setNoiseCancel] = useState(true);
  const [audioPreset, setAudioPreset] = useState('none');
  const [bgVolume, setBgVolume] = useState(40);
  const [bgPlaying, setBgPlaying] = useState(false);
  const bgAudioRef = useRef(null);

  // Enumerate devices when panel opens
  useEffect(() => {
    if (!open) return;
    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
      setAudioDevices(devices.filter((d) => d.kind === 'audioinput'));
    }).catch(() => {});
  }, [open]);

  const [customAudioLabel, setCustomAudioLabel] = useState('');

  // Background audio management
  useEffect(() => {
    const preset = AUDIO_PRESETS.find((p) => p.id === audioPreset);
    if (!preset?.src && !bgAudioRef.current?._isCustom) {
      bgAudioRef.current?.pause();
      setBgPlaying(false);
      return;
    }
    if (!preset?.src) return; // custom audio handled separately
    if (!bgAudioRef.current) {
      bgAudioRef.current = new Audio();
      bgAudioRef.current.loop = true;
    }
    bgAudioRef.current._isCustom = false;
    if (bgAudioRef.current.src !== preset.src) {
      bgAudioRef.current.src = preset.src;
    }
    bgAudioRef.current.volume = bgVolume / 100;
    if (bgPlaying) bgAudioRef.current.play().catch(() => {});
    else bgAudioRef.current.pause();
  }, [audioPreset, bgPlaying, bgVolume]);

  const handleLoadCustomAudio = (url, name) => {
    if (!bgAudioRef.current) {
      bgAudioRef.current = new Audio();
      bgAudioRef.current.loop = true;
    }
    bgAudioRef.current._isCustom = true;
    bgAudioRef.current.src = url;
    bgAudioRef.current.volume = bgVolume / 100;
    setCustomAudioLabel(name);
    setAudioPreset('custom');
    setBgPlaying(true);
    bgAudioRef.current.play().catch(() => {});
  };

  const handleCaptureSystemAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: false });
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const dest = ctx.createMediaStreamDestination();
      src.connect(dest);
      // Create audio from the system stream
      const sysAudio = new Audio();
      sysAudio.srcObject = stream;
      sysAudio.volume = bgVolume / 100;
      sysAudio.play().catch(() => {});
      if (!bgAudioRef.current) bgAudioRef.current = sysAudio;
      else { bgAudioRef.current.pause(); bgAudioRef.current = sysAudio; }
      bgAudioRef.current._isCustom = true;
      setCustomAudioLabel('Son de l\'ordinateur');
      setAudioPreset('custom');
      setBgPlaying(true);
    } catch {
      // User cancelled
    }
  };

  // Keep volume in sync
  useEffect(() => {
    if (bgAudioRef.current) bgAudioRef.current.volume = bgVolume / 100;
  }, [bgVolume]);

  // Note: ambient audio intentionally keeps playing when the panel is closed.
  // The user can reopen the panel to pause or change the track.

  const handleSelectCamera = (id) => {
    setSelectedCamera(id);
    onSelectCamera?.(id);
  };

  const handleSelectMic = (id) => {
    setSelectedMic(id);
    onSelectMic?.(id);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-[min(98vw,520px)] rounded-[24px] border border-white/20 bg-[#0c1425]/94 backdrop-blur-2xl shadow-[0_30px_80px_-30px_rgba(0,0,0,0.97)] overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <p className="text-sm font-semibold text-white/90">Paramètres du live</p>
            <button
              type="button"
              onClick={onClose}
              className="h-7 w-7 rounded-full hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {typeof onLiriForceCompactLayoutChange === 'function' ? (
            <div className="px-4 pb-3 border-b border-white/[0.06]">
              <div className="mb-2 flex items-end gap-1.5 text-[10px] uppercase tracking-wider text-white/40">
                <span>Interface</span>
                <LiriWordmark size="kicker" className="text-white/50" subtleGlow />
              </div>
              <button
                type="button"
                onClick={() => onLiriForceCompactLayoutChange(!liriForceCompactLayout)}
                className={cn(
                  'w-full min-h-[2.75rem] rounded-xl text-xs font-medium flex items-center justify-between gap-2 px-3 py-2 border transition-colors text-left',
                  liriForceCompactLayout
                    ? 'bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-[var(--school-accent)]'
                    : 'bg-white/[0.04] border-white/10 text-white/70 hover:bg-white/[0.07]',
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Smartphone className="w-4 h-4 shrink-0" />
                  <span className="leading-snug">Forcer la maquette mobile (même sur grand écran)</span>
                </span>
                <span className="text-[10px] shrink-0 opacity-90 tabular-nums">{liriForceCompactLayout ? 'Oui' : 'Non'}</span>
              </button>
              <p className="text-[10px] text-white/35 mt-1.5 leading-relaxed">
                Tablette, Chrome « site pour ordinateur », ou écran tactile large : même disposition que sur téléphone (scènes, SmartBoard).
              </p>
            </div>
          ) : null}

          {/* Tabs */}
          <div className="px-4 pb-2">
            <div className="flex gap-1 rounded-2xl bg-white/[0.05] p-1">
              <Tab active={tab === 'video'} onClick={() => setTab('video')}>🎥 Vidéo</Tab>
              <Tab active={tab === 'audio'} onClick={() => setTab('audio')}>🎙️ Audio</Tab>
              <Tab active={tab === 'board'} onClick={() => setTab('board')}>📊 SmartBoard</Tab>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 pb-4 max-h-[60vh] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.1)_transparent]">
            {tab === 'video' && (
              <VideoTab
                videoDevices={videoDevices}
                selectedCamera={selectedCamera}
                onSelectCamera={handleSelectCamera}
                blur={blur}
                onToggleBlur={() => onBlurChange?.(!blur)}
                beauty={beauty}
                onToggleBeauty={() => onBeautyChange?.(!beauty)}
                vbg={vbg}
                onSelectVbg={(v) => onVbgChange?.(v)}
                chromaKey={chromaKey}
                onToggleChroma={onChromaKeyChange}
                chromaColor={chromaColor}
                onChromaColorChange={onChromaColorChange}
                chromaSensitivity={chromaSensitivity}
                onChromaSensitivityChange={onChromaSensitivityChange}
              />
            )}
            {tab === 'audio' && (
              <AudioTab
                audioDevices={audioDevices}
                selectedMic={selectedMic}
                onSelectMic={handleSelectMic}
                noiseCancel={noiseCancel}
                onToggleNoise={() => setNoiseCancel((v) => !v)}
                preset={audioPreset}
                onSelectPreset={setAudioPreset}
                bgVolume={bgVolume}
                onBgVolume={setBgVolume}
                bgPlaying={bgPlaying}
                onToggleBgPlay={() => setBgPlaying((v) => !v)}
                onLoadCustomAudio={handleLoadCustomAudio}
                onCaptureSystemAudio={handleCaptureSystemAudio}
              />
            )}
            {tab === 'board' && (
              <SmartBoardTab
                onLoadSlides={onLoadSlides}
                onShareScreen={onShareScreen}
                onShareImage={onShareImage}
                sharingScreen={sharingScreen}
                smartboardSceneFlags={smartboardSceneFlags}
                onSmartboardSceneToggle={onSmartboardSceneToggle}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
