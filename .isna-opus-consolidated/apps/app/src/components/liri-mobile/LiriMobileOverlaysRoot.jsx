import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMobileLiriStore } from '@/stores/mobileLiriStore';
import { MembersOverlay } from './overlays/MembersOverlay';
import { SmartboardFullOverlay } from './overlays/SmartboardFullOverlay';
import { SettingsOverlay } from './overlays/SettingsOverlay';
import { MemberActionsOverlay } from './overlays/MemberActionsOverlay';
import { PrivateChatOverlay } from './overlays/PrivateChatOverlay';
import { WhisperChatOverlay } from './overlays/WhisperChatOverlay';
import { ProfileOverlay } from './overlays/ProfileOverlay';
import { ExitConfirmOverlay } from './overlays/ExitConfirmOverlay';

/**
 * @param {{
 *   members: Array<{ id: string, name: string, avatar_url?: string, isHost?: boolean }>,
 *   currentUserId?: string,
 *   onOpenLiveSettings: () => void,
 *   onSendForumLine: (text: string) => void | Promise<void>,
 *   forumSending?: boolean,
 *   onConfirmExitLive: () => void,
 *   smartboardFullPlan?: { plan: { label: string, human: string, empty?: boolean, title?: string }, sceneCaption: string },
 *   liveSettingsPanel?: object — voir `SettingsOverlay` (`muted`, `ambientMusicEnabled`, etc.).
 *   whisperSessionKey?: string | null,
 *   whisperThreads?: Record<string, Array<{ id: string, fromId: string, toId: string, text: string, at: number }>>,
 *   sendWhisper?: (toId: string, text: string) => void,
 * }} props
 */
export function LiriMobileOverlaysRoot({
  members,
  currentUserId,
  onOpenLiveSettings,
  onSendForumLine,
  forumSending,
  onConfirmExitLive,
  smartboardFullPlan,
  liveSettingsPanel,
  whisperSessionKey = null,
  whisperThreads = {},
  sendWhisper,
}) {
  const activeOverlay = useMobileLiriStore((s) => s.activeOverlay);
  const selectedMember = useMobileLiriStore((s) => s.selectedMember);

  const showGlobalBackdrop = ['members', 'settings', 'member-actions', 'private-chat', 'whisper', 'profile'].includes(
    activeOverlay,
  );

  const whisperPeerId = selectedMember?.id && activeOverlay === 'whisper' ? String(selectedMember.id) : '';
  const whisperMessages = whisperPeerId ? (whisperThreads[whisperPeerId] || []) : [];

  const memberSheetWhisperOk = Boolean(
    whisperSessionKey && currentUserId && sendWhisper && selectedMember?.id,
  )
    && String(selectedMember.id) !== '__live_forum__'
    && String(selectedMember.id) !== String(currentUserId);

  return (
    <AnimatePresence>
      {showGlobalBackdrop ? (
        <motion.button
          key="liri-overlay-backdrop"
          type="button"
          aria-label="Fermer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.26 }}
          className="fixed inset-0 z-[200] border-0 bg-black/55 backdrop-blur-sm"
          onClick={() => useMobileLiriStore.getState().closeOverlay()}
        />
      ) : null}

      {activeOverlay === 'members' ? (
        <MembersOverlay key="ov-members" members={members} currentUserId={currentUserId} />
      ) : null}
      {activeOverlay === 'smartboard-full' ? (
        <SmartboardFullOverlay
          key="ov-sb"
          plan={smartboardFullPlan?.plan}
          sceneCaption={smartboardFullPlan?.sceneCaption}
        />
      ) : null}
      {activeOverlay === 'settings' ? (
        <SettingsOverlay
          key="ov-settings"
          onOpenLiveSettings={onOpenLiveSettings}
          liveSettings={liveSettingsPanel}
        />
      ) : null}
      {activeOverlay === 'member-actions' ? (
        <MemberActionsOverlay key="ov-ma" whisperEnabled={memberSheetWhisperOk} currentUserId={currentUserId} />
      ) : null}
      {activeOverlay === 'private-chat' ? (
        <PrivateChatOverlay key="ov-pc" onSend={onSendForumLine} sending={forumSending} />
      ) : null}
      {activeOverlay === 'whisper' && sendWhisper ? (
        <WhisperChatOverlay
          key="ov-whisper"
          whisperMessages={whisperMessages}
          sendWhisper={sendWhisper}
          currentUserId={currentUserId}
        />
      ) : null}
      {activeOverlay === 'profile' ? <ProfileOverlay key="ov-pr" /> : null}
      {activeOverlay === 'exit-confirm' ? (
        <ExitConfirmOverlay key="ov-ex" onConfirmLeave={onConfirmExitLive} />
      ) : null}
    </AnimatePresence>
  );
}
