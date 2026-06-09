import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import BookingCalendarModal from '@/components/booking/BookingCalendarModal';
import { JourneyAmbient } from '@/components/booking/AppointmentJourneyPrimitives';
import { supabase } from '@/lib/customSupabaseClient';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import {
  BOOKING_CHANNEL_NGOWAZULU,
  BOOKING_CHANNEL_PRORASCIENCE,
  NGOWAZULU_CONSULTATION_FLOW,
  NGOWAZULU_CONSULTATION_NEXT_PATH,
  NGOWAZULU_CONSULTATION_PLAN_SLUG,
} from '@/config/ngowazuluConsultation';

const easePremium = [0.22, 1, 0.36, 1];

const STEP_GUIDE = {
  1: {
    eyebrow: 'Étape 1 · Votre demande',
    title: 'Bienvenue : dites-nous',
    titleGold: 'pourquoi vous écrivez',
    body:
      'En quelques lignes, posez le cadre de votre entretien. Le secrétariat lit chaque demande pour préparer un échange utile et respectueux de votre parcours.',
    bullets: [
      'Formulez le sujet principal (obligatoire).',
      'Renseignez l\'e-mail et le numéro WhatsApp (format international) pour les confirmations.',
      'Ajoutez des précisions si vous le souhaitez : contexte, urgence, questions.',
      'Rien n\'est définitif : vous pourrez préciser avec l\'équipe aux étapes suivantes.',
    ],
  },
  2: {
    eyebrow: 'Étape 2 · L\'équipe',
    title: 'Nous vous orientons vers',
    titleGold: 'le bon interlocuteur',
    body:
      'Selon votre fuseau et la disponibilité des secrétariats, nous vous proposons une personne référente. Vous pouvez en choisir une autre dans la liste si besoin.',
    bullets: [
      'Votre fuseau horaire est détecté automatiquement.',
      'Les pastilles indiquent la disponibilité et la zone.',
      'Si l\'école est fermée, vous pouvez quand même réserver un créneau — la demande sera traitée à la réouverture.',
    ],
  },
  3: {
    eyebrow: 'Étape 3 · Calendrier',
    title: 'Choisissez une date puis',
    titleGold: 'un créneau vivant',
    body:
      'Le calendrier se met à jour selon les disponibilités réelles. Les créneaux en vert sont réservables ; actualisez si besoin après un changement de jour.',
    bullets: [
      'Touchez un jour pour charger les horaires du jour choisi.',
      'Sélectionnez un créneau vert (30 minutes).',
      'Vérifiez le récapitulatif en bas avant de passer à la confirmation.',
    ],
  },
  4: {
    eyebrow: 'Étape 4 · Validation',
    title: 'Dernière vérification',
    titleGold: 'avant envoi',
    body:
      'Relisez le sujet, l\'interlocuteur et la date. Une fois confirmé, votre demande rejoint le secrétariat et vous recevez les informations de suivi.',
    bullets: [
      'Contrôlez chaque ligne du récapitulatif.',
      'Le fuseau affiché est celui de votre appareil.',
      'Après confirmation, pensez à noter le créneau dans votre agenda.',
    ],
  },
};

const BOOKING_STATE_GUIDE = {
  existing_appointment: {
    eyebrow: 'Rendez-vous en attente',
    title: 'Vous avez déjà un',
    titleGold: 'rendez-vous programmé',
    body:
      "Parfait, votre dossier est actif. Utilisez les actions à droite pour rejoindre la salle d'attente, demander un report ou annuler si nécessaire.",
    bullets: [
      "1) Ouvrez la salle d'attente quand l'heure approche.",
      '2) Le secrétariat valide puis lance la bascule vers le chat immersif.',
      "3) Une fois admis, l'entretien se déroule dans l'espace immersif ISNA.",
    ],
  },
  success: {
    eyebrow: 'Rendez-vous confirmé',
    title: 'Demande envoyée,',
    titleGold: 'prochaine étape immersive',
    body:
      "Votre réservation est bien enregistrée. Conservez la référence et préparez vos questions : vous serez guidé vers l'espace d'échange immersif le moment venu.",
    bullets: [
      'Gardez la référence et ajoutez le créneau à votre agenda.',
      "Rejoignez la salle d'attente via le bouton dédié.",
      "Suivez les instructions du secrétariat jusqu'au chat immersif.",
    ],
  },
  loading: {
    eyebrow: 'Synchronisation',
    title: 'Préparation de votre',
    titleGold: 'espace rendez-vous',
    body:
      "Nous chargeons vos informations de réservation pour éviter les doublons et vous orienter vers le bon parcours.",
    bullets: [
      'Vérification de votre statut de rendez-vous.',
      'Chargement des informations de suivi.',
      'Ouverture automatique du bon flux.',
    ],
  },
};

const PROMO_MOMENTS_FALLBACK = [
  { badge: 'DIRECT', when: "Aujourd'hui · 20:00", title: 'Live LIRI · Classe immersive' },
  { badge: 'NOUVEAU', when: 'Cette semaine', title: 'Doctrine MK5 · Fondements guidés' },
  { badge: 'ÉVÉNEMENT', when: 'Samedi · 18:30', title: 'Questions / Réponses avec secrétariat ISNA' },
  { badge: 'BIBLIOTHÈQUE', when: 'Mise à jour', title: 'Nouveaux extraits d\'ouvrages fondateurs' },
  { badge: 'PARCOURS', when: 'Cycle actif', title: '21 sciences · progression de cohorte' },
  { badge: 'TÉMOIGNAGE', when: 'Temps fort', title: 'Retours élèves · discipline & transformation' },
];

function AppointmentHeroChrome() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.9]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
          maskImage: 'radial-gradient(ellipse at center, black 42%, transparent 100%)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-24 top-0 z-0 h-72 w-72 rounded-full bg-[#6f4cff]/20 blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 top-24 z-0 h-80 w-80 rounded-full bg-[#D4AF37]/12 blur-[110px]"
        aria-hidden
      />
    </>
  );
}

function StepPills({ step }) {
  const labels = ['Sujet', 'Équipe', 'Créneau', 'OK'];
  return (
    <nav className="mb-10 flex flex-wrap items-center justify-center gap-2 md:justify-start" aria-label="Progression">
      {labels.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const active = step === n;
        return (
          <div
            key={label}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors md:px-4 md:py-2 md:text-[11px] ${
              active
                ? 'border-[#D4AF37]/55 bg-[#D4AF37]/12 text-[#D4AF37]'
                : done
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200/90'
                  : 'border-white/10 bg-white/[0.03] text-white/40'
            }`}
          >
            {done ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <span className="text-white/50">{n}</span>}
            {label}
          </div>
        );
      })}
    </nav>
  );
}

function NarrativePanel({ step, reduce, viewState = 'form' }) {
  const copy =
    (viewState !== 'form' && BOOKING_STATE_GUIDE[viewState]) ||
    STEP_GUIDE[step] ||
    STEP_GUIDE[1];
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step}
        initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: -12 }}
        transition={{ duration: 0.45, ease: easePremium }}
        className="space-y-6"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-[#D4AF37] md:text-[11px]">
          <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4" />
          {copy.eyebrow}
        </div>
        <h1 className="font-serif text-3xl font-bold leading-[1.12] text-white md:text-4xl lg:text-5xl">
          {copy.title}{' '}
          <span className="bg-gradient-to-r from-[#f5e6b8] via-[#D4AF37] to-[#c9a43a] bg-clip-text text-transparent">
            {copy.titleGold}
          </span>
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-white/72 md:text-lg">{copy.body}</p>
        <ul className="max-w-xl space-y-3 text-sm text-white/60">
          {copy.bullets.map((line) => (
            <li key={line} className="flex gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#D4AF37]/80" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-white/45">
          <ShieldCheck className="h-4 w-4 text-[#D4AF37]" />
          Données traitées dans le cadre ISNA · Prorascience
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function PromoMomentsTicker({ reduce, items }) {
  const source = items?.length ? items : PROMO_MOMENTS_FALLBACK;
  const loop = [...source, ...source];
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/25 py-3">
      <motion.div
        className="flex w-max gap-3 px-3"
        animate={reduce ? undefined : { x: ['0%', '-50%'] }}
        transition={reduce ? undefined : { duration: 34, ease: 'linear', repeat: Infinity }}
      >
        {loop.map((item, idx) => (
          <article
            key={`${item.title}-${idx}`}
            className="inline-flex shrink-0 items-center gap-3 rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-3 py-2"
          >
            <span className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#D4AF37]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]" />
              {item.badge}
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] font-medium text-white/85">{item.title}</span>
              <span className="text-[10px] text-white/55">{item.when}</span>
            </div>
          </article>
        ))}
      </motion.div>
    </div>
  );
}

/**
 * Route /appointment/request — page pleine largeur, ambiance hero Prorascience,
 * panneau narratif par étape + calendrier intégré (embedded).
 */
const RequestAppointmentPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [searchParams] = useSearchParams();
  const appointmentIdParam = searchParams.get('appointmentId') || undefined;
  const flow = searchParams.get('flow') || '';
  const shouldUseNativeMobileBooking =
    typeof window !== 'undefined' &&
    (Capacitor.isNativePlatform() ||
      (window.matchMedia?.('(max-width: 767px)').matches ?? window.innerWidth < 768));
  const bookingChannel =
    flow === NGOWAZULU_CONSULTATION_FLOW ? BOOKING_CHANNEL_NGOWAZULU : BOOKING_CHANNEL_PRORASCIENCE;
  const [bookingStep, setBookingStep] = useState(1);
  const [bookingViewState, setBookingViewState] = useState('form');
  const [promoMoments, setPromoMoments] = useState(PROMO_MOMENTS_FALLBACK);
  const [checkingGate, setCheckingGate] = useState(flow === NGOWAZULU_CONSULTATION_FLOW);
  const [gateError, setGateError] = useState('');

  const onBookingStepChange = useCallback((s) => {
    if (typeof s === 'number' && s >= 1 && s <= 4) setBookingStep(s);
  }, []);

  const onBookingViewStateChange = useCallback((nextState) => {
    if (typeof nextState === 'string' && nextState.length > 0) setBookingViewState(nextState);
  }, []);

  useEffect(() => {
    if (!shouldUseNativeMobileBooking) return;
    const next = new URLSearchParams(searchParams);
    const qs = next.toString();
    navigate(`${ELEVE_MOBILE.appointmentRequest}${qs ? `?${qs}` : ''}`, { replace: true });
  }, [navigate, searchParams, shouldUseNativeMobileBooking]);

  useEffect(() => {
    let alive = true;
    const shouldCheckPayment = flow === NGOWAZULU_CONSULTATION_FLOW && Boolean(user?.id);
    if (!shouldCheckPayment) {
      setCheckingGate(false);
      setGateError('');
      return () => {
        alive = false;
      };
    }

    const run = async () => {
      setCheckingGate(true);
      setGateError('');
      try {
        // Check via subscriptions: billing_invoices.tenant_id → tenants.id (not profile IDs).
        // billing_subscriptions.plan_id is text matching the plan slug constant directly.
        const { data: consultSubs, error: subError } = await supabase
          .from('billing_subscriptions')
          .select('id')
          .eq('user_id', user.id)
          .eq('plan_id', NGOWAZULU_CONSULTATION_PLAN_SLUG);
        if (subError) throw subError;

        const consultSubIds = (consultSubs || []).map(s => s.id);
        const { count, error: paymentError } = consultSubIds.length > 0
          ? await supabase
              .from('billing_invoices')
              .select('id', { count: 'exact', head: true })
              .in('subscription_id', consultSubIds)
              .eq('status', 'paid')
          : { count: 0, error: null };
        if (paymentError) throw paymentError;

        if (!alive) return;
        const hasConfirmedPayment = (count || 0) > 0;
        if (!hasConfirmedPayment) {
          navigate(
            `/paiements/payer?plan=${encodeURIComponent(NGOWAZULU_CONSULTATION_PLAN_SLUG)}&interval=one_time&next=${encodeURIComponent(NGOWAZULU_CONSULTATION_NEXT_PATH)}`,
            { replace: true }
          );
          return;
        }
        setCheckingGate(false);
      } catch (err) {
        if (!alive) return;
        setCheckingGate(false);
        setGateError(String(err?.message || 'Impossible de verifier le paiement de consultation.'));
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [flow, navigate, user?.id]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!user?.id) return;
      try {
        const nowIso = new Date().toISOString();
        const [eventsRes, livesRes] = await Promise.all([
          supabase
            .from('school_events')
            .select('title,start_at,location')
            .gte('start_at', nowIso)
            .order('start_at', { ascending: true })
            .limit(4),
          supabase
            .from('live_sessions')
            .select('title,scheduled_at,started_at,status')
            .in('status', ['scheduled', 'live'])
            .order('scheduled_at', { ascending: true })
            .limit(3),
        ]);

        const events = Array.isArray(eventsRes?.data) ? eventsRes.data : [];
        const lives = Array.isArray(livesRes?.data) ? livesRes.data : [];
        const liveItems = lives.map((l) => {
          const t = l.scheduled_at || l.started_at;
          return {
            badge: String(l.status || '').toLowerCase() === 'live' ? 'DIRECT' : 'LIVE',
            when: t
              ? new Date(t).toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
              : 'À venir',
            title: l.title || 'Session live ISNA',
          };
        });
        const eventItems = events.map((e) => ({
          badge: 'ÉVÉNEMENT',
          when: e.start_at
            ? new Date(e.start_at).toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
            : 'Agenda',
          title: e.title || e.location || 'Temps fort ISNA',
        }));
        const merged = [...liveItems, ...eventItems].slice(0, 8);
        if (alive && merged.length > 0) setPromoMoments(merged);
      } catch {
        // conserve le fallback marketing silencieusement
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  const shell = (children) => (
    <div className="relative min-h-screen overflow-x-hidden bg-[#070b12] text-white">
      <JourneyAmbient />
      <AppointmentHeroChrome />
      <div className="relative z-[2]">{children}</div>
    </div>
  );

  if (shouldUseNativeMobileBooking) {
    return shell(
      <div className="flex min-h-[100dvh] items-center justify-center px-6 text-center">
        <div className="space-y-3">
          <CalendarClock className="mx-auto h-8 w-8 text-[#D4AF37]" />
          <p className="text-sm text-white/60">Ouverture du moteur rendez-vous mobile…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return shell(
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-[60] border-b border-white/10 bg-[#070b12]/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-wide text-white/90">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#D4AF37] text-black">I</span>
              ISNA · PRORASCIENCE
            </Link>
            <Link
              to="/ecoles/prorascience"
              className="text-sm text-white/70 transition-colors hover:text-white"
            >
              L&apos;école
              <ChevronRight className="ml-0.5 inline h-4 w-4" />
            </Link>
          </div>
        </header>
        <div className="flex flex-1 items-center justify-center px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-md space-y-6 text-center"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/10">
              <CalendarClock className="h-8 w-8 text-[#D4AF37]" />
            </div>
            <h1 className="font-serif text-2xl font-bold text-white md:text-3xl">Rendez-vous ISNA</h1>
            <p className="text-white/65">Connectez-vous pour accéder au parcours guidé et au calendrier en direct.</p>
            <Button
              onClick={() => navigate('/login', { state: { from: { pathname: '/appointment/request' } } })}
              className="h-12 bg-[#D4AF37] px-8 text-base font-bold text-black hover:bg-[#ebca5e]"
            >
              Se connecter
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  if (checkingGate) {
    return shell(
      <div className="flex min-h-screen items-center justify-center px-6 py-16">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-md space-y-3 text-center">
          <h1 className="font-serif text-xl font-bold text-white md:text-2xl">Vérification du paiement</h1>
          <p className="text-sm text-white/55">
            Nous vérifions vos frais de consultation Ngowazulu avant l&apos;accès au calendrier.
          </p>
        </motion.div>
      </div>
    );
  }

  if (gateError) {
    return shell(
      <div className="flex min-h-screen items-center justify-center px-6 py-16">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-md space-y-4 text-center">
          <p className="text-sm text-red-300">{gateError}</p>
          <Button
            onClick={() =>
              navigate(
                `/paiements/payer?plan=${encodeURIComponent(NGOWAZULU_CONSULTATION_PLAN_SLUG)}&interval=one_time&next=${encodeURIComponent(NGOWAZULU_CONSULTATION_NEXT_PATH)}`
              )
            }
            className="bg-[#D4AF37] font-semibold text-black hover:bg-[#ebca5e]"
          >
            Aller au paiement
          </Button>
        </motion.div>
      </div>
    );
  }

  return shell(
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-[60] border-b border-white/10 bg-[#070b12]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-wide text-white/90">
            <motion.span
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#D4AF37] text-black"
              animate={
                reduce
                  ? undefined
                  : {
                      boxShadow: [
                        '0 0 0 0 rgba(212,175,55,0)',
                        '0 0 20px 2px rgba(212,175,55,0.35)',
                        '0 0 0 0 rgba(212,175,55,0)',
                      ],
                    }
              }
              transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 4 }}
            >
              I
            </motion.span>
            ISNA · PRORASCIENCE
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/ecoles/prorascience"
              className="hidden text-sm text-white/70 transition-colors hover:text-white sm:inline"
            >
              L&apos;école
            </Link>
            <Button variant="ghost" size="sm" className="text-white/80 hover:bg-white/10" asChild>
              <Link to="/dashboard">Mon espace</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 pb-12 pt-6 md:pb-14 md:pt-8">
        <div className="mx-auto max-w-7xl">
          <StepPills step={bookingStep} />

          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.12fr)] lg:items-start lg:gap-10">
            <aside className="order-2 min-w-0 lg:order-1 lg:sticky lg:top-28">
              <NarrativePanel step={bookingStep} reduce={reduce} viewState={bookingViewState} />
              <PromoMomentsTicker reduce={reduce} items={promoMoments} />
            </aside>

            <div className="order-1 min-w-0 lg:order-2">
              <BookingCalendarModal
                embedded
                open
                onOpenChange={() => {}}
                initialAppointmentId={appointmentIdParam}
                bookingChannel={bookingChannel}
                onStepChange={onBookingStepChange}
                onViewStateChange={onBookingViewStateChange}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default RequestAppointmentPage;
