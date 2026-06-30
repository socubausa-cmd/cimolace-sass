// ─────────────────────────────────────────────────────────────────────────────
// SALLE D'ATTENTE de l'événement (patient/invité) — affichée AVANT que le
// praticien (hôte) n'ait démarré la consultation. Principe : seul l'hôte démarre
// le live ; le patient patiente ici puis BASCULE automatiquement quand l'hôte
// arrive (cf. ConsultationRoom : poll `host_present`).
//
// Contenu : image de marque (logo LIRI + clinique) · COMPTE À REBOURS dynamique ·
// AGENDA (« Au programme ») · MUSIQUE d'attente (playlist) · STUDIO green room
// (aperçu caméra + choix CAMÉRA/MICRO + DÉTOURAGE flou/fond virtuel + MAQUILLAGE
// retouche — segmentation MediaPipe via `useSegmentedVideo`).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Mic, MicOff, Video, VideoOff, Clock, ListChecks, Music2, Play, Pause, ShieldCheck, Camera, Wand2, Sparkles } from 'lucide-react';
import { useAmbientAudio } from './AmbientAudioEngine';
import { useSegmentedVideo } from '@/hooks/useSegmentedVideo';

const BG = '#262624';
const PAGE_MESH =
  'radial-gradient(ellipse 85% 55% at 50% -15%, rgba(217,119,87,0.06), transparent 58%), radial-gradient(ellipse 55% 40% at 100% 85%, rgba(226,85,63,0.05), transparent 52%), radial-gradient(ellipse 45% 32% at 0% 75%, rgba(194,104,63,0.04), transparent 48%)';
const STAGE_BG = '#1f1e1c';
const PANEL_BG = 'rgba(48,48,46,0.97)';
const PANEL_BORDER = '1px solid rgba(245,244,238,0.1)';
const GOLD = '#d4a36a';
// Retouche « maquillage » (mêmes valeurs que la segmentation, pour cohérence
// quand le détourage est coupé : filtre CSS direct sur la vidéo).
const BEAUTY_FILTER = 'saturate(1.32) brightness(1.12) contrast(0.9)';

// Détourage : fonds disponibles (segmentation MediaPipe). `none` = vidéo brute.
const DETOURAGE = [
  { id: 'none', label: 'Aucun', icon: '⦸' },
  { id: 'blur', label: 'Flou', icon: '🫧' },
  { id: 'immersive', label: 'Immersif', icon: '✨' },
  { id: 'nature', label: 'Nature', icon: '🌿' },
  { id: 'office', label: 'Bureau', icon: '🏢' },
  { id: 'library', label: 'Biblio', icon: '📚' },
];

export interface WaitingRoomProps {
  clinicName: string | null;
  clinicLogo: string | null;
  practitionerName?: string | null;
  patientName?: string | null;
  scheduledAt?: string | null;
  agendaReason?: string | null;
  agendaNotes?: string | null;
  joinCam: boolean;
  joinMic: boolean;
  onToggleCam: () => void;
  onToggleMic: () => void;
}

function pad(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

export default function WaitingRoom({
  clinicName,
  clinicLogo,
  practitionerName,
  patientName,
  scheduledAt,
  agendaReason,
  agendaNotes,
  joinCam,
  joinMic,
  onToggleCam,
  onToggleMic,
}: WaitingRoomProps) {
  // ── Compte à rebours ────────────────────────────────────────────────────────
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const target = scheduledAt ? new Date(scheduledAt).getTime() : null;
  const remaining = target != null && Number.isFinite(target) ? target - now : null;
  const beforeTime = remaining != null && remaining > 0;
  let countdownLabel = "d'un instant à l'autre";
  if (beforeTime && remaining != null) {
    const totalSec = Math.floor(remaining / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    countdownLabel = h > 0 ? `${h} h ${pad(m)} min` : `${pad(m)}:${pad(s)}`;
  }
  const scheduledLabel = (() => {
    if (target == null || !Number.isFinite(target)) return null;
    try {
      return new Date(target).toLocaleString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return null;
    }
  })();

  // ── Musique d'attente ───────────────────────────────────────────────────────
  const ambient = useAmbientAudio({ initialPresetId: 'lo-fi', initialVolume: 24 });

  // ── Studio caméra : périphériques + détourage + maquillage ──────────────────
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [previewOn, setPreviewOn] = useState(false);
  const [camId, setCamId] = useState<string>('');
  const [micId, setMicId] = useState<string>('');
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [detourage, setDetourage] = useState<string>('none');
  const [beauty, setBeauty] = useState<boolean>(false);

  // Acquisition caméra (périphérique choisi) → vidéo cachée qui alimente
  // l'aperçu et la segmentation. Ré-acquise quand la caméra change.
  useEffect(() => {
    if (!joinCam) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setPreviewOn(false);
      return undefined;
    }
    let alive = true;
    const constraints: MediaStreamConstraints = {
      video: camId ? { deviceId: { exact: camId } } : true,
      audio: false,
    };
    navigator.mediaDevices?.getUserMedia?.(constraints)
      .then(async (stream) => {
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play?.().catch(() => {}); }
        setPreviewOn(true);
        try {
          const list = await navigator.mediaDevices.enumerateDevices();
          if (!alive) return;
          setCams(list.filter((d) => d.kind === 'videoinput'));
          setMics(list.filter((d) => d.kind === 'audioinput'));
        } catch { /* labels indispo */ }
      })
      .catch(() => { if (alive) setPreviewOn(false); });
    return () => { alive = false; };
  }, [joinCam, camId]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const segActive = joinCam && detourage !== 'none';
  // Détourage + maquillage sur l'aperçu (segmentation MediaPipe → canvas).
  useSegmentedVideo({ videoRef, canvasRef, blur: detourage === 'blur', beauty, vbg: detourage, active: segActive });

  const agendaItems = useMemo(
    () => [agendaReason, agendaNotes].filter((x): x is string => !!x && x.trim().length > 0),
    [agendaReason, agendaNotes],
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2147483000, background: BG, backgroundImage: PAGE_MESH, display: 'grid', placeItems: 'center', padding: 24, overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 820 }}>
        {/* En-tête de marque */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <img src="/lirilogo.png" alt="LIRI" style={{ height: 36, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 2px 10px rgba(212,163,106,0.4))' }} />
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '6px 13px 6px 8px', borderRadius: 999, background: PANEL_BG, border: PANEL_BORDER }}>
            {clinicLogo ? <img src={clinicLogo} alt="" style={{ height: 22, width: 'auto', maxWidth: 70, objectFit: 'contain', borderRadius: 5 }} /> : null}
            <span style={{ fontSize: 13, fontWeight: 600, color: '#f5f4ee' }}>{clinicName || 'Consultation'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {/* GAUCHE — studio green room */}
          <div style={{ flex: '1 1 360px', minWidth: 320, background: PANEL_BG, border: PANEL_BORDER, borderRadius: 18, padding: 16, boxShadow: '0 24px 64px rgba(0,0,0,0.45)' }}>
            <div style={{ aspectRatio: '4 / 3', borderRadius: 14, overflow: 'hidden', background: STAGE_BG, border: PANEL_BORDER, position: 'relative', marginBottom: 12 }}>
              {joinCam ? (
                <>
                  <video ref={videoRef} autoPlay muted playsInline
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', filter: beauty && !segActive ? BEAUTY_FILTER : 'none' }} />
                  {segActive ? (
                    <canvas ref={canvasRef}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                  ) : null}
                </>
              ) : null}
              {(!joinCam || !previewOn) ? (
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#9a978f' }}>
                  <div style={{ textAlign: 'center' }}>
                    <VideoOff size={26} aria-hidden="true" style={{ opacity: 0.7 }} />
                    <p style={{ margin: '6px 0 0', fontSize: 12 }}>{joinCam ? 'Activation de la caméra…' : 'Caméra désactivée'}</p>
                  </div>
                </div>
              ) : null}
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 10, display: 'flex', justifyContent: 'center', gap: 10, zIndex: 2 }}>
                <button type="button" onClick={onToggleMic} title={joinMic ? 'Couper le micro' : 'Activer le micro'} style={roundToggle(joinMic)}>
                  {joinMic ? <Mic size={17} aria-hidden="true" /> : <MicOff size={17} aria-hidden="true" />}
                </button>
                <button type="button" onClick={onToggleCam} title={joinCam ? 'Couper la caméra' : 'Activer la caméra'} style={roundToggle(joinCam)}>
                  {joinCam ? <Video size={17} aria-hidden="true" /> : <VideoOff size={17} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {/* Réglages studio */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Périphériques */}
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={studioLabel}><Camera size={12} aria-hidden="true" /> Caméra</span>
                  <select value={camId} onChange={(e) => setCamId(e.target.value)} style={studioSelect}>
                    <option value="">Par défaut</option>
                    {cams.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Caméra ${i + 1}`}</option>)}
                  </select>
                </label>
                <label style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={studioLabel}><Mic size={12} aria-hidden="true" /> Micro</span>
                  <select value={micId} onChange={(e) => setMicId(e.target.value)} style={studioSelect}>
                    <option value="">Par défaut</option>
                    {mics.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Micro ${i + 1}`}</option>)}
                  </select>
                </label>
              </div>

              {/* Détourage */}
              <div>
                <span style={{ ...studioLabel, marginBottom: 6, display: 'inline-flex' }}><Wand2 size={12} aria-hidden="true" /> Détourage / arrière-plan</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {DETOURAGE.map((d) => {
                    const active = detourage === d.id;
                    return (
                      <button key={d.id} type="button" onClick={() => setDetourage(d.id)} style={studioChip(active)}>
                        <span aria-hidden="true">{d.icon}</span> {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Maquillage */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ ...studioLabel, display: 'inline-flex' }}><Sparkles size={12} aria-hidden="true" /> Maquillage (retouche)</span>
                <button type="button" onClick={() => setBeauty((v) => !v)} aria-pressed={beauty} style={studioChip(beauty)}>
                  {beauty ? 'Activé' : 'Désactivé'}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 2, fontSize: 12.5, color: '#cbd5e1' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: GOLD, boxShadow: '0 0 0 4px rgba(212,163,106,0.18)' }} />
                {patientName ? `${patientName}, votre` : 'Votre'} praticien va vous rejoindre…
              </div>
            </div>
          </div>

          {/* DROITE — compte à rebours + agenda + musique */}
          <div style={{ flex: '1 1 300px', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: PANEL_BG, border: PANEL_BORDER, borderRadius: 16, padding: 16, textAlign: 'center' }}>
              <p style={{ margin: '0 0 6px', fontSize: 11.5, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', color: 'rgba(245,244,238,0.55)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Clock size={13} aria-hidden="true" /> {beforeTime ? 'La consultation commence dans' : 'Le praticien arrive'}
              </p>
              <div style={{ fontSize: 34, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#fff', lineHeight: 1.1 }}>{countdownLabel}</div>
              {scheduledLabel ? <p style={{ margin: '6px 0 0', fontSize: 12, color: 'rgba(245,244,238,0.5)' }}>Rendez-vous · {scheduledLabel}</p> : null}
            </div>

            <div style={{ background: PANEL_BG, border: PANEL_BORDER, borderRadius: 16, padding: 16 }}>
              <p style={{ margin: '0 0 8px', fontSize: 11.5, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', color: 'rgba(245,244,238,0.55)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <ListChecks size={13} aria-hidden="true" /> Au programme
              </p>
              {agendaItems.length > 0 ? (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {agendaItems.map((it, i) => (
                    <li key={i} style={{ display: 'flex', gap: 9, fontSize: 13.5, color: '#e8e6df', lineHeight: 1.45 }}>
                      <span style={{ color: GOLD, flexShrink: 0 }}>•</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: 'rgba(245,244,238,0.5)' }}>Le praticien précisera les points à aborder.</p>
              )}
            </div>

            <div style={{ background: PANEL_BG, border: PANEL_BORDER, borderRadius: 16, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <p style={{ margin: 0, fontSize: 11.5, fontWeight: 600, letterSpacing: 0.3, textTransform: 'uppercase', color: 'rgba(245,244,238,0.55)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Music2 size={13} aria-hidden="true" /> Musique d'attente
                </p>
                <button type="button" onClick={ambient.togglePlay} title={ambient.playing ? 'Pause' : 'Lecture'}
                  style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: ambient.playing ? GOLD : 'rgba(255,255,255,0.14)', color: ambient.playing ? '#1a1a1a' : '#fff' }}>
                  {ambient.playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ambient.presets.filter((p) => p.id !== 'none').map((p) => {
                  const active = ambient.presetId === p.id;
                  return (
                    <button key={p.id} type="button"
                      onClick={() => { ambient.selectPreset(p.id); if (!ambient.playing) ambient.play(); }}
                      style={studioChip(active)}>
                      <span aria-hidden="true">{p.icon}</span> {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <p style={{ margin: '16px 0 0', textAlign: 'center', fontSize: 11.5, color: 'rgba(245,244,238,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <ShieldCheck size={13} aria-hidden="true" /> Liaison sécurisée · propulsé par LIRI
        </p>
      </div>
    </div>
  );
}

const studioLabel: CSSProperties = {
  fontSize: 10.5, fontWeight: 600, letterSpacing: 0.2, textTransform: 'uppercase',
  color: 'rgba(245,244,238,0.5)', alignItems: 'center', gap: 5,
};
const studioSelect: CSSProperties = {
  width: '100%', padding: '7px 9px', borderRadius: 9, fontSize: 12,
  background: 'rgba(255,255,255,0.05)', color: '#e8e6df',
  border: '1px solid rgba(245,244,238,0.12)', cursor: 'pointer',
};
function studioChip(active: boolean): CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 999,
    cursor: 'pointer', fontSize: 12, fontWeight: 600,
    border: active ? `1px solid ${GOLD}` : '1px solid rgba(245,244,238,0.12)',
    background: active ? 'rgba(212,163,106,0.16)' : 'rgba(255,255,255,0.04)',
    color: active ? '#f3e6d4' : '#cbd5e1',
  };
}

function roundToggle(active: boolean): CSSProperties {
  return {
    width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: active ? 'rgba(255,255,255,0.18)' : '#b1372f',
    color: '#fff', WebkitBackdropFilter: 'blur(6px)', backdropFilter: 'blur(6px)',
  };
}
