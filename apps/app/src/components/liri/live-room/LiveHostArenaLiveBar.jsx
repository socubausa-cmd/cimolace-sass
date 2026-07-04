import React from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal, QrCode, Sparkles, Leaf, Layers, Sun, Maximize2, MessagesSquare, Link2, Check, ChevronDown } from 'lucide-react';
import { ARENA_LAYOUT } from '@/lib/liriArenaLayout';
import LiriProductBadge from '@/components/brand/LiriProductBadge';
import { buildSmartboardNavigatorScenes } from '@/lib/smartboardNavigatorScenes';
import { SmartboardNavigatorSceneIcon } from '@/components/liri/live-room/SmartboardNavigatorSceneIcon';
import GuestPermissionBar from '@/components/liri/liri-live/GuestPermissionBar';
import LiveHostFooterMessaging from '@/components/liri/live-room/LiveHostFooterMessaging';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { useLiveDataSaver } from '@/hooks/useLiveDataSaver';

const PHASE_LIVE = 'live';

const sep = (
  <div
    key="__sep__"
    style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,.08)', flexShrink: 0 }}
  />
);

/**
 * Même barre d'icônes que le pied du live (vues plateau, scènes, messagerie, étapes, etc.) —
 * réutilisée dans le tiroir LONGIA (APERÇUS RAPIDES / détail signaux).
 */
export default function LiveHostArenaLiveBar({
  /** `footer` = bandeau bas colonne centrale (plusieurs nœuds flex) · `hub` = bloc enroulé dans le tiroir. */
  variant = 'footer',
  isGuestUi,
  phase,
  /* --- invité (média) --- */
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
  /* --- hôte : vue plateau live --- */
  applyHostArenaLayoutMode,
  arenaLayoutMode,
  onOpenMobileCameraQr,
  openSettings,
  videoFxActive,
  recording,
  onStopRecording,
  onStartRecording,
  recStarting,
  sessionId,
  joyKitGrant,
  user,
  addMeshRequest,
  debateNeuronqEnabled,
  neuronqSessionOn,
  guestNeuronqPanelOpen,
  setGuestNeuronqPanelOpen,
  /* --- smartboard scènes --- */
  smartboardSceneFlags,
  sbActiveScene,
  smartboardStageRef,
  /* --- messagerie --- */
  onOpenMessagingPanel,
  guestFooterMessagingAllowed,
  /* --- étapes & suite --- */
  step,
  stepCount,
  gotoStep,
  formatTimer,
  liveDuration,
  freeTierRemainingSeconds,
  toggleProgressivePlayback,
  progressivePlayback,
  spotlightOn,
  setSpotlightOn,
  focusMode,
  setFocusMode,
  sessionFormationId,
  copyInviteLink,
  inviteCopied,
}) {
  const isLive = phase === PHASE_LIVE;
  const hub = variant === 'hub';
  const { dataSaver, toggleDataSaver } = useLiveDataSaver();

  const group1 = (
    <div
      key="g1"
      style={{ display: 'flex', alignItems: 'center', gap: hub ? 4 : 6, flexShrink: 0, flexWrap: hub ? 'wrap' : 'nowrap' }}
    >
      {isGuestUi ? (
        <GuestPermissionBar
          section="media"
          isGuestUi={isGuestUi}
          joyKitGrant={joyKitGrant}
          guestMicLocked={guestMicLocked}
          toggleMic={toggleMic}
          micOn={micOn}
          guestCamLocked={guestCamLocked}
          toggleCamera={toggleCamera}
          cameraOn={cameraOn}
          guestHandRaiseLocked={guestHandRaiseLocked}
          myHandRaised={myHandRaised}
          lowerHand={lowerHand}
          raiseHand={raiseHand}
          guestScreenShareLocked={guestScreenShareLocked}
          toggleScreenShare={toggleScreenShare}
          sharingScreen={sharingScreen}
          debateViewerRole={debateViewerRole}
        />
      ) : isLive ? (
        <>
          {/* Sélecteur de layout (caméra/panel/mur/conférence) : déplacé dans le hub LONGIA,
              retiré de la barre du bas pour un rendu immersif/épuré (façon maquette). */}
          {hub && (
          <>
          <button
            type="button"
            onClick={() => applyHostArenaLayoutMode(ARENA_LAYOUT.HOST_CAMERA)}
            title="Caméra formateur plein écran (présentation humaine)"
            className="lh-premium-btn"
            style={{
              borderRadius: '8px',
              border: `1px solid ${
                arenaLayoutMode === ARENA_LAYOUT.HOST_CAMERA ? 'rgba(251,191,36,.55)' : 'rgba(255,255,255,.12)'
              }`,
              background: arenaLayoutMode === ARENA_LAYOUT.HOST_CAMERA ? 'rgba(251,191,36,.2)' : 'rgba(0,0,0,.45)',
              padding: hub ? '4px 7px' : '6px 10px',
              fontSize: '10px',
              fontWeight: 700,
              color: arenaLayoutMode === ARENA_LAYOUT.HOST_CAMERA ? '#fbbf24' : 'rgba(255,255,255,.78)',
              cursor: 'pointer',
              letterSpacing: '.04em',
              flexShrink: 0,
            }}
          >
            Formateur
          </button>
          <button
            type="button"
            onClick={() => applyHostArenaLayoutMode(ARENA_LAYOUT.GUEST_FOCUS)}
            title="Invité à l'antenne en plein écran (interview, témoignage)"
            className="lh-premium-btn"
            style={{
              borderRadius: '8px',
              border: `1px solid ${
                arenaLayoutMode === ARENA_LAYOUT.GUEST_FOCUS ? 'rgba(212,163,106,.55)' : 'rgba(255,255,255,.12)'
              }`,
              background: arenaLayoutMode === ARENA_LAYOUT.GUEST_FOCUS ? 'rgba(168,118,58,.22)' : 'rgba(0,0,0,.45)',
              padding: hub ? '4px 7px' : '6px 10px',
              fontSize: '10px',
              fontWeight: 700,
              color: arenaLayoutMode === ARENA_LAYOUT.GUEST_FOCUS ? '#e3c79a' : 'rgba(255,255,255,.78)',
              cursor: 'pointer',
              letterSpacing: '.04em',
              flexShrink: 0,
            }}
          >
            Invité
          </button>
          <button
            type="button"
            onClick={() => applyHostArenaLayoutMode(ARENA_LAYOUT.SMARTBOARD)}
            title="SmartBoard plein écran"
            className="lh-premium-btn"
            style={{
              borderRadius: '8px',
              border: `1px solid ${
                arenaLayoutMode === ARENA_LAYOUT.SMARTBOARD ? 'rgba(248,152,56,.5)' : 'rgba(255,255,255,.12)'
              }`,
              background: arenaLayoutMode === ARENA_LAYOUT.SMARTBOARD ? 'rgba(248,152,56,.18)' : 'rgba(0,0,0,.45)',
              padding: hub ? '4px 7px' : '6px 10px',
              fontSize: '10px',
              fontWeight: 700,
              color: arenaLayoutMode === ARENA_LAYOUT.SMARTBOARD ? '#38bdf8' : 'rgba(255,255,255,.78)',
              cursor: 'pointer',
              letterSpacing: '.04em',
              flexShrink: 0,
            }}
          >
            SmartBoard
          </button>
          <button
            type="button"
            onClick={() => applyHostArenaLayoutMode(ARENA_LAYOUT.PANEL)}
            title="Table ronde : jusqu'à 4 participants (ordre du dock)"
            className="lh-premium-btn"
            style={{
              borderRadius: '8px',
              border: `1px solid ${
                arenaLayoutMode === ARENA_LAYOUT.PANEL ? 'rgba(191,118,45,.55)' : 'rgba(255,255,255,.12)'
              }`,
              background: arenaLayoutMode === ARENA_LAYOUT.PANEL ? 'rgba(136,74,13,.22)' : 'rgba(0,0,0,.45)',
              padding: hub ? '4px 7px' : '6px 10px',
              fontSize: '10px',
              fontWeight: 700,
              color: arenaLayoutMode === ARENA_LAYOUT.PANEL ? '#5eead4' : 'rgba(255,255,255,.78)',
              cursor: 'pointer',
              letterSpacing: '.04em',
              flexShrink: 0,
            }}
          >
            Panel
          </button>
          <button
            type="button"
            onClick={() => applyHostArenaLayoutMode(ARENA_LAYOUT.MEMBERS_WALL)}
            title="Mosaïque des participants connectés"
            className="lh-premium-btn"
            style={{
              borderRadius: '8px',
              border: `1px solid ${
                arenaLayoutMode === ARENA_LAYOUT.MEMBERS_WALL ? 'rgba(184,166,148,.5)' : 'rgba(255,255,255,.12)'
              }`,
              background: arenaLayoutMode === ARENA_LAYOUT.MEMBERS_WALL ? 'rgba(85,68,51,.35)' : 'rgba(0,0,0,.45)',
              padding: hub ? '4px 7px' : '6px 10px',
              fontSize: '10px',
              fontWeight: 700,
              color: arenaLayoutMode === ARENA_LAYOUT.MEMBERS_WALL ? '#e2e8f0' : 'rgba(255,255,255,.78)',
              cursor: 'pointer',
              letterSpacing: '.04em',
              flexShrink: 0,
            }}
          >
            Mur
          </button>
          <button
            type="button"
            onClick={() => applyHostArenaLayoutMode(ARENA_LAYOUT.CONFERENCE)}
            title="Mode conférence : grille type Meet (se voir), smartboard rétracté"
            className="lh-premium-btn"
            style={{
              borderRadius: '8px',
              border: `1px solid ${
                arenaLayoutMode === ARENA_LAYOUT.CONFERENCE ? 'rgba(212,163,106,.55)' : 'rgba(255,255,255,.12)'
              }`,
              background: arenaLayoutMode === ARENA_LAYOUT.CONFERENCE ? 'rgba(200,148,62,.22)' : 'rgba(0,0,0,.45)',
              padding: hub ? '4px 7px' : '6px 10px',
              fontSize: '10px',
              fontWeight: 700,
              color: arenaLayoutMode === ARENA_LAYOUT.CONFERENCE ? '#d4a36a' : 'rgba(255,255,255,.78)',
              cursor: 'pointer',
              letterSpacing: '.04em',
              flexShrink: 0,
            }}
          >
            Conférence
          </button>
          </>
          )}
          {/* Étiquette produit LIRI (Academy) — posée juste à côté du bouton « Formation »
              (relocalisée depuis le bandeau du haut, qui prenait trop de place). */}
          {!hub ? <LiriProductBadge product="academy" size="sm" style={{ flexShrink: 0 }} /> : null}
          {/* Mode d'affichage — menu déroulant (façon Zoom) : un seul bouton montrant le mode
              courant, qui déroule les modes Formation / Conférence / Débat. */}
          {!hub && (() => {
            const MODES = [
              { mode: ARENA_LAYOUT.SMARTBOARD, label: 'Formation', hint: 'SmartBoard / cours' },
              { mode: ARENA_LAYOUT.CONFERENCE, label: 'Conférence', hint: 'Grille type Meet + membres' },
              { mode: ARENA_LAYOUT.PANEL, label: 'Débat', hint: 'Panel des débatteurs' },
            ];
            const current = MODES.find((m) => m.mode === arenaLayoutMode) || MODES[0];
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    title="Choisir le mode d'affichage de la salle"
                    aria-label="Mode d'affichage"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      borderRadius: 8, border: '1px solid rgba(212,163,106,.4)',
                      background: 'rgba(200,148,62,.14)', color: '#d4a36a',
                      fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
                      padding: '6px 11px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                  >
                    <Layers size={13} aria-hidden />
                    {current.label}
                    <ChevronDown size={12} aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56 border-[rgba(212,163,106,0.28)] bg-[#171310]/97">
                  <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#e3c79a]/70">
                    Mode d'affichage
                  </DropdownMenuLabel>
                  {MODES.map((m) => {
                    const active = arenaLayoutMode === m.mode;
                    return (
                      <DropdownMenuItem
                        key={m.mode}
                        onSelect={() => applyHostArenaLayoutMode(m.mode)}
                        className={cn('flex flex-col items-start gap-0.5 text-[12px]', active && 'text-[var(--school-accent)]')}
                      >
                        <span className="flex w-full items-center">
                          {m.label}
                          {active ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
                        </span>
                        <span className="text-[10px] text-white/40">{m.hint}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })()}
        </>
      ) : (
        <>
          <button
            onClick={() => toggleMic()}
            title="Micro"
            style={{
              borderRadius: '4px',
              border: `1px solid ${micOn ? 'rgba(200,148,62,.4)' : 'rgba(255,255,255,.1)'}`,
              background: micOn ? 'rgba(200,148,62,.14)' : 'rgba(255,255,255,.04)',
              padding: '9px',
              color: micOn ? '#c8943e' : 'rgba(255,255,255,.8)',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </button>
          <button
            onClick={() => toggleCamera()}
            title={cameraOn ? 'Couper caméra' : 'Activer caméra'}
            style={{
              borderRadius: '4px',
              border: `1px solid ${cameraOn ? 'rgba(200,148,62,.4)' : 'rgba(255,255,255,.1)'}`,
              background: cameraOn ? 'rgba(200,148,62,.14)' : 'rgba(255,255,255,.04)',
              padding: '9px',
              color: cameraOn ? '#c8943e' : 'rgba(255,255,255,.8)',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.618v6.764a1 1 0 0 1-1.447.894L15 14M5 18h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => toggleScreenShare()}
            title={sharingScreen ? 'Arrêter partage' : 'Partager écran'}
            style={{
              borderRadius: '4px',
              border: `1px solid ${sharingScreen ? 'rgba(168,118,58,.5)' : 'rgba(255,255,255,.1)'}`,
              background: sharingScreen ? 'rgba(168,118,58,.18)' : 'rgba(255,255,255,.04)',
              padding: '9px',
              color: sharingScreen ? '#e3c79a' : 'rgba(255,255,255,.8)',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </button>
        </>
      )}
      <button
        type="button"
        data-testid={!isGuestUi ? 'live-host-open-studio-settings' : undefined}
        onClick={openSettings}
        title={isGuestUi ? 'Paramètres — micro, caméra, périphériques' : 'Paramètres studio — vidéo & salle virtuelle, moteur audio, ambiance, salle & IA'}
        style={{
          borderRadius: '6px',
          border: `1px solid ${videoFxActive ? 'rgba(251,191,36,.5)' : 'rgba(255,255,255,.12)'}`,
          background: videoFxActive
            ? 'rgba(251,191,36,.16)'
            : 'linear-gradient(165deg,rgba(32,27,22,.55),rgba(25,17,10,.75))',
          padding: '9px 12px',
          minWidth: '40px',
          color: videoFxActive ? '#fbbf24' : 'rgba(255,255,255,.82)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: videoFxActive ? '0 0 14px rgba(251,191,36,.2)' : 'inset 0 1px 0 rgba(255,255,255,.06)',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path
            d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {!isGuestUi
        ? recording
          ? (
            <button
              type="button"
              onClick={onStopRecording}
              title="Arrêter l'enregistrement"
              style={{
                borderRadius: '4px',
                border: '1px solid rgba(239,68,68,.5)',
                background: 'rgba(239,68,68,.15)',
                padding: '7px 9px',
                color: '#ef4444',
                fontSize: '11px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                animation: 'lhPulse 1.5s infinite',
                flexShrink: 0,
              }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
              REC
            </button>
          )
          : (
            <button
              type="button"
              onClick={onStartRecording}
              disabled={recStarting}
              title="Démarrer l'enregistrement"
              style={{
                borderRadius: '4px',
                border: '1px solid rgba(255,255,255,.1)',
                background: 'rgba(255,255,255,.04)',
                padding: '7px 9px',
                color: recStarting ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.8)',
                fontSize: '11px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: recStarting ? 'default' : 'pointer',
                flexShrink: 0,
              }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'rgba(255,255,255,.4)', flexShrink: 0 }} />
              REC
            </button>
            )
        : null}
      <GuestPermissionBar
        section="joy"
        isGuestUi={isGuestUi}
        joyKitGrant={joyKitGrant}
        showJoyCluster={isLive && Boolean(user?.id)}
        addMeshRequest={addMeshRequest}
        debateNeuronqEnabled={debateNeuronqEnabled}
        neuronqSessionOn={neuronqSessionOn}
        guestNeuronqPanelOpen={guestNeuronqPanelOpen}
        setGuestNeuronqPanelOpen={setGuestNeuronqPanelOpen}
      />
    </div>
  );

  const scenesDock = !isGuestUi ? (
    <div
      key="scenes"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        flexShrink: 0,
        background: 'rgba(168,118,58,.08)',
        border: '1px solid rgba(212,163,106,.2)',
        borderRadius: '12px',
        padding: hub ? '3px 4px' : '4px 6px',
        position: 'relative',
        flexWrap: hub ? 'wrap' : 'nowrap',
        maxWidth: '100%',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '-9px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '8px',
          fontWeight: 700,
          letterSpacing: '.08em',
          color: 'rgba(212,163,106,.7)',
          background: '#1a1816',
          padding: '0 5px',
          whiteSpace: 'nowrap',
          textTransform: 'uppercase',
        }}
      >
        Scènes
      </span>
      {buildSmartboardNavigatorScenes({ flags: smartboardSceneFlags }).map((scene) => {
        const isActive = sbActiveScene === scene.id;
        return (
          <button
            key={scene.id}
            type="button"
            title={`${scene.label}${scene.hint ? ` — ${scene.hint}` : ''}`}
            onClick={() => smartboardStageRef.current?.changeScene?.(scene.id)}
            className="lh-scene-btn"
            data-active={isActive ? 'true' : undefined}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: hub ? '28px' : '32px',
              height: hub ? '28px' : '32px',
              borderRadius: '8px',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <SmartboardNavigatorSceneIcon sceneId={scene.id} className="w-4 h-4" strokeWidth={1.4} />
            {isActive && (
              <span
                style={{
                  position: 'absolute',
                  bottom: '2px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '10px',
                  height: '2px',
                  borderRadius: '2px',
                  background: 'rgba(212,163,106,.9)',
                  boxShadow: '0 0 5px rgba(212,163,106,.7)',
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  ) : null;

  const messaging = (
    <div key="msg" style={{ flexShrink: 0 }}>
      <LiveHostFooterMessaging
        onOpenPanel={onOpenMessagingPanel}
        disabled={!user?.id || phase !== PHASE_LIVE || (isGuestUi && !guestFooterMessagingAllowed)}
      />
    </div>
  );

  const hostRight = !isGuestUi
    ? (
      <>
        {sep}
        <div
          key="g4"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: hub ? 4 : 5,
            flexShrink: 0,
            flexWrap: hub ? 'wrap' : 'nowrap',
          }}
        >
          <button
            type="button"
            onClick={() => step > 0 && gotoStep(step - 1)}
            style={{
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,.08)',
              background: 'rgba(255,255,255,.03)',
              padding: '5px 8px',
              fontSize: '15px',
              color: 'rgba(255,255,255,.6)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ‹
          </button>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: '44px',
              gap: '1px',
              flexShrink: 0,
            }}
          >
            <div
              style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '.08em', color: '#fff', whiteSpace: 'nowrap' }}
            >
              {micOn
                ? formatTimer()
                : `${step + 1 < 10 ? '0' : ''}${step + 1}/${stepCount < 10 ? '0' : ''}${stepCount}`}
            </div>
            {typeof freeTierRemainingSeconds === 'number'
              ? (
                <div
                  title="Forfait gratuit : lives limités à 3 min. Passez à un forfait LIRI pour des lives illimités."
                  style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '.04em', color: freeTierRemainingSeconds <= 30 ? '#f87171' : '#fbbf24' }}
                >
                  Gratuit · {Math.floor(freeTierRemainingSeconds / 60)}:{String(freeTierRemainingSeconds % 60).padStart(2, '0')}
                </div>
                )
              : liveDuration
                ? (
                  <div style={{ fontSize: '8px', color: 'rgba(255,255,255,.35)', letterSpacing: '.06em' }}>
                    {liveDuration}
                  </div>
                  )
                : null}
          </div>
          <button
            type="button"
            onClick={() => step < stepCount - 1 && gotoStep(step + 1)}
            style={{
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,.08)',
              background: 'rgba(255,255,255,.03)',
              padding: '5px 8px',
              fontSize: '15px',
              color: 'rgba(255,255,255,.6)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ›
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Plus d'outils du live (éco data, spotlight, focus, forum, inviter…)"
                aria-label="Plus d'outils"
                style={{
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,.12)',
                  background: 'rgba(255,255,255,.04)',
                  padding: '6px 11px',
                  color: 'rgba(255,255,255,.82)',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <MoreHorizontal size={15} aria-hidden />
                Outils
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="end"
              className="w-60 border-[rgba(212,163,106,0.28)] bg-[#171310]/97"
            >
              <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#e3c79a]/70">
                Outils du live
              </DropdownMenuLabel>
              <DropdownMenuItem onSelect={onOpenMobileCameraQr} className="gap-2 text-[12px]">
                <QrCode className="h-4 w-4 text-[#e3c79a]" /> Caméra mobile (QR)
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => sessionId && void supabase.functions.invoke('neuro-recall-bootstrap', { body: { sessionId } }).catch(() => {})}
                className="gap-2 text-[12px]"
              >
                <Sparkles className="h-4 w-4 text-[#e3c79a]" /> Neuro Recall (IA)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => { e.preventDefault(); toggleDataSaver(); }}
                className={cn('gap-2 text-[12px]', dataSaver && 'text-[var(--school-accent)]')}
              >
                <Leaf className="h-4 w-4" /> Mode éco data
                {dataSaver ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => { e.preventDefault(); toggleProgressivePlayback(); }}
                className={cn('gap-2 text-[12px]', progressivePlayback && 'text-[var(--school-accent)]')}
              >
                <Layers className="h-4 w-4" /> Révélation progressive
                {progressivePlayback ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => { e.preventDefault(); setSpotlightOn((v) => !v); }}
                className={cn('gap-2 text-[12px]', spotlightOn && 'text-[var(--school-accent)]')}
              >
                <Sun className="h-4 w-4" /> Spotlight
                {spotlightOn ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(e) => { e.preventDefault(); setFocusMode((v) => !v); }}
                className={cn('gap-2 text-[12px]', focusMode && 'text-[var(--school-accent)]')}
              >
                <Maximize2 className="h-4 w-4" /> Focus tableau plein écran
                {focusMode ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
              </DropdownMenuItem>
              {sessionFormationId ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="gap-2 text-[12px]">
                    <Link to={`/formation/${sessionFormationId}/forum`} target="_blank" rel="noopener noreferrer">
                      <MessagesSquare className="h-4 w-4 text-[#e3c79a]" /> Forum formation
                    </Link>
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => copyInviteLink?.()}
                className={cn('gap-2 text-[12px]', inviteCopied && 'text-emerald-300')}
              >
                {inviteCopied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4 text-[#e3c79a]" />}
                {inviteCopied ? 'Lien copié' : 'Inviter (copier le lien)'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </>
    )
    : (
      <div
        key="guestStep"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px', gap: '2px', flexShrink: 0 }}
      >
        <div
          style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '.06em', color: 'rgba(255,255,255,.85)', whiteSpace: 'nowrap' }}
        >
          Étape {step + 1}/{stepCount}
        </div>
        {liveDuration
          ? (
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,.35)', letterSpacing: '.06em' }}>{liveDuration}</div>
            )
          : null}
        {sessionFormationId
          ? (
            <Link
              to={`/formation/${sessionFormationId}/forum`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '9px', fontWeight: 700, color: '#e3c79a', textDecoration: 'underline', textUnderlineOffset: '2px' }}
            >
              Forum
            </Link>
            )
          : null}
      </div>
    );

  if (hub) {
    return (
      <div
        className="live-host-arena-bar--hub"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {group1}
        {scenesDock}
        {sep}
        {messaging}
        {hostRight}
      </div>
    );
  }

  return (
    <>
      {group1}
      {scenesDock}
      {sep}
      {messaging}
      {hostRight}
    </>
  );
}
