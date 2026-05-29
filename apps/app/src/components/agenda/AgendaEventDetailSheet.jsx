import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Calendar,
  Clock,
  User,
  Video,
  Sparkles,
  Loader2,
  Clapperboard,
  ShieldCheck,
  AlertCircle,
  Bell,
} from 'lucide-react';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  labelForAppointmentType,
  labelForSessionType,
  preparationStatusLabel,
  appointmentNeedsStudioPrep,
} from '@/lib/agendaEventModel';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { sendAppointmentReminder } from '@/services/appointmentNotifications';

function safeFormat(iso, fmt) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isValid(d) ? format(d, fmt, { locale: fr }) : '—';
}

/**
 * Panneau latéral — détail d'un événement agenda (RDV ou live) + actions studio / live.
 */
export default function AgendaEventDetailSheet({
  open,
  onOpenChange,
  event,
  isStaff,
  canManageStudio,
  hostName,
  onEnsureStudio,
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [studioBusy, setStudioBusy] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);

  if (!event) return null;

  const isLive = event.source === 'live_sessions';
  const isAppt = event.source === 'appointments';
  const canStudio = Boolean(canManageStudio);

  const typeLabel = isLive
    ? event.production_live_type || labelForSessionType(event.session_type)
    : labelForAppointmentType(event.appointment_type);

  const prepLabel = isLive
    ? preparationStatusLabel(event.preparation_status)
    : event.live_session_id && event.linked_preparation_status
      ? preparationStatusLabel(event.linked_preparation_status)
      : '— (aucune session live liée)';

  const studioPath = event.studioPrepPath;
  const needsPrep = isAppt && appointmentNeedsStudioPrep(event.appointment_type);

  const goStudio = () => {
    if (studioPath) navigate(studioPath);
  };

  const handleCreateAndPrep = async () => {
    if (!onEnsureStudio || !isAppt) return;
    setStudioBusy(true);
    try {
      const { error, sessionId } = await onEnsureStudio(event.id);
      if (error) throw error;
      if (sessionId) navigate(`/studio/live-preparation/${sessionId}`);
    } catch (e) {
      console.error(e);
      toast({
        title: 'Impossible de créer la session',
        description: e?.message || 'Réessayez ou vérifiez les droits Supabase.',
        variant: 'destructive',
      });
    } finally {
      setStudioBusy(false);
    }
  };

  const handleSendReminder = async () => {
    if (!isAppt || !event?.id) return;
    setReminderBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        toast({
          title: 'Session expirée',
          description: 'Reconnectez-vous pour envoyer un rappel.',
          variant: 'destructive',
        });
        return;
      }
      await sendAppointmentReminder({ appointmentId: event.id }, token);
      toast({
        title: 'Rappel envoyé',
        description: 'Une notification a été créée pour le participant.',
      });
    } catch (e) {
      toast({
        title: 'Impossible d\'envoyer le rappel',
        description: e?.message || 'Réessayez plus tard.',
        variant: 'destructive',
      });
    } finally {
      setReminderBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto border-l border-white/10 bg-[#0c1018]/98 text-white">
        <SheetHeader className="text-left space-y-1">
          <SheetTitle className="text-xl font-serif text-white pr-8">{event.title}</SheetTitle>
          <SheetDescription className="text-gray-400 text-sm">
            {isLive ? 'Session live' : 'Rendez-vous'} · {typeLabel}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-[#D4AF37]/40 text-[#D4AF37]">
              {isLive ? 'Live' : 'RDV'}
            </Badge>
            <Badge variant="secondary" className="bg-white/10 text-gray-200">
              {String(event.status || '—')}
            </Badge>
            {isStaff && (
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
                <ShieldCheck className="w-3 h-3 mr-1" /> Secrétariat / admin
              </Badge>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3 text-sm">
            <div className="flex items-start gap-2 text-gray-300">
              <Calendar className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
              <span>{safeFormat(event.scheduled_at, "EEEE d MMMM yyyy 'à' HH:mm")}</span>
            </div>
            <div className="flex items-start gap-2 text-gray-300">
              <Clock className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
              <span>
                Durée :{' '}
                {event.duration_minutes != null ? `${event.duration_minutes} min` : '—'}
              </span>
            </div>
            <div className="flex items-start gap-2 text-gray-300">
              <User className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
              <span>
                Hôte / maître : <span className="text-white">{hostName || '—'}</span>
              </span>
            </div>
            {event.student && (
              <div className="flex items-start gap-2 text-gray-300">
                <User className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                <span>
                  Participant :{' '}
                  <span className="text-[#D4AF37]">{event.student.name || event.student.email || '—'}</span>
                </span>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Préparation studio</p>
            <p className="text-sm text-gray-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              {prepLabel}
            </p>
          </div>

          {event.notes ? (
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-400 whitespace-pre-wrap">{event.notes}</p>
            </div>
          ) : null}

          <Separator className="bg-white/10" />

          <div className="space-y-2">
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Les rappels automatiques complètent le cycle ; vous pouvez aussi envoyer un rappel manuel ci-dessous.
            </p>
            {isStaff && isAppt && (
              <Button
                type="button"
                variant="outline"
                className="w-full border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                disabled={reminderBusy}
                data-testid="agenda-send-appointment-reminder"
                onClick={handleSendReminder}
              >
                {reminderBusy ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Bell className="w-4 h-4 mr-2" />
                )}
                Envoyer un rappel au participant
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-2">
            {canStudio && studioPath && (
              <Button
                className="w-full bg-[#D4AF37] text-black hover:bg-[#e5c04a] font-semibold"
                onClick={goStudio}
              >
                <Clapperboard className="w-4 h-4 mr-2" />
                Studio événement (préparation live)
              </Button>
            )}

            {canStudio && !studioPath && isAppt && needsPrep && (
              <Button
                className="w-full bg-[#D4AF37] text-black hover:bg-[#e5c04a] font-semibold"
                disabled={studioBusy}
                onClick={handleCreateAndPrep}
              >
                {studioBusy ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Clapperboard className="w-4 h-4 mr-2" />
                )}
                Créer la session live & préparer
              </Button>
            )}

            {canStudio && !studioPath && isAppt && !needsPrep && (
              <Button
                variant="outline"
                className="w-full border-white/20"
                disabled={studioBusy}
                onClick={handleCreateAndPrep}
              >
                {studioBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Lier une session live (optionnel)
              </Button>
            )}

            {isLive ? (
              <Button variant="secondary" className="w-full bg-white/10 hover:bg-white/15" asChild>
                <Link to={`/live/${event.id}`}>
                  <Video className="w-4 h-4 mr-2" />
                  Ouvrir la salle live
                </Link>
              </Button>
            ) : event.video_url ? (
              <Button variant="secondary" className="w-full bg-white/10 hover:bg-white/15" asChild>
                <a href={event.video_url} target="_blank" rel="noopener noreferrer">
                  <Video className="w-4 h-4 mr-2" />
                  Lien visioconférence
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
