import { useMemo } from 'react';

/**
 * Valeurs dérivées de messagerie et de communication invité :
 * cibles whisper, autorisation messagerie footer, liste modal membres,
 * permissions école, et verrous micro/caméra/main/partage.
 */
export function useLiveHostGuestCommFlags({
  liveParticipants,
  user,
  isGuestUi,
  sessionCommFlags,
  guestCapabilityCaps,
  guestCommAllowed,
  debateArena,
}) {
  const footerWhisperTargets = useMemo(
    () => liveParticipants.filter((m) => m?.id != null && String(m.id) !== String(user?.id)),
    [liveParticipants, user?.id],
  );

  const guestFooterMessagingAllowed = useMemo(() => {
    if (!isGuestUi) return true;
    const collective = sessionCommFlags.chat_enabled !== false && guestCapabilityCaps.canChatPublic;
    const privateOk = footerWhisperTargets.length > 0
      && (guestCapabilityCaps.canWhisperTeacher || guestCapabilityCaps.canChatPeer);
    return collective || privateOk;
  }, [
    isGuestUi,
    sessionCommFlags.chat_enabled,
    guestCapabilityCaps.canChatPublic,
    guestCapabilityCaps.canWhisperTeacher,
    guestCapabilityCaps.canChatPeer,
    footerWhisperTargets.length,
  ]);

  const memberModalWhisperPickable = useMemo(() => {
    const rows = liveParticipants.map((m) => ({ id: m.id, name: m.name }));
    if (user?.id) {
      rows.unshift({ id: user.id, name: user.full_name || 'Vous', isLocal: true });
    }
    return rows;
  }, [liveParticipants, user?.id, user?.full_name]);

  const memberModalAllowSchoolLife =
    !isGuestUi || sessionCommFlags.guest_member_inspect_enabled === true;

  const guestMicLocked = isGuestUi && !guestCommAllowed.mic;
  const guestCamLocked = isGuestUi && !guestCommAllowed.cam;
  const guestHandRaiseLocked = isGuestUi && !guestCommAllowed.handRaise;
  const guestScreenShareLocked =
    isGuestUi && (!guestCommAllowed.screenShare || debateArena?.myRole === 'viewer');

  return {
    footerWhisperTargets,
    guestFooterMessagingAllowed,
    memberModalWhisperPickable,
    memberModalAllowSchoolLife,
    guestMicLocked,
    guestCamLocked,
    guestHandRaiseLocked,
    guestScreenShareLocked,
  };
}
