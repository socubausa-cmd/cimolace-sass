import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import HostPermissionRequestsPanel from '@/components/liri-live/HostPermissionRequestsPanel';
import ControlMeshPanel from '@/components/live-room/ControlMeshPanel';
import Zone3Panel from '@/components/live-room/Zone3Panel';
import LiveHostLongiaCoachPanel from '@/components/live-room/LiveHostLongiaCoachPanel';
import LiveHostLayoutPreviewPanel from '@/components/live-room/LiveHostLayoutPreviewPanel';
import { LIVE_DRAWER_SPRING_ELASTIC } from '@/lib/liveDrawerMotion';
import {
  LIVE_HOST_HUB_GOVERNOR_LABELS,
  LIVE_HOST_HUB_GOVERNOR_TITLE,
  LIVE_HOST_LONGIA_FILTER_CHIPS,
  LIVE_HOST_LONGIA_GOVERNOR_ORDER,
  PHASE,
} from '@/features/live/host/liveHostConstants';
import {
  LONGIA_GOVERNOR_MODE,
  LONGIA_PANEL_FILTER,
  longiaPanelEventMatchesFilter,
} from '@/lib/longiaLiveCopilot';
import { evc, evi } from '@/features/live/host/liveHostUtils';
import { LiveHostLongiaSignalShortcuts } from '@/features/live/host/components/LiveHostLongiaSignalShortcuts';
import { LiveHostLongiaSubDrawerHeader } from '@/features/live/host/components/LiveHostLongiaSubDrawerHeader';

/**
 * Hub LONGIA hôte (signaux + sous-tiroirs) : aperçus rapides, mains levées, demandes
 * de permission, salle d'attente, journal, mesh, zone 3, NeuronQ, prévisualisation
 * de layout, etc. Affiché uniquement pour l'hôte pendant la phase LIVE.
 */
export const LiveHostLongiaSignalHub = ({
  phase,
  isGuestUi,
  liveShell,
  longiaSignalSubDrawer,
  setLongiaSignalSubDrawer,
  panels,
  lastHandEv,
  hostAccessRequestCount,
  permReqPreviewLine,
  waitingEntries,
  meshRequests,
  meshPreviewLine,
  zone3RaisedHands,
  zone3PrivilegedSeats,
  debateNeuronqEnabled,
  nqPendingN,
  nqFirstQ,
  journalVisiblePreview,
  lastJournalPreviewEv,
  supabase,
  coachScopeSessionId,
  user,
  sessionTitle,
  step,
  activeEtapes,
  chatMessages,
  liveParticipants,
  toast,
  pushCoachRendersToSmartboard,
  longiaGovernorModes,
  resolveHandRaise,
  hostPermissionRequests,
  hostJoyKitRequests,
  resolveHostPermissionSignal,
  resolveHostJoyKitSignal,
  approveWaiting,
  rejectWaiting,
  hostNotifFilter,
  setHostNotifFilter,
  toggleLongiaGovernorMode,
  mergeLongiaHostSignalActions,
  activeMembers,
  setModal,
  handleLongiaDecisionAction,
  meshParticipantsList,
  meshGrantsByUserId,
  acceptMeshRequest,
  rejectMeshRequest,
  applyMeshProfile,
  revokeMeshParticipant,
  zone3LowerHand,
  zone3GrantSeat,
  zone3RevokeSeat,
  neuronqQuestions,
  markNeuronqAnswered,
  markNeuronqSkipped,
  hostCenterStageMirrorRef,
  previewMobileMaquette,
  handleMobileLayoutPreviewChange,
  previewProjectorLayout,
  setPreviewProjectorLayout,
  focusMode,
  guestInvitePreviewUrl,
}) => {
  if (phase !== PHASE.LIVE || isGuestUi) return null;

  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      {!longiaSignalSubDrawer ? (
        <LiveHostLongiaSignalShortcuts
          innerRadius={liveShell.innerRadius}
          longiaSignalSubDrawer={longiaSignalSubDrawer}
          setLongiaSignalSubDrawer={setLongiaSignalSubDrawer}
          handsEventsCount={panels[0].events.length}
          lastHandEv={lastHandEv}
          hostAccessRequestCount={hostAccessRequestCount}
          permReqPreviewLine={permReqPreviewLine}
          waitingEntries={waitingEntries}
          meshRequestsCount={meshRequests.length}
          meshPreviewLine={meshPreviewLine}
          zone3RaisedHandsCount={zone3RaisedHands.length}
          zone3PrivilegedSeatsCount={zone3PrivilegedSeats.length}
          debateNeuronqEnabled={debateNeuronqEnabled}
          nqPendingN={nqPendingN}
          nqFirstQ={nqFirstQ}
          journalVisiblePreviewCount={journalVisiblePreview.length}
          lastJournalPreviewEv={lastJournalPreviewEv}
        />
      ) : null}

      <AnimatePresence>
        {longiaSignalSubDrawer ? (
          <motion.div
            key="longia-hub-signal-drawer-shell"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 40,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'stretch',
              background: '#14131c',
              boxSizing: 'border-box',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 0 0 1px rgba(255,255,255,0.02)',
            }}
          >
            <motion.div
              key={longiaSignalSubDrawer}
              role="dialog"
              aria-modal="true"
              aria-label="Détail signaux live"
              initial={{ x: 36, opacity: 0.9, scaleX: 0.98 }}
              animate={{ x: 0, opacity: 1, scaleX: 1 }}
              exit={{ x: 24, opacity: 0 }}
              transition={LIVE_DRAWER_SPRING_ELASTIC}
              style={{
                transformOrigin: '0% 50%',
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box',
                background: '#14131c',
                boxShadow: '10px 0 32px rgba(0,0,0,.4)',
              }}
            >
              <LiveHostLongiaSubDrawerHeader
                longiaSignalSubDrawer={longiaSignalSubDrawer}
                onBack={() => setLongiaSignalSubDrawer(null)}
              />
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: 0,
                  width: '100%',
                }}
              >
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY:
                      longiaSignalSubDrawer === 'mesh'
                      || longiaSignalSubDrawer === 'zone3'
                      || longiaSignalSubDrawer === 'host_coach'
                        ? 'hidden'
                        : 'auto',
                    overflowX: 'hidden',
                    padding: 10,
                    scrollbarWidth: 'thin',
                    display:
                      longiaSignalSubDrawer === 'mesh'
                      || longiaSignalSubDrawer === 'zone3'
                      || longiaSignalSubDrawer === 'host_coach'
                        ? 'flex'
                        : 'block',
                    flexDirection:
                      longiaSignalSubDrawer === 'mesh'
                      || longiaSignalSubDrawer === 'zone3'
                      || longiaSignalSubDrawer === 'host_coach'
                        ? 'column'
                        : undefined,
                  }}
                >
                  {longiaSignalSubDrawer === 'host_coach' ? (
                    <div
                      className="flex min-h-0 min-w-0 flex-1 flex-col self-stretch overflow-hidden"
                      style={{ flex: '1 1 0%', minHeight: 0 }}
                    >
                      <LiveHostLongiaCoachPanel
                        supabase={supabase}
                        sessionId={coachScopeSessionId}
                        user={user}
                        sessionTitle={sessionTitle}
                        stepTitle={(activeEtapes[step] || activeEtapes[0] || {})?.title}
                        chatMessages={chatMessages}
                        liveParticipants={liveParticipants}
                        toast={toast}
                        onPushRendersToBoard={pushCoachRendersToSmartboard}
                        architectModeOn={longiaGovernorModes[LONGIA_GOVERNOR_MODE.SMARTBOARD_ASSISTANT] !== false}
                      />
                    </div>
                  ) : null}
                  {longiaSignalSubDrawer === 'hands' ? (
                    panels[0].events.length === 0 ? (
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', textAlign: 'center', padding: '20px 8px', lineHeight: 1.5, margin: 0 }}>
                        0 main levée — rien à traiter pour l’instant (temps réel).
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {panels[0].events.map((ev, ei) => (
                          <div
                            key={`${String(ev.userId)}-${ei}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '8px 10px',
                              background: 'rgba(255,255,255,.035)',
                              border: '1px solid rgba(255,255,255,.08)',
                              borderRadius: 6,
                            }}
                          >
                            <div
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                background: 'rgba(251,191,36,.2)',
                                border: '1px solid rgba(251,191,36,.45)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 9,
                                fontWeight: 800,
                                color: '#fbbf24',
                                flexShrink: 0,
                              }}
                            >
                              {(ev.avatar || '?').toString().substring(0, 2)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 11, color: '#fff', margin: 0, lineHeight: 1.35 }}>{ev.msg}</p>
                              <p style={{ fontSize: 8, color: 'rgba(255,255,255,.32)', margin: '4px 0 0' }}>{ev.time}</p>
                            </div>
                            {ev.type === 'hand_up' && ev.userId ? (
                              <button
                                type="button"
                                onClick={() => resolveHandRaise(ev.userId)}
                                title="Résoudre"
                                style={{
                                  borderRadius: 4,
                                  border: '1px solid rgba(16,185,129,.4)',
                                  background: 'rgba(16,185,129,.12)',
                                  padding: '4px 8px',
                                  color: '#10b981',
                                  fontSize: 9,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                }}
                              >
                                ✓
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )
                  ) : null}
                  {longiaSignalSubDrawer === 'permission_requests' ? (
                    <HostPermissionRequestsPanel
                      rows={hostPermissionRequests}
                      joyKitRows={hostJoyKitRequests}
                      onReject={(row) => { void resolveHostPermissionSignal(row, 'reject'); }}
                      onApprove5min={(row) => { void resolveHostPermissionSignal(row, 'approve_5min'); }}
                      onApproveSession={(row) => { void resolveHostPermissionSignal(row, 'approve_session'); }}
                      onJoyKitReject={(row) => { void resolveHostJoyKitSignal(row, 'reject'); }}
                      onJoyKitApprove5min={(row, level) => { void resolveHostJoyKitSignal(row, 'approve_5min', level); }}
                      onJoyKitApproveSession={(row, level) => { void resolveHostJoyKitSignal(row, 'approve_session', level); }}
                    />
                  ) : null}
                  {longiaSignalSubDrawer === 'waiting' ? (
                    waitingEntries.length === 0 ? (
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', textAlign: 'center', padding: '20px 8px', lineHeight: 1.5, margin: 0 }}>
                        0 participant en salle d’attente.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {waitingEntries.map((e) => {
                          const name = e.profile?.name || 'Participant';
                          return (
                            <div
                              key={e.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '7px 8px',
                                background: 'rgba(255,255,255,.025)',
                                border: '1px solid rgba(255,255,255,.07)',
                                borderRadius: 4,
                              }}
                            >
                              <div
                                style={{
                                  width: 26,
                                  height: 26,
                                  borderRadius: '50%',
                                  background: 'rgba(56,189,248,.18)',
                                  border: '1px solid rgba(56,189,248,.4)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 9,
                                  fontWeight: 700,
                                  color: '#38bdf8',
                                  flexShrink: 0,
                                }}
                              >
                                {name.substring(0, 2).toUpperCase()}
                              </div>
                              <span style={{ flex: 1, fontSize: 11, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                              <button
                                type="button"
                                onClick={() => approveWaiting(e.id)}
                                title="Accepter"
                                style={{
                                  borderRadius: 3,
                                  border: '1px solid rgba(16,185,129,.4)',
                                  background: 'rgba(16,185,129,.12)',
                                  padding: '3px 7px',
                                  color: '#10b981',
                                  fontSize: 9,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                onClick={() => approveWaiting(e.id, { audioOnly: true })}
                                title="Audio seulement"
                                style={{
                                  borderRadius: 3,
                                  border: '1px solid rgba(251,191,36,.3)',
                                  background: 'rgba(251,191,36,.07)',
                                  padding: '3px 7px',
                                  color: '#fbbf24',
                                  fontSize: 9,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                ♪
                              </button>
                              <button
                                type="button"
                                onClick={() => rejectWaiting(e.id)}
                                title="Refuser"
                                style={{
                                  borderRadius: 3,
                                  border: '1px solid rgba(239,68,68,.35)',
                                  background: 'rgba(239,68,68,.08)',
                                  padding: '3px 7px',
                                  color: '#ef4444',
                                  fontSize: 9,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : null}
                  {longiaSignalSubDrawer === 'journal' ? (
                    <>
                      <div
                        role="presentation"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}
                      >
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {LIVE_HOST_LONGIA_FILTER_CHIPS.map((chip) => (
                            <button
                              key={chip.id}
                              type="button"
                              onClick={() => setHostNotifFilter(chip.id)}
                              style={{
                                borderRadius: '999px',
                                border: `1px solid ${hostNotifFilter === chip.id ? 'rgba(167,139,250,.55)' : 'rgba(255,255,255,.12)'}`,
                                background: hostNotifFilter === chip.id ? 'rgba(167,139,250,.14)' : 'rgba(255,255,255,.04)',
                                padding: '3px 8px',
                                fontSize: '8px',
                                fontWeight: 700,
                                color: hostNotifFilter === chip.id ? '#e9d5ff' : 'rgba(255,255,255,.45)',
                                cursor: 'pointer',
                                letterSpacing: '.04em',
                              }}
                            >
                              {chip.label}
                            </button>
                          ))}
                        </div>
                        <p style={{ margin: '0 0 6px', fontSize: 9, lineHeight: 1.4, color: 'rgba(255,255,255,.45)' }}>
                          Filtres = <strong style={{ color: 'rgba(253,230,138,.8)' }}>notifications</strong>. Pastilles
                          vertes = <strong style={{ color: 'rgba(253,230,138,.8)' }}>Coach</strong>,{' '}
                          <strong style={{ color: 'rgba(253,230,138,.8)' }}>Architecte</strong>, etc.
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                          <span
                            style={{
                              fontSize: '8px',
                              fontWeight: 700,
                              color: 'rgba(255,255,255,.4)',
                              letterSpacing: '.06em',
                              marginRight: '2px',
                            }}
                          >
                            Modes IA
                          </span>
                          {LIVE_HOST_LONGIA_GOVERNOR_ORDER.map((mode) => {
                            const on = longiaGovernorModes[mode] !== false;
                            return (
                              <button
                                key={mode}
                                type="button"
                                title={LIVE_HOST_HUB_GOVERNOR_TITLE[mode]}
                                onClick={() => toggleLongiaGovernorMode(mode)}
                                style={{
                                  borderRadius: '4px',
                                  border: `1px solid ${on ? 'rgba(16,185,129,.35)' : 'rgba(255,255,255,.1)'}`,
                                  background: on ? 'rgba(16,185,129,.08)' : 'rgba(0,0,0,.2)',
                                  padding: '2px 6px',
                                  fontSize: '8px',
                                  fontWeight: 700,
                                  color: on ? '#6ee7b7' : 'rgba(255,255,255,.35)',
                                  cursor: 'pointer',
                                  maxWidth: '88px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {LIVE_HOST_HUB_GOVERNOR_LABELS[mode]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {(() => {
                        const je =
                          hostNotifFilter !== LONGIA_PANEL_FILTER.ALL
                            ? panels[2].events.filter((ev) => longiaPanelEventMatchesFilter(ev, hostNotifFilter))
                            : panels[2].events;
                        if (je.length === 0) {
                          return (
                            <p style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', textAlign: 'center', padding: '20px 8px', lineHeight: 1.5, margin: 0 }}>
                              {hostNotifFilter !== LONGIA_PANEL_FILTER.ALL
                                ? '0 événement pour le filtre courant — changez de filtre ou attendez du flux temps réel.'
                                : '0 notification dans le journal LONGIA — le flux affichera les prochains signaux ici.'}
                            </p>
                          );
                        }
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {[...je].reverse().slice(0, 120).map((ev, ei) => {
                              const c2 = evc(ev.type);
                              const mb2 = activeMembers.find((x) => x.name === ev.avatar);
                              const jActions = mergeLongiaHostSignalActions(ev);
                              const payload = {
                                message: ev?.msg,
                                longiaRealtimeId: ev?.longiaRealtimeId,
                                longiaDecision: ev?.longiaDecision,
                              };
                              return (
                                <div key={`sig-j-${ei}-${String(ev.time)}`} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      padding: '6px 8px',
                                      background: 'rgba(255,255,255,.025)',
                                      border: '1px solid rgba(255,255,255,.06)',
                                      borderRadius: 4,
                                      cursor: mb2 ? 'pointer' : 'default',
                                    }}
                                    onClick={() => {
                                      if (mb2) setModal({ type: 'member', data: mb2 });
                                    }}
                                    role="presentation"
                                  >
                                    <div
                                      style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: '50%',
                                        background: `${c2}22`,
                                        border: `1px solid ${c2}44`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 8,
                                        fontWeight: 700,
                                        color: c2,
                                      }}
                                    >
                                      {(ev.avatar || '?').toString().substring(0, 2)}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <p style={{ fontSize: 10, color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.msg}</p>
                                      <p style={{ fontSize: 8, color: 'rgba(255,255,255,.3)', margin: 0 }}>{ev.time}</p>
                                    </div>
                                    <span style={{ fontSize: 12, color: c2 }}>{evi(ev.type)}</span>
                                  </div>
                                  {jActions.length > 0 && !isGuestUi ? (
                                    <div style={{ paddingLeft: 8 }} onClick={(e) => e.stopPropagation()} role="presentation">
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {jActions.slice(0, 6).map((ac, ai) => (
                                          <button
                                            key={`${String(ac.action || '')}-${ai}`}
                                            type="button"
                                            onClick={() => handleLongiaDecisionAction(ac.action, payload)}
                                            style={{
                                              borderRadius: '3px',
                                              border: '1px solid rgba(167,139,250,.35)',
                                              background: 'rgba(124,58,237,.12)',
                                              padding: '2px 6px',
                                              color: '#ddd6fe',
                                              fontSize: '8px',
                                              fontWeight: 700,
                                              cursor: 'pointer',
                                            }}
                                          >
                                            {ac.label || ac.action}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </>
                  ) : null}
                  {longiaSignalSubDrawer === 'mesh' ? (
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                      <ControlMeshPanel
                        compact
                        participants={meshParticipantsList}
                        pendingRequests={meshRequests}
                        grantsByUserId={meshGrantsByUserId}
                        onAcceptRequest={acceptMeshRequest}
                        onRejectRequest={rejectMeshRequest}
                        onApplyProfile={applyMeshProfile}
                        onPassJoyKit={() => {}}
                        onRevokeParticipant={revokeMeshParticipant}
                      />
                    </div>
                  ) : null}
                  {longiaSignalSubDrawer === 'zone3' ? (
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                      <Zone3Panel
                        embedded
                        open
                        onClose={() => setLongiaSignalSubDrawer(null)}
                        members={activeMembers.map((m) => ({ userId: m.id, name: m.name, avatar_url: m.avatar_url, role: m.grade }))}
                        raisedHands={zone3RaisedHands}
                        onLowerHand={zone3LowerHand}
                        privilegedSeats={zone3PrivilegedSeats}
                        onGrantSeat={zone3GrantSeat}
                        onRevokeSeat={zone3RevokeSeat}
                        currentUserId={user?.id}
                        isHost
                        neuronqEnabled={false}
                        questions={[]}
                        scriptSections={[]}
                      />
                    </div>
                  ) : null}
                  {longiaSignalSubDrawer === 'neuronq' ? (
                    !debateNeuronqEnabled ? (
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', textAlign: 'center', padding: '16px 8px', margin: 0 }}>
                        NeuronQ n’est pas activé sur ce live.
                      </p>
                    ) : neuronqQuestions.length === 0 ? (
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', textAlign: 'center', padding: '16px 8px', margin: 0 }}>
                        0 question NeuronQ.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {neuronqQuestions.map((q) => (
                          <div
                            key={q.id}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 6,
                              padding: '7px 8px',
                              background: q.status === 'answered' ? 'rgba(16,185,129,.04)' : 'rgba(255,255,255,.025)',
                              border: `1px solid ${q.status === 'answered' ? 'rgba(16,185,129,.2)' : 'rgba(6,182,212,.15)'}`,
                              borderRadius: 4,
                              opacity: q.status === 'answered' ? 0.55 : 1,
                            }}
                          >
                            <div
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: '50%',
                                background: 'rgba(6,182,212,.18)',
                                border: '1px solid rgba(6,182,212,.4)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 8,
                                fontWeight: 700,
                                color: '#06b6d4',
                                flexShrink: 0,
                              }}
                            >
                              Q
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p
                                style={{
                                  fontSize: 10,
                                  color: 'rgba(255,255,255,.85)',
                                  margin: '0 0 3px',
                                  lineHeight: 1.45,
                                  overflow: 'hidden',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: 'vertical',
                                }}
                              >
                                {q.reformulated_text || q.raw_text}
                              </p>
                              <span style={{ fontSize: 8, color: q.status === 'answered' ? '#10b981' : 'rgba(6,182,212,.7)', fontWeight: 600 }}>
                                {q.status === 'answered' ? '✓ Répondue' : 'En attente'}
                              </span>
                            </div>
                            {!isGuestUi && q.status === 'pending' ? (
                              <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                                <button
                                  type="button"
                                  onClick={() => markNeuronqAnswered(q.id)}
                                  title="Marquer répondue"
                                  style={{
                                    borderRadius: 3,
                                    border: '1px solid rgba(16,185,129,.4)',
                                    background: 'rgba(16,185,129,.12)',
                                    padding: '3px 7px',
                                    color: '#10b981',
                                    fontSize: 9,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  ✓
                                </button>
                                <button
                                  type="button"
                                  onClick={() => markNeuronqSkipped(q.id)}
                                  title="Passer"
                                  style={{
                                    borderRadius: 3,
                                    border: '1px solid rgba(255,255,255,.12)',
                                    background: 'rgba(255,255,255,.04)',
                                    padding: '3px 7px',
                                    color: 'rgba(255,255,255,.35)',
                                    fontSize: 9,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                  }}
                                >
                                  —
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )
                  ) : null}
                  {longiaSignalSubDrawer === 'layout_preview' ? (
                    <LiveHostLayoutPreviewPanel
                      embedded
                      emulatorSourceRef={hostCenterStageMirrorRef}
                      mobilePreviewActive={previewMobileMaquette}
                      onMobilePreviewChange={handleMobileLayoutPreviewChange}
                      projectorPreviewActive={previewProjectorLayout}
                      onProjectorPreviewChange={setPreviewProjectorLayout}
                      cinemaModeReal={focusMode}
                      guestInviteUrl={guestInvitePreviewUrl}
                    />
                  ) : null}
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
