import React from 'react';
import { MemberVideoModal } from '@/components/liri/live-room/MemberVideoModal';
import { ARENA_LAYOUT } from '@/lib/liriArenaLayout';

/**
 * Wrapper du `MemberVideoModal` ouvert depuis la fiche membre. Centralise les
 * branchements WhisperPickableMembers, kick / mute / camera proctoring et
 * promotion en scène centrale (host uniquement).
 */
export const LiveHostMemberVideoModalSlot = ({
  modal,
  setModal,
  roomRef,
  isGuestUi,
  promotedId,
  setPromotedId,
  setAntennaSoloMode,
  applyHostArenaLayoutMode,
  memberModalAllowSchoolLife,
  muteParticipant,
  kickParticipant,
  sessionCommFlags,
  broadcastHostCameraCommand,
  sessionId,
  user,
  whisperThreads,
  sendWhisper,
  toast,
  memberModalWhisperPickable,
  liveParticipants,
}) => {
  if (modal?.type !== 'member' || !modal.data) return null;
  return (
    <MemberVideoModal
      open
      onClose={() => setModal(null)}
      roomRef={roomRef}
      participant={{ id: modal.data.id, name: modal.data.name, isLocal: false }}
      isHost={!isGuestUi}
      isPromoted={!isGuestUi && promotedId != null && String(promotedId) === String(modal.data.id)}
      onPromoteToStage={
        !isGuestUi
          ? (pid) => {
              setAntennaSoloMode(false);
              setPromotedId(pid);
              applyHostArenaLayoutMode(ARENA_LAYOUT.GUEST_FOCUS, { guestUserId: pid });
            }
          : undefined
      }
      allowSchoolLifePreview={memberModalAllowSchoolLife}
      onHostMuteParticipant={!isGuestUi ? () => muteParticipant(modal.data) : undefined}
      onHostRemoveParticipant={!isGuestUi ? () => kickParticipant(modal.data) : undefined}
      hostRemoteCameraControl={
        !isGuestUi &&
        sessionCommFlags.proctoring_camera_consent_required === true &&
        sessionCommFlags.host_remote_camera_enabled === true
      }
      onHostRemoteCamera={
        !isGuestUi ? (enabled) => broadcastHostCameraCommand(modal.data.id, enabled) : undefined
      }
      whisperSessionKey={sessionId}
      currentUserId={user?.id ?? null}
      whisperMessages={whisperThreads[String(modal.data.id)] || []}
      onSendWhisper={(text) => {
        void (async () => {
          const r = await sendWhisper(String(modal.data.id), text);
          if (r && !r.ok && r.error) {
            toast({
              title: 'Message privé',
              description: String(r.error.message || r.error),
              variant: 'destructive',
            });
          }
        })();
      }}
      whisperPickableMembers={memberModalWhisperPickable}
      onPickWhisperMember={(p) => {
        const full = liveParticipants.find((x) => String(x.id) === String(p.id));
        if (full) {
          setModal({ type: 'member', data: full });
        } else if (p?.id) {
          setModal({
            type: 'member',
            data: {
              id: p.id,
              name: p.name || 'Membre',
              init: '?',
              color: '#a78bfa',
              status: 'online',
              grade: '',
              bio: '',
              avg: '—',
              att: '—',
              note: '',
            },
          });
        }
      }}
      viewport="viewport"
    />
  );
};

export default LiveHostMemberVideoModalSlot;
