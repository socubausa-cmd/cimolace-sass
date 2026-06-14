import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronRight,
  Clock,
  Loader2,
  MessageCircle,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/school/eleve-mobile/connection/EleveConnectionLayout';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { cn } from '@/lib/utils';
import {
  BOOKING_CHANNEL_NGOWAZULU,
  BOOKING_CHANNEL_PRORASCIENCE,
  NGOWAZULU_CONSULTATION_FLOW,
} from '@/config/ngowazuluConsultation';
import { EV_BG, EV_MUTED, EV_PAGE_AMBIENT } from '@/pages/school/eleve-mobile/eleveMobileScreensShared';

const USE_NETLIFY_BOOKING_IN_DEV = String(import.meta.env.VITE_USE_NETLIFY_BOOKING_IN_DEV || '') === '1';

const TOPICS = [
  { id: 'orientation', label: 'Orientation', detail: 'Choisir un parcours ou un module.' },
  { id: 'formation', label: 'Formation', detail: 'Questions sur les 21 modules.' },
  { id: 'paiement', label: 'Paiement', detail: 'Forfait, règlement, accès.' },
  { id: 'secretariat', label: 'Secrétariat', detail: 'Dossier, suivi, organisation.' },
];

const STEPS = [
  { id: 1, label: 'Sujet' },
  { id: 2, label: 'Contact' },
  { id: 3, label: 'Créneau' },
  { id: 4, label: 'Résumé' },
];

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
}

function isValidWhatsapp(v) {
  return /^\+[1-9]\d{7,14}$/.test(String(v || '').replace(/\s/g, ''));
}

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

function formatSlot(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatFullDate(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

function buildLocalSlots(selectedDate, bookingChannel) {
  const out = [];
  const now = Date.now();
  for (let h = 8; h <= 18; h += 1) {
    for (const min of [0, 30]) {
      const local = new Date(`${selectedDate}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`);
      if (local.getTime() < now) continue;
      out.push({
        slotUtc: local.toISOString(),
        secretariatId: 'local-secretariat-principal',
        secretariatName: bookingChannel === BOOKING_CHANNEL_NGOWAZULU ? 'Administration Ngowazulu' : 'Secrétariat ISNA',
        queueEstimate: 0,
      });
    }
  }
  return out;
}

function StepDots({ step }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {STEPS.map((s) => {
        const active = step === s.id;
        const done = step > s.id;
        return (
          <div
            key={s.id}
            className={cn(
              'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em]',
              active
                ? 'border-[#D4AF37]/55 bg-[#D4AF37]/15 text-[#D4AF37]'
                : done
                  ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                  : 'border-white/10 bg-white/[0.035] text-white/35',
            )}
          >
            {done ? <Check className="h-3 w-3" /> : <span>{s.id}</span>}
            <span className="truncate">{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function AppCard({ children, className }) {
  return (
    <div
      className={cn('rounded-[24px] border border-white/[0.08] bg-white/[0.035] p-4', className)}
      style={{
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 30px -24px rgba(0,0,0,0.85)',
      }}
    >
      {children}
    </div>
  );
}

export default function EleveAppointmentRequestScreen() {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const flow = searchParams.get('flow') || '';
  const bookingChannel = flow === NGOWAZULU_CONSULTATION_FLOW ? BOOKING_CHANNEL_NGOWAZULU : BOOKING_CHANNEL_PRORASCIENCE;
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Libreville', []);
  const country = useMemo(() => {
    const parts = String(navigator.language || '').split('-');
    return parts.length > 1 ? parts[1].toUpperCase() : '';
  }, []);
  const today = useMemo(() => dateKey(new Date()), []);
  const days = useMemo(() => Array.from({ length: 10 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  }), []);

  const [step, setStep] = useState(1);
  const [topic, setTopic] = useState('orientation');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [consent, setConsent] = useState(false);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [selectedDate, setSelectedDate] = useState(today);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotError, setSlotError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('notification_email,email,whatsapp_phone,notify_sms')
        .eq('id', user.id)
        .maybeSingle();
      if (!alive) return;
      setEmail(String(data?.notification_email || data?.email || user?.email || '').trim());
      setWhatsapp(String(data?.whatsapp_phone || '').trim());
      setSmsOptIn(data?.notify_sms === true);
    })();
    return () => {
      alive = false;
    };
  }, [user?.id, user?.email]);

  const loadSlots = useCallback(async () => {
    if (!selectedDate) return;
    setSlotsLoading(true);
    setSlotError('');
    setSelectedSlot(null);
    try {
      if (import.meta.env.DEV && !USE_NETLIFY_BOOKING_IN_DEV) {
        setSlots(buildLocalSlots(selectedDate, bookingChannel));
        return;
      }
      const windowStart = new Date(`${selectedDate}T00:00:00`);
      const windowEnd = new Date(`${selectedDate}T23:30:00`);
      const qs = new URLSearchParams({
        timezone,
        country,
        channel: bookingChannel,
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
      });
      const res = await fetch(`/.netlify/functions/booking-available-slots?${qs.toString()}`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Créneaux indisponibles');
      const primary = Array.isArray(payload?.slots) ? payload.slots : [];
      const fallback = Array.isArray(payload?.fallbackSlots) ? payload.fallbackSlots : [];
      const merged = [...primary, ...fallback];
      const seen = new Set();
      setSlots(
        merged.filter((s) => {
          const k = `${s.slotUtc}:${s.secretariatId}`;
          if (!s?.slotUtc || !s?.secretariatId || seen.has(k)) return false;
          seen.add(k);
          return true;
        }),
      );
    } catch (e) {
      setSlots([]);
      setSlotError(e?.message || 'Impossible de charger les créneaux.');
    } finally {
      setSlotsLoading(false);
    }
  }, [bookingChannel, country, selectedDate, timezone]);

  useEffect(() => {
    if (step === 3) void loadSlots();
  }, [loadSlots, step]);

  const canContinue = useMemo(() => {
    if (step === 1) return subject.trim().length >= 4;
    if (step === 2) return isValidEmail(email) && isValidWhatsapp(whatsapp) && consent;
    if (step === 3) return Boolean(selectedSlot?.slotUtc && selectedSlot?.secretariatId);
    return true;
  }, [consent, email, selectedSlot, step, subject, whatsapp]);

  const continueNext = () => {
    if (!canContinue) {
      toast({
        title: 'Étape incomplète',
        description:
          step === 2
            ? 'Vérifie e-mail, WhatsApp et consentement.'
            : step === 3
              ? 'Choisis un créneau.'
              : 'Indique le sujet du rendez-vous.',
        variant: 'destructive',
      });
      return;
    }
    setStep((s) => Math.min(4, s + 1));
  };

  const submit = async () => {
    if (!user?.id || !session?.access_token) {
      navigate(`${ELEVE_MOBILE.login}?${new URLSearchParams({ redirect: ELEVE_MOBILE.appointmentRequest }).toString()}`);
      return;
    }
    if (!canContinue || !selectedSlot) return;
    setBooking(true);
    try {
      if (import.meta.env.DEV && !USE_NETLIFY_BOOKING_IN_DEV) {
        toast({ title: 'Mode local', description: 'Rendez-vous simulé en local.' });
        navigate(ELEVE_MOBILE.agenda);
        return;
      }
      const res = await fetch('/.netlify/functions/booking-request-appointment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          subject: subject.trim(),
          description: description.trim() || subject.trim(),
          scheduledAt: selectedSlot.slotUtc,
          secretariatId: selectedSlot.secretariatId,
          visitorTimezone: timezone,
          visitorCountry: country,
          bookingChannel,
          notificationEmail: email.trim(),
          whatsappPhone: whatsapp.trim().replace(/\s/g, ''),
          notificationConsent: consent,
          notifySms: smsOptIn,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'Réservation impossible');
      toast({ title: 'Rendez-vous envoyé', description: 'La demande est enregistrée.' });
      if (payload?.bookingReference) {
        navigate(`/rendez-vous/${encodeURIComponent(payload.bookingReference)}`, { replace: true });
      } else {
        navigate(ELEVE_MOBILE.agenda, { replace: true });
      }
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Réessayez.', variant: 'destructive' });
    } finally {
      setBooking(false);
    }
  };

  if (!user) {
    return (
      <EleveMobileShell hideHeader hideTabBar contentClassName="!px-0">
        <div className="flex min-h-[100dvh] flex-col items-center justify-center px-5 text-center" style={{ backgroundColor: EV_BG, backgroundImage: EV_PAGE_AMBIENT }}>
          <LiriWordmark size="header" className="mb-5" />
          <h1 className="text-[24px] font-extrabold text-white">Rendez-vous LIRI</h1>
          <p className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-white/50">
            Connecte-toi pour réserver un créneau avec le secrétariat.
          </p>
          <Link
            to={`${ELEVE_MOBILE.login}?${new URLSearchParams({ redirect: ELEVE_MOBILE.appointmentRequest }).toString()}`}
            className="mt-6 rounded-full bg-[#D4AF37] px-6 py-3 text-[14px] font-extrabold text-black"
          >
            Se connecter
          </Link>
        </div>
      </EleveMobileShell>
    );
  }

  return (
    <EleveMobileShell user={user} hideHeader contentClassName="!px-0">
      <div className="flex min-h-[100dvh] flex-col" style={{ backgroundColor: EV_BG, backgroundImage: EV_PAGE_AMBIENT }}>
        <div className="px-4 pt-[max(0.35rem,env(safe-area-inset-top))]">
          <LiriStatusBar />
        </div>

        <header className="flex items-center gap-3 px-4 pb-3 pt-1">
          <button
            type="button"
            onClick={() => (step > 1 ? setStep((s) => s - 1) : navigate(-1))}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/85 active:bg-white/10"
            aria-label="Retour"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <LiriWordmark size="kicker" className="text-white/40" />
            <h1 className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-white">
              Prendre rendez-vous
            </h1>
            <p className="mt-0.5 text-[12px]" style={{ color: EV_MUTED }}>
              Étape {step} sur 4 · {bookingChannel === BOOKING_CHANNEL_NGOWAZULU ? 'Consultation Ngowazulu' : 'Secrétariat Prorascience'}
            </p>
          </div>
        </header>

        <main className="flex-1 px-4 pb-28">
          <StepDots step={step} />

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div key="subject" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }}>
                <AppCard>
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10">
                      <MessageCircle className="h-5 w-5 text-[#D4AF37]" />
                    </div>
                    <div>
                      <p className="text-[17px] font-extrabold text-white">Quel est le sujet ?</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-white/45">Pose le cadre. Le secrétariat préparera le bon échange.</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {TOPICS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setTopic(t.id);
                          if (!subject.trim()) setSubject(t.label);
                        }}
                        className={cn(
                          'rounded-2xl border p-3 text-left transition',
                          topic === t.id
                            ? 'border-[#D4AF37]/55 bg-[#D4AF37]/12'
                            : 'border-white/10 bg-white/[0.035]',
                        )}
                      >
                        <p className="text-[12px] font-bold text-white">{t.label}</p>
                        <p className="mt-1 line-clamp-2 text-[10.5px] text-white/40">{t.detail}</p>
                      </button>
                    ))}
                  </div>

                  <label className="mt-4 block">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">Sujet obligatoire</span>
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-[14px] text-white outline-none focus:border-[#D4AF37]/45"
                      placeholder="Ex. choisir un module, parler au secrétariat..."
                    />
                  </label>
                  <label className="mt-3 block">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">Précisions</span>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-[14px] text-white outline-none focus:border-[#D4AF37]/45"
                      placeholder="Contexte, questions, urgence..."
                    />
                  </label>
                </AppCard>
              </motion.div>
            ) : null}

            {step === 2 ? (
              <motion.div key="contact" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }}>
                <AppCard>
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10">
                      <Phone className="h-5 w-5 text-emerald-300" />
                    </div>
                    <div>
                      <p className="text-[17px] font-extrabold text-white">Coordonnées</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-white/45">E-mail et WhatsApp servent aux confirmations.</p>
                    </div>
                  </div>
                  <label className="mt-5 block">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">E-mail</span>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      inputMode="email"
                      className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-[14px] text-white outline-none focus:border-[#D4AF37]/45"
                      placeholder="nom@email.com"
                    />
                  </label>
                  <label className="mt-3 block">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">WhatsApp international</span>
                    <input
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      inputMode="tel"
                      className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-[14px] text-white outline-none focus:border-[#D4AF37]/45"
                      placeholder="+241..."
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setConsent((v) => !v)}
                    className="mt-4 flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-left"
                  >
                    <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', consent ? 'border-[#D4AF37] bg-[#D4AF37] text-black' : 'border-white/20')}>
                      {consent ? <Check className="h-3.5 w-3.5" /> : null}
                    </span>
                    <span className="text-[12px] leading-relaxed text-white/55">
                      J'accepte de recevoir les notifications de rendez-vous par e-mail / WhatsApp.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSmsOptIn((v) => !v)}
                    className="mt-2 text-[12px] text-white/35 underline-offset-2 active:text-white/70"
                  >
                    {smsOptIn ? 'SMS activé' : 'Activer aussi les SMS'}
                  </button>
                </AppCard>
              </motion.div>
            ) : null}

            {step === 3 ? (
              <motion.div key="slot" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }}>
                <AppCard>
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10">
                      <CalendarClock className="h-5 w-5 text-sky-300" />
                    </div>
                    <div>
                      <p className="text-[17px] font-extrabold text-white">Date et créneau</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-white/45">Fuseau détecté : {timezone.replace(/_/g, ' ')}</p>
                    </div>
                  </div>

                  <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {days.map((d) => {
                      const key = dateKey(d);
                      const active = selectedDate === key;
                      return (
                        <button
                          type="button"
                          key={key}
                          onClick={() => setSelectedDate(key)}
                          className={cn(
                            'w-[72px] shrink-0 rounded-2xl border px-2 py-2 text-center',
                            active ? 'border-[#D4AF37]/65 bg-[#D4AF37] text-black' : 'border-white/10 bg-white/[0.035] text-white/55',
                          )}
                        >
                          <p className="text-[10px] font-bold uppercase">{d.toLocaleDateString('fr-FR', { weekday: 'short' })}</p>
                          <p className="mt-0.5 text-[18px] font-black">{d.getDate()}</p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-[12px] font-semibold text-white/55">Créneaux disponibles</p>
                    <button type="button" onClick={() => loadSlots()} className="text-[12px] font-semibold text-[#D4AF37]">
                      Actualiser
                    </button>
                  </div>

                  {slotsLoading ? (
                    <div className="flex items-center justify-center py-8 text-white/45">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : slotError ? (
                    <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-[12px] text-red-200">{slotError}</p>
                  ) : slots.length === 0 ? (
                    <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-[12px] text-white/45">
                      Aucun créneau ce jour. Essaie une autre date.
                    </p>
                  ) : (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {slots.slice(0, 18).map((s) => {
                        const active = selectedSlot?.slotUtc === s.slotUtc && selectedSlot?.secretariatId === s.secretariatId;
                        return (
                          <button
                            key={`${s.slotUtc}-${s.secretariatId}`}
                            type="button"
                            onClick={() => setSelectedSlot(s)}
                            className={cn(
                              'rounded-2xl border px-2 py-3 text-center text-[12px] font-bold',
                              active ? 'border-[#D4AF37]/70 bg-[#D4AF37] text-black' : 'border-white/10 bg-white/[0.035] text-white/70',
                            )}
                          >
                            {formatSlot(s.slotUtc)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </AppCard>
              </motion.div>
            ) : null}

            {step === 4 ? (
              <motion.div key="summary" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }}>
                <AppCard>
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10">
                      <ShieldCheck className="h-5 w-5 text-[#D4AF37]" />
                    </div>
                    <div>
                      <p className="text-[17px] font-extrabold text-white">Confirmer</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-white/45">Relis les informations avant l'envoi.</p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-2">
                    {[
                      ['Sujet', subject],
                      ['Date', selectedSlot?.slotUtc ? formatFullDate(selectedSlot.slotUtc) : '—'],
                      ['Équipe', selectedSlot?.secretariatName || 'Secrétariat'],
                      ['E-mail', email],
                      ['WhatsApp', whatsapp],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">{k}</p>
                        <p className="mt-1 text-[13px] font-semibold text-white/80">{v}</p>
                      </div>
                    ))}
                  </div>
                </AppCard>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </main>

        <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#0B0B0F]/92 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
          <button
            type="button"
            disabled={booking}
            onClick={step === 4 ? submit : continueNext}
            className={cn(
              'flex h-12 w-full items-center justify-center rounded-2xl text-[14px] font-extrabold transition active:scale-[0.99]',
              canContinue || step === 4 ? 'bg-[#D4AF37] text-black' : 'bg-white/[0.06] text-white/30',
            )}
          >
            {booking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {step === 4 ? 'Confirmer le rendez-vous' : 'Continuer'}
            {!booking ? <ChevronRight className="ml-1 h-4 w-4" /> : null}
          </button>
          <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-white/30">
            <Clock className="h-3 w-3" />
            Réponse du secrétariat selon disponibilité.
          </div>
        </footer>
      </div>
    </EleveMobileShell>
  );
}
