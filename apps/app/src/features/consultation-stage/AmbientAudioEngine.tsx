// ─────────────────────────────────────────────────────────────────────────────
// MOTEUR AUDIO — FOND SONORE DE CONSULTATION (MEDOS / salle de téléconsultation)
//
// Composant AUTONOME : un petit panneau de contrôle flottant pour poser une
// ambiance douce pendant la consultation (Silence, Nature, Océan, Pluie, Café,
// Lo-Fi, Feu, Focus). Play/pause + slider de volume.
//
// RÉUTILISE les ambiances éprouvées de LIRI (cf. AUDIO_PRESETS de
// components/liri/live-room/LiveSettingsPanel.jsx — mêmes id/label/icône/URL
// Pixabay). Ce panneau n'EXPORTE pas son tableau ; on le re-déclare ici à
// l'identique pour rester découplé (LiveSettingsPanel = .jsx + Tailwind + var
// CSS --school-accent), au lieu d'importer un module non conçu pour cet usage.
//
// LECTURE : HTML5 <Audio> en boucle (même logique que LiveSettingsPanel :
// el.volume = pct/100, el.loop = true, el.play().catch()). N'interfère PAS avec
// les pistes micro/caméra LiveKit (flux <audio> indépendant côté navigateur).
//
// PAR DÉFAUT : COUPÉ (pause) + volume BAS. Le praticien démarre l'ambiance
// explicitement. Styles inline + GOLD + icônes lucide-react comme
// ConsultationRoom (pas de Tailwind, pas de dépendance à --school-accent).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Music2, Volume1, Volume2, VolumeX, Play, Pause, ChevronUp, ChevronDown, Upload, Headphones, Radio } from 'lucide-react';

const GOLD = '#b08d57';
const PANEL_BG = 'rgba(22,22,24,0.94)';

// ── Presets d'ambiance ───────────────────────────────────────────────────────
// IDENTIQUE à LiveSettingsPanel.AUDIO_PRESETS (réutilisation des sources LIRI).
// `src=null` ⇒ Silence (coupe le son sans démonter l'élément <audio>).
export type AmbiencePreset = {
  id: string;
  label: string;
  icon: string;
  src: string | null;
};

// Sources MP3 servies EN SAME-ORIGIN via un proxy Vercel (cf. apps/app/vercel.json
// rewrites `/media/ambient/*`). CRUCIAL pour la DIFFUSION : `createMediaElementSource`
// produit un flux SILENCIEUX (tainted) sur une source cross-origin SANS en-tête CORS
// (cas de SoundHelix en direct). En passant par le proxy same-origin, le graphe
// WebAudio capte le vrai son → l'ambiance est diffusable au patient + invités.
// (Les pistes chargées par le praticien sont des blob: URLs same-origin → OK aussi.)
export const AMBIENCE_PRESETS: AmbiencePreset[] = [
  { id: 'none', label: 'Silence', icon: '🔇', src: null },
  { id: 'calm', label: 'Détente', icon: '🍃', src: '/media/ambient/calm.mp3' },
  { id: 'lo-fi', label: 'Lo-Fi', icon: '🎵', src: '/media/ambient/lofi.mp3' },
  { id: 'focus', label: 'Focus', icon: '🎯', src: '/media/ambient/focus.mp3' },
  { id: 'soft', label: 'Douce', icon: '🎶', src: '/media/ambient/soft.mp3' },
  { id: 'warm', label: 'Chill', icon: '☕', src: '/media/ambient/warm.mp3' },
  { id: 'deep', label: 'Ambiant', icon: '🌌', src: '/media/ambient/deep.mp3' },
];

// ─────────────────────────────────────────────────────────────────────────────
// HOOK : useAmbientAudio — toute la logique de lecture, sans UI.
// Permet de piloter le fond sonore depuis un autre chrome si besoin.
// ─────────────────────────────────────────────────────────────────────────────
export type UseAmbientAudioOptions = {
  /** Preset initial (défaut : 'none' = silence). */
  initialPresetId?: string;
  /** Volume initial 0–100 (défaut : 22 = bas, conforme à l'esprit LIRI 0.22). */
  initialVolume?: number;
  /** Démarrer en lecture (défaut : false = coupé). */
  autoPlay?: boolean;
};

export type AmbientAudioController = {
  presets: AmbiencePreset[];
  presetId: string;
  preset: AmbiencePreset;
  /** 0–100 */
  volume: number;
  /** true si une piste audible est censée jouer. */
  playing: boolean;
  selectPreset: (id: string) => void;
  setVolume: (v: number) => void;
  togglePlay: () => void;
  play: () => void;
  pause: () => void;
  /** Charge une piste locale (fichier de l'appareil) → l'ajoute aux ambiances et la lance. */
  addCustomTrack: (file: File) => void;
  // ── Diffusion (Privé ↔ Partagé) ──────────────────────────────────────────
  /** true = l'ambiance est diffusée aux autres participants (patient + invités). */
  broadcast: boolean;
  /** Active/coupe la diffusion. À true → construit le graphe WebAudio (geste requis). */
  setBroadcast: (on: boolean) => void;
  /**
   * Flux MediaStream capté sur l'élément <audio> (via WebAudio) à PUBLIER dans la
   * salle LiveKit. Construit le graphe paresseusement au 1er appel. `null` si SSR.
   * Le son local continue de sortir sur les enceintes (graphe → destination).
   */
  getBroadcastStream: () => MediaStream | null;
};

const SILENCE_ID = 'none';

function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, Math.round(v)));
}

export function useAmbientAudio(options: UseAmbientAudioOptions = {}): AmbientAudioController {
  const { initialPresetId = SILENCE_ID, initialVolume = 22, autoPlay = false } = options;

  // Ambiances de base + pistes chargées par le praticien (fichiers locaux).
  const [customPresets, setCustomPresets] = useState<AmbiencePreset[]>([]);
  const presets = useMemo(() => [...AMBIENCE_PRESETS, ...customPresets], [customPresets]);
  const [presetId, setPresetId] = useState<string>(
    AMBIENCE_PRESETS.some((p) => p.id === initialPresetId) ? initialPresetId : SILENCE_ID,
  );
  const [volume, setVolumeState] = useState<number>(clampVolume(initialVolume));
  // « playing » = intention de lecture. La lecture réelle ne sonne que si le
  // preset a une source (≠ Silence) — Silence reste un état « pause sonore ».
  const [playing, setPlaying] = useState<boolean>(!!autoPlay);
  // Diffusion aux autres participants (Privé = false par défaut).
  const [broadcast, setBroadcastState] = useState<boolean>(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Object URLs des pistes chargées (révoquées à la destruction) + compteur d'id stable.
  const customUrlsRef = useRef<string[]>([]);
  const customIdRef = useRef<number>(1);

  // ── Graphe WebAudio (capture pour diffusion) ───────────────────────────────
  // Construit UNIQUEMENT quand la diffusion est activée (aucune régression sur la
  // lecture locale en mode Privé). Une fois créé : element → gain → { enceintes
  // locales, flux MediaStream diffusé }. Le gain porte le volume (uniforme local
  // + distant, fiable sur tous navigateurs, contrairement à `el.volume` capté).
  const audioCtxRef = useRef<AudioContext | null>(null);
  const srcNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const destNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const ensureGraph = useCallback((): MediaStream | null => {
    if (typeof window === 'undefined') return null;
    const el = audioRef.current;
    if (!el) return null;
    if (!streamRef.current) {
      try {
        const Ctx: typeof AudioContext =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        // createMediaElementSource ne peut être appelé qu'UNE fois par élément :
        // dès lors la sortie de l'élément passe par le graphe → on doit rebrancher
        // les enceintes via ctx.destination.
        const src = ctx.createMediaElementSource(el);
        const gain = ctx.createGain();
        gain.gain.value = clampVolume(volume) / 100;
        const dest = ctx.createMediaStreamDestination();
        src.connect(gain);
        gain.connect(ctx.destination); // son local (enceintes du praticien)
        gain.connect(dest); // flux à publier dans la salle
        // Le graphe attenue déjà via le gain → l'élément joue à plein régime.
        el.volume = 1;
        audioCtxRef.current = ctx;
        srcNodeRef.current = src;
        gainNodeRef.current = gain;
        destNodeRef.current = dest;
        streamRef.current = dest.stream;
      } catch {
        return null;
      }
    }
    // Reprise du contexte (politique autoplay) — appelé depuis un geste utilisateur.
    audioCtxRef.current?.resume().catch(() => {});
    return streamRef.current;
  }, [volume]);

  const getBroadcastStream = useCallback(() => ensureGraph(), [ensureGraph]);

  const setBroadcast = useCallback(
    (on: boolean) => {
      if (on) ensureGraph(); // construit le graphe DANS le geste (autoplay policy)
      setBroadcastState(on);
    },
    [ensureGraph],
  );

  const preset = useMemo(
    () => presets.find((p) => p.id === presetId) ?? presets[0],
    [presets, presetId],
  );

  // Élément <audio> unique, créé paresseusement (évite le SSR + 1 seul flux).
  const ensureEl = useCallback((): HTMLAudioElement | null => {
    if (typeof window === 'undefined') return null;
    if (!audioRef.current) {
      const el = new Audio();
      el.loop = true;
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      // playsInline n'existe pas sur le type DOM standard → cast volontaire
      // (utile iOS Safari pour autoriser la lecture inline).
      (el as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
      audioRef.current = el;
    }
    return audioRef.current;
  }, []);

  // Synchronise source + volume + état lecture sur l'élément.
  useEffect(() => {
    const el = ensureEl();
    if (!el) return;

    const src = preset.src;
    const audible = playing && !!src;

    if (!src) {
      // Silence : on coupe sans détruire l'élément.
      try {
        el.pause();
      } catch {
        /* ignore */
      }
      return;
    }

    if (el.src !== src) {
      el.src = src;
      try {
        el.load();
      } catch {
        /* ignore */
      }
    }
    // Volume : via le gain WebAudio si le graphe de diffusion existe (attenuation
    // uniforme local + distant), sinon directement sur l'élément (mode Privé pur).
    if (streamRef.current && gainNodeRef.current) {
      el.volume = 1;
      gainNodeRef.current.gain.value = clampVolume(volume) / 100;
      // Le navigateur peut suspendre le contexte (changement de source, onglet…) :
      // le flux diffusé deviendrait muet. On le relance (déjà autorisé par un geste).
      if (audible && audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    } else {
      el.volume = clampVolume(volume) / 100;
    }

    if (audible) {
      // play() peut être rejeté (autoplay policy) → silencieux, l'utilisateur
      // a de toute façon déclenché via un clic dans la salle.
      el.play().catch(() => {});
    } else {
      try {
        el.pause();
      } catch {
        /* ignore */
      }
    }
  }, [ensureEl, preset.src, playing, volume]);

  // Nettoyage : couper le flux à la destruction (sortie de consultation).
  useEffect(() => {
    return () => {
      const el = audioRef.current;
      if (el) {
        try {
          el.pause();
          el.src = '';
        } catch {
          /* ignore */
        }
      }
      customUrlsRef.current.forEach((u) => {
        try {
          URL.revokeObjectURL(u);
        } catch {
          /* ignore */
        }
      });
      customUrlsRef.current = [];
      // Fermer le contexte WebAudio de diffusion (le cas échéant).
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state !== 'closed') {
        try {
          void ctx.close();
        } catch {
          /* ignore */
        }
      }
      audioCtxRef.current = null;
      srcNodeRef.current = null;
      gainNodeRef.current = null;
      destNodeRef.current = null;
      streamRef.current = null;
    };
  }, []);

  const selectPreset = useCallback((id: string) => {
    setPresetId((prev) => (presets.some((p) => p.id === id) ? id : prev));
    // Choisir une vraie ambiance = lancer la lecture ; choisir Silence = couper.
    setPlaying(id !== SILENCE_ID);
  }, [presets]);

  // Charge une piste locale (fichier de l'appareil) via object URL, l'ajoute aux
  // ambiances et la lance. Lecture PUREMENT LOCALE (comme les presets) — pas de
  // dépendance au bucket, pas de diffusion réseau. Révoquée à la destruction.
  const addCustomTrack = useCallback((file: File) => {
    if (typeof window === 'undefined' || !file) return;
    let url: string;
    try {
      url = URL.createObjectURL(file);
    } catch {
      return;
    }
    customUrlsRef.current.push(url);
    const base = (file.name || '').replace(/\.[^./\\]+$/, '').trim().slice(0, 20) || 'Ma piste';
    const id = `custom-${customIdRef.current++}`;
    setCustomPresets((prev) => [...prev, { id, label: base, icon: '🎧', src: url }]);
    setPresetId(id);
    setPlaying(true);
  }, []);

  const setVolume = useCallback((v: number) => setVolumeState(clampVolume(v)), []);
  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);
  const togglePlay = useCallback(() => setPlaying((p) => !p), []);

  return {
    presets,
    presetId,
    preset,
    volume,
    playing: playing && !!preset.src,
    selectPreset,
    setVolume,
    togglePlay,
    play,
    pause,
    addCustomTrack,
    broadcast,
    setBroadcast,
    getBroadcastStream,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// TOGGLE Privé ↔ Partagé — segmenté, réutilisé dans le panneau flottant ET le
// panneau Réglages (même contrôleur). RÉSERVÉ au praticien (l'hôte publie la
// piste ; le patient ne fait que la recevoir via son RoomAudioRenderer).
// ─────────────────────────────────────────────────────────────────────────────
export function BroadcastToggle({ ctl }: { ctl: AmbientAudioController }) {
  const { broadcast, setBroadcast } = ctl;
  const seg = (active: boolean): React.CSSProperties => ({
    flex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 30,
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
    background: active ? GOLD : 'transparent',
    color: active ? '#1a1a1a' : 'rgba(255,255,255,0.62)',
    transition: 'background 0.15s, color 0.15s',
  });
  return (
    <div>
      <div
        role="tablist"
        aria-label="Diffusion du fond sonore"
        style={{
          display: 'flex',
          gap: 4,
          padding: 3,
          borderRadius: 10,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={!broadcast}
          onClick={() => setBroadcast(false)}
          title="Vous seul entendez l'ambiance"
          style={seg(!broadcast)}
        >
          <Headphones size={13} aria-hidden="true" />
          Privé
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={broadcast}
          onClick={() => setBroadcast(true)}
          title="Le patient et les invités entendent l'ambiance"
          style={seg(broadcast)}
        >
          <Radio size={13} aria-hidden="true" />
          Partagé
        </button>
      </div>
      <p style={{ margin: '6px 2px 0', fontSize: 10.5, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
        {broadcast ? 'Le patient et vos invités entendent l’ambiance.' : 'Vous seul entendez l’ambiance.'}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PANNEAU DE CONTRÔLE (UI) — flottant, repliable, coin bas-gauche par défaut.
// ─────────────────────────────────────────────────────────────────────────────
export type AmbientAudioEngineProps = {
  /** Replié au montage (défaut : true = pastille discrète). */
  defaultCollapsed?: boolean;
  /** Positionnement du conteneur (défaut : bas-gauche fixe). Override possible. */
  style?: React.CSSProperties;
  /** Réglages initiaux de lecture. */
  initialPresetId?: string;
  initialVolume?: number;
  /** Contrôleur externe (si l'hôte gère déjà l'état via useAmbientAudio). */
  controller?: AmbientAudioController;
  /** Praticien : affiche le sélecteur Privé/Partagé (diffusion aux participants). */
  host?: boolean;
};

const VOLUME_ICON_THRESHOLD_LOW = 45;

function VolumeIcon({ volume, playing }: { volume: number; playing: boolean }) {
  if (!playing || volume <= 0) return <VolumeX size={15} aria-hidden="true" />;
  if (volume < VOLUME_ICON_THRESHOLD_LOW) return <Volume1 size={15} aria-hidden="true" />;
  return <Volume2 size={15} aria-hidden="true" />;
}

export default function AmbientAudioEngine({
  defaultCollapsed = true,
  style,
  initialPresetId,
  initialVolume,
  controller,
  host = false,
}: AmbientAudioEngineProps) {
  // Soit on consomme un contrôleur fourni, soit on en crée un local.
  const localCtl = useAmbientAudio({ initialPresetId, initialVolume });
  const ctl = controller ?? localCtl;

  const [collapsed, setCollapsed] = useState<boolean>(defaultCollapsed);

  const { presets, presetId, preset, volume, playing, selectPreset, setVolume, togglePlay, addCustomTrack } = ctl;
  const hasSource = !!preset.src;

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    left: 16,
    bottom: 16,
    zIndex: 2147483200,
    width: collapsed ? 'auto' : 248,
    background: PANEL_BG,
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14,
    boxShadow: '0 16px 44px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    color: '#fff',
    overflow: 'hidden',
    ...style,
  };

  // ── Replié : pastille (icône + libellé + play/pause rapide) ────────────────
  if (collapsed) {
    return (
      <div style={containerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
          <button
            type="button"
            onClick={togglePlay}
            disabled={!hasSource}
            aria-label={playing ? "Couper l'ambiance" : "Activer l'ambiance"}
            title={!hasSource ? 'Choisissez une ambiance' : playing ? "Couper l'ambiance" : "Activer l'ambiance"}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: '50%', border: 'none', flexShrink: 0,
              cursor: hasSource ? 'pointer' : 'not-allowed',
              background: playing ? GOLD : 'rgba(255,255,255,0.1)',
              color: playing ? '#1a1a1a' : '#fff',
              opacity: hasSource ? 1 : 0.55,
            }}
          >
            {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Ouvrir le fond sonore"
            title="Fond sonore"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 6px',
              background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff',
            }}
          >
            <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1 }}>{preset.icon}</span>
            <span style={{ fontSize: 12.5, color: '#cbd5e1', maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {hasSource ? preset.label : 'Fond sonore'}
            </span>
            <ChevronUp size={14} color="#9ca3af" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  // ── Déplié : titre + grille de presets + play/volume ───────────────────────
  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Music2 size={16} color={GOLD} aria-hidden="true" />
        <span style={{ fontWeight: 600, fontSize: 13.5 }}>Fond sonore</span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Réduire le fond sonore"
          title="Réduire"
          style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'inline-flex' }}
        >
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>

      <div style={{ padding: 12 }}>
        {/* Grille de presets (4 colonnes, comme LIRI). */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
          {presets.map((p) => {
            const active = presetId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPreset(p.id)}
                aria-pressed={active}
                title={p.label}
                style={{
                  height: 46, borderRadius: 11, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                  fontSize: 9.5, lineHeight: 1.1,
                  border: active ? `1px solid ${GOLD}` : '1px solid rgba(255,255,255,0.1)',
                  background: active ? 'rgba(176,141,87,0.16)' : 'rgba(255,255,255,0.03)',
                  color: active ? GOLD : 'rgba(255,255,255,0.62)',
                  transition: 'background 0.15s, border-color 0.15s, color 0.15s',
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>{p.icon}</span>
                <span style={{ maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* Charger une piste depuis l'appareil (ambiance personnalisée). */}
        <label
          title="Charger une piste depuis votre appareil"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            height: 32, marginBottom: 12, borderRadius: 10, cursor: 'pointer',
            border: `1px dashed ${GOLD}66`, background: 'rgba(176,141,87,0.08)',
            color: GOLD, fontSize: 11.5, fontWeight: 600,
          }}
        >
          <Upload size={13} aria-hidden="true" />
          Charger une piste
          <input
            type="file"
            accept="audio/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) addCustomTrack(f);
              e.currentTarget.value = '';
            }}
          />
        </label>

        {/* Privé ↔ Partagé (praticien) : diffuse l'ambiance aux participants. */}
        {host ? (
          <div style={{ marginBottom: 12 }}>
            <BroadcastToggle ctl={ctl} />
          </div>
        ) : null}

        {/* Play/pause + volume (masqué si Silence : rien à régler). */}
        {hasSource ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? 'Mettre en pause' : 'Lire'}
              title={playing ? 'Pause' : 'Lecture'}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: '50%', border: 'none', flexShrink: 0, cursor: 'pointer',
                background: playing ? GOLD : 'rgba(255,255,255,0.1)',
                color: playing ? '#1a1a1a' : '#fff',
              }}
            >
              {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
            </button>
            <span style={{ color: '#9ca3af', display: 'inline-flex', flexShrink: 0 }}>
              <VolumeIcon volume={volume} playing={playing} />
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volume du fond sonore"
              style={{ flex: 1, minWidth: 0, height: 3, cursor: 'pointer', accentColor: GOLD }}
            />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', width: 30, textAlign: 'right', flexShrink: 0 }}>{volume}%</span>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: 11.5, color: '#6b7280', textAlign: 'center', lineHeight: 1.5 }}>
            Choisissez une ambiance pour adoucir la consultation.
          </p>
        )}
      </div>
    </div>
  );
}
