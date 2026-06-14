import React, { useRef, useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, GraduationCap, Star, Search, Send } from 'lucide-react';
import { RoomEvent, Track } from 'livekit-client';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { liveRegulariteFromStats } from '@/lib/liveRegularite';
import { MemberSchoolLifeInlinePanel } from '@/components/liri/live-room/MemberSchoolLifeInlinePanel';

function isProfileUuid(s) {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/**
 * Modal plein écran — vidéo d'un membre (style proche du mode Q&R).
 * Régularité : colonnes profiles (live_immersive_session_count) + libellé dérivé.
 */
export function MemberVideoModal({
  open,
  onClose,
  roomRef,
  participant,
  /** Métadonnées présence zone 3 (optionnel) */
  presenceMeta = null,
  /** Surcharge texte si les stats ne sont pas lisibles (RLS) */
  liveRegularite = null,
  isHost = false,
  onPromoteToStage,
  isPromoted = false,
  /** Id session live (Arena / immersif) — active messagerie privée éphémère */
  whisperSessionKey = null,
  currentUserId = null,
  whisperMessages = [],
  onSendWhisper,
  /** { id, name, isLocal? }[] — recherche rapide pour ouvrir un autre membre */
  whisperPickableMembers = [],
  onPickWhisperMember,
  /** Message privé reçu d'un autre membre pendant que ce modal affiche quelqu'un d'autre */
  whisperHasBackgroundUnread = false,
  /**
   * `embedded` = positionné dans le shell live (absolute).
   * `viewport` = fixed plein viewport + safe areas (LIRI mobile / petite fenêtre).
   */
  viewport = 'embedded',
  /** Hôte : vue vie scolaire (aperçu chargé). Invités : désactivable par paramètre de session. */
  allowSchoolLifePreview = true,
  onHostMuteParticipant,
  onHostRemoveParticipant,
  /** Hôte : mode salle « examen surveillé » — commande caméra à distance (après consentement invité). */
  hostRemoteCameraControl = false,
  onHostRemoteCamera,
}) {
  const videoRef = useRef(null);
  const cloneRef = useRef(null);
  const [videoLive, setVideoLive] = useState(false);
  const [regulariteRow, setRegulariteRow] = useState(null);
  const [regulariteLoading, setRegulariteLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [whisperDraft, setWhisperDraft] = useState('');
  const whisperListRef = useRef(null);
  const [schoolLifeOpen, setSchoolLifeOpen] = useState(false);

  const id = participant?.id;
  const name = participant?.name || 'Membre';
  const isLocal = Boolean(participant?.isLocal);

  const bindVideo = useCallback(() => {
    const room = roomRef?.current;
    const el = videoRef.current;
    setVideoLive(false);
    if (cloneRef.current) {
      try {
        cloneRef.current.stop();
      } catch {
        /* ignore */
      }
      cloneRef.current = null;
    }
    if (el) el.srcObject = null;
    if (!open || !room || !el || !id) return;

    let lkParticipant = isLocal ? room.localParticipant : room.remoteParticipants.get(String(id));
    if (!lkParticipant && !isLocal) {
      for (const p of room.remoteParticipants.values()) {
        if (String(p.sid) === String(id) || String(p.identity) === String(id)) {
          lkParticipant = p;
          break;
        }
      }
    }
    if (!lkParticipant) return;

    const pub = lkParticipant.getTrackPublication(Track.Source.Camera);
    const mediaTrack = pub?.track?.mediaStreamTrack;
    if (!mediaTrack || pub.isMuted) return;

    try {
      const clone = mediaTrack.clone();
      cloneRef.current = clone;
      el.srcObject = new MediaStream([clone]);
      el.play().catch(() => {});
    } catch {
      /* clone indisponible */
    }
  }, [roomRef, id, isLocal, open]);

  useEffect(() => {
    if (!open) return undefined;
    bindVideo();
    const room = roomRef?.current;
    if (!room) return undefined;

    const onChange = () => bindVideo();
    room.on(RoomEvent.LocalTrackPublished, onChange);
    room.on(RoomEvent.LocalTrackUnpublished, onChange);
    room.on(RoomEvent.TrackPublished, onChange);
    room.on(RoomEvent.TrackUnpublished, onChange);
    room.on(RoomEvent.TrackSubscribed, onChange);
    room.on(RoomEvent.TrackUnsubscribed, onChange);

    return () => {
      room.off(RoomEvent.LocalTrackPublished, onChange);
      room.off(RoomEvent.LocalTrackUnpublished, onChange);
      room.off(RoomEvent.TrackPublished, onChange);
      room.off(RoomEvent.TrackUnpublished, onChange);
      room.off(RoomEvent.TrackSubscribed, onChange);
      room.off(RoomEvent.TrackUnsubscribed, onChange);
      if (cloneRef.current) {
        try {
          cloneRef.current.stop();
        } catch {
          /* ignore */
        }
        cloneRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      setVideoLive(false);
    };
  }, [open, bindVideo, roomRef]);

  useEffect(() => {
    if (!open || !id || !isProfileUuid(id)) {
      setRegulariteRow(null);
      setRegulariteLoading(false);
      return undefined;
    }
    let cancelled = false;
    setRegulariteLoading(true);
    setRegulariteRow(null);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('live_immersive_session_count, live_immersive_last_at')
          .eq('id', id)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          setRegulariteRow(null);
          return;
        }
        setRegulariteRow(
          liveRegulariteFromStats({
            count: data?.live_immersive_session_count,
            lastAt: data?.live_immersive_last_at,
          }),
        );
      } catch {
        if (!cancelled) setRegulariteRow(null);
      } finally {
        if (!cancelled) setRegulariteLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, id]);

  const joinedLabel = presenceMeta?.joinedAt
    ? formatDistanceToNow(new Date(presenceMeta.joinedAt), { addSuffix: true, locale: fr })
    : null;

  const whisperEnabled = Boolean(
    whisperSessionKey && currentUserId && onSendWhisper && !isLocal,
  );
  const q = memberSearch.trim().toLowerCase();
  const pickableFiltered = (whisperPickableMembers || []).filter((p) => {
    if (!p?.id) return false;
    if (String(p.id) === String(currentUserId)) return false;
    if (!q) return true;
    return String(p.name || p.id || '').toLowerCase().includes(q);
  }).slice(0, 12);

  useEffect(() => {
    if (!open) {
      setMemberSearch('');
      setWhisperDraft('');
      setSchoolLifeOpen(false);
    }
  }, [open]);

  useEffect(() => {
    const el = whisperListRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [whisperMessages, open, id]);

  const submitWhisper = () => {
    const t = whisperDraft.trim();
    if (!t || !whisperEnabled) return;
    onSendWhisper(t);
    setWhisperDraft('');
  };

  const isViewport = viewport === 'viewport';

  return (
    <AnimatePresence>
      {open && participant && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn(
            'flex flex-col bg-gradient-to-b from-black/80 to-black/70 backdrop-blur-xl',
            isViewport
              ? 'fixed inset-0 z-[60]'
              : 'absolute inset-0 z-[55]',
          )}
        >
          <div
            className={cn(
              'absolute left-1/2 -translate-x-1/2 flex items-center gap-2 min-h-8 px-4 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] z-[40] max-w-[min(92vw,320px)]',
              isViewport ? 'top-[max(0.75rem,env(safe-area-inset-top))]' : 'top-4',
            )}
          >
            <Star className="w-3.5 h-3.5 text-[var(--school-accent)]" />
            <span className="text-xs font-semibold text-[var(--school-accent)]">Membre en live</span>
            {whisperHasBackgroundUnread ? (
              <span
                className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.7)] animate-pulse"
                title="Message privé d'un autre membre"
                aria-hidden
              />
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className={cn(
              'absolute h-10 w-10 rounded-full bg-white/8 border border-white/12 text-gray-300 flex items-center justify-center hover:text-white z-[60]',
              isViewport
                ? 'top-[max(0.5rem,env(safe-area-inset-top))] right-[max(0.5rem,env(safe-area-inset-right))]'
                : 'top-4 right-4 h-9 w-9',
            )}
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>

          <div
            className={cn(
              'flex-1 flex flex-col lg:flex-row lg:items-stretch lg:justify-center gap-6 px-4 min-h-0 overflow-y-auto lg:overflow-hidden',
              isViewport
                ? 'pt-[max(4.25rem,env(safe-area-inset-top)+3.25rem)] pb-[max(1.25rem,env(safe-area-inset-bottom))]'
                : 'pt-14 pb-8',
            )}
          >
            <div className="flex flex-col items-center justify-center min-w-0 flex-1 lg:max-w-[min(100%,720px)] gap-6">
            <div className="relative w-full max-w-3xl aspect-video rounded-2xl overflow-hidden border border-white/15 bg-black/50 shadow-2xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={cn(
                  'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
                  videoLive ? 'opacity-100' : 'opacity-0',
                )}
                onPlaying={() => setVideoLive(true)}
                onEmptied={() => setVideoLive(false)}
              />
              {!videoLive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#1a2540] to-black/80">
                  {presenceMeta?.avatar_url ? (
                    <img
                      src={presenceMeta.avatar_url}
                      alt=""
                      className="h-20 w-20 rounded-full object-cover border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)]"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[color-mix(in_srgb,var(--school-accent)_28%,transparent)] to-[#1a2540] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] flex items-center justify-center text-xl font-bold text-[var(--school-accent)]">
                      {(name || '?').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <p className="text-sm text-white/55">Caméra inactive ou non disponible</p>
                </div>
              )}
            </div>

            <div className="w-full max-w-md space-y-3 text-center">
              <h2 className="text-lg font-semibold text-white">{name}</h2>
              <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-white/60">
                {presenceMeta?.role ? (
                  <span className="px-2 py-0.5 rounded-full border border-white/12 bg-white/[0.04]">
                    {presenceMeta.role}
                  </span>
                ) : null}
                {joinedLabel ? <span>Connecté {joinedLabel}</span> : null}
                {isPromoted ? (
                  <span className="px-2 py-0.5 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-[#f5dd8a]">
                    À l&apos;antenne
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-white/45">
                Régularité live :{' '}
                <span className="text-white/70">
                  {liveRegularite
                    || (regulariteLoading
                      ? 'Chargement…'
                      : regulariteRow
                        ? [
                            `${regulariteRow.label} · ${regulariteRow.count} session${regulariteRow.count > 1 ? 's' : ''} immersive${regulariteRow.count > 1 ? 's' : ''}`,
                            regulariteRow.lastAt
                              ? `Dernière : ${formatDistanceToNow(new Date(regulariteRow.lastAt), { addSuffix: true, locale: fr })}`
                              : null,
                          ].filter(Boolean).join(' — ')
                        : '—')}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {isHost && onPromoteToStage && !isLocal ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-[#f5dd8a] hover:bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)]"
                  onClick={() => {
                    onPromoteToStage(id);
                    onClose?.();
                  }}
                >
                  Mettre à l&apos;antenne
                </Button>
              ) : null}
              {isHost && (onHostMuteParticipant || onHostRemoveParticipant) && !isLocal ? (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {onHostMuteParticipant ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-amber-400/35 text-amber-100/90 hover:bg-amber-500/10"
                      onClick={() => onHostMuteParticipant()}
                    >
                      Couper son
                    </Button>
                  ) : null}
                  {onHostRemoveParticipant ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-red-400/40 text-red-200/90 hover:bg-red-500/15"
                      onClick={() => onHostRemoveParticipant()}
                    >
                      Retirer
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {isHost && hostRemoteCameraControl && onHostRemoteCamera && !isLocal ? (
                <div className="flex flex-wrap items-center justify-center gap-2 w-full">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-cyan-400/35 text-cyan-100/95 hover:bg-cyan-500/12"
                    onClick={() => onHostRemoteCamera(true)}
                  >
                    Allumer la caméra (élève)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-slate-400/35 text-slate-100/90 hover:bg-slate-500/12"
                    onClick={() => onHostRemoteCamera(false)}
                  >
                    Couper la caméra (élève)
                  </Button>
                </div>
              ) : null}
              {allowSchoolLifePreview ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2 bg-white/10 border-white/15 text-white hover:bg-white/15"
                  onClick={() => setSchoolLifeOpen(true)}
                >
                  <GraduationCap className="w-4 h-4" />
                  Vie scolaire (aperçu)
                </Button>
              ) : !isHost ? (
                <p className="text-[10px] text-white/38 max-w-xs text-center px-2 leading-snug">
                  Vue détaillée vie scolaire : désactivée pour les invités (réglage sécurité de la salle).
                </p>
              ) : null}
              <Button type="button" variant="ghost" className="text-white/70 hover:text-white" onClick={onClose}>
                Fermer
              </Button>
            </div>
            </div>

            {whisperSessionKey && currentUserId && onPickWhisperMember && !schoolLifeOpen ? (
              <aside className="w-full lg:w-[min(380px,42vw)] shrink-0 flex flex-col gap-3 min-h-0 lg:border-l lg:border-white/10 lg:pl-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50 mb-1.5 flex items-center gap-2">
                    <span>Trouver un membre</span>
                    {whisperHasBackgroundUnread ? (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-[var(--school-accent)] shadow-[0_0_8px_rgba(212,175,55,0.6)]"
                        title="Nouveau message privé — voir la liste ou le toast"
                        aria-hidden
                      />
                    ) : null}
                  </p>
                  <div className="h-9 rounded-xl border border-white/12 bg-black/30 px-2.5 flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-white/35 shrink-0" />
                    <input
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Nom…"
                      className="bg-transparent text-xs text-white w-full outline-none placeholder:text-white/35"
                    />
                  </div>
                  {pickableFiltered.length > 0 ? (
                    <ul className="mt-2 max-h-[28vh] lg:max-h-[22vh] overflow-y-auto rounded-xl border border-white/10 bg-black/25 divide-y divide-white/[0.06]">
                      {pickableFiltered.map((p) => (
                        <li key={String(p.id)}>
                          <button
                            type="button"
                            onClick={() => onPickWhisperMember(p)}
                            className={cn(
                              'w-full text-left px-3 py-2 text-xs transition-colors',
                              String(p.id) === String(id)
                                ? 'bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-[#f5dd8a]'
                                : 'text-white/85 hover:bg-white/[0.06]',
                            )}
                          >
                            <span className="font-medium">{p.name || 'Membre'}</span>
                            {p.isLocal ? (
                              <span className="ml-1.5 text-[10px] text-white/40">(vous)</span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-white/40 mt-2 px-1">
                      {q ? 'Aucun membre ne correspond.' : 'Aucun autre membre dans la liste.'}
                    </p>
                  )}
                </div>

                {whisperEnabled ? (
                  <div className="flex flex-col flex-1 min-h-[200px] lg:min-h-0 gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
                      Message privé avec {name}
                    </p>
                    <p className="text-[10px] text-white/35 leading-snug">
                      Message privé entre vous deux (hors forum du tiroir latéral, visible par toute la salle).
                    </p>
                    <div
                      ref={whisperListRef}
                      className="flex-1 min-h-[120px] max-h-[32vh] lg:max-h-none lg:flex-1 overflow-y-auto rounded-xl border border-white/10 bg-black/35 p-2 space-y-2"
                    >
                      {whisperMessages.length === 0 ? (
                        <p className="text-[11px] text-white/35 text-center py-6">Aucun message encore.</p>
                      ) : (
                        whisperMessages.map((m) => {
                          const mine = String(m.fromId) === String(currentUserId);
                          return (
                            <div
                              key={m.id}
                              className={cn(
                                'max-w-[92%] rounded-lg px-2.5 py-1.5 text-[11px] leading-snug',
                                mine
                                  ? 'ml-auto bg-[color-mix(in_srgb,var(--school-accent)_22%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] text-white/95'
                                  : 'mr-auto bg-white/[0.06] border border-white/10 text-white/88',
                              )}
                            >
                              {m.text}
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={whisperDraft}
                        onChange={(e) => setWhisperDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            submitWhisper();
                          }
                        }}
                        placeholder="Écrire…"
                        className="flex-1 h-10 rounded-xl border border-white/12 bg-black/40 px-3 text-xs text-white outline-none placeholder:text-white/35"
                      />
                      <Button
                        type="button"
                        size="icon"
                        className="h-10 w-10 shrink-0 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] text-[#f5dd8a] hover:bg-[color-mix(in_srgb,var(--school-accent)_35%,transparent)]"
                        onClick={submitWhisper}
                        disabled={!whisperDraft.trim()}
                        aria-label="Envoyer"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ) : isLocal ? (
                  <p className="text-[11px] text-white/40">Messagerie privée indisponible sur votre propre flux.</p>
                ) : null}
              </aside>
            ) : null}
          </div>

          {schoolLifeOpen ? (
            <div
              className={cn(
                'absolute inset-0 z-[50] flex flex-col min-h-0 bg-gradient-to-b from-[#0a0f18]/97 to-black/95 backdrop-blur-xl px-3 sm:px-5',
                isViewport
                  ? 'pt-[max(3.5rem,env(safe-area-inset-top)+2.5rem)] pb-[max(1rem,env(safe-area-inset-bottom))]'
                  : 'pt-14 pb-4',
              )}
            >
              <MemberSchoolLifeInlinePanel
                studentId={id}
                studentName={name}
                onBack={() => setSchoolLifeOpen(false)}
              />
            </div>
          ) : null}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default MemberVideoModal;
