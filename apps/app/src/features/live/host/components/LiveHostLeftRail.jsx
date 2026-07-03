import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Copy,
  Check,
  Link2,
  Share2,
  Hand,
  Lightbulb,
  Brain,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import activeTenantConfig from '@/lib/tenant/activeTenantConfig';
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
    activityBadges,
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

  // Fenêtre flottante façon Claude : en live hôte (languette repliée), le panneau gauche
  // s'ouvre AU SURVOL et flotte par-dessus la scène — la colonne reste à 52px, donc la
  // grille ne bouge pas (plus de réorganisation ni de superposition).
  const hostHoverMode = focusHost && asStrip && !lhLayoutCompact;
  // Activity bar : icône cliquable → overlay focalisé, un seul à la fois. `activePanel` pilote
  // l'overlay « Salle » ancré au rail ; Modération/Coach/Interactions ouvrent le Hub ; Aperçu = onglet.
  const [activePanel, setActivePanel] = React.useState(null);
  const [copied, setCopied] = React.useState(false);

  // Ref fusionnée : on conserve la ref transmise par le parent ET une ref locale pour
  // mesurer la barre membres (haut) et le dock scènes (bas), afin d'aligner la fenêtre
  // flottante PILE sur la scène (jamais derrière le header ni sous le dock → fini la
  // superposition). Mesuré dynamiquement (ResizeObserver) plutôt qu'en dur.
  const localRef = React.useRef(null);
  const setRefs = React.useCallback(
    (node) => {
      localRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
  React.useLayoutEffect(() => {
    if (!hostHoverMode) return undefined;
    const el = localRef.current;
    const grid = el?.parentElement;
    const center = grid?.children?.[1];
    if (!el || !grid || !center) return undefined;
    const shellRoot = el.closest('.liri-live-shell--host');
    const measure = () => {
      const gridBox = grid.getBoundingClientRect();
      const header = center.children[0];
      const footer = center.children[center.children.length - 1];
      const hb = header?.getBoundingClientRect();
      const fb = footer?.getBoundingClientRect();
      const footerIsDock = fb && fb.height < 160 && fb.top > gridBox.top + 240;
      const top = hb ? Math.max(8, Math.round(hb.bottom - gridBox.top + 6)) : 10;
      let bottom = 10;
      if (footerIsDock) bottom = Math.max(8, Math.round(gridBox.bottom - fb.top + 6));
      // Vars locales (rail) — la fenêtre flottante du rail est `absolute` dans le rail.
      el.style.setProperty('--lh-panel-top', `${top}px`);
      el.style.setProperty('--lh-panel-bottom', `${bottom}px`);
      // Vars partagées (root shell) en coordonnées VIEWPORT — réutilisées par la fenêtre
      // flottante du Hub LONGIA (`position: fixed`), pour caler les deux sur la scène.
      if (shellRoot && hb) {
        const vh = window.innerHeight || document.documentElement.clientHeight || 0;
        shellRoot.style.setProperty('--lh-stage-top-vw', `${Math.max(8, Math.round(hb.bottom + 8))}px`);
        shellRoot.style.setProperty(
          '--lh-stage-bottom-vw',
          `${footerIsDock ? Math.max(8, Math.round(vh - fb.top + 8)) : 12}px`,
        );
        shellRoot.style.setProperty('--lh-rail-edge', `${Math.round(gridBox.left + 52 + 12)}px`);
      }
    };
    measure();
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(center);
      ro.observe(grid);
    }
    window.addEventListener('resize', measure);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [hostHoverMode]);

  const inviteUrl = React.useMemo(() => {
    if (!sessionId) return '';
    if (typeof window === 'undefined') return `/live/${sessionId}`;
    // Propage le tenant de la salle (?tenant=…) pour que l'invité voie le bon branding.
    const t = new URLSearchParams(window.location.search).get('tenant');
    return `${window.location.origin}/live/${sessionId}${t ? `?tenant=${encodeURIComponent(t)}` : ''}`;
  }, [sessionId]);

  const copyInvite = React.useCallback(() => {
    if (!inviteUrl) return;
    try {
      void navigator.clipboard?.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* presse-papiers indisponible */
    }
  }, [inviteUrl]);

  const shareInvite = React.useCallback(async () => {
    if (!inviteUrl) return;
    const title = sessionTitle?.trim() || 'Session LIRI';
    const text = `${sessionTitle?.trim() ? `${sessionTitle.trim()}\n\n` : 'Rejoignez la session LIRI :\n'}${inviteUrl}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, text, url: inviteUrl });
        return;
      }
    } catch {
      return; // l'utilisateur a annulé le partage natif
    }
    try {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    } catch {
      /* ignore */
    }
  }, [inviteUrl, sessionTitle]);

  const hostLabel = user?.full_name || user?.email || 'Formateur';
  const hostLetter = (hostLabel.trim().charAt(0) || '?').toUpperCase();
  const waitingList = Array.isArray(waitingEntries) ? waitingEntries : [];
  const waitingCount = waitingList.length;
  const memberCount = Math.max(1, onlineMemberCount || 1);
  // Badges de la barre d'activité — compteurs réels remontés depuis LiveHostPage (signaux Longia).
  const modBadge = Math.max(0, activityBadges?.moderation || 0);
  const coachBadge = Math.max(0, activityBadges?.coach || 0);
  const interBadge = Math.max(0, activityBadges?.interactions || 0);

  if (hostHoverMode) {
    return (
      <div
        ref={setRefs}
        className="lh-sp-dim lh-hoverrail"
        data-pinned={activePanel === 'salle' ? 'true' : 'false'}
        onMouseLeave={() => {
          /* le survol gère l'ouverture ; rien à faire ici (l'épingle persiste) */
        }}
        style={{
          order: hostCompactColOrder.left,
          // Épuré façon sidebar du portail LIRI : fond commun (pas de carte),
          // séparé de la scène par un simple liseré à droite — ni bordure complète,
          // ni radius, ni ombre.
          background: 'transparent',
          borderRadius: 0,
          borderRight: '1px solid rgba(245,244,238,0.09)',
          padding: '12px 6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: '12px',
          position: 'relative',
          // Le rail porte `lh-sp-dim` (will-change:filter) → c'est un contexte d'empilement.
          // On le hisse au-dessus de la colonne centrale pour que la fenêtre flottante
          // (enfant) passe PAR-DESSUS la scène au lieu d'être masquée par elle (< 500 = modales).
          zIndex: 40,
          overflow: 'visible',
          minHeight: 0,
          minWidth: 0,
          alignSelf: 'stretch',
          boxShadow: 'none',
        }}
      >
        {/* Activity bar — icônes cliquables, un overlay focalisé à la fois.
            Salle = overlay ancré au rail ; Modération/Coach/Interactions = Hub ; Aperçu = onglet. */}
        <div
          className="lh-hoverrail-strip"
          style={{ display: 'flex', flex: 1, width: '100%', minHeight: 0, flexDirection: 'column', alignItems: 'center', gap: '10px', paddingTop: '2px' }}
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,.85)]"
            style={{ animation: 'lhPulse 2s infinite', marginBottom: '2px' }}
            title="En direct"
            aria-hidden
          />
          {[
            { id: 'salle', label: 'Salle — participants, file, inviter', Icon: Users, badge: waitingCount > 0 ? waitingCount : 0, active: activePanel === 'salle', onClick: () => setActivePanel((p) => (p === 'salle' ? null : 'salle')) },
            { id: 'mod', label: 'Modération — mains levées, demandes', Icon: Hand, badge: modBadge, active: longiaHubOpen && longiaSignalSubDrawer === 'hands', onClick: () => { setActivePanel(null); openLongiaHubControlMesh(); setLongiaSignalSubDrawer('hands'); } },
            { id: 'coach', label: 'Coach IA — Longia', Icon: Lightbulb, badge: coachBadge, active: longiaHubOpen && longiaSignalSubDrawer === 'host_coach', onClick: () => { setActivePanel(null); openLongiaHubCoachPanel(); } },
            { id: 'inter', label: 'Interactions — Zone 3, NeuronQ', Icon: Brain, badge: interBadge, active: longiaHubOpen && longiaSignalSubDrawer === 'zone3', onClick: () => { setActivePanel(null); openLongiaHubControlMesh(); setLongiaSignalSubDrawer('zone3'); } },
          ].map((it) => {
            const ItIcon = it.Icon;
            return (
              <button
                key={it.id}
                type="button"
                onClick={it.onClick}
                title={it.label}
                aria-label={it.label}
                className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
                  it.active
                    ? 'bg-amber-500/15 text-amber-200'
                    : 'bg-transparent text-white/55 hover:bg-white/[0.06] hover:text-white/90'
                }`}
              >
                <ItIcon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                {it.badge ? (
                  <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#d4a36a] px-1 text-[10px] font-semibold text-[#2a2118]">
                    {it.badge > 9 ? '9+' : it.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => { if (inviteUrl && typeof window !== 'undefined') window.open(inviteUrl, '_blank', 'noopener,noreferrer'); }}
            title="Aperçu — vue participant (nouvel onglet)"
            aria-label="Aperçu — vue participant (nouvel onglet)"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition bg-transparent text-white/55 hover:bg-white/[0.06] hover:text-white/90"
          >
            <Eye className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          </button>
        </div>

        {/* Overlay « Salle » ancré au rail — ouvert au clic sur l'icône Salle (data-pinned). */}
        <div className="lh-hoverrail-panel" aria-hidden={activePanel === 'salle' ? false : true}>
          <div className="lh-hoverrail-panel-inner lh-sy">
            {/* En direct + épingle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                paddingBottom: 12,
                marginBottom: 12,
                borderBottom: '1px solid rgba(255,255,255,.07)',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#ef4444',
                  boxShadow: '0 0 8px rgba(239,68,68,.9)',
                  animation: 'lhPulse 2s infinite',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', color: '#ff8c42' }}>
                EN DIRECT
              </span>
              {liveDuration ? (
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', fontVariantNumeric: 'tabular-nums' }}>
                  {liveDuration}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => setActivePanel(null)}
                title="Fermer"
                aria-label="Fermer le panneau Salle"
                style={{
                  marginLeft: 'auto',
                  display: 'flex',
                  width: 26,
                  height: 26,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,.1)',
                  background: 'rgba(255,255,255,.03)',
                  color: 'rgba(255,255,255,.55)',
                  cursor: 'pointer',
                }}
              >
                <ChevronLeft size={14} aria-hidden />
              </button>
            </div>

            {/* Étape en cours */}
            {curEtape?.title ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  marginBottom: 12,
                  padding: '10px 11px',
                  borderRadius: 12,
                  border: '1px solid rgba(212,163,106,.18)',
                  background: 'rgba(212,163,106,.05)',
                }}
              >
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    letterSpacing: '.14em',
                    textTransform: 'uppercase',
                    color: 'rgba(212,163,106,.85)',
                  }}
                >
                  Étape en cours
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    lineHeight: 1.4,
                    color: 'rgba(255,255,255,.9)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {curEtape.title}
                </span>
              </div>
            ) : null}

            {/* Inviter */}
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 8,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,.5)',
                }}
              >
                <Link2 size={12} style={{ color: 'var(--lh-accent,#d4a36a)' }} aria-hidden /> Inviter
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  readOnly
                  value={inviteUrl || '—'}
                  title={inviteUrl || undefined}
                  style={{
                    minWidth: 0,
                    flex: 1,
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,.08)',
                    background: 'rgba(0,0,0,.3)',
                    padding: '8px 10px',
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 10,
                    color: 'rgba(255,255,255,.85)',
                  }}
                />
                <button
                  type="button"
                  onClick={copyInvite}
                  disabled={!inviteUrl}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    flexShrink: 0,
                    borderRadius: 10,
                    border: `1px solid ${copied ? 'rgba(120,200,120,.4)' : 'rgba(212,163,106,.4)'}`,
                    background: copied ? 'rgba(120,200,120,.14)' : 'rgba(212,163,106,.14)',
                    color: copied ? '#9fe0a0' : '#e3c79a',
                    padding: '0 11px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: inviteUrl ? 'pointer' : 'not-allowed',
                  }}
                >
                  {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
                  {copied ? 'Copié' : 'Copier'}
                </button>
              </div>
              <button
                type="button"
                onClick={shareInvite}
                disabled={!inviteUrl}
                style={{
                  marginTop: 8,
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,.1)',
                  background: 'rgba(255,255,255,.03)',
                  color: 'rgba(255,255,255,.82)',
                  padding: '8px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: inviteUrl ? 'pointer' : 'not-allowed',
                }}
              >
                <Share2 size={13} aria-hidden /> Partager le lien
              </button>
            </div>

            {/* Salle */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Users size={12} style={{ color: 'var(--lh-accent,#d4a36a)' }} aria-hidden />
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '.14em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,.5)',
                  }}
                >
                  Salle · {memberCount}
                </span>
                {waitingCount > 0 ? (
                  <span
                    style={{
                      marginLeft: 'auto',
                      borderRadius: 999,
                      border: '1px solid rgba(212,163,106,.35)',
                      background: 'rgba(212,163,106,.12)',
                      padding: '1px 8px',
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#e3c79a',
                    }}
                  >
                    {waitingCount} en attente
                  </span>
                ) : null}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  borderRadius: 12,
                  border: '1px solid rgba(245,244,238,.07)',
                  background: 'rgba(255,255,255,.02)',
                  padding: '8px 10px',
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    width: 30,
                    height: 30,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 9,
                    background: 'var(--lh-accent,#d4a36a)',
                    color: '#1f1a12',
                    fontSize: 13,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {hostLetter}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'rgba(255,255,255,.92)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {hostLabel}
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(212,163,106,.8)', fontWeight: 600 }}>Vous · formateur</div>
                </div>
              </div>

              {waitingCount > 0 ? (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {waitingList.slice(0, 3).map((e) => {
                    const name = e.profile?.name || 'Participant';
                    return (
                      <div
                        key={e.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          borderRadius: 10,
                          border: '1px solid rgba(255,255,255,.06)',
                          background: 'rgba(0,0,0,.25)',
                          padding: '6px 8px',
                        }}
                      >
                        <span
                          style={{
                            display: 'flex',
                            width: 26,
                            height: 26,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            background: 'rgba(212,163,106,.2)',
                            color: '#e3c79a',
                            fontSize: 10,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {name.substring(0, 2).toUpperCase()}
                        </span>
                        <span
                          style={{
                            minWidth: 0,
                            flex: 1,
                            fontSize: 11,
                            color: 'rgba(255,255,255,.9)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {name}
                        </span>
                        <button
                          type="button"
                          title="Accepter"
                          aria-label={`Accepter ${name}`}
                          onClick={() => onApproveWaiting?.(e.id)}
                          style={{
                            flexShrink: 0,
                            borderRadius: 8,
                            border: '1px solid rgba(212,163,106,.45)',
                            background: 'rgba(212,163,106,.16)',
                            color: '#e3c79a',
                            padding: '3px 8px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          title="Refuser"
                          aria-label={`Refuser ${name}`}
                          onClick={() => onRejectWaiting?.(e.id)}
                          style={{
                            flexShrink: 0,
                            borderRadius: 8,
                            border: '1px solid rgba(229,90,70,.4)',
                            background: 'rgba(229,90,70,.12)',
                            color: '#e88a72',
                            padding: '3px 8px',
                            fontSize: 11,
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
              ) : null}

              {typeof onOpenLongiaWaiting === 'function' ? (
                <button
                  type="button"
                  onClick={onOpenLongiaWaiting}
                  style={{
                    marginTop: 8,
                    display: 'flex',
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,.08)',
                    background: 'rgba(255,255,255,.03)',
                    color: 'rgba(255,255,255,.78)',
                    padding: '7px 10px',
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <span>Gestion complète · LONGIA</span>
                  <ChevronRight size={13} style={{ opacity: 0.5 }} aria-hidden />
                </button>
              ) : null}
            </div>

            {/* Signaux / Coach retirés d'ici : ce sont désormais des icônes de l'activity bar. */}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setRefs}
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
        </div>
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
              {(activeTenantConfig?.slug) ? (
                <span style={{ fontWeight: 700, color: '#fff', fontSize: 13, whiteSpace: 'nowrap' }}>
                  {activeTenantConfig?.branding?.name || 'LIRI'}
                </span>
              ) : (
                <LiriWordmark
                  variant="mark"
                  size="rail"
                  bulbColor="#d4a36a"
                  bulbGlow="drop-shadow(0 0 12px rgba(212,163,106,.55))"
                  letterClassName="text-white"
                  className="text-white drop-shadow-[0_2px_10px_rgba(212,163,106,0.35)]"
                />
              )}
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
                  inviteUrl={inviteUrl}
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
