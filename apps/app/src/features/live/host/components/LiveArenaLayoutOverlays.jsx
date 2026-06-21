import React from 'react';
import { Track } from 'livekit-client';
import LiveHostVideoCell from '@/components/liri/live-room/LiveHostVideoCell';
import ConferenceStage from '@/features/live/host/components/ConferenceStage';
import {
  ARENA_LAYOUT,
  ARENA_MEMBERS_WALL_MAX_VISIBLE,
  ARENA_PANEL_MAX_SLOTS,
} from '@/lib/liriArenaLayout';

const OVERLAY_CONTAINER_STYLE = {
  position: 'absolute',
  inset: 0,
  zIndex: 15,
  background: '#0a0b0f',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

/**
 * Overlays arène centrale lorsque le mode `ARENA_LAYOUT` ≠ SmartBoard :
 * - hostCameraCenter : caméra hôte plein cadre (HOST_CAMERA / DUO).
 * - guestFocusCenter : caméra de l'élève promu plein cadre.
 * - panelCenter     : grille 2×2 des participants au panel.
 * - membersWallCenter : mur de tous les participants.
 *
 * Retourne `null` si aucun mode n'est actif (laisser passer le SmartBoard).
 */
export const LiveArenaLayoutOverlays = ({
  arenaHostCameraCenter,
  arenaGuestFocusCenter,
  arenaPanelCenter,
  arenaMembersWallCenter,
  arenaLayoutMode,
  hostId,
  openLongiaHubCoachPanel,
  setMemberVideoPreview,
  isGuestUi,
  hostLiveKitParticipant,
  livekitParticipantsMap,
  cameraOn,
  liveKitMediaEpoch,
  arenaGuestFocusUserId,
  promotedId,
  liveParticipants,
  arenaPanelUserIds,
}) => {
  if (arenaHostCameraCenter) {
    const primary = isGuestUi ? hostLiveKitParticipant : livekitParticipantsMap['local'];
    const showVid = isGuestUi
      ? primary && Array.from(primary.videoTrackPublications?.values?.() || []).some((p) => p.source === Track.Source.Camera && !p.isMuted && p.track)
      : primary && cameraOn;
    return (
      <div style={OVERLAY_CONTAINER_STYLE}>
        {showVid && primary ? (
          <LiveHostVideoCell
            participant={primary}
            mediaEpoch={liveKitMediaEpoch}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '24px' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'radial-gradient(circle at 38% 32%,#d4a870,#8b5e3c 50%,#5c3a1e)', border: '2px solid rgba(255,255,255,.12)' }} />
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,.45)', textAlign: 'center' }}>
              {isGuestUi ? 'Caméra du formateur indisponible' : 'Activez la caméra pour le mode Formateur'}
            </span>
          </div>
        )}
      </div>
    );
  }

  if (arenaGuestFocusCenter) {
    const fid = isGuestUi ? arenaGuestFocusUserId : promotedId;
    const lk =
      (fid && livekitParticipantsMap[fid])
      || (fid && livekitParticipantsMap[String(fid)])
      || null;
    const focusName =
      liveParticipants.find((m) => String(m.id) === String(fid))?.name
      || lk?.name
      || 'Participant';
    const showVid =
      lk
      && Array.from(lk.videoTrackPublications?.values?.() || []).some(
        (p) => p.source === Track.Source.Camera && !p.isMuted && p.track,
      );
    return (
      <div style={OVERLAY_CONTAINER_STYLE}>
        {showVid && lk ? (
          <LiveHostVideoCell
            participant={lk}
            mediaEpoch={liveKitMediaEpoch}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '24px' }}>
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg,#6d28d9,#4c1d95)',
                border: '2px solid rgba(255,255,255,.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                fontWeight: 800,
                color: '#e9d5ff',
              }}
            >
              {(focusName || '?').substring(0, 2).toUpperCase()}
            </div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,.78)', textAlign: 'center' }}>{focusName}</span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,.38)', textAlign: 'center' }}>
              Vidéo indisponible ou caméra coupée
            </span>
          </div>
        )}
      </div>
    );
  }

  if (arenaPanelCenter) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 15,
          background: '#0a0b0f',
          padding: '8px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: '8px',
          minHeight: 0,
          boxSizing: 'border-box',
        }}
      >
        {Array.from({ length: ARENA_PANEL_MAX_SLOTS }).map((_, i) => {
          const pid = arenaPanelUserIds[i] ?? null;
          if (!pid) {
            return (
              <div
                key={`panel-empty-${i}`}
                style={{
                  borderRadius: '8px',
                  border: '1px dashed rgba(255,255,255,.12)',
                  background: 'rgba(255,255,255,.03)',
                  minHeight: 0,
                }}
              />
            );
          }
          const lk =
            livekitParticipantsMap[pid] || livekitParticipantsMap[String(pid)] || null;
          const cellName =
            liveParticipants.find((m) => String(m.id) === String(pid))?.name
            || lk?.name
            || 'Participant';
          const showVid =
            lk
            && Array.from(lk.videoTrackPublications?.values?.() || []).some(
              (p) => p.source === Track.Source.Camera && !p.isMuted && p.track,
            );
          return (
            <div
              key={pid}
              style={{
                position: 'relative',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,.1)',
                background: 'rgba(0,0,0,.4)',
                minHeight: 0,
              }}
            >
              {showVid && lk ? (
                <LiveHostVideoCell
                  participant={lk}
                  mediaEpoch={liveKitMediaEpoch}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px',
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg,#4c1d95,#312e81)',
                      border: '1px solid rgba(255,255,255,.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 800,
                      color: '#c4b5fd',
                    }}
                  >
                    {(cellName || '?').substring(0, 2).toUpperCase()}
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: 'rgba(255,255,255,.65)',
                      textAlign: 'center',
                      lineHeight: 1.3,
                    }}
                  >
                    {cellName}
                  </span>
                </div>
              )}
              <div
                style={{
                  position: 'absolute',
                  left: '6px',
                  bottom: '5px',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: 'rgba(255,255,255,.85)',
                  textShadow: '0 1px 4px rgba(0,0,0,.9)',
                  maxWidth: '90%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {cellName}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (arenaMembersWallCenter) {
    // Mode CONFÉRENCE : scène type Meet (grille adaptative + densité réglable, vue orateur,
    // auto-suivi de qui parle). Le « Mur » dense reste en dessous.
    if (arenaLayoutMode === ARENA_LAYOUT.CONFERENCE) {
      return (
        <ConferenceStage
          liveParticipants={liveParticipants}
          livekitParticipantsMap={livekitParticipantsMap}
          liveKitMediaEpoch={liveKitMediaEpoch}
          hostId={hostId}
          onOpenLongia={openLongiaHubCoachPanel}
          onMemberPreview={setMemberVideoPreview}
        />
      );
    }
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 15,
          background: '#0a0b0f',
          padding: '8px',
          overflow: 'auto',
          boxSizing: 'border-box',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))',
          gap: '8px',
          alignContent: 'start',
        }}
      >
        {liveParticipants.length === 0 ? (
          <div
            style={{
              gridColumn: '1 / -1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '120px',
              fontSize: '12px',
              color: 'rgba(255,255,255,.4)',
            }}
          >
            Aucun participant à afficher pour le moment.
          </div>
        ) : (
          <>
            {liveParticipants.slice(0, ARENA_MEMBERS_WALL_MAX_VISIBLE).map((m) => {
              const lk =
                livekitParticipantsMap[m.id] || livekitParticipantsMap[String(m.id)] || null;
              const showVid =
                lk
                && Array.from(lk.videoTrackPublications?.values?.() || []).some(
                  (p) => p.source === Track.Source.Camera && !p.isMuted && p.track,
                );
              return (
                <div
                  key={m.id}
                  style={{
                    position: 'relative',
                    aspectRatio: '4 / 3',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,.08)',
                    background: 'rgba(0,0,0,.35)',
                  }}
                >
                  {showVid && lk ? (
                    <LiveHostVideoCell
                      participant={lk}
                      mediaEpoch={liveKitMediaEpoch}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: `${m.color}22`,
                      }}
                    >
                      <span style={{ fontSize: '18px', fontWeight: 800, color: m.color }}>
                        {m.init}
                      </span>
                    </div>
                  )}
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      padding: '4px 6px',
                      fontSize: '9px',
                      fontWeight: 700,
                      color: '#fff',
                      background: 'linear-gradient(transparent, rgba(0,0,0,.75))',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {m.name}
                  </div>
                </div>
              );
            })}
            {liveParticipants.length > ARENA_MEMBERS_WALL_MAX_VISIBLE ? (
              <div
                style={{
                  gridColumn: '1 / -1',
                  fontSize: '11px',
                  color: 'rgba(255,255,255,.45)',
                  padding: '4px 2px',
                }}
              >
                +{liveParticipants.length - ARENA_MEMBERS_WALL_MAX_VISIBLE} autre(s) connecté(s)
              </div>
            ) : null}
          </>
        )}
      </div>
    );
  }

  return null;
};
