/**
 * Panneau hôte — gestion des invitations (aligné maquette mobile LiRi).
 */
import React, { useCallback, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  BookOpen,
  Copy,
  Crown,
  Hourglass,
  Link2,
  Mail,
  MessageCircle,
  Mic,
  MoreVertical,
  QrCode,
  Send,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

function shareBody(sessionTitle, inviteUrl) {
  const t = sessionTitle?.trim();
  if (t) return `${t}\n\n${inviteUrl}`;
  return `Rejoignez la session sur LIRI :\n${inviteUrl}`;
}

/** Boutons principaux violet plein (maquette ~ #6332C1) */
function PurpleButton({ children, className, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-[11px] font-bold text-white shadow-[0_2px_14px_rgba(124,58,237,0.38)] transition-colors',
        'bg-liri-violet hover:bg-liri-violet/92 active:scale-[0.98]',
        'disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export default function LiveHostInviteManagementPanel({
  inviteUrl = '',
  sessionTitle = '',
  hostDisplayName = '',
  participantOnlineCount = 1,
  waitingEntries = [],
  /** Chronomètre session « 02:29 » — si défini, affiche la ligne EN DIRECT */
  liveDuration = '',
  /** Titre étape pédagogique (carte « ÉTAPE EN COURS ») */
  currentStepTitle = '',
  onApproveWaiting,
  onRejectWaiting,
  onOpenLongiaWaiting,
  /** Guide produit (optionnel) */
  onOpenGuide,
}) {
  const { toast } = useToast();
  const [qrOpen, setQrOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');

  const canShare = Boolean(inviteUrl);

  const hostCardLabel = sessionTitle?.trim() || hostDisplayName || 'Formateur';
  const avatarLetter = hostCardLabel.trim().charAt(0).toUpperCase() || '?';

  const mailtoInvite = useMemo(() => {
    if (!canShare) return '';
    const subject = encodeURIComponent(sessionTitle?.trim() || 'Invitation session LIRI');
    const body = encodeURIComponent(shareBody(sessionTitle, inviteUrl));
    return `mailto:?subject=${subject}&body=${body}`;
  }, [canShare, sessionTitle, inviteUrl]);

  const mailtoTargeted = useMemo(() => {
    const to = emailDraft.trim();
    if (!to || !canShare) return '';
    const subject = encodeURIComponent(sessionTitle?.trim() || 'Invitation session LIRI');
    const body = encodeURIComponent(shareBody(sessionTitle, inviteUrl));
    return `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`;
  }, [emailDraft, canShare, sessionTitle, inviteUrl]);

  const whatsappHref = useMemo(() => {
    if (!canShare) return '';
    const text = encodeURIComponent(shareBody(sessionTitle, inviteUrl));
    return `https://wa.me/?text=${text}`;
  }, [canShare, sessionTitle, inviteUrl]);

  const copyLink = useCallback(() => {
    if (!inviteUrl) return;
    try {
      void navigator.clipboard?.writeText(inviteUrl);
      toast({
        title: 'Lien copié',
        description: 'Vous pouvez le partager avec les participants.',
        duration: 2200,
      });
    } catch {
      toast({
        title: 'Copie impossible',
        description: 'Autorisez le presse-papiers ou copiez le lien manuellement.',
        variant: 'destructive',
      });
    }
  }, [inviteUrl, toast]);

  const openMailto = useCallback((href) => {
    if (!href) return;
    try {
      window.location.href = href;
    } catch {
      /* ignore */
    }
  }, []);

  const handleGuide = useCallback(() => {
    if (typeof onOpenGuide === 'function') {
      onOpenGuide();
      return;
    }
    toast({
      title: 'Guide',
      description: 'Documentation participant disponible prochainement.',
      duration: 2600,
    });
  }, [onOpenGuide, toast]);

  const waitingPreview = Array.isArray(waitingEntries) ? waitingEntries.slice(0, 4) : [];

  const cardClass =
    'rounded-2xl border border-white/[0.07] bg-[#16161c]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';

  return (
    <div className="font-liri mb-2 shrink-0 space-y-3 rounded-2xl border border-white/[0.06] bg-[#0f0f12] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      {/* EN DIRECT + durée */}
      {liveDuration ? (
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/60 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,.85)]" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-orange-400/95">
            En direct
          </span>
          <span className="ml-auto font-mono text-[11px] tabular-nums text-white/40">{liveDuration}</span>
        </div>
      ) : null}

      {/* Étape en cours */}
      {currentStepTitle ? (
        <div
          className={cn(
            'flex w-full items-start gap-2.5 rounded-2xl border border-emerald-500/35 bg-emerald-950/20 px-3 py-2.5 text-left',
          )}
          role="status"
          aria-label={`Étape en cours : ${currentStepTitle}`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15">
            <BookOpen className="h-3.5 w-3.5 text-emerald-300/90" strokeWidth={1.75} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[8px] font-bold uppercase tracking-[0.14em] text-emerald-400/90">
              Étape en cours
            </span>
            <span className="mt-1 block text-[12px] font-semibold leading-snug text-white/90">{currentStepTitle}</span>
          </span>
          <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-white/30" aria-hidden />
        </div>
      ) : null}

      {/* Compteur rapide */}
      <p className="flex items-center gap-1.5 text-[11px] text-white/50">
        <span aria-hidden className="text-[11px] opacity-80">
          👤
        </span>
        <span>
          {participantOnlineCount} participant{participantOnlineCount > 1 ? 's' : ''} en ligne
        </span>
      </p>

      {/* Inviter par lien */}
      <section className={cn(cardClass, 'p-3')}>
        <p className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-white/55">
          <Link2 className="h-3 w-3 shrink-0 text-liri-violet/85" strokeWidth={1.75} aria-hidden />
          Inviter par lien
        </p>
        <div className="flex gap-2">
          <input
            readOnly
            value={inviteUrl || '—'}
            className="min-w-0 flex-1 truncate rounded-2xl border border-white/[0.08] bg-black/40 px-3 py-2.5 font-mono text-[10px] leading-snug text-white/88 shadow-inner"
            title={inviteUrl || undefined}
          />
          <PurpleButton disabled={!canShare} onClick={copyLink} className="min-w-[88px] px-3">
            <Copy className="h-3.5 w-3.5 opacity-95" strokeWidth={1.75} aria-hidden />
            Copier
          </PurpleButton>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href={canShare ? whatsappHref : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 py-2 text-center text-[9px] font-semibold transition-colors',
              canShare
                ? 'border-emerald-500/35 bg-emerald-950/40 text-emerald-50 hover:bg-emerald-950/55'
                : 'pointer-events-none border-white/10 text-white/35',
            )}
          >
            <MessageCircle className="h-4 w-4 text-emerald-400/85" strokeWidth={1.75} aria-hidden />
            WhatsApp
          </a>
          <button
            type="button"
            disabled={!canShare}
            onClick={() => openMailto(mailtoInvite)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 py-2 text-center text-[9px] font-semibold transition-colors',
              canShare
                ? 'border-liri-blue/40 bg-liri-blue/15 text-sky-50 hover:bg-liri-blue/22'
                : 'cursor-not-allowed border-white/10 text-white/35',
            )}
          >
            <Mail className="h-4 w-4 text-liri-blue/90" strokeWidth={1.75} aria-hidden />
            Email
          </button>
          <button
            type="button"
            disabled={!canShare}
            title="Copie le lien de session (URL complète — lien court serveur à venir)"
            onClick={copyLink}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 py-2 text-center text-[9px] font-semibold transition-colors',
              canShare
                ? 'border-liri-violet/45 bg-liri-violet/18 text-violet-50 hover:bg-liri-violet/28'
                : 'cursor-not-allowed border-white/10 text-white/35',
            )}
          >
            <Link2 className="h-4 w-4 text-liri-violet/90" strokeWidth={1.75} aria-hidden />
            Lien court
          </button>
          <button
            type="button"
            disabled={!canShare}
            onClick={() => setQrOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 py-2 text-center text-[9px] font-semibold transition-colors',
              canShare
                ? 'border-white/14 bg-white/[0.06] text-white/92 hover:bg-white/[0.1]'
                : 'cursor-not-allowed text-white/35',
            )}
          >
            <QrCode className="h-4 w-4 text-white/65" strokeWidth={1.75} aria-hidden />
            QR code
          </button>
        </div>
      </section>

      {/* Inviter par e-mail */}
      <section className={cn(cardClass, 'p-3')}>
        <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.16em] text-white/55">
          Inviter par e-mail
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            autoComplete="off"
            placeholder="email@exemple.com"
            value={emailDraft}
            onChange={(e) => setEmailDraft(e.target.value)}
            className="min-w-0 flex-1 rounded-2xl border border-white/[0.08] bg-black/35 px-3 py-2.5 text-[12px] text-white placeholder:text-white/28 shadow-inner"
          />
          <PurpleButton
            disabled={!emailDraft.trim() || !canShare}
            onClick={() => openMailto(mailtoTargeted)}
            className="min-w-[92px]"
          >
            <Send className="h-3.5 w-3.5 opacity-95" strokeWidth={1.75} aria-hidden />
            Envoyer
          </PurpleButton>
        </div>
      </section>

      {/* Participants — formateur */}
      <section className={cn(cardClass, 'p-3')}>
        <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.14em] text-white/45">
          Participants ({participantOnlineCount})
        </p>
        <div className="flex items-center gap-3 rounded-2xl border border-liri-violet/28 bg-liri-violet/[0.12] px-2.5 py-2">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-liri-violet text-[14px] font-bold text-white shadow-inner">
            {avatarLetter}
            <span
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#16161c] bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.75)]"
              aria-hidden
            />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-white/95">{hostCardLabel}</div>
            <div className="mt-1 inline-flex rounded-lg bg-liri-violet/45 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
              Vous (formateur)
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/[0.06] bg-black/20 text-amber-400/85">
              <Crown className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/[0.06] bg-black/20 text-white/65">
              <Mic className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/[0.06] bg-black/20 text-white/45">
              <MoreVertical className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
            </span>
          </div>
        </div>
      </section>

      {/* File d’attente */}
      <section className={cn(cardClass, 'border-sky-500/25 bg-sky-950/12 p-3')}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Hourglass className="h-3.5 w-3.5 shrink-0 text-sky-400/85" strokeWidth={1.75} aria-hidden />
            <span className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-sky-100/95">
              En attente d&apos;approbation
            </span>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[11px] font-bold tabular-nums text-sky-300">
            {waitingEntries.length}
          </span>
        </div>

        {waitingEntries.length === 0 ? (
          <p className="py-1 text-[11px] leading-snug text-white/45">Aucune demande en attente</p>
        ) : (
          <ul className="max-h-[140px] space-y-2 overflow-y-auto [scrollbar-width:thin]">
            {waitingPreview.map((e) => {
              const name = e.profile?.name || 'Participant';
              return (
                <li
                  key={e.id}
                  className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/30 px-2 py-2"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500/25 text-[10px] font-bold text-sky-200">
                    {name.substring(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-white/90">{name}</span>
                  <button
                    type="button"
                    title="Accepter"
                    onClick={() => onApproveWaiting?.(e.id)}
                    className="shrink-0 rounded-xl border border-emerald-500/45 bg-emerald-500/18 px-2 py-1 text-[10px] font-bold text-emerald-400"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    title="Refuser"
                    onClick={() => onRejectWaiting?.(e.id)}
                    className="shrink-0 rounded-xl border border-red-500/40 bg-red-500/12 px-2 py-1 text-[10px] font-bold text-red-400"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {typeof onOpenLongiaWaiting === 'function' ? (
          <button
            type="button"
            onClick={onOpenLongiaWaiting}
            className="mt-3 flex w-full items-center justify-between gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-2.5 py-2 text-left text-[10px] font-semibold text-white/78 transition-colors hover:bg-white/[0.07]"
          >
            <span>Gestion complète (LONGIA)</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/40" strokeWidth={1.75} aria-hidden />
          </button>
        ) : null}
      </section>

      {/* Aide */}
      <section className={cn(cardClass, 'border-liri-gold/22 bg-gradient-to-br from-[#1a1510]/90 to-[#121218]/95 p-3')}>
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-liri-gold/90" strokeWidth={1.75} aria-hidden />
          <div className="min-w-0 flex-1 pr-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12px] font-semibold text-white/95">Besoin d&apos;aide ?</p>
              <button
                type="button"
                onClick={handleGuide}
                className="group inline-flex shrink-0 items-center gap-0.5 text-[10px] font-bold text-liri-gold/95 hover:text-liri-gold"
              >
                Voir guide
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-white/48">
              Partage le lien ou invite par email pour faire rejoindre des participants.
            </p>
          </div>
        </div>
      </section>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-[320px] border-white/15 bg-[#121218] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">QR code — rejoindre la session</DialogTitle>
            <DialogDescription className="text-white/55">
              Scannez pour ouvrir le lien d&apos;invitation sur mobile.
            </DialogDescription>
          </DialogHeader>
          {canShare ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="rounded-2xl bg-white p-3 shadow-lg">
                <QRCodeSVG value={inviteUrl} size={200} level="M" />
              </div>
              <PurpleButton onClick={copyLink} className="w-full max-w-[220px]">
                Copier le lien
              </PurpleButton>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
