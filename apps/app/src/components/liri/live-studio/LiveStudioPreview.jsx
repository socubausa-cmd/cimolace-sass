import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Calendar, Video, Users, User, Lock, MessageSquare, Hand, Monitor,
  Mic, CircleDot, Shield, CheckCircle2, Sparkles,
  Brain, Zap, Volume2, LayoutPanelLeft, Key, Bell, UserCheck, GraduationCap, Eye,
  Camera,
  Waves,
  Globe,
  Repeat,
  ChevronDown,
  BarChart3,
  Expand,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const SESSION_TYPES = {
  classe: 'Classe virtuelle',
  entretien: 'Entretien privé',
  conference: 'Conférence',
};

const ACCESS_LABELS = {
  free:     { label: 'Accès libre',        color: 'text-emerald-300',  bg: 'bg-emerald-400/10 border-emerald-400/20' },
  password: { label: 'Mot de passe',       color: 'text-violet-300',    bg: 'bg-violet-500/10 border-violet-500/20' },
  manual:   { label: 'Validation hôte',    color: 'text-blue-300',     bg: 'bg-blue-400/10 border-blue-400/20' },
  double:   { label: 'Double validation',  color: 'text-purple-300',   bg: 'bg-purple-400/10 border-purple-400/20' },
};

export function LiveStudioPreview({ draft, onGoToDateStep, embedded = false }) {
  const [coverPreviewOpen, setCoverPreviewOpen] = useState(false);

  const {
    title, description, session_type, cover_image_url,
    scheduled_at, scheduled_time, duration_minutes,
    visibility_mode, invited_users, chat_enabled,
    hand_raise_enabled, screen_share_enabled,
    student_audio_enabled, student_video_enabled,
    recording_enabled, invite_only, waiting_room,
    manual_approval, recurrence, quiz_enabled,
    polls_enabled, ai_summary_enabled, ai_mindmap_enabled,
    // LIRI
    access_mode, invited_classes, invited_modules, invited_roles,
    notify_dashboard, notify_email, notify_whatsapp, waiting_room_audio_enabled,
  } = draft;

  const hasTitle = Boolean(title?.trim());
  const displayDate = scheduled_at && isValid(new Date(scheduled_at))
    ? format(new Date(scheduled_at), 'EEEE d MMMM', { locale: fr })
    : '—';
  const displayTime = scheduled_time || '—';
  const recurrenceLabel = recurrence && recurrence !== 'none' ? recurrence : 'Aucune';

  const accessInfo = ACCESS_LABELS[access_mode] || ACCESS_LABELS.free;

  const totalInvited = [
    ...(invited_users || []),
  ].length;

  const roomFeatures = [
    { key: 'chat', enabled: chat_enabled, icon: MessageSquare, label: 'Chat' },
    { key: 'hand', enabled: hand_raise_enabled, icon: Hand, label: 'Main levée' },
    { key: 'screen', enabled: screen_share_enabled, icon: Monitor, label: 'Partage écran' },
    { key: 'audio', enabled: student_audio_enabled, icon: Mic, label: 'Micro élèves' },
    { key: 'video', enabled: student_video_enabled, icon: Video, label: 'Caméra élèves' },
    { key: 'recording', enabled: recording_enabled, icon: CircleDot, label: 'Enregistrement' },
  ];

  const aiFeatures = [
    { key: 'quiz', enabled: quiz_enabled, icon: Sparkles, label: 'Quiz live' },
    { key: 'polls', enabled: polls_enabled, icon: Sparkles, label: 'Sondages' },
    { key: 'summary', enabled: ai_summary_enabled, icon: Brain, label: 'Résumé IA' },
    { key: 'mindmap', enabled: ai_mindmap_enabled, icon: Brain, label: 'Mindmap IA' },
    { key: 'neuronq', enabled: draft.neuronq_enabled, icon: Zap, label: 'Neuron-Q' },
    { key: 'neuro_recall', enabled: draft.neuro_recall_enabled, icon: GraduationCap, label: 'NeuroRecall' },
  ];

  const scenesObj = draft.smartboard_scenes || {};
  const activeScenes = Object.entries(scenesObj).filter(([, v]) => v !== false).map(([k]) => k);
  const hasAmbient = draft.ambient_audio_enabled && (draft.ambient_tracks || []).length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      className={cn('space-y-6', embedded && 'space-y-4')}
    >
      {!embedded && (
        <div className="relative overflow-hidden rounded-xl border border-[#2D3139] bg-[#12141a]/90 p-4">
          <div className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_3.8s_infinite] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-white">
            <Eye className="h-4 w-4 text-[#d97757]" />
            Aperçu visuel
          </h3>
          <p className="text-[11px] leading-relaxed text-gray-500">
            C&apos;est ainsi que les participants verront votre live.
          </p>
        </div>
      )}

      {/* Carte preview */}
      <motion.div
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        className="overflow-hidden rounded-2xl border border-[#d97757]/25 bg-[#14161c] shadow-[0_20px_44px_-28px_rgba(217,119,87,0.25)]"
      >
        {/* Cover — clic pour agrandir si une image est définie */}
        {cover_image_url ? (
          <motion.button
            type="button"
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.24 }}
            onClick={() => setCoverPreviewOpen(true)}
            aria-label="Voir la couverture en grand"
            title="Voir en grand"
            className={cn(
              'relative aspect-video w-full overflow-hidden rounded-t-[inherit] bg-cover bg-center text-left',
              'cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d97757]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#14161c]',
              'group',
            )}
            style={{ backgroundImage: `url(${cover_image_url})` }}
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/15 via-black/30 to-black/55" />
            <span className="pointer-events-none absolute bottom-2 right-2 z-[1] inline-flex items-center gap-1 rounded-lg border border-white/15 bg-black/45 px-2 py-1 text-[10px] font-medium text-white/90 opacity-0 shadow-lg backdrop-blur-sm transition-opacity group-hover:opacity-100">
              <Expand className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
              Agrandir
            </span>
          </motion.button>
        ) : (
          <motion.div
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.24 }}
            className="relative aspect-video flex items-center justify-center overflow-hidden rounded-t-[inherit] bg-gradient-to-br from-[#d97757]/30 via-[#151528] to-[#0a0c10]"
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/15 via-black/30 to-black/55" />
            <div className="relative z-[1] p-6 text-center">
              <Camera className="mx-auto mb-2 h-14 w-14 text-[#d97757]/85" strokeWidth={1.25} />
              <span className="text-sm text-gray-400">Image de couverture</span>
            </div>
          </motion.div>
        )}

        {/* Content */}
        <div className="p-5 space-y-4">
          <div>
            <span className="rounded px-2 py-0.5 text-xs font-medium bg-[#d97757]/18 text-[#d97757]">
              {SESSION_TYPES[session_type] || session_type}
            </span>
            <h4 className="text-lg font-semibold text-white mt-2">
              {hasTitle ? title : 'Titre du live'}
            </h4>
            {description?.trim() && (
              <p className="text-sm text-gray-400 mt-1 line-clamp-2">{description}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-gray-400">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-[#d97757]" strokeWidth={2} />
            <span className="text-gray-300">
              {displayDate}
              {' · '}
              {displayTime}
              {duration_minutes ? (
                <>
                  {' · '}
                  {duration_minutes} min
                </>
              ) : null}
            </span>
            {typeof onGoToDateStep === 'function' && (
              <button
                type="button"
                onClick={onGoToDateStep}
                className="ml-auto text-[11px] font-medium text-[#d97757] hover:underline"
              >
                Régler date…
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <Repeat className="h-3.5 w-3.5 shrink-0 text-gray-500" />
              Récurrence : <span className="text-gray-300">{recurrenceLabel}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 shrink-0 text-gray-500" />
              Fuseau :{' '}
              <span className="text-gray-300">{draft.timezone || '—'}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.07] pt-3">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <Lock className="h-3.5 w-3.5 shrink-0 text-gray-500" />
              {visibility_mode === 'secret' ? 'Secret' : 'Public'}
            </span>
            {invite_only && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Shield className="w-3 h-3" />
                Invitation uniquement
              </span>
            )}
            {waiting_room && (
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <User className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                Salle d&apos;attente
              </span>
            )}
            {manual_approval && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <CheckCircle2 className="w-3 h-3" />
                Validation manuelle
              </span>
            )}
            {invited_users?.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Users className="w-3 h-3" />
                {invited_users.length} invité(s)
              </span>
            )}
          </div>

          {/* Bloc LIRI */}
          <div className="border-t border-white/[0.07] pt-3">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">
              <Key className="h-3 w-3" /> Accès &amp; invitations
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium',
                  accessInfo.bg,
                  accessInfo.color,
                )}
              >
                {accessInfo.label}
              </span>
              {waiting_room !== false && (
                <span className="inline-flex items-center rounded-lg border border-white/12 bg-white/[0.06] px-2.5 py-1 text-[11px] text-gray-400">
                  Salle d&apos;attente{waiting_room_audio_enabled ? ' + Audio' : ''}
                </span>
              )}
              {notify_dashboard !== false && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/15 px-3 py-1.5 text-[11px] font-medium text-blue-300">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Dashboard
                </span>
              )}
              {(notify_email || notify_whatsapp) && (
                <span className="inline-flex items-center gap-1 rounded-lg border border-blue-400/20 bg-blue-400/10 px-2 py-1 text-[11px] text-blue-300">
                  <Bell className="w-3 h-3" />
                  {[notify_email && 'Email', notify_whatsapp && 'WhatsApp'].filter(Boolean).join(' + ')}
                </span>
              )}
              {totalInvited > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md border border-[#d97757]/25 bg-[#d97757]/8 px-2 py-1 text-[11px] text-[#d97757]">
                  <Users className="w-3 h-3" />
                  {totalInvited} individuel(s)
                </span>
              )}
              {(invited_classes || []).map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border border-emerald-400/20 bg-emerald-400/8 text-emerald-300">
                  <UserCheck className="w-3 h-3" />
                  {c.name || c}
                </span>
              ))}
              {(invited_modules || []).map((m, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border border-purple-400/20 bg-purple-400/8 text-purple-300">
                  <Sparkles className="w-3 h-3" />
                  {m.name || m}
                </span>
              ))}
              {(invited_roles || []).map((r, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border border-violet-400/20 bg-violet-400/8 text-violet-300 capitalize">
                  <Shield className="w-3 h-3" />
                  {r}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-white/10">
            <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Salle virtuelle</p>
            <div className="flex flex-wrap gap-1.5">
              {roomFeatures.map(({ key, enabled, icon: Icon, label }) => (
                <span
                  key={key}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border',
                    enabled
                      ? 'border-[#d97757]/30 bg-[#d97757]/10 text-[#d97757]'
                      : 'border-white/10 bg-white/5 text-gray-500'
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-white/10">
            <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">Interactions & IA</p>
            <div className="flex flex-wrap gap-1.5">
              {aiFeatures.map(({ key, enabled, icon: Icon, label }) => (
                <span
                  key={key}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border',
                    enabled
                      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                      : 'border-white/10 bg-white/5 text-gray-500'
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {activeScenes.length > 0 && (
            <div className="pt-2 border-t border-white/10">
              <p className="text-[11px] uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1">
                <LayoutPanelLeft className="w-3 h-3" /> Scènes SmartBoard
              </p>
              <div className="flex flex-wrap gap-1.5">
                {activeScenes.map((s) => (
                  <span key={s} className="inline-flex items-center rounded-md border border-[#d97757]/20 bg-[#d97757]/5 px-2 py-1 text-[11px] capitalize text-[#d97757]/90">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {hasAmbient && (
            <div className="pt-2 border-t border-white/10 flex items-center gap-2">
              <Volume2 className="h-3.5 w-3.5 text-[#d97757]/65" />
              <span className="text-[11px] text-gray-400">{(draft.ambient_tracks || []).length} piste(s) d&apos;ambiance</span>
            </div>
          )}
        </div>

        <div className="flex min-h-[40px] items-center gap-2 border-t border-[#2D3139] bg-[#07080c] px-3 py-2 text-[10px] text-gray-500">
          <Waves className="h-3.5 w-3.5 shrink-0 text-[#d97757]" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate font-medium text-gray-200">{hasTitle ? title : 'Titre du live'}</div>
            <div className="hidden truncate text-[10px] text-gray-500 sm:block">
              Direct terminé — Rendue disponible dans le post-live
            </div>
          </div>
          <button
            type="button"
            className="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-md border border-[#d97757]/40 bg-[#d97757]/14 px-2 py-1 text-[10px] font-semibold text-[#d97757]"
          >
            Post-live
            <ChevronDown className="h-3 w-3 opacity-80" />
          </button>
        </div>
      </motion.div>

      {!embedded && (
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#d97757]/35 bg-[#d97757]/10 px-3 py-2.5 text-sm font-medium text-[#f0b89a] transition-all hover:scale-[1.01] hover:bg-[#d97757]/16"
        >
          <Eye className="h-4 w-4" />
          Voir comme participant
        </button>
      )}

      <Dialog open={coverPreviewOpen} onOpenChange={setCoverPreviewOpen}>
        <DialogContent
          overlayClassName="z-[2500]"
          className="z-[2501] max-w-[min(96vw,1100px)] border-[#2D3139] bg-[#12141a] p-0 gap-0 overflow-hidden sm:rounded-2xl"
        >
          <DialogHeader className="border-b border-white/[0.08] px-4 py-3 text-left">
            <DialogTitle className="text-base text-white">Couverture du live</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Image affichée aux participants — fermez pour revenir à l&apos;aperçu.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(85vh,calc(100vh-8rem))] overflow-auto bg-black/40 p-3">
            {cover_image_url ? (
              <img
                src={cover_image_url}
                alt=""
                className="mx-auto block max-h-[min(82vh,calc(100vh-10rem))] w-full object-contain"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
