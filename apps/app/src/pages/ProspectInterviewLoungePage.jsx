import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { JourneyAmbient, JourneyMobileDock, JourneySectionLabel } from '@/components/booking/AppointmentJourneyPrimitives';
import {
  CalendarClock,
  Loader2,
  MessageSquare,
  Sparkles,
  Timer,
  Video,
  CheckCircle2,
  Circle,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { motion } from 'framer-motion';

function FlowStepPill({ label, done, active }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`flex min-h-[3.25rem] items-center gap-2 rounded-xl border px-4 py-3 transition-all ${
        done
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          : active
            ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
            : 'border-white/10 bg-white/5 text-gray-500'
      }`}
    >
      {done ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : active ? (
        <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.8 }}>
          <Circle className="h-4 w-4 shrink-0" />
        </motion.div>
      ) : (
        <Circle className="h-4 w-4 shrink-0" />
      )}
      <span className="text-sm font-medium leading-snug">{label}</span>
    </motion.div>
  );
}

const ProspectInterviewLoungePage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [nextInterview, setNextInterview] = useState(null);
  const [appointmentMeta, setAppointmentMeta] = useState({
    appointment: null,
    chatInvite: null,
    liveSession: null,
  });
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    const load = async () => {
      const { data } = await supabase
        .from('appointment_requests')
        .select('id,reason,status,scheduled_at,video_meeting_url,queue_position,created_at')
        .eq('student_id', user.id)
        .in('status', ['pending', 'confirmed'])
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!alive) return;
      setNextInterview(data || null);
      if (!data?.id) {
        setAppointmentMeta({ appointment: null, chatInvite: null, liveSession: null });
        setLoading(false);
        return;
      }

      let appointment = null;
      let chatInvite = null;
      let liveSession = null;
      try {
        const { data: appt } = await supabase
          .from('appointments')
          .select('id,status,scheduled_at,immersive_chat_id,immersive_live_id,booking_reference')
          .or(`appointment_request_id.eq.${data.id},request_id.eq.${data.id}`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        appointment = appt || null;
        // Normalise scheduled_at depuis booking_slots si absent (booking API shape)
        if (appointment && !appointment.scheduled_at && appointment.booking_slots?.start_at) {
          appointment = { ...appointment, scheduled_at: appointment.booking_slots.start_at };
        }
      } catch {
        appointment = null;
      }

      if (appointment?.immersive_chat_id) {
        const { data: invite } = await supabase
          .from('live_chat_invites')
          .select('id,status,scheduled_for,started_at,accepted_at')
          .eq('id', appointment.immersive_chat_id)
          .maybeSingle();
        chatInvite = invite || null;
      }
      if (appointment?.immersive_live_id) {
        const { data: live } = await supabase
          .from('live_sessions')
          .select('id,status,scheduled_at,video_room_url')
          .eq('id', appointment.immersive_live_id)
          .maybeSingle();
        liveSession = live || null;
      }
      setAppointmentMeta({ appointment, chatInvite, liveSession });
      setLoading(false);
    };
    load();
    const channel = supabase
      .channel(`prospect-lounge-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointment_requests', filter: `student_id=eq.${user.id}` }, () => {
        load();
      })
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    const t = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const countdown = useMemo(() => {
    if (!nextInterview?.scheduled_at) return null;
    const ms = new Date(nextInterview.scheduled_at).getTime() - nowTick;
    const days = Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
    const hours = Math.max(0, Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000)));
    const mins = Math.max(0, Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000)));
    const secs = Math.max(0, Math.floor((ms % (60 * 1000)) / 1000));
    return { days, hours, mins, secs, isNow: ms <= 15 * 60 * 1000 };
  }, [nextInterview?.scheduled_at, nowTick]);

  const flow = useMemo(() => {
    if (!nextInterview) return { current: 'none', steps: [] };
    const now = nowTick;
    const appointmentStatus = String(appointmentMeta.appointment?.status || '').toLowerCase();
    const requestStatus = String(nextInterview.status || '').toLowerCase();
    const liveStatus = String(appointmentMeta.liveSession?.status || '').toLowerCase();
    const chatStatus = String(appointmentMeta.chatInvite?.status || '').toLowerCase();
    const startTs = nextInterview.scheduled_at ? new Date(nextInterview.scheduled_at).getTime() : 0;
    const isNowWindow = startTs > 0 ? now >= startTs - 15 * 60 * 1000 : false;

    let current = 'preparation';
    if (requestStatus === 'pending') current = 'pending_validation';
    else if (liveStatus === 'live') current = 'live_active';
    else if (['accepted', 'pending'].includes(chatStatus) && isNowWindow) current = 'chat_active';
    else if (requestStatus === 'confirmed' || appointmentStatus === 'scheduled' || appointmentStatus === 'rescheduled') current = 'scheduled';

    const steps = [
      { id: 'pending_validation', label: 'Validation secrétariat', done: requestStatus !== 'pending' },
      { id: 'scheduled', label: 'Rendez-vous planifié', done: ['confirmed'].includes(requestStatus) },
      { id: 'chat_active', label: 'Chat immersif', done: ['accepted', 'ended'].includes(chatStatus) || liveStatus === 'live' },
      { id: 'live_active', label: 'Live immersif', done: liveStatus === 'live' || liveStatus === 'ended' },
    ];
    return { current, steps };
  }, [appointmentMeta.appointment?.status, appointmentMeta.chatInvite?.status, appointmentMeta.liveSession?.status, nextInterview, nowTick]);

  const reminderStatus = useMemo(() => {
    if (!nextInterview?.scheduled_at) return { j1: false, h1: false, now: false };
    const ms = new Date(nextInterview.scheduled_at).getTime() - nowTick;
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;
    return {
      j1: ms <= oneDay,
      h1: ms <= oneHour,
      now: ms <= 15 * 60 * 1000,
    };
  }, [nextInterview?.scheduled_at, nowTick]);

  const joinUrl = appointmentMeta.liveSession?.video_room_url || nextInterview?.video_meeting_url || null;
  const canJoinLive = Boolean(countdown?.isNow && joinUrl);

  const mobileDockPrimary = useMemo(() => {
    if (!nextInterview) return null;
    if (canJoinLive) {
      return (
        <motion.a
          href={joinUrl}
          target="_blank"
          rel="noreferrer"
          whileTap={{ scale: 0.98 }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4AF37] py-3.5 text-sm font-bold text-black shadow-[0_0_28px_rgba(212,175,55,0.28)]"
        >
          <Video className="h-4 w-4" /> Rejoindre la salle
        </motion.a>
      );
    }
    return (
      <Button asChild className="h-auto w-full rounded-xl bg-[#D4AF37] py-3.5 text-sm font-bold text-black hover:bg-amber-500">
        <Link to="/messages">
          <MessageSquare className="mr-2 h-4 w-4" /> Ouvrir le chat immersif
        </Link>
      </Button>
    );
  }, [nextInterview, canJoinLive, joinUrl]);

  const mobileDockSecondary = useMemo(() => {
    if (!nextInterview) return null;
    return (
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm" className="flex-1 border-white/15 text-white hover:bg-white/5">
          <Link to="/">Site</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="flex-1 border-white/15 text-white hover:bg-white/5">
          <Link to="/resources">Contenus</Link>
        </Button>
      </div>
    );
  }, [nextInterview]);

  if (!user) return <Navigate to="/login" replace />;

  const refCode = appointmentMeta.appointment?.booking_reference;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0a0908] text-white">
      <JourneyAmbient />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header
          className="sticky top-0 z-20 flex items-center justify-between border-b border-white/5 bg-[#0a0908]/80 px-4 py-3 backdrop-blur-xl sm:px-6 sm:py-4"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
        >
          <Link to="/" className="flex items-center gap-2 text-sm font-bold tracking-wide text-[#D4AF37]">
            <Sparkles className="h-4 w-4" /> PRORASCIENCE
          </Link>
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/80">Salon entretien</span>
        </header>

        <main className="flex flex-1 flex-col items-center px-4 pb-28 pt-8 lg:pb-14 lg:pt-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="w-full max-w-3xl space-y-8"
          >
            <div className="relative overflow-hidden rounded-3xl border-2 border-[#D4AF37]/35 bg-gradient-to-br from-[#1a1510]/90 via-[#10141a]/95 to-[#0a0908] p-6 shadow-[0_32px_80px_rgba(0,0,0,0.55),0_0_60px_rgba(212,175,55,0.08)] backdrop-blur-sm before:pointer-events-none before:absolute before:inset-x-4 before:top-0 before:h-px before:rounded-full before:bg-gradient-to-r before:from-transparent before:via-[#D4AF37] before:to-transparent sm:p-10">
              <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Espace entretien</h1>
                  <p className="mt-1 text-sm text-gray-400">
                    Suivez votre rendez-vous immersif et rejoignez la session le jour J.
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="space-y-3">
                  <div className="h-5 w-1/2 animate-pulse rounded bg-white/10" />
                  <div className="h-16 w-full animate-pulse rounded bg-white/10" />
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Chargement de votre programmation…
                  </div>
                </div>
              ) : nextInterview ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className={
                        nextInterview.status === 'confirmed'
                          ? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-300'
                          : 'border-amber-500/30 bg-amber-500/20 text-amber-200'
                      }
                    >
                      {nextInterview.status === 'confirmed' ? 'Confirmé' : 'En attente de validation'}
                    </Badge>
                    <Badge className="border-white/15 bg-white/5 text-gray-200">
                      No {String(nextInterview.id).slice(0, 8).toUpperCase()}
                    </Badge>
                    {refCode ? (
                      <Badge className="border-white/15 bg-white/5 font-mono text-gray-200">
                        Réf. {String(refCode).slice(0, 10).toUpperCase()}
                      </Badge>
                    ) : null}
                  </div>

                  {refCode ? (
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="border-[#D4AF37]/35 text-[#D4AF37] hover:bg-[#D4AF37]/10"
                    >
                      <Link to={`/rendez-vous/${encodeURIComponent(refCode)}`}>
                        <ExternalLink className="mr-2 h-3.5 w-3.5" />
                        Page salle d&apos;attente (lien partageable)
                      </Link>
                    </Button>
                  ) : null}

                  <p className="text-gray-200">
                    Sujet :{' '}
                    <span className="font-medium text-white">{nextInterview.reason || "Entretien d'orientation"}</span>
                  </p>
                  <p className="flex items-center gap-2 text-gray-300">
                    <CalendarClock className="h-4 w-4 shrink-0 text-[#D4AF37]" />
                    {nextInterview.scheduled_at
                      ? new Date(nextInterview.scheduled_at).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })
                      : 'Horaire en cours de préparation'}
                  </p>

                  {countdown ? (
                    <motion.div
                      animate={{
                        boxShadow: [
                          '0 0 0 rgba(212,175,55,0)',
                          '0 0 28px rgba(212,175,55,0.14)',
                          '0 0 0 rgba(212,175,55,0)',
                        ],
                      }}
                      transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                      className="rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 p-5"
                    >
                      <p className="flex items-center gap-2 text-sm font-semibold text-[#D4AF37]">
                        <Timer className="h-4 w-4" />
                        Compteur avant entretien
                      </p>
                      <p className="mt-2 text-2xl font-bold tracking-wide sm:text-3xl">
                        {countdown.days}j {String(countdown.hours).padStart(2, '0')}h {String(countdown.mins).padStart(2, '0')}m{' '}
                        {String(countdown.secs).padStart(2, '0')}s
                      </p>
                    </motion.div>
                  ) : null}

                  <div className="rounded-2xl border border-white/10 bg-[#0F1419]/50 p-4">
                    <JourneySectionLabel className="mb-3">Rappels automatiques</JourneySectionLabel>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <motion.div
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                          reminderStatus.j1
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                            : 'border-white/10 bg-white/5 text-gray-400'
                        }`}
                        whileHover={{ y: -1 }}
                      >
                        {reminderStatus.j1 ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                        <span className="text-xs font-medium">Rappel J-1</span>
                      </motion.div>
                      <motion.div
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                          reminderStatus.h1
                            ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                            : 'border-white/10 bg-white/5 text-gray-400'
                        }`}
                        whileHover={{ y: -1 }}
                      >
                        {reminderStatus.h1 ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                        <span className="text-xs font-medium">Rappel 1 h</span>
                      </motion.div>
                      <motion.div
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                          reminderStatus.now
                            ? 'border-violet-500/40 bg-violet-500/10 text-violet-200'
                            : 'border-white/10 bg-white/5 text-gray-400'
                        }`}
                        whileHover={{ y: -1 }}
                      >
                        {reminderStatus.now ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                        <span className="text-xs font-medium">Session prête</span>
                      </motion.div>
                    </div>
                  </div>

                  <div className="hidden flex-wrap gap-3 lg:flex">
                    <Link to="/">
                      <Button variant="outline" className="border-white/15 text-white transition-all hover:-translate-y-0.5 hover:bg-white/5">
                        Visiter le site
                      </Button>
                    </Link>
                    <Link to="/resources">
                      <Button variant="outline" className="border-white/15 text-white transition-all hover:-translate-y-0.5 hover:bg-white/5">
                        Lire des contenus
                      </Button>
                    </Link>
                    {canJoinLive ? (
                      <Button
                        asChild
                        className="bg-[#D4AF37] text-black transition-all hover:-translate-y-0.5 hover:bg-amber-500 hover:shadow-[0_0_24px_rgba(212,175,55,0.35)]"
                      >
                        <a href={joinUrl} target="_blank" rel="noreferrer">
                          <Video className="mr-2 h-4 w-4" />
                          Rejoindre la salle
                        </a>
                      </Button>
                    ) : (
                      <Button
                        asChild
                        className="bg-[#D4AF37] text-black transition-all hover:-translate-y-0.5 hover:bg-amber-500 hover:shadow-[0_0_24px_rgba(212,175,55,0.35)]"
                      >
                        <Link to="/messages">
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Ouvrir le chat immersif
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-300">
                    Aucun entretien programmé pour le moment. Choisissez un créneau selon les disponibilités du secrétariat.
                  </p>
                  <Link to="/appointment/request">
                    <Button className="bg-[#D4AF37] text-black hover:bg-amber-500">Programmer un entretien</Button>
                  </Link>
                </div>
              )}
            </div>

            {nextInterview && flow.steps.length > 0 ? (
              <div className="space-y-3">
                <JourneySectionLabel className="text-center">Parcours de session</JourneySectionLabel>
                <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:overflow-visible lg:px-0 lg:pb-0 xl:grid-cols-4">
                  {flow.steps.map(step => (
                    <div key={step.id} className="w-[min(100%,14rem)] shrink-0 snap-start lg:w-auto lg:min-w-0">
                      <FlowStepPill label={step.label} done={step.done} active={flow.current === step.id} />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </motion.div>
        </main>

        <JourneyMobileDock primary={mobileDockPrimary} secondary={mobileDockSecondary} />

        <footer className="border-t border-white/5 py-6 text-center text-xs text-gray-600">
          Prorascience — Parcours rendez-vous
        </footer>
      </div>
    </div>
  );
};

export default ProspectInterviewLoungePage;
