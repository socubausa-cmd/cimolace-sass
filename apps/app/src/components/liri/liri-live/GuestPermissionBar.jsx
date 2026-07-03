import React, { useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { parseLiveSessionIdFromRouteParam } from '@/lib/liveSessionRouteId';
import PermissionGate from '@/components/liri/liri-live/PermissionGate';
import RequestAccessButton from '@/components/liri/liri-live/RequestAccessButton';
import { useLiriLivePermissionsContextOptional } from '@/components/liri/liri-live/LiriLivePermissionsContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { assertGuestLiveAction } from '@/lib/liriLive/assertGuestPermissionServer';
import JoyKitActiveBadge from '@/components/liri/liri-live/JoyKitActiveBadge';
import { useLiveDataSaver } from '@/hooks/useLiveDataSaver';

/**
 * Barre permissions invité (micro, médias, JoyKit, NeuronQ, demandes d'accès).
 * Deux sections pour respecter l'ordre du footer LiveHostPage (réglages / REC entre les blocs).
 *
 * @param {'media'|'joy'} props.section
 * @param {boolean} props.isGuestUi
 * @param {boolean} props.showJoyCluster — phase live + utilisateur connecté
 */
export default function GuestPermissionBar({
  section,
  isGuestUi,
  /** @type {import('@/lib/liriLive/joyKit').JoyKitGrant | null} */
  joyKitGrant = null,
  showJoyCluster,
  guestMicLocked,
  toggleMic,
  micOn,
  guestCamLocked,
  toggleCamera,
  cameraOn,
  guestHandRaiseLocked,
  myHandRaised,
  lowerHand,
  raiseHand,
  guestScreenShareLocked,
  toggleScreenShare,
  sharingScreen,
  debateViewerRole,
  addMeshRequest,
  debateNeuronqEnabled,
  neuronqSessionOn,
  guestNeuronqPanelOpen,
  setGuestNeuronqPanelOpen,
}) {
  const permCtx = useLiriLivePermissionsContextOptional();
  const { sessionId: sessionIdParam } = useParams();
  const sessionId = useMemo(
    () => parseLiveSessionIdFromRouteParam(sessionIdParam),
    [sessionIdParam],
  );
  const { user } = useAuth();
  const { dataSaver, toggleDataSaver } = useLiveDataSaver();

  const withGuestServerPermission = useCallback(
    async (action, fn) => {
      if (!sessionId || !user?.id) return;
      const ok = await assertGuestLiveAction(supabase, permCtx, {
        liveSessionId: sessionId,
        userId: user.id,
        action,
      });
      if (ok) fn();
    },
    [sessionId, user?.id, permCtx],
  );

  if (!isGuestUi) return null;

  if (section === 'media') {
    return (
      <>
        <PermissionGate action="canUseMic" forceDisabled={guestMicLocked}>
          <button
            type="button"
            onClick={() => {
              if (guestMicLocked) return;
              void withGuestServerPermission('canUseMic', toggleMic);
            }}
            title={guestMicLocked ? 'Micro désactivé par le formateur' : undefined}
            style={{
              borderRadius: '4px',
              border: `1px solid ${micOn ? 'rgba(251,191,36,.55)' : 'rgba(255,255,255,.1)'}`,
              background: micOn ? 'rgba(251,191,36,.16)' : 'rgba(255,255,255,.04)',
              padding: '9px',
              color: micOn ? '#fde68a' : 'rgba(255,255,255,.8)',
              display: 'flex',
              alignItems: 'center',
              cursor: guestMicLocked ? 'not-allowed' : 'pointer',
              opacity: guestMicLocked ? 0.45 : 1,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" /></svg>
          </button>
        </PermissionGate>
        <PermissionGate action="canUseCamera" forceDisabled={guestCamLocked}>
          <button
            type="button"
            onClick={() => {
              if (guestCamLocked) return;
              void withGuestServerPermission('canUseCamera', toggleCamera);
            }}
            title={guestCamLocked ? 'Caméra désactivée par le formateur' : (cameraOn ? 'Couper caméra' : 'Activer caméra')}
            style={{
              borderRadius: '4px',
              border: `1px solid ${cameraOn ? 'rgba(212,163,106,.5)' : 'rgba(255,255,255,.1)'}`,
              background: cameraOn ? 'rgba(168,118,58,.2)' : 'rgba(255,255,255,.04)',
              padding: '9px',
              color: cameraOn ? '#efe0c4' : 'rgba(255,255,255,.8)',
              display: 'flex',
              alignItems: 'center',
              cursor: guestCamLocked ? 'not-allowed' : 'pointer',
              opacity: guestCamLocked ? 0.45 : 1,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14M5 18h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z" /></svg>
          </button>
        </PermissionGate>
        <PermissionGate action="canUseSignals" forceDisabled={guestHandRaiseLocked}>
          <button
            type="button"
            onClick={() => {
              if (guestHandRaiseLocked) return;
              void withGuestServerPermission('canUseSignals', () => {
                if (myHandRaised) void lowerHand();
                else void raiseHand();
              });
            }}
            title={guestHandRaiseLocked ? 'Mains levées désactivées par le formateur' : (myHandRaised ? 'Baisser la main' : 'Lever la main')}
            style={{
              borderRadius: '4px',
              border: `1px solid ${myHandRaised ? 'rgba(251,191,36,.55)' : 'rgba(255,255,255,.1)'}`,
              background: myHandRaised ? 'rgba(251,191,36,.2)' : 'rgba(255,255,255,.04)',
              padding: '9px',
              color: myHandRaised ? '#fbbf24' : 'rgba(255,255,255,.8)',
              display: 'flex',
              alignItems: 'center',
              cursor: guestHandRaiseLocked ? 'not-allowed' : 'pointer',
              opacity: guestHandRaiseLocked ? 0.45 : 1,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M11 11.5V16a1 1 0 0 0 2 0v-4.5M7 11.5V15a1 1 0 0 0 2 0v-3.5M15 11.5V15a1 1 0 0 0 2 0v-3.5" /><path d="M7 11.5c0-2.5 1.5-4.5 5-4.5s5 2 5 4.5" strokeLinecap="round" /></svg>
          </button>
        </PermissionGate>
        <button
          type="button"
          onClick={() => { if (!guestScreenShareLocked) toggleScreenShare(); }}
          title={guestScreenShareLocked ? (debateViewerRole === 'viewer' ? 'Partage indisponible' : 'Partage désactivé') : (sharingScreen ? 'Arrêter partage' : 'Partager écran')}
          style={{
            borderRadius: '4px',
            border: `1px solid ${sharingScreen ? 'rgba(168,118,58,.5)' : 'rgba(255,255,255,.1)'}`,
            background: sharingScreen ? 'rgba(168,118,58,.18)' : 'rgba(255,255,255,.04)',
            padding: '9px',
            color: sharingScreen ? '#e3c79a' : 'rgba(255,255,255,.8)',
            display: 'flex',
            alignItems: 'center',
            cursor: guestScreenShareLocked ? 'not-allowed' : 'pointer',
            opacity: guestScreenShareLocked ? 0.45 : 1,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>
        </button>
        <button
          type="button"
          onClick={toggleDataSaver}
          title={dataSaver
            ? 'Mode éco data ACTIVÉ : caméras coupées (audio + partage d’écran gardés). Cliquer pour réafficher la vidéo.'
            : 'Mode éco data : coupe les caméras pour tenir en connexion faible (garde l’audio + le partage d’écran).'}
          style={{
            borderRadius: '4px',
            border: `1px solid ${dataSaver ? 'rgba(251,191,36,.55)' : 'rgba(255,255,255,.1)'}`,
            background: dataSaver ? 'rgba(251,191,36,.16)' : 'rgba(255,255,255,.04)',
            padding: '9px',
            color: dataSaver ? '#fde68a' : 'rgba(255,255,255,.8)',
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" /><path d="M2 21c0-3 1.85-5.36 5.08-6" /></svg>
        </button>
        {permCtx ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <RequestAccessButton action="canUseMic" size="sm" variant="outline" className="h-8 px-2 text-[9px] font-semibold whitespace-nowrap border-white/15 bg-white/5 text-white/85 hover:bg-white/10">
              Accès micro
            </RequestAccessButton>
            <RequestAccessButton action="canUseCamera" size="sm" variant="outline" className="h-8 px-2 text-[9px] font-semibold whitespace-nowrap border-white/15 bg-white/5 text-white/85 hover:bg-white/10">
              Accès caméra
            </RequestAccessButton>
            <RequestAccessButton action="canUseSignals" size="sm" variant="outline" className="h-8 px-2 text-[9px] font-semibold whitespace-nowrap border-white/15 bg-white/5 text-white/85 hover:bg-white/10">
              Signaux
            </RequestAccessButton>
          </div>
        ) : null}
      </>
    );
  }

  if (section === 'joy') {
    if (!showJoyCluster) return null;
    return (
      <>
        {joyKitGrant?.level ? <JoyKitActiveBadge grant={joyKitGrant} /> : null}
        <PermissionGate action="canUseJoyKit">
          <button type="button" onClick={() => { void withGuestServerPermission('canUseJoyKit', () => addMeshRequest('control')); }} title="Demander contrôle (Mesh)" style={{ borderRadius: '6px', border: '1px solid rgba(212,163,106,.4)', background: 'rgba(168,118,58,.14)', padding: '7px 8px', fontSize: '9px', fontWeight: 700, color: '#efe0c4', cursor: 'pointer', whiteSpace: 'nowrap' }}>Joy·Ctl</button>
        </PermissionGate>
        <PermissionGate action="canUseJoyKit">
          <button type="button" onClick={() => { void withGuestServerPermission('canUseJoyKit', () => addMeshRequest('joykit')); }} title="Demander JoyKit" style={{ borderRadius: '6px', border: '1px solid rgba(212,163,106,.35)', background: 'rgba(168,118,58,.12)', padding: '7px 8px', fontSize: '9px', fontWeight: 700, color: '#e3c79a', cursor: 'pointer', whiteSpace: 'nowrap' }}>JoyKit</button>
        </PermissionGate>
        <RequestAccessButton action="canUseJoyKit" size="sm" variant="outline" className="h-8 px-2 text-[9px] font-semibold whitespace-nowrap border-amber-400/35 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15">
          Demander accès JoyKit
        </RequestAccessButton>
        {debateNeuronqEnabled && neuronqSessionOn ? (
          <PermissionGate action="canUseNeuronQ">
            <button type="button" onClick={() => { void withGuestServerPermission('canUseNeuronQ', () => setGuestNeuronqPanelOpen((o) => !o)); }} title="NeuronQ" style={{ borderRadius: '6px', border: `1px solid ${guestNeuronqPanelOpen ? 'rgba(245,158,11,.55)' : 'rgba(245,158,11,.28)'}`, background: guestNeuronqPanelOpen ? 'rgba(245,158,11,.18)' : 'rgba(245,158,11,.08)', padding: '7px 10px', fontSize: '9px', fontWeight: 800, color: '#fcd34d', cursor: 'pointer', whiteSpace: 'nowrap' }}>NeuronQ</button>
          </PermissionGate>
        ) : null}
        {debateNeuronqEnabled && neuronqSessionOn ? (
          <RequestAccessButton action="canUseNeuronQ" size="sm" variant="outline" className="h-8 px-2 text-[9px] font-semibold whitespace-nowrap border-amber-400/35 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15">
            Demander accès NeuronQ
          </RequestAccessButton>
        ) : null}
      </>
    );
  }

  return null;
}
