import React, { useMemo } from 'react';
import LiveHostMessagingPanel from '@/components/liri/live-room/LiveHostMessagingPanel';
import LiveMemberVideoPreviewModal from '@/components/liri/live-room/LiveMemberVideoPreviewModal';
import { LIVE_STRIP_DOCK_MIN_MEMBER_SLOTS } from '@/lib/liveCommLayers';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Slot wrap autour de `LiveHostMessagingPanel` (drawer messages forum/whisper)
 * et de `LiveMemberVideoPreviewModal` (preview vidéo membre dépublié).
 * Centralise les helpers `getLiveKitParticipant`, dérivations `inviteUrl`,
 * `hostMemberSearch`, `hostAsideMonitor`, et la résolution `chatCollectiveEnabled`.
 */
export const LiveHostMessagingPanelSlot = ({
  showMessagingPanel,
  setShowMessagingPanel,
  forumTarget,
  setForumTarget,
  forumInput,
  setForumInput,
  activeMembers,
  chatMessages,
  whisperThreads,
  user,
  isGuestUi,
  sessionCommFlags,
  guestCapabilityCaps,
  teacherId,
  sendChatMessage,
  sendWhisper,
  toast,
  liveKitMediaEpoch,
  livekitParticipantsMap,
  phase,
  searchQuery,
  setSearchQuery,
  searchResults,
  setModal,
  liveStripDockMembers,
  promotedId,
  sessionId,
  eleveAppChatUrl,
  memberVideoPreview,
  setMemberVideoPreview,
  isHostUser,
  asideMedia,
  hostMonitorBus,
}) => {
  const getLiveKitParticipant = useMemo(
    () => (m) =>
      (m &&
        (livekitParticipantsMap[m.id] ||
          livekitParticipantsMap[String(m.id)] ||
          livekitParticipantsMap[m.name] ||
          (m.isLocal ? livekitParticipantsMap.local : null))) ||
      null,
    [livekitParticipantsMap],
  );

  const chatCollectiveEnabled = !isGuestUi
    ? sessionCommFlags.chat_enabled !== false
    : sessionCommFlags.chat_enabled !== false && guestCapabilityCaps.canChatPublic;

  const memberSchoolLifeEnabled =
    !isGuestUi || sessionCommFlags.guest_member_inspect_enabled === true;

  const hostMemberSearch = !isGuestUi && phase === PHASE.LIVE
    ? {
        query: searchQuery,
        onQueryChange: setSearchQuery,
        results: searchResults,
        onPickMember: (m) => {
          setSearchQuery('');
          setModal({ type: 'member', data: m });
        },
      }
    : null;

  const inviteUrl = !isGuestUi && phase === PHASE.LIVE && sessionId
    ? typeof window !== 'undefined'
      ? `${window.location.origin}/live/${sessionId}`
      : `/live/${sessionId}`
    : null;

  const hostAsideMonitor = phase === PHASE.LIVE && isHostUser && !isGuestUi
    ? {
        asideState: asideMedia.asideState,
        asideMode: asideMedia.asideMode,
        startAside: asideMedia.startAside,
        endAside: asideMedia.endAside,
        monitorBus: hostMonitorBus,
      }
    : null;

  return (
    <>
      <LiveHostMessagingPanel
        open={showMessagingPanel}
        onClose={() => setShowMessagingPanel(false)}
        forumTarget={forumTarget}
        setForumTarget={setForumTarget}
        forumInput={forumInput}
        setForumInput={setForumInput}
        activeMembers={activeMembers}
        chatMessages={chatMessages}
        whisperThreads={whisperThreads}
        user={user}
        isGuestUi={isGuestUi}
        chatCollectiveEnabled={chatCollectiveEnabled}
        guestPrivateTeacherUserId={isGuestUi ? teacherId : null}
        guestCanChatPeer={!isGuestUi || guestCapabilityCaps.canChatPeer}
        onSendCollective={(text) => void sendChatMessage(text)}
        onSendPrivate={(peerId, text) => {
          void (async () => {
            const r = await sendWhisper(peerId, text);
            if (r && !r.ok && r.error) {
              toast({
                title: 'Message privé',
                description: String(r.error.message || r.error),
                variant: 'destructive',
              });
            }
          })();
        }}
        liveKitMediaEpoch={liveKitMediaEpoch}
        getLiveKitParticipant={getLiveKitParticipant}
        hostMemberSearch={hostMemberSearch}
        memberSchoolLifeEnabled={memberSchoolLifeEnabled}
        stripDockMembers={liveStripDockMembers}
        stripDockPromotedId={promotedId}
        stripDockMinSlots={LIVE_STRIP_DOCK_MIN_MEMBER_SLOTS}
        inviteUrl={inviteUrl}
        eleveAppChatUrl={eleveAppChatUrl}
        previewMember={memberVideoPreview}
        onPreviewMemberChange={setMemberVideoPreview}
        fullViewportDim={false}
        isLiveSessionHost={phase === PHASE.LIVE && isHostUser && !isGuestUi}
        hostAsideMonitor={hostAsideMonitor}
      />
      <LiveMemberVideoPreviewModal
        member={memberVideoPreview}
        onClose={() => setMemberVideoPreview(null)}
        liveKitMediaEpoch={liveKitMediaEpoch}
        getLiveKitParticipant={getLiveKitParticipant}
        memberSchoolLifeEnabled={memberSchoolLifeEnabled}
      />
    </>
  );
};
