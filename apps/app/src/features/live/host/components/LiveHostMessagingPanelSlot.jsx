import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LiveHostMessagingPanel from '@/components/liri/live-room/LiveHostMessagingPanel';
import LiveMemberVideoPreviewModal from '@/components/liri/live-room/LiveMemberVideoPreviewModal';
import { LIVE_STRIP_DOCK_MIN_MEMBER_SLOTS } from '@/lib/liveCommLayers';
import { PHASE } from '@/features/live/host/liveHostConstants';
import { useMessagingTopics } from '@/hooks/useMessagingTopics';

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
  sessionFormationId,
  sessionTitle,
}) => {
  // ── Phase D — Sujet du live (kind='topic', visibility='context', type='live') ──
  // ADDITIF : un fil de discussion PERSISTANT rattaché au live (≠ le chat éphémère
  // live_session_chat affiché par ce drawer). get-or-create idempotent à la 1re
  // ouverture du panneau, via l'API `for-context` (contrôle d'accès côté serveur :
  // encadrant OU membre actif du tenant ; 403 sinon). Chemin de données ISOLÉ : si
  // l'API échoue/refuse, l'encart Sujet ne s'affiche pas et le live continue intact.
  const {
    activeTopic: liveTopicActive,
    topicMessages: liveTopicMessages,
    topicMessagesLoading: liveTopicLoading,
    getOrCreateContextTopic: getOrCreateLiveTopic,
    sendTopicMessage: sendLiveTopicMessage,
    closeActiveTopicView: closeLiveTopicView,
  } = useMessagingTopics(user?.id);

  const [liveTopicInput, setLiveTopicInput] = useState('');
  const [liveTopicSending, setLiveTopicSending] = useState(false);
  const [liveTopicError, setLiveTopicError] = useState(false);
  // Mémorise le sessionId déjà résolu pour ne lancer le get-or-create qu'une fois.
  const liveTopicOpenedForRef = useRef(null);

  // Réinitialise le fil de Sujet quand on change de session live.
  useEffect(() => {
    liveTopicOpenedForRef.current = null;
    setLiveTopicInput('');
    setLiveTopicError(false);
    closeLiveTopicView();
  }, [sessionId, closeLiveTopicView]);

  // À l'ouverture du drawer messagerie (live en cours) : get-or-create idempotent du
  // Sujet du live courant, puis ouverture de son fil. Une seule fois par session.
  // Dégrade en silence : pas de sessionId / 403 non-membre → encart masqué (état error).
  useEffect(() => {
    if (!showMessagingPanel) return;
    // Hôte/encadrant en direct uniquement : l'invité a son propre chat de session
    // (app élève) → inutile de solliciter l'API for-context côté élève.
    if (isGuestUi || phase !== PHASE.LIVE) return;
    if (!user?.id || !sessionId) return;
    if (liveTopicOpenedForRef.current === sessionId) return;
    liveTopicOpenedForRef.current = sessionId;
    setLiveTopicError(false);
    (async () => {
      const topic = await getOrCreateLiveTopic({
        contextType: 'live',
        contextId: sessionId,
        // courseId optionnel : seulement si la session est rattachée à une formation.
        // (la garde serveur 'live' n'en dépend pas, mais ça relie le Sujet au cours.)
        courseId: sessionFormationId || undefined,
        subject: sessionTitle ? `Sujet du live — ${sessionTitle}` : undefined,
      });
      if (!topic) {
        // Échec/refus (ex. 403 non-membre) → autorise une nouvelle tentative et
        // bascule l'encart en mode indisponible plutôt que cassé.
        liveTopicOpenedForRef.current = null;
        setLiveTopicError(true);
      }
    })();
  }, [
    showMessagingPanel,
    isGuestUi,
    phase,
    user?.id,
    sessionId,
    sessionFormationId,
    sessionTitle,
    getOrCreateLiveTopic,
  ]);

  const handleSendLiveTopic = useCallback(async () => {
    const c = String(liveTopicInput || '').trim();
    if (!c || liveTopicSending || !liveTopicActive?.id) return;
    setLiveTopicSending(true);
    const ok = await sendLiveTopicMessage(c);
    setLiveTopicSending(false);
    if (ok) setLiveTopicInput('');
  }, [liveTopicInput, liveTopicSending, liveTopicActive?.id, sendLiveTopicMessage]);

  // Objet prop unique passé au panneau : présent SEULEMENT pour l'hôte/encadrant en
  // direct (pas l'invité — il a déjà le chat de session app élève). Si l'API a refusé
  // (liveTopicError) sans Sujet, on transmet quand même pour afficher l'état « indispo ».
  const liveTopic = useMemo(() => {
    if (isGuestUi || phase !== PHASE.LIVE || !sessionId) return null;
    if (!liveTopicActive && !liveTopicError) return null;
    return {
      topic: liveTopicActive,
      messages: liveTopicMessages,
      loading: liveTopicLoading,
      error: liveTopicError,
      input: liveTopicInput,
      setInput: setLiveTopicInput,
      sending: liveTopicSending,
      onSend: handleSendLiveTopic,
      currentUserId: user?.id ?? null,
    };
  }, [
    isGuestUi,
    phase,
    sessionId,
    liveTopicActive,
    liveTopicMessages,
    liveTopicLoading,
    liveTopicError,
    liveTopicInput,
    liveTopicSending,
    handleSendLiveTopic,
    user?.id,
  ]);

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
        liveTopic={liveTopic}
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
