/**
 * Panneau messagerie — shell LONGIA / designer : colonne verticale de vignettes (+ emplacements vides hôte) + fil de chat.
 * Choix du destinataire privé par vignette flux LiveKit ; aperçu plein écran en modal.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Headphones, MessageCircle, MessagesSquare, Send, Shield, X, Globe, Link2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import activeTenantConfig from '@/lib/tenant/activeTenantConfig';

// Marque blanche : nom du tenant sur son domaine, « LIRI » sur l'hôte produit LIRI.
const BRAND_NAME = activeTenantConfig?.branding?.name || 'LIRI';
import LiveHostAsideAndMonitorBar from '@/components/liri/live-room/LiveHostAsideAndMonitorBar';
import LiveHostMemberPanelCard from '@/components/liri/live-room/LiveHostMemberPanelCard';
import LiveMemberVideoPreviewModal from '@/components/liri/live-room/LiveMemberVideoPreviewModal';
import { ApplePointerTilt } from '@/components/ui/ApplePointerTilt';
import {
  LIVE_COMM_COPY,
  LIVE_COMM_LAYER,
  LIVE_STRIP_DOCK_MIN_MEMBER_SLOTS,
  LIVE_MEMBER_PANEL_TILT_DEG,
  LIVE_MEMBER_PANEL_TILT_HOVER_SCALE,
} from '@/lib/liveCommLayers';
import { LIVE_DRAWER_BACKDROP_TRANSITION, liveDrawerAsideRight } from '@/lib/liveDrawerMotion';
import {
  designerShellBackdrop,
  designerShellBackdropLiveStage,
  designerShellCloseBtn,
  designerShellComposer,
  designerShellComposerUnified,
  designerShellComposerUnifiedInput,
  designerShellComposerUnifiedSendAmber,
  designerShellDrawerClass,
  designerShellHeader,
  designerShellIconBadge,
  designerShellInput,
  designerShellMainScroll,
  designerShellMessageBubble,
} from '@/lib/liriDesignerShellClasses';

export default function LiveHostMessagingPanel({
  open,
  onClose,
  forumTarget,
  setForumTarget,
  forumInput,
  setForumInput,
  activeMembers = [],
  chatMessages = [],
  whisperThreads = {},
  user,
  isGuestUi = false,
  chatCollectiveEnabled = true,
  /** Invité : si false, seuls les MP vers ce user (ex. prof) sont listés. */
  guestPrivateTeacherUserId = null,
  guestCanChatPeer = true,
  onSendCollective,
  onSendPrivate,
  /** Epoch LiveKit — ré-attache les pistes vidéo */
  liveKitMediaEpoch = 0,
  /** Résout un membre `activeMembers` → participant LiveKit (ou null) */
  getLiveKitParticipant,
  /**
   * Hôte live : recherche membre (déplacée depuis la colonne gauche).
   * @type {null | { query: string, onQueryChange: (q: string) => void, results: Array<Record<string, unknown>>, onPickMember: (m: Record<string, unknown>) => void }}
   */
  hostMemberSearch = null,
  /** Hôte (ou invité si réglage salle) : colonne vie scolaire dans le modal membre */
  memberSchoolLifeEnabled = true,
  /** Hôte : même liste que le bandeau plateau (`liveStripDockMembers`) + emplacements vides jusqu'à 10. */
  stripDockMembers,
  stripDockPromotedId = null,
  stripDockMinSlots = LIVE_STRIP_DOCK_MIN_MEMBER_SLOTS,
  /** Hôte : lien public `/live/:sessionId` — visibleici pour ne pas confondre avec le seul fil de chat */
  inviteUrl = null,
  /**
   * Invité : app élève — chat de session plein écran (`/m/eleve/live/chat?session=`), URL absolue recommandée.
   */
  eleveAppChatUrl = null,
  /**
   * Contrôle parent (ex. LiveHostPage) : même aperçu plein écran que le dock plateau.
   * Si défini, le modal est rendu par le parent ; sinon état interne au panneau.
   */
  previewMember: controlledPreview = undefined,
  onPreviewMemberChange = undefined,
  /**
   * Si false : voile très léger (plateau bien visible). Si true : assombrissement fort (salle d'attente, maquettes).
   * Clic sur le voile, × ou Échap pour fermer.
   */
  fullViewportDim = true,
  /**
   * Hôte en direct : aparté WebRTC + préécoute casque.
   * Visible uniquement après sélection d'un interlocuteur privé (vignette membre) ; `forumTarget` pilote l'aparté.
   */
  hostAsideMonitor = null,
  /**
   * Formateur hôte de la session uniquement : sans `true`, le routage média / aparté n'est pas proposé (invités, maquettes).
   */
  isLiveSessionHost = false,
  /**
   * Phase D — Sujet du live (fil PERSISTANT, ≠ chat éphémère). Objet fourni par le slot
   * parent (get-or-create idempotent via l'API `for-context`) ; null = non disponible
   * (invité, hors direct, ou accès refusé) → l'encart n'est pas rendu. Forme :
   * { topic, messages, loading, error, input, setInput, sending, onSend, currentUserId }.
   */
  liveTopic = null,
}) {
  const { toast } = useToast();
  const scrollRef = useRef(null);
  const liveTopicScrollRef = useRef(null);
  const prevSecretPeerRef = useRef(null);
  const [secretRoutingOpen, setSecretRoutingOpen] = useState(false);
  // Encart « Sujet du live » replié par défaut (le chat collectif reste l'usage premier).
  const [liveTopicOpen, setLiveTopicOpen] = useState(false);
  const parentHandlesPreview = typeof onPreviewMemberChange === 'function';
  const [internalPreview, setInternalPreview] = useState(null);
  const fullscreenMember = parentHandlesPreview ? controlledPreview : internalPreview;
  const setFullscreenMember = parentHandlesPreview ? onPreviewMemberChange : setInternalPreview;

  const hostMediaRoutingAllowed =
    Boolean(hostAsideMonitor) && !isGuestUi && isLiveSessionHost;

  const peerId = forumTarget ? String(forumTarget.id) : null;
  const msgs = forumTarget
    ? (whisperThreads[peerId] || []).map((m) => ({
        id: m.id,
        from: String(m.fromId) === String(user?.id) ? 'Vous' : forumTarget.name,
        msg: m.text,
        time: new Date(m.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        mine: String(m.fromId) === String(user?.id),
      }))
    : chatMessages.map((m) => ({
        id: m.id,
        from: m.name,
        msg: m.text,
        time: new Date(m.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        mine: String(m.userId) === String(user?.id),
      }));

  const openWas = useRef(open);
  useEffect(() => {
    if (openWas.current && !open) {
      setFullscreenMember(null);
      prevSecretPeerRef.current = null;
    }
    openWas.current = open;
  }, [open, setFullscreenMember]);

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, msgs.length, forumTarget?.id]);

  // Auto-scroll du fil « Sujet du live » (quand ouvert / nouveaux messages).
  const liveTopicMsgCount = liveTopic?.messages?.length ?? 0;
  useEffect(() => {
    if (!open || !liveTopicOpen) return;
    const el = liveTopicScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, liveTopicOpen, liveTopicMsgCount]);

  useEffect(() => {
    if (!hostMediaRoutingAllowed) {
      setSecretRoutingOpen(false);
      prevSecretPeerRef.current = null;
    }
  }, [hostMediaRoutingAllowed]);

  useEffect(() => {
    if (!open || !hostMediaRoutingAllowed) return;
    const id = forumTarget?.id != null ? String(forumTarget.id) : null;
    if (id == null) {
      setSecretRoutingOpen(false);
      prevSecretPeerRef.current = null;
      return;
    }
    if (id !== prevSecretPeerRef.current) {
      setSecretRoutingOpen(true);
    }
    prevSecretPeerRef.current = id;
  }, [open, hostMediaRoutingAllowed, forumTarget?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (fullscreenMember && !parentHandlesPreview) {
        setFullscreenMember(null);
        return;
      }
      if (!fullscreenMember) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, fullscreenMember, parentHandlesPreview, setFullscreenMember]);

  const sendForum = useCallback(() => {
    const t = forumInput.trim();
    if (!t) return;
    if (forumTarget) {
      if (
        isGuestUi
        && !guestCanChatPeer
        && guestPrivateTeacherUserId != null
        && String(forumTarget.id) !== String(guestPrivateTeacherUserId)
      ) {
        toast({
          title: 'Message privé',
          description: 'Les messages entre élèves sont désactivés pour cette session.',
          variant: 'destructive',
        });
        return;
      }
      onSendPrivate?.(peerId, t);
    } else {
      if (isGuestUi && !chatCollectiveEnabled) {
        toast({
          title: 'Chat désactivé',
          description: 'Le formateur a désactivé le forum collectif. Utilisez un message privé.',
          variant: 'destructive',
        });
        return;
      }
      onSendCollective?.(t);
    }
    setForumInput('');
  }, [
    forumInput,
    forumTarget,
    peerId,
    isGuestUi,
    chatCollectiveEnabled,
    onSendCollective,
    onSendPrivate,
    setForumInput,
    toast,
    guestCanChatPeer,
    guestPrivateTeacherUserId,
  ]);

  const onlineMembers = activeMembers.filter((m) => m.status === 'online');
  /** Hôte : même liste que le plateau + panneaux vides jusqu'à N ; invité : membres en ligne — liste verticale */
  const useHostStripDock = Array.isArray(stripDockMembers);
  const stripMembersBase = useHostStripDock ? stripDockMembers : onlineMembers;
  const stripMembers = useMemo(() => {
    if (!isGuestUi || guestCanChatPeer || guestPrivateTeacherUserId == null) {
      return stripMembersBase;
    }
    const tid = String(guestPrivateTeacherUserId);
    return stripMembersBase.filter((m) => m && String(m.id) === tid);
  }, [isGuestUi, guestCanChatPeer, guestPrivateTeacherUserId, stripMembersBase]);
  const emptyDockSlots = useHostStripDock
    ? Math.max(0, stripDockMinSlots - stripDockMembers.length)
    : 0;
  const collectiveLocked = isGuestUi && !chatCollectiveEnabled;
  const sendDisabled = !forumInput.trim() || (!forumTarget && collectiveLocked);
  const resolveLk = typeof getLiveKitParticipant === 'function' ? getLiveKitParticipant : () => null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key={fullViewportDim ? 'msg-backdrop' : 'msg-backdrop-stage'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={LIVE_DRAWER_BACKDROP_TRANSITION}
            className={fullViewportDim ? designerShellBackdrop : designerShellBackdropLiveStage}
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            key="msg-panel"
            {...liveDrawerAsideRight}
            className={designerShellDrawerClass('w-[min(100vw,560px)]')}
          >
            <div className={designerShellHeader}>
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className={designerShellIconBadge}>
                  <MessageCircle className="h-5 w-5" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold tracking-wide text-white/95">
                    {forumTarget ? `Message privé — ${forumTarget.name}` : 'LONGIA — Messagerie'}
                  </p>
                  <p className="mt-1 max-w-[340px] text-[10px] leading-relaxed text-white/38">
                    {forumTarget
                      ? LIVE_COMM_COPY[LIVE_COMM_LAYER.PRIVATE_DM]
                      : collectiveLocked
                        ? 'Forum collectif désactivé — choisissez une vignette vidéo pour écrire en privé.'
                        : LIVE_COMM_COPY[LIVE_COMM_LAYER.PUBLIC_FORUM]}
                  </p>
                </div>
              </div>
              <button type="button" onClick={onClose} className={designerShellCloseBtn} aria-label="Fermer">
                <X className="h-4 w-4" />
              </button>
            </div>

            {isGuestUi && eleveAppChatUrl ? (
              <div className="shrink-0 border-b border-amber-500/20 bg-amber-950/35 px-3 py-2.5">
                <p className="mb-1.5 flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-amber-200/80">
                  <MessageCircle className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
                  App {BRAND_NAME} — chat plein écran
                </p>
                <a
                  href={eleveAppChatUrl}
                  className="block truncate rounded-lg border border-amber-500/30 bg-black/30 px-2.5 py-1.5 text-center text-[11px] font-semibold text-amber-100/95 underline-offset-2 hover:underline"
                  title="Ouvrir le chat de session (maquette app élève)"
                >
                  Ouvrir le chat de session
                </a>
              </div>
            ) : null}

            {!isGuestUi && inviteUrl ? (
              <div className="shrink-0 border-b border-white/[0.08] bg-[#1a1815]/90 px-3 py-2.5">
                <p className="mb-1.5 flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/40">
                  <Link2 className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                  Lien d&apos;invitation — rejoindre la session
                </p>
                <div className="flex gap-2">
                  <a
                    href={inviteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 truncate rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[10px] font-mono text-[#e9bf72]/95 underline-offset-2 hover:underline"
                    title={inviteUrl}
                  >
                    {inviteUrl}
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        void navigator.clipboard?.writeText(inviteUrl);
                        toast({
                          title: 'Lien copié',
                          description: 'Vous pouvez l\'envoyer aux participants.',
                          duration: 2200,
                        });
                      } catch {
                        toast({
                          title: 'Copie impossible',
                          description: 'Autorisez le presse-papiers ou copiez le lien manuellement.',
                          variant: 'destructive',
                        });
                      }
                    }}
                    className="shrink-0 rounded-lg border border-[#C8960C]/40 bg-[#C8960C]/12 px-2.5 py-1.5 text-[10px] font-bold text-[#e9bf72] transition-colors hover:bg-[#C8960C]/20"
                  >
                    Copier
                  </button>
                </div>
              </div>
            ) : null}

            {liveTopic && !forumTarget ? (
              <div className="shrink-0 border-b border-amber-500/15 bg-[#0a0e12]/95">
                <button
                  type="button"
                  onClick={() => setLiveTopicOpen((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
                  aria-expanded={liveTopicOpen}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-950/40">
                      <MessagesSquare className="h-4 w-4 text-amber-200/90" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/55">
                        Sujet du live — fil persistant
                        {liveTopic.topic?.status === 'closed' ? (
                          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide text-white/50">Clôturé</span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] leading-snug text-white/40">
                        {liveTopic.error
                          ? 'Indisponible — réservé aux membres du cours.'
                          : liveTopic.topic?.subject || 'Questions et échanges conservés après le live'}
                      </span>
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-white/45 transition-transform',
                      liveTopicOpen && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </button>

                {liveTopicOpen ? (
                  <div className="px-3 pb-3">
                    {liveTopic.error ? (
                      <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-[11px] text-white/45">
                        Le Sujet du live est momentanément indisponible. Il est réservé aux participants et à l&apos;équipe encadrante.
                      </div>
                    ) : (
                      <>
                        <div
                          ref={liveTopicScrollRef}
                          className="max-h-[240px] space-y-2.5 overflow-y-auto rounded-lg border border-white/[0.08] bg-black/25 p-2.5 [scrollbar-width:thin] [scrollbar-color:rgba(212,163,106,0.2)_transparent]"
                        >
                          {liveTopic.loading && !liveTopic.messages?.length ? (
                            <p className="py-6 text-center text-[10px] text-white/35">Chargement du fil…</p>
                          ) : !liveTopic.messages?.length ? (
                            <p className="py-6 text-center text-[10px] text-white/35">
                              Aucun message — lancez le fil. Il restera consultable après le live.
                            </p>
                          ) : (
                            liveTopic.messages.map((m) => {
                              const mine = m.sender_id && m.sender_id === liveTopic.currentUserId;
                              return (
                                <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                                  <div
                                    className={cn(
                                      'max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-[12px] leading-relaxed',
                                      mine ? 'bg-amber-500/85 text-black' : 'bg-white/10 text-white/90',
                                    )}
                                  >
                                    {m.content}
                                  </div>
                                  {m.created_at ? (
                                    <span className="mt-0.5 px-1 text-[9px] tabular-nums text-white/30">
                                      {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  ) : null}
                                </div>
                              );
                            })
                          )}
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                          <input
                            value={liveTopic.input}
                            onChange={(e) => liveTopic.setInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                liveTopic.onSend();
                              }
                            }}
                            placeholder={
                              liveTopic.topic?.status === 'closed'
                                ? 'Fil clôturé.'
                                : liveTopic.topic?.id
                                  ? 'Écrire dans le Sujet du live…'
                                  : 'Ouverture du fil…'
                            }
                            disabled={!liveTopic.topic?.id || liveTopic.topic?.status === 'closed'}
                            className={cn(
                              designerShellInput,
                              'min-w-0 flex-1 text-[12px]',
                              (!liveTopic.topic?.id || liveTopic.topic?.status === 'closed') && 'opacity-45',
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => liveTopic.onSend()}
                            disabled={
                              !liveTopic.topic?.id ||
                              liveTopic.sending ||
                              !String(liveTopic.input || '').trim() ||
                              liveTopic.topic?.status === 'closed'
                            }
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/15 text-amber-200 transition-colors hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                            title="Envoyer dans le Sujet du live"
                            aria-label="Envoyer dans le Sujet du live"
                          >
                            <Send className="h-4 w-4" strokeWidth={2} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}

            {hostMemberSearch ? (
              <div className="shrink-0 border-b border-white/[0.08] bg-[#0f0e16]/95 px-3 py-2.5">
                <p className="mb-1.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/40">Recherche membre</p>
                <input
                  type="search"
                  value={hostMemberSearch.query}
                  onChange={(e) => hostMemberSearch.onQueryChange(e.target.value)}
                  placeholder="Chercher un membre…"
                  className={cn(designerShellInput, 'w-full text-[12px]')}
                  autoComplete="off"
                />
                {Array.isArray(hostMemberSearch.results) && hostMemberSearch.results.length > 0 ? (
                  <ul className="mt-2 max-h-[min(28vh,160px)] space-y-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(245,158,11,0.2)_transparent]">
                    {hostMemberSearch.results.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => hostMemberSearch.onPickMember(m)}
                          className="flex w-full items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1.5 text-left transition-colors hover:border-white/[0.14] hover:bg-white/[0.06]"
                        >
                          <div
                            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold"
                            style={{
                              background: `${m.color}33`,
                              border: `1.5px solid ${m.color}`,
                              color: m.color,
                            }}
                          >
                            {m.init}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[11px] font-semibold text-white/95">{m.name}</div>
                            <div className="truncate text-[9px] text-white/40">{m.grade}</div>
                          </div>
                          <span
                            className={cn(
                              'shrink-0 text-[9px] font-semibold',
                              m.status === 'online' ? 'text-amber-400' : 'text-amber-500/90',
                            )}
                          >
                            {m.status === 'online' ? 'En ligne' : 'Absent'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {hostMediaRoutingAllowed && forumTarget ? (
              <div className="shrink-0 border-b border-amber-500/15 bg-[#0a0810]/95 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setSecretRoutingOpen((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-left transition-colors hover:border-amber-500/25 hover:bg-amber-950/20"
                  aria-expanded={secretRoutingOpen}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-950/40">
                      <Shield className="h-4 w-4 text-amber-200/90" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/55">
                        <Headphones className="h-3 w-3 shrink-0 text-amber-300/80" aria-hidden />
                        Routage média — conversation secrète
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-snug text-white/40">
                        Aparté avec {forumTarget.name} — préécoute casque (hors salle)
                      </span>
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-white/45 transition-transform',
                      secretRoutingOpen && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </button>
                {secretRoutingOpen ? (
                  <div className="mt-2">
                    <LiveHostAsideAndMonitorBar
                      forumTarget={forumTarget}
                      asideState={hostAsideMonitor.asideState}
                      asideMode={hostAsideMonitor.asideMode}
                      startAside={hostAsideMonitor.startAside}
                      endAside={hostAsideMonitor.endAside}
                      monitorBus={hostAsideMonitor.monitorBus}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
              <div
                className={cn(
                  'flex w-[132px] shrink-0 flex-col gap-2.5 overflow-y-auto overflow-x-hidden border-r border-white/[0.08] bg-[#1a1815]/95 px-2.5 py-2',
                  '[scrollbar-width:thin] [scrollbar-color:rgba(245,158,11,0.2)_transparent]',
                  '[perspective:1100px] [transform-style:preserve-3d]',
                )}
              >
                <p className="px-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] text-white/40">
                  {useHostStripDock
                    ? `Panneaux verticaux — ${stripDockMinSlots} empl. (vides ou membres)`
                    : 'En ligne — défilez ↓'}
                </p>
                <ApplePointerTilt
                  className="w-full shrink-0"
                  disabled={collectiveLocked}
                  tiltDeg={LIVE_MEMBER_PANEL_TILT_DEG}
                  hoverScale={LIVE_MEMBER_PANEL_TILT_HOVER_SCALE}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (collectiveLocked) return;
                      setForumTarget(null);
                      setFullscreenMember(null);
                    }}
                    disabled={collectiveLocked}
                    title={collectiveLocked ? 'Forum collectif désactivé par le formateur' : 'Chat de toute la salle'}
                    className={cn(
                      'flex h-[72px] w-full flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 transition-all',
                      !forumTarget && !collectiveLocked
                        ? 'border-amber-400/45 bg-amber-500/12 text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                        : 'border-white/[0.1] bg-white/[0.03] text-white/55 hover:border-white/[0.16] hover:bg-white/[0.06]',
                      collectiveLocked && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-500/25 bg-amber-500/10" aria-hidden>
                      <Globe className="h-4 w-4 text-amber-200/90" strokeWidth={1.75} />
                    </span>
                    <span className="text-[8px] font-bold uppercase tracking-wide">Tous</span>
                  </button>
                </ApplePointerTilt>
                {stripMembers.map((m) => {
                  const lkParticipant = resolveLk(m);
                  const isPromotedCard =
                    useHostStripDock
                    && stripDockPromotedId != null
                    && String(m.id) === String(stripDockPromotedId);
                  const isSel = forumTarget && String(forumTarget.id) === String(m.id);
                  const guestStripTitle =
                    isGuestUi && chatCollectiveEnabled
                      ? `${m.name} — aperçu (double-clic : aparté si autorisé)`
                      : `${m.name} — aparté / aperçu`;
                  return (
                    <LiveHostMemberPanelCard
                      key={m.id}
                      as="button"
                      member={m}
                      liveKitParticipant={lkParticipant}
                      mediaEpoch={liveKitMediaEpoch}
                      isPromoted={isPromotedCard}
                      preferLiveVideo
                      isSelected={Boolean(isSel)}
                      pointerTilt
                      title={guestStripTitle}
                      onClick={() => {
                        /*
                          Invité + forum collectif actif : un clic ne doit pas basculer le fil vers
                          les apartés (whisperThreads), sinon les messages du formateur (live_session_chat)
                          disparaissent du panneau alors que les notifs LONGIA continuent d'arriver.
                          Exception : apartés pairs désactivés → seul le MP formateur est possible : clic = aparté prof.
                        */
                        if (
                          isGuestUi
                          && chatCollectiveEnabled
                          && (guestCanChatPeer
                            || guestPrivateTeacherUserId == null
                            || String(m.id) !== String(guestPrivateTeacherUserId))
                        ) {
                          setFullscreenMember(m);
                          return;
                        }
                        setForumTarget(m);
                        setFullscreenMember(m);
                      }}
                      onDoubleClick={(e) => {
                        if (!isGuestUi || !chatCollectiveEnabled || !guestCanChatPeer) return;
                        e.preventDefault();
                        setForumTarget(m);
                        setFullscreenMember(m);
                      }}
                      className="h-[88px] min-h-[88px] w-full shrink-0"
                    />
                  );
                })}
                {Array.from({ length: emptyDockSlots }).map((_, i) => (
                  <ApplePointerTilt
                    key={`msg-strip-empty-${i}`}
                    className="w-full shrink-0"
                    tiltDeg={LIVE_MEMBER_PANEL_TILT_DEG}
                    hoverScale={LIVE_MEMBER_PANEL_TILT_HOVER_SCALE}
                  >
                    <div
                      data-testid="live-dock-slot-empty"
                      className="flex min-h-[88px] w-full flex-col items-center justify-center rounded-[4px] border border-dashed border-white/[0.12] bg-white/[0.02] px-1.5 py-2"
                    >
                      <span className="text-center text-[8px] leading-snug text-white/[0.28]">Panel disponible</span>
                    </div>
                  </ApplePointerTilt>
                ))}
              </div>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <div ref={scrollRef} className={designerShellMainScroll}>
                  {msgs.length === 0 ? (
                    <p className="py-12 text-center text-[11px] text-white/32">
                      Aucun message — le fil apparaît ici.
                    </p>
                  ) : (
                    msgs.map((m, i) => (
                      <div key={m.id != null ? String(m.id) : `msg-${i}`} className={designerShellMessageBubble(m.mine)}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'text-[10px] font-semibold uppercase tracking-wide',
                              m.mine ? 'text-amber-200/90' : 'text-white/55',
                            )}
                          >
                            {m.from}
                          </span>
                          <span className="text-[9px] tabular-nums text-white/28">{m.time}</span>
                        </div>
                        <p className="text-[12px] leading-relaxed text-white/[0.88]">{m.msg}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className={designerShellComposer}>
                  <div
                    className={cn(
                      designerShellComposerUnified,
                      'focus-within:border-amber-500/30 focus-within:shadow-[0_0_0_1px_rgba(212,163,106,0.1)]',
                    )}
                  >
                    <input
                      value={forumInput}
                      onChange={(e) => setForumInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') sendForum();
                      }}
                      placeholder={forumTarget ? 'Message privé…' : 'Message collectif…'}
                      disabled={!forumTarget && collectiveLocked}
                      className={cn(
                        designerShellComposerUnifiedInput,
                        !forumTarget && collectiveLocked && 'opacity-45',
                      )}
                    />
                    <button
                      type="button"
                      onClick={sendForum}
                      disabled={sendDisabled}
                      className={designerShellComposerUnifiedSendAmber}
                      title="Envoyer"
                      aria-label="Envoyer"
                    >
                      <Send className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.aside>

          {!parentHandlesPreview ? (
            <LiveMemberVideoPreviewModal
              member={fullscreenMember}
              onClose={() => setFullscreenMember(null)}
              liveKitMediaEpoch={liveKitMediaEpoch}
              getLiveKitParticipant={getLiveKitParticipant}
              memberSchoolLifeEnabled={memberSchoolLifeEnabled}
            />
          ) : null}
        </>
      )}
    </AnimatePresence>
  );
}
