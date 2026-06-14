import React, { useEffect, useState } from 'react';
import { RaisedHandsPanel } from './RaisedHandsPanel';
import { WaitingRoomPanel } from './WaitingRoomPanel';
import { NotificationsPanel } from './NotificationsPanel';
import { LiriHostBrandHeader } from './LiriHostBrandHeader';
import { LIRI_HOST_EVENT_CARD, LIRI_HOST_SIDE_COLUMN } from './liriHostUiTheme';
import { cn } from '@/lib/utils';
import { LIRI_HOST_EXPAND_NOTIFICATIONS_EVENT } from '@/lib/longiaLiveCopilot';

/**
 * Colonne gauche — vue hôte LIRI verrouillée : mains levées, salle d'attente, notifications.
 */
export function LiveEventsSidebar({
  raisedHands = [],
  waitingEntries = [],
  activityFeed = [],
  notifFilter,
  onNotifFilterChange,
  onClearActivityFeed,
  onGrantSpeech,
  onIgnoreHand,
  onApproveWaiting,
  onRejectWaiting,
  /** Bloc Antenne & Q&R (même callbacks / libellés que l'existant — ne pas modifier les actions) */
  antenneBlock,
  /** Bouton / lien membres compact */
  membersCompactButton,
}) {
  const [handsEx, setHandsEx] = useState(false);
  const [waitEx, setWaitEx] = useState(false);
  const [notifEx, setNotifEx] = useState(false);

  const toggleHands = () => {
    setHandsEx((v) => !v);
    if (!handsEx) {
      setWaitEx(false);
      setNotifEx(false);
    }
  };
  const toggleWait = () => {
    setWaitEx((v) => !v);
    if (!waitEx) {
      setHandsEx(false);
      setNotifEx(false);
    }
  };
  const toggleNotif = () => {
    setNotifEx((v) => !v);
    if (!notifEx) {
      setHandsEx(false);
      setWaitEx(false);
    }
  };

  useEffect(() => {
    const onExpand = () => {
      setNotifEx(true);
      setHandsEx(false);
      setWaitEx(false);
    };
    window.addEventListener(LIRI_HOST_EXPAND_NOTIFICATIONS_EVENT, onExpand);
    return () => window.removeEventListener(LIRI_HOST_EXPAND_NOTIFICATIONS_EVENT, onExpand);
  }, []);

  return (
    <div
      className={cn(
        LIRI_HOST_SIDE_COLUMN,
        'gap-2 pt-9 pb-2 pl-1 pr-0.5 sm:pl-1.5 [scrollbar-width:thin]',
      )}
    >
      <LiriHostBrandHeader className="shrink-0" />
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
        <RaisedHandsPanel
          hands={raisedHands}
          expanded={handsEx}
          onToggle={toggleHands}
          onGrantSpeech={onGrantSpeech}
          onIgnore={onIgnoreHand}
        />
        <WaitingRoomPanel
          entries={waitingEntries}
          expanded={waitEx}
          onToggle={toggleWait}
          onApprove={onApproveWaiting}
          onReject={onRejectWaiting}
        />
        <NotificationsPanel
          items={activityFeed}
          expanded={notifEx}
          onToggle={toggleNotif}
          filter={notifFilter}
          onFilterChange={onNotifFilterChange}
          onClear={onClearActivityFeed}
        />
      </div>

      {antenneBlock ? (
        <div className={cn(LIRI_HOST_EVENT_CARD, 'shrink-0 p-2 backdrop-blur-md')}>
          {antenneBlock}
        </div>
      ) : null}

      {membersCompactButton ? <div className="shrink-0">{membersCompactButton}</div> : null}
    </div>
  );
}
