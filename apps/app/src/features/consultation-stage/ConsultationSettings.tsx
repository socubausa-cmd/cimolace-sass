// ─────────────────────────────────────────────────────────────────────────────
// RÉGLAGES — Salle de téléconsultation MEDOS (mode Consultation LIRI).
//
// Panneau de paramétrage des périphériques pour la salle de consultation :
//   • Caméra      (videoinput)
//   • Microphone  (audioinput)
//   • Haut-parleur (audiooutput)   ← bascule du SinkId quand le navigateur le permet.
//
// IMPORTANT — ce composant DOIT être monté À L'INTÉRIEUR de <LiveKitRoom> (comme
// la barre de contrôle de ConsultationRoom). Il s'appuie sur le contexte de la
// salle via le hook `useMediaDeviceSelect` (@livekit/components-react), qui :
//   - énumère les périphériques (labels peuplés car la salle a déjà la permission
//     micro/caméra : LiveKitRoom est monté avec `audio video`),
//   - expose le périphérique actif,
//   - et applique le changement DIRECTEMENT sur la salle LiveKit
//     (room.switchActiveDevice sous le capot — rien à câbler côté appelant).
//
// Présentation : popover sombre en inline-style, calé sur les conventions de
// ConsultationRoom (fond BAR, accent GOLD '#b08d57', icônes lucide-react). Les
// LIGNES de sélection réutilisent le composant studio partagé `StudioDevicePicker`
// (2 sources → interrupteur segmenté ; sinon liste). Un emplacement `children`
// (slot « Fond sonore ») est laissé pour brancher l'AmbientAudioEngine.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { useMediaDeviceSelect } from '@livekit/components-react';
import { Settings, Camera, Mic, Volume2, X, Music } from 'lucide-react';
import { StudioDevicePicker } from '@/components/liri/live-room/StudioDevicePicker';

const GOLD = '#b08d57';
const PANEL_BG = 'rgba(18,18,20,0.98)';

// ── Bouton déclencheur (à poser dans la barre de contrôle) ───────────────────
// Réutilise le langage visuel des boutons de ConsultationBar (pilule sombre,
// état actif = fond GOLD). Optionnel : on peut aussi piloter l'ouverture depuis
// le parent et n'afficher que <ConsultationSettings />.
export function ConsultationSettingsButton({
  open,
  onToggle,
  label = 'Réglages',
}: {
  open: boolean;
  onToggle: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={open}
      aria-label="Réglages des périphériques"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        borderRadius: 9,
        border: 'none',
        cursor: 'pointer',
        background: open ? GOLD : 'rgba(255,255,255,0.1)',
        color: open ? '#1a1a1a' : '#fff',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <Settings size={15} aria-hidden="true" /> {label}
    </button>
  );
}

// ── Une section « périphérique » (titre + sélecteur studio) ──────────────────
function DeviceSection({
  kind,
  title,
  icon: Icon,
  kindFr,
  emptyMessage,
  switchHintTwo,
  switchHintMany,
}: {
  kind: MediaDeviceKind;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  kindFr: string;
  emptyMessage: string;
  switchHintTwo: string;
  switchHintMany: string;
}) {
  // `useMediaDeviceSelect` lit la salle depuis le contexte (<LiveKitRoom>) et
  // applique le changement sur la salle. `requestPermissions` reste à false :
  // la salle de consultation publie déjà micro+caméra, la permission est donc
  // acquise et les labels sont peuplés sans re-déclencher de prompt.
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <Icon className="" />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#e5e7eb' }}>{title}</span>
      </div>
      <StudioDevicePicker
        devices={devices}
        activeId={activeDeviceId}
        onPick={(id: string) => {
          // Best-effort : un haut-parleur non commutable (Safari/Firefox) rejette
          // — on avale l'erreur, l'UI reste cohérente (sélecteur inchangé).
          void setActiveMediaDevice(id).catch(() => {});
        }}
        icon={Icon}
        kindFr={kindFr}
        emptyMessage={emptyMessage}
        switchHintTwo={switchHintTwo}
        switchHintMany={switchHintMany}
      />
    </div>
  );
}

// ── Panneau RÉGLAGES (popover) ───────────────────────────────────────────────
// `open=false` → rien (les sections, donc l'énumération, ne montent pas).
// `children` = emplacement « Fond sonore » : l'intégration y branche les
// contrôles de l'AmbientAudioEngine (presets, volume, lecture/pause…).
//
// Deux façons de brancher le fond sonore :
//   1) Laisser `showAmbientSection` à true et passer un contrôle inline en
//      `children` (p.ex. piloté par `useAmbientAudio()` du module frère).
//   2) Mettre `showAmbientSection={false}` et monter <AmbientAudioEngine/> en
//      pastille flottante autonome (il gère son propre positionnement fixe).
export default function ConsultationSettings({
  open,
  onClose,
  children,
  ambientLabel = 'Fond sonore',
  showAmbientSection = true,
}: {
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  ambientLabel?: string;
  showAmbientSection?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Fermeture au clic extérieur + touche Échap (confort, non bloquant).
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Réglages de la consultation"
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 10px)',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(94vw, 380px)',
        maxHeight: 'min(70vh, 560px)',
        overflowY: 'auto',
        background: PANEL_BG,
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 16,
        boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
        zIndex: 2147483500,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Settings size={17} color={GOLD} aria-hidden="true" />
        <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>Réglages</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer les réglages"
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: 'none',
            color: '#9ca3af',
            cursor: 'pointer',
            display: 'inline-flex',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Périphériques */}
      <DeviceSection
        kind="videoinput"
        title="Caméra"
        icon={Camera}
        kindFr="Caméra"
        emptyMessage="Aucune caméra détectée. Autorisez l'accès caméra dans le navigateur."
        switchHintTwo="Basculer entre les deux caméras"
        switchHintMany="Choisir une caméra"
      />
      <DeviceSection
        kind="audioinput"
        title="Microphone"
        icon={Mic}
        kindFr="Micro"
        emptyMessage="Aucun micro détecté. Vérifiez les permissions du navigateur."
        switchHintTwo="Basculer entre les deux micros"
        switchHintMany="Choisir un micro"
      />
      <DeviceSection
        kind="audiooutput"
        title="Haut-parleur"
        icon={Volume2}
        kindFr="Sortie"
        emptyMessage="Sortie audio non commutable sur ce navigateur (le système gère le haut-parleur)."
        switchHintTwo="Basculer entre les deux sorties"
        switchHintMany="Choisir une sortie audio"
      />

      {/* Emplacement « Fond sonore » — l'intégration y branche AmbientAudioEngine.
          Masquable via showAmbientSection={false} si l'ambiance est montée en
          pastille flottante autonome à côté de la salle. */}
      {showAmbientSection ? (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Music size={15} color={GOLD} aria-hidden="true" />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#e5e7eb' }}>{ambientLabel}</span>
          </div>
          {children ?? (
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
              Aucune ambiance disponible pour l'instant.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
