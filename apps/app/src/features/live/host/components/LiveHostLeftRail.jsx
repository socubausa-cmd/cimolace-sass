import React from 'react';
import { ChevronLeft, ChevronRight, Boxes, Sparkles, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { designerShellCloseBtn } from '@/lib/liriDesignerShellClasses';
import LiriHostLeftLiveAssistantRail from '@/components/liri/live-room/LiriHostLeftLiveAssistantRail';
import LiveHostInviteManagementPanel from '@/components/liri/live-room/LiveHostInviteManagementPanel';
import { PHASE } from '@/features/live/host/liveHostConstants';

export const LiveHostLeftRail = React.forwardRef(function LiveHostLeftRail(
  {
    hostCompactColOrder,
    liveShell,
    liveLeftRailCollapsedStrip,
    longiaHubPushesLayout,
    lhLayoutCompact,
    liveLeftRailOpen,
    setLiveLeftRailOpen,
    phase,
    meshPanelOpen,
    setMeshPanelOpen,
    setLongiaSignalSubDrawer,
    openLongiaHubControlMesh,
    openLongiaHubCoachPanel,
    longiaHubOpen,
    longiaSignalSubDrawer,
    lhStageFocusLayout,
    sessionId,
    sessionTitle,
    user,
    onlineMemberCount,
    liveDuration,
    curEtape,
    waitingEntries,
    onApproveWaiting,
    onRejectWaiting,
    onOpenLongiaWaiting,
  },
  ref,
) {
  // Mode formation (focus) hôte : languette d'extension (chevron, bord gauche) si
  // fermé, panneau si ouvert — jamais masqué. (Ce rail n'est rendu que pour l'hôte.)
  const focusHost = phase === PHASE.LIVE; // poignée rétractable par défaut (hôte live — maquette)
  const asStrip = liveLeftRailCollapsedStrip || (focusHost && !liveLeftRailOpen);
  const railHidden = focusHost ? false : (longiaHubPushesLayout || (lhLayoutCompact && !liveLeftRailOpen));
  const showFullContent = phase === PHASE.LIVE && (!lhStageFocusLayout || (focusHost && liveLeftRailOpen));
  return (
    <div
      ref={ref}
      className="lh-sy lh-sp-dim"
      style={{
        order: hostCompactColOrder.left,
        background: asStrip
          ? 'linear-gradient(180deg, rgba(26,22,18,.99) 0%, rgba(16,13,10,.995) 100%)'
          : 'var(--lh-page-bg, #262624)',
        borderRadius: asStrip ? liveShell.panelRadius : 0,
        border: asStrip ? liveShell.panelBorder : 'none',
        padding: asStrip ? '10px 6px' : '16px',
        display: railHidden ? 'none' : 'flex',
        flexDirection: 'column',
        gap: asStrip ? '8px' : '11px',
        alignItems: asStrip ? 'center' : undefined,
        overflow: 'hidden',
        transition: 'opacity .2s, padding .2s ease, background .2s ease',
        opacity: railHidden ? 0 : 1,
        pointerEvents: railHidden ? 'none' : 'auto',
        minHeight: 0,
        minWidth: 0,
        alignSelf: 'stretch',
        boxShadow: asStrip
          ? 'inset 0 0 0 1px rgba(255,255,255,.1), inset 0 1px 0 rgba(255,255,255,.06)'
          : 'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px rgba(255,255,255,0.02) inset',
        // Languette repliée : centrée verticalement dans la fine colonne in-flow.
        justifyContent: asStrip ? 'center' : undefined,
      }}
    >
      {asStrip ? (
        focusHost ? (
          <button
            type="button"
            onClick={() => setLiveLeftRailOpen(true)}
            title="Ouvrir le panneau gauche"
            aria-label="Ouvrir le panneau gauche"
            className="flex items-center justify-center rounded-r-xl border border-l-0 border-white/12 bg-white/[0.02] px-1.5 py-6 text-white/70 shadow-[0_12px_30px_rgba(0,0,0,.4)] transition hover:border-amber-400/45 hover:text-white"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        ) : (
        <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-3 py-1">
          <button
            type="button"
            onClick={() => setLiveLeftRailOpen(true)}
            title="Agrandir le panneau gauche"
            aria-label="Agrandir le panneau gauche"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/22 bg-white/[0.02] text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] transition hover:border-amber-400/45 hover:bg-white/[0.02] hover:text-white"
          >
            <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          </button>
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,.85)]"
            style={{ animation: 'lhPulse 2s infinite' }}
            title="En direct"
            aria-hidden
          />
          {phase === PHASE.LIVE ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (meshPanelOpen) {
                    setMeshPanelOpen(false);
                    setLongiaSignalSubDrawer((d) => (d === 'mesh' ? null : d));
                  } else {
                    openLongiaHubControlMesh();
                  }
                }}
                title="LIRI Control Mesh — hub LONGIA (Signaux)"
                aria-label="Control Mesh"
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,.06)] transition ${
                  meshPanelOpen || (longiaHubOpen && longiaSignalSubDrawer === 'mesh')
                    ? 'border-amber-400/55 bg-amber-500/18 text-amber-100'
                    : 'border-white/22 bg-white/[0.02] text-[#d4a012] hover:border-amber-400/35 hover:text-amber-200'
                }`}
              >
                <Boxes className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => {
                  openLongiaHubCoachPanel();
                }}
                title="IA — coach formateur (chat et rendus)"
                aria-label="IA — coach formateur"
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,.06)] transition ${
                  longiaHubOpen && longiaSignalSubDrawer === 'host_coach'
                    ? 'border-amber-400/55 bg-amber-500/18 text-amber-100'
                    : 'border-white/22 bg-white/[0.02] text-amber-200/95 hover:border-amber-400/45 hover:text-amber-100'
                }`}
              >
                <Sparkles className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
              </button>
            </>
          ) : null}
        </div>
        )
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              paddingBottom: '12px',
              borderBottom: '1px solid rgba(255,255,255,.08)',
            }}
          >
            <div
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                minHeight: 46,
              }}
            >
              <LiriWordmark
                variant="mark"
                size="rail"
                bulbColor="#d4a36a"
                bulbGlow="drop-shadow(0 0 12px rgba(212,163,106,.55))"
                letterClassName="text-white"
                className="text-white drop-shadow-[0_2px_10px_rgba(212,163,106,0.35)]"
              />
            </div>
            {phase === PHASE.LIVE && (!lhStageFocusLayout || focusHost) ? (
              <button
                type="button"
                onClick={() => setLiveLeftRailOpen(false)}
                title="Fermer le panneau gauche"
                className={cn(designerShellCloseBtn, 'h-8 w-8')}
                aria-label="Fermer le panneau gauche"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </div>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              marginTop: 4,
              paddingRight: 2,
              scrollbarWidth: 'thin',
            }}
          >
            {showFullContent ? (
              <>
                <LiveHostInviteManagementPanel
                  inviteUrl={(() => {
                    if (!sessionId) return '';
                    if (typeof window === 'undefined') return `/live/${sessionId}`;
                    // Propage le tenant de la salle (?tenant=zahirwellness) pour que
                    // l'invité voie le branding du tenant hôte, pas le défaut ISNA.
                    const t = new URLSearchParams(window.location.search).get('tenant');
                    return `${window.location.origin}/live/${sessionId}${t ? `?tenant=${encodeURIComponent(t)}` : ''}`;
                  })()}
                  sessionTitle={sessionTitle}
                  hostDisplayName={user?.full_name || user?.email || 'Formateur'}
                  participantOnlineCount={Math.max(1, onlineMemberCount)}
                  liveDuration={liveDuration || ''}
                  currentStepTitle={curEtape?.title || ''}
                  waitingEntries={waitingEntries}
                  onApproveWaiting={onApproveWaiting}
                  onRejectWaiting={onRejectWaiting}
                  onOpenLongiaWaiting={onOpenLongiaWaiting}
                />
                <LiriHostLeftLiveAssistantRail />
              </>
            ) : (
              <p
                style={{
                  fontSize: 10,
                  lineHeight: 1.5,
                  color: 'rgba(255,255,255,.38)',
                  margin: '8px 0 0',
                }}
              >
                {phase === PHASE.LIVE
                  ? 'Panneau réduit en mode scène plein écran. Quittez le focus scène pour le fil temps réel.'
                  : 'Chargement de la salle…'}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
});

export default LiveHostLeftRail;
