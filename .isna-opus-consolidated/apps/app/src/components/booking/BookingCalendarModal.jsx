import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Calendar as CalendarGlyph,
  Loader2,
  CheckCircle,
  Clock,
  Globe,
  UserCheck,
  RefreshCw,
  AlertTriangle,
  Download,
  CalendarClock,
  Mail,
  MessageCircle,
} from 'lucide-react';
import { parse as parseDateFns, format as formatDateFns, startOfDay } from 'date-fns';
import { fr as frLocale } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as DayPickerCalendar } from '@/components/ui/calendar';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  saveVisitorAppointmentSnapshot,
  loadVisitorAppointmentSnapshot,
  clearVisitorAppointmentSnapshot,
} from '@/lib/bookingAppointmentStorage';
import {
  BOOKING_CHANNEL_NGOWAZULU,
  BOOKING_CHANNEL_PRORASCIENCE,
} from '@/config/ngowazuluConsultation';
import { JourneyAmbientInset, JourneySectionLabel } from '@/components/booking/AppointmentJourneyPrimitives';

function BookingCalendarSurface({ embedded, open, onOpenChange, className, children }) {
  if (embedded) {
    return (
      <div className={className} role="region" aria-labelledby="booking-title" aria-describedby={undefined}>
        {children}
      </div>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className} aria-describedby={undefined}>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** Compare à la minute (UTC) pour éviter les écarts de ms entre grille API et créneaux réservables */
function sameSlot(a, b) {
  if (!a || !b) return false;
  const ma = Math.floor(new Date(a).getTime() / 60000);
  const mb = Math.floor(new Date(b).getTime() / 60000);
  return ma === mb;
}

const ACTIVE_STATUSES = ['scheduled', 'in_progress', 'rescheduled'];
const USE_NETLIFY_BOOKING_IN_DEV = String(import.meta.env.VITE_USE_NETLIFY_BOOKING_IN_DEV || '') === '1';

/**
 * Calendrier de réservation — fenêtre modale compacte, réutilisable partout.
 * Visiteurs / prospects : mémorisation du RDV (API + local), annulation, demande de report, .ics.
 * Élèves (tableau de bord) : flux court + confirmation classique.
 */
export function BookingCalendarModal({
  open,
  onOpenChange,
  initialAppointmentId = null,
  bookingChannel = BOOKING_CHANNEL_PRORASCIENCE,
  /** Affichage plein panneau (page RDV) au lieu d’une modale */
  embedded = false,
  /** Suivi de l’étape du wizard pour un panneau narratif externe */
  onStepChange,
  /** Retourne l’état de vue courant: loading | form | existing_appointment | success */
  onViewStateChange,
}) {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  /** Détail RDV pour visiteurs (chargement API ou après réservation) */
  const [visitorDetail, setVisitorDetail] = useState(null);
  /** Prêt à afficher le formulaire / détail visiteur (évite le flash avant sync API) */
  const [visitorReady, setVisitorReady] = useState(true);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleProposed, setRescheduleProposed] = useState('');
  const [rescheduleJustification, setRescheduleJustification] = useState('');
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [downloadingIcs, setDownloadingIcs] = useState(false);
  const [neuronQrOpen, setNeuronQrOpen] = useState(false);
  const [neuronQuestion, setNeuronQuestion] = useState('');
  const [neuronSubmitting, setNeuronSubmitting] = useState(false);

  /* ── Wizard steps ── */
  const [step, setStep] = useState(1); // 1=sujet, 2=secrétariat, 3=calendrier, 4=confirmation
  const [description, setDescription] = useState('');
  const [secretaryRec, setSecretaryRec] = useState(null);
  const [secretaryAlts, setSecretaryAlts] = useState([]);
  const [secretaryStrategy, setSecretaryStrategy] = useState(null);
  const [loadingSecretaries, setLoadingSecretaries] = useState(false);
  const [selectedSecretary, setSelectedSecretary] = useState(null);

  const [reason, setReason] = useState('');
  /** Confirmations RDV (profil + Resend / Twilio WhatsApp) */
  const [notificationEmail, setNotificationEmail] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [notificationConsent, setNotificationConsent] = useState(false);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bookableSlots, setBookableSlots] = useState([]);
  const [slotGrid, setSlotGrid] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const selectedSlotRef = useRef(null);
  selectedSlotRef.current = selectedSlot;
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [availabilityMeta, setAvailabilityMeta] = useState({
    requesterRegion: 'AF',
    schoolOpen: false,
    regionStatuses: [],
    message: null,
  });

  const isStudent = useMemo(
    () => String(user?.role || '').toLowerCase() === 'student',
    [user?.role]
  );

  const requesterTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Libreville',
    []
  );
  const requesterCountry = useMemo(() => {
    const lang = String(navigator.language || '');
    const parts = lang.split('-');
    return parts.length > 1 ? parts[1].toUpperCase() : '';
  }, []);

  const contactEmailOk = useMemo(() => {
    const t = notificationEmail.trim();
    return t.length > 3 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
  }, [notificationEmail]);
  /** E.164 : + puis 8–15 chiffres */
  const contactWhatsappOk = useMemo(() => {
    const t = whatsappPhone.trim().replace(/\s/g, '');
    return t.startsWith('+') && /^\+[1-9]\d{7,14}$/.test(t);
  }, [whatsappPhone]);

  const isNgowazuluBooking = bookingChannel === BOOKING_CHANNEL_NGOWAZULU;
  const staffLabel = isNgowazuluBooking ? 'Administration Ngowazulu' : 'Secrétariat';
  const shouldUseLocalDevFallback = import.meta.env.DEV && !USE_NETLIFY_BOOKING_IN_DEV;

  const buildLocalDevSecretaries = useCallback(() => {
    const main = {
      id: 'local-secretariat-principal',
      name: isNgowazuluBooking ? 'Administration Ngowazulu (local)' : 'Secrétariat ISNA (local)',
      region: 'AF_EU',
      timezone: requesterTimezone,
      score: 92,
      queueEstimate: 0,
      isOnline: true,
    };
    return {
      recommended: main,
      alternatives: [
        { ...main, id: 'local-secretariat-af', name: 'Secrétariat Afrique (local)', region: 'GABON', score: 84 },
        { ...main, id: 'local-secretariat-eu', name: 'Secrétariat Europe (local)', region: 'FRANCE', score: 80 },
      ],
      strategy: 'recommended',
    };
  }, [isNgowazuluBooking, requesterTimezone]);

  const buildLocalDevSlots = useCallback(() => {
    const day = selectedDate || new Date().toISOString().slice(0, 10);
    const startHour = 8;
    const endHour = 18;
    const now = Date.now();
    const slotGrid = [];
    const slots = [];
    for (let h = startHour; h <= endHour; h += 1) {
      for (const min of [0, 30]) {
        const local = new Date(`${day}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`);
        const iso = local.toISOString();
        const isPast = local.getTime() < now;
        const available = !isPast && (h < endHour || min === 0);
        slotGrid.push({
          slotUtc: iso,
          state: available ? 'available' : 'past',
        });
        if (available) {
          slots.push({
            slotUtc: iso,
            secretariatId: 'local-secretariat-principal',
            secretariatName: isNgowazuluBooking ? 'Administration Ngowazulu (local)' : 'Secrétariat ISNA (local)',
            queueEstimate: 0,
          });
        }
      }
    }
    return {
      slots,
      slotGrid,
      requesterRegion: 'AF_EU',
      schoolOpen: true,
      regionStatuses: [],
      message: 'Mode local DEV actif (fonctions Netlify bypass).',
    };
  }, [isNgowazuluBooking, selectedDate]);

  /** Tablette et téléphone : plein écran + traitement premium (largeur sous le breakpoint lg). */
  const [isMobileFullBooking, setIsMobileFullBooking] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const fn = () => setIsMobileFullBooking(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  /* ── Réinitialise le wizard à chaque ouverture ── */
  useEffect(() => {
    if (open || embedded) {
      setStep(1);
      setDescription('');
      setNotificationEmail('');
      setWhatsappPhone('');
      setNotificationConsent(false);
      setSmsOptIn(false);
      setSecretaryRec(null);
      setSecretaryAlts([]);
      setSecretaryStrategy(null);
      setSelectedSecretary(null);
      setSelectedSlot(null);
      setSlotGrid([]);
      setBookableSlots([]);
    }
  }, [open, embedded]);

  /** Préremplit email / WhatsApp depuis le profil compte */
  useEffect(() => {
    if (!session?.access_token || !user?.id) return undefined;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('notification_email, email, whatsapp_phone, notify_sms')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const em = String(data?.notification_email || data?.email || user?.email || '').trim();
      setNotificationEmail(em);
      setWhatsappPhone(String(data?.whatsapp_phone || '').trim());
      setSmsOptIn(data?.notify_sms === true);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.access_token, user?.id, user?.email, open, embedded]);

  useEffect(() => {
    onStepChange?.(step);
  }, [step, onStepChange]);

  useEffect(() => {
    if (!open && !embedded) setCancelConfirmOpen(false);
  }, [open, embedded]);

  /* ── Charge les secrétaires recommandés (étape 2) ── */
  const loadSecretaries = useCallback(async () => {
    setLoadingSecretaries(true);
    try {
      if (shouldUseLocalDevFallback) {
        const localData = buildLocalDevSecretaries();
        setSecretaryRec(localData.recommended || null);
        setSecretaryAlts(localData.alternatives || []);
        setSecretaryStrategy(localData.strategy || 'recommended');
        if (localData.recommended) setSelectedSecretary(localData.recommended);
        return;
      }
      const qs = new URLSearchParams({
        timezone: requesterTimezone,
        country: requesterCountry || '',
        channel: bookingChannel,
      });
      const res = await fetch(`/.netlify/functions/booking-available-secretaries?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Impossible de charger les secrétaires');
      setSecretaryRec(data.recommended || null);
      setSecretaryAlts(data.alternatives || []);
      setSecretaryStrategy(data.strategy || null);
      // Pré-sélectionner la recommandation
      if (data.recommended) setSelectedSecretary(data.recommended);
    } catch (e) {
      toast({ title: 'Secrétariat', description: e?.message || 'Réessayez.', variant: 'destructive' });
    } finally {
      setLoadingSecretaries(false);
    }
  }, [
    bookingChannel,
    requesterTimezone,
    requesterCountry,
    toast,
    shouldUseLocalDevFallback,
    buildLocalDevSecretaries,
  ]);

  const loadSlots = useCallback(
    async ({ keepSelection = false, silent = false } = {}) => {
      if (!session?.access_token || !selectedDate) return;
      if (!silent) setLoadingSlots(true);
      if (!keepSelection) setSelectedSlot(null);
      try {
        if (shouldUseLocalDevFallback) {
          const payload = buildLocalDevSlots();
          const deduped = Array.isArray(payload?.slots) ? payload.slots : [];
          setBookableSlots(deduped);
          setSlotGrid(Array.isArray(payload?.slotGrid) ? payload.slotGrid : []);
          setAvailabilityMeta({
            requesterRegion: payload?.requesterRegion || 'AF_EU',
            schoolOpen: Boolean(payload?.schoolOpen),
            regionStatuses: Array.isArray(payload?.regionStatuses) ? payload.regionStatuses : [],
            message: payload?.message || null,
          });
          setLastSyncAt(Date.now());
          return;
        }
        const windowStart = new Date(`${selectedDate}T00:00:00`);
        const windowEnd = new Date(`${selectedDate}T23:30:00`);
        const qs = new URLSearchParams({
          timezone: requesterTimezone,
          country: requesterCountry || '',
          channel: bookingChannel,
          windowStart: windowStart.toISOString(),
          windowEnd: windowEnd.toISOString(),
        });
        const res = await fetch(`/.netlify/functions/booking-available-slots?${qs.toString()}`);
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || 'Impossible de charger les créneaux');
        const primary = Array.isArray(payload?.slots) ? payload.slots : [];
        const fallback = Array.isArray(payload?.fallbackSlots) ? payload.fallbackSlots : [];
        const merged = [...primary, ...fallback];
        const seen = new Set();
        const deduped = merged.filter((s) => {
          const k = `${s.slotUtc}:${s.secretariatId}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        setBookableSlots(deduped);
        setSlotGrid(Array.isArray(payload?.slotGrid) ? payload.slotGrid : []);
        setAvailabilityMeta({
          requesterRegion: payload?.requesterRegion || 'AF',
          schoolOpen: Boolean(payload?.schoolOpen),
          regionStatuses: Array.isArray(payload?.regionStatuses) ? payload.regionStatuses : [],
          message: payload?.message || null,
        });
        setLastSyncAt(Date.now());
        if (keepSelection && selectedSlotRef.current) {
          const prev = selectedSlotRef.current;
          const still = deduped.find(
            (s) => sameSlot(s.slotUtc, prev.slotUtc) && s.secretariatId === prev.secretariatId
          );
          if (!still) setSelectedSlot(null);
        }
      } catch (e) {
        if (!silent) {
          setBookableSlots([]);
          setSlotGrid([]);
          setAvailabilityMeta((prev) => ({ ...prev, message: null }));
          toast({ title: 'Calendrier', description: e?.message || 'Réessayez.', variant: 'destructive' });
        }
      } finally {
        if (!silent) setLoadingSlots(false);
      }
    },
    [
      bookingChannel,
      requesterCountry,
      requesterTimezone,
      selectedDate,
      session?.access_token,
      toast,
      shouldUseLocalDevFallback,
      buildLocalDevSlots,
    ]
  );

  useEffect(() => {
    if (open && session?.access_token) void loadSlots();
  }, [open, loadSlots, session?.access_token]);

  /* ── Real-time : rafraîchit les créneaux dès qu'un RDV est créé/modifié ── */
  useEffect(() => {
    if (shouldUseLocalDevFallback || !open || !session?.access_token) return undefined;

    const channel = supabase
      .channel('booking-slots-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointment_requests',
      }, () => {
        if (!document.hidden) loadSlots({ keepSelection: true, silent: true });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'availability_slots',
      }, () => {
        if (!document.hidden) loadSlots({ keepSelection: true, silent: true });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [open, loadSlots, session?.access_token, shouldUseLocalDevFallback]);

  /** Charge le dernier RDV visiteur (API + secours localStorage) */
  useEffect(() => {
    if (isStudent || !open) {
      setVisitorReady(true);
      return undefined;
    }
    if (!session?.access_token) {
      setVisitorReady(true);
      return undefined;
    }
    let cancelled = false;
    setVisitorReady(false);
    (async () => {
      try {
        if (shouldUseLocalDevFallback) {
          const stored = loadVisitorAppointmentSnapshot();
          if (!cancelled) {
            if (stored?.appointmentId) {
              setVisitorDetail({
                ...stored,
                fromLocalOnly: true,
                visitorTimezone: stored.visitorTimezone || requesterTimezone,
              });
            } else {
              setVisitorDetail(null);
            }
          }
          return;
        }
        const qs = new URLSearchParams({ channel: bookingChannel });
        const res = await fetch(`/.netlify/functions/booking-my-appointments?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const payload = await res.json();
        if (!res.ok || cancelled) return;
        const list = Array.isArray(payload?.appointments) ? payload.appointments : [];
        const byId = initialAppointmentId
          ? list.find((a) => a.id === initialAppointmentId)
          : null;
        const pick =
          byId ||
          list.find((a) => ACTIVE_STATUSES.includes(String(a.status || '').toLowerCase())) ||
          null;
        if (pick) {
          setVisitorDetail({
            appointmentId: pick.id,
            bookingReference: pick.bookingReference,
            scheduledAt: pick.scheduledAt,
            subject: pick.subject || '—',
            status: pick.status,
            secretariatName: null,
            immersiveChatId: pick.immersiveChatId,
            visitorTimezone: pick.visitorTimezone || requesterTimezone,
            bookingReferenceFull: pick.bookingReference,
          });
        } else {
          const stored = loadVisitorAppointmentSnapshot();
          if (stored?.appointmentId) {
            setVisitorDetail({
              ...stored,
              fromLocalOnly: true,
              visitorTimezone: stored.visitorTimezone || requesterTimezone,
            });
          } else {
            setVisitorDetail(null);
          }
        }
      } catch {
        const stored = loadVisitorAppointmentSnapshot();
        if (stored?.appointmentId) {
          setVisitorDetail({
            ...stored,
            fromLocalOnly: true,
            visitorTimezone: stored.visitorTimezone || requesterTimezone,
          });
        }
      } finally {
        if (!cancelled) setVisitorReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    bookingChannel,
    open,
    session?.access_token,
    isStudent,
    initialAppointmentId,
    requesterTimezone,
    shouldUseLocalDevFallback,
  ]);

  const selectGridCell = (cell) => {
    if (cell.state !== 'available') return;
    const match = bookableSlots.find((s) => sameSlot(s.slotUtc, cell.slotUtc));
    if (match) {
      setSelectedSlot(match);
      return;
    }
    toast({
      title: 'Créneau',
      description: 'Créneau affiché libre mais aucun secrétariat assigné — cliquez sur Actualiser.',
      variant: 'destructive',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.id || !session?.access_token) {
      toast({ title: 'Connexion', description: 'Connectez-vous pour réserver.', variant: 'destructive' });
      return;
    }
    if (!reason.trim()) {
      toast({ title: 'Sujet requis', description: "Indiquez le sujet de l'entretien.", variant: 'destructive' });
      return;
    }
    if (!contactEmailOk) {
      toast({
        title: 'E-mail requis',
        description: 'Indiquez une adresse e-mail valide pour la confirmation.',
        variant: 'destructive',
      });
      return;
    }
    if (!contactWhatsappOk) {
      toast({
        title: 'WhatsApp requis',
        description: 'Indiquez votre numéro WhatsApp au format international (ex. +33612345678).',
        variant: 'destructive',
      });
      return;
    }
    if (!notificationConsent) {
      toast({
        title: 'Consentement requis',
        description: 'Veuillez accepter de recevoir les notifications de rendez-vous (e-mail / WhatsApp).',
        variant: 'destructive',
      });
      return;
    }
    if (!selectedSlot?.slotUtc || !selectedSlot?.secretariatId) {
      toast({ title: 'Créneau requis', description: 'Choisissez un créneau disponible (non grisé).', variant: 'destructive' });
      return;
    }
    setBooking(true);
    try {
      if (shouldUseLocalDevFallback) {
        const fakeRef = `DEV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const detail = {
          appointmentId: `local-${Date.now()}`,
          bookingReference: fakeRef,
          scheduledAt: selectedSlot.slotUtc,
          queuePosition: selectedSlot.queueEstimate || 1,
          secretariatName: selectedSlot.secretariatName,
          subject: reason.trim(),
          status: 'scheduled',
          immersiveChatId: null,
          visitorTimezone: requesterTimezone,
          fromLocalOnly: true,
        };
        saveVisitorAppointmentSnapshot(detail);
        setVisitorDetail(detail);
        if (isStudent) {
          setSubmitted({
            appointmentId: detail.appointmentId,
            bookingReference: detail.bookingReference,
            scheduledAt: detail.scheduledAt,
            queuePosition: detail.queuePosition,
            secretariatName: detail.secretariatName,
          });
        }
        toast({
          title: 'Mode local DEV',
          description: 'Rendez-vous simulé localement (sans fonction Netlify).',
        });
        setStep(4);
        return;
      }
      const res = await fetch('/.netlify/functions/booking-request-appointment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          subject: reason.trim(),
          description: description.trim() || reason.trim(),
          scheduledAt: selectedSlot.slotUtc,
          secretariatId: selectedSecretary?.id || selectedSlot.secretariatId,
          visitorTimezone: requesterTimezone,
          visitorCountry: requesterCountry,
          bookingChannel,
          notificationEmail: notificationEmail.trim(),
          whatsappPhone: whatsappPhone.trim().replace(/\s/g, ''),
          notificationConsent,
          notifySms: smsOptIn,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Réservation impossible');

      const detail = {
        appointmentId: payload.appointmentId || payload.requestId,
        bookingReference: payload.bookingReference,
        scheduledAt: selectedSlot.slotUtc,
        queuePosition: selectedSlot.queueEstimate || 1,
        secretariatName: selectedSlot.secretariatName,
        subject: reason.trim(),
        status: 'scheduled',
        immersiveChatId: payload.immersiveChatId,
        visitorTimezone: requesterTimezone,
      };

      // Redirection vers la Waiting Room immersive après réservation
      const ref = payload.bookingReference;
      if (ref) {
        onOpenChange?.(false);
        navigate(`/rendez-vous/${encodeURIComponent(ref)}`);
        return;
      }

      if (isStudent) {
        setSubmitted({
          appointmentId: detail.appointmentId,
          bookingReference: payload.bookingReference || null,
          scheduledAt: selectedSlot.slotUtc,
          queuePosition: selectedSlot.queueEstimate || 1,
          secretariatName: selectedSlot.secretariatName,
        });
      } else {
        saveVisitorAppointmentSnapshot(detail);
        setVisitorDetail(detail);
      }
      toast({
        title: isNgowazuluBooking ? 'Consultation programmée' : 'Entretien programmé',
        description: 'Vous recevrez une confirmation.',
      });
    } catch (err) {
      toast({ title: 'Erreur', description: err?.message || 'Réessayez.', variant: 'destructive' });
    } finally {
      setBooking(false);
    }
  };

  const compactTime = (iso) => {
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        timeZone: requesterTimezone,
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso?.slice(11, 16) || '—';
    }
  };

  const parsedSelectedDate = useMemo(() => {
    if (!selectedDate) return undefined;
    const d = parseDateFns(selectedDate, 'yyyy-MM-dd', new Date());
    return Number.isNaN(d.getTime()) ? undefined : d;
  }, [selectedDate]);

  const downloadIcs = async () => {
    if (!session?.access_token || !visitorDetail?.appointmentId) return;
    setDownloadingIcs(true);
    try {
      const res = await fetch(
        `/.netlify/functions/booking-appointment-ics?appointmentId=${encodeURIComponent(visitorDetail.appointmentId)}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (!res.ok) throw new Error('Impossible de générer le fichier calendrier');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rdv-${String(visitorDetail.bookingReference || visitorDetail.appointmentId).slice(0, 12)}.ics`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Calendrier', description: 'Fichier .ics téléchargé — importez-le dans Google Agenda, Outlook, etc.' });
    } catch (e) {
      toast({ title: 'Calendrier', description: e?.message || 'Réessayez.', variant: 'destructive' });
    } finally {
      setDownloadingIcs(false);
    }
  };

  const openCancelConfirm = () => {
    if (!visitorDetail?.appointmentId || !session?.access_token) return;
    setCancelConfirmOpen(true);
  };

  const performCancelAppointment = async () => {
    if (!visitorDetail?.appointmentId || !session?.access_token) return;
    setCancelling(true);
    try {
      if (shouldUseLocalDevFallback) {
        setCancelConfirmOpen(false);
        clearVisitorAppointmentSnapshot();
        setVisitorDetail((prev) => (prev ? { ...prev, status: 'cancelled' } : prev));
        toast({
          title: 'Rendez-vous annulé (local)',
          description: 'Mode dev local: annulation simulée sans fonction Netlify.',
        });
        return;
      }

      const res = await fetch('/.netlify/functions/booking-cancel-appointment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ appointmentId: visitorDetail.appointmentId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Annulation impossible');
      setCancelConfirmOpen(false);
      clearVisitorAppointmentSnapshot();
      setVisitorDetail(null);
      toast({ title: 'Rendez-vous annulé', description: 'Vous pouvez en réserver un nouveau.' });
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Réessayez.', variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  const openReschedule = () => {
    const base = visitorDetail?.scheduledAt ? new Date(visitorDetail.scheduledAt) : new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const local = new Date(base.getTime() + 60 * 60 * 1000);
    const y = local.getFullYear();
    const m = pad(local.getMonth() + 1);
    const d = pad(local.getDate());
    const h = pad(local.getHours());
    const min = pad(local.getMinutes());
    setRescheduleProposed(`${y}-${m}-${d}T${h}:${min}`);
    setRescheduleJustification('');
    setRescheduleOpen(true);
  };

  const submitRescheduleRequest = async (e) => {
    e.preventDefault();
    if (!visitorDetail?.appointmentId || !session?.access_token) return;
    if (rescheduleJustification.trim().length < 8) {
      toast({
        title: 'Justification',
        description: 'Expliquez le motif du report (au moins 8 caractères).',
        variant: 'destructive',
      });
      return;
    }
    const proposed = rescheduleProposed ? new Date(rescheduleProposed) : null;
    if (!proposed || Number.isNaN(proposed.getTime())) {
      toast({ title: 'Date', description: 'Choisissez une date et heure proposées.', variant: 'destructive' });
      return;
    }
    setRescheduleSubmitting(true);
    try {
      const res = await fetch('/.netlify/functions/booking-reschedule-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          appointmentId: visitorDetail.appointmentId,
          proposedScheduledAt: proposed.toISOString(),
          justification: rescheduleJustification.trim(),
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Envoi impossible');
      setRescheduleOpen(false);
      toast({
        title: 'Demande envoyée',
        description: 'Le secrétariat confirmera le nouveau créneau.',
      });
    } catch (err) {
      toast({ title: 'Erreur', description: err?.message || 'Réessayez.', variant: 'destructive' });
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  const submitNeuronQuestion = async (e) => {
    e.preventDefault();
    const q = neuronQuestion.trim();
    if (q.length < 5) {
      toast({
        title: 'Question trop courte',
        description: 'Décrivez votre question en au moins 5 caractères.',
        variant: 'destructive',
      });
      return;
    }
    setNeuronSubmitting(true);
    try {
      const key = `neuronqr_questions_${visitorDetail?.appointmentId || 'unknown'}`;
      const prev = JSON.parse(window.localStorage.getItem(key) || '[]');
      const next = [
        ...prev,
        {
          question: q,
          createdAt: new Date().toISOString(),
        },
      ];
      window.localStorage.setItem(key, JSON.stringify(next));
      setNeuronQuestion('');
      setNeuronQrOpen(false);
      toast({
        title: 'Question ajoutée',
        description: 'Votre question NeuronQR a été enregistrée.',
      });
    } catch {
      toast({
        title: 'Impossible d’enregistrer',
        description: 'Réessayez dans un instant.',
        variant: 'destructive',
      });
    } finally {
      setNeuronSubmitting(false);
    }
  };

  const statusCancelled = String(visitorDetail?.status || '').toLowerCase() === 'cancelled';
  const canManageVisitor =
    visitorDetail &&
    !isStudent &&
    !statusCancelled &&
    ACTIVE_STATUSES.includes(String(visitorDetail.status || '').toLowerCase());

  const visitorPublicRef =
    visitorDetail?.bookingReference || visitorDetail?.bookingReferenceFull || null;
  const visitorStatus = String(visitorDetail?.status || '').toLowerCase();
  const visitorProgressSteps = [
    { key: 'pending', label: 'Validation secrétariat' },
    { key: 'scheduled', label: 'Rendez-vous planifié' },
    { key: 'chat', label: 'Chat immersif' },
    { key: 'live', label: 'Live immersif' },
  ];
  const visitorProgressIndex =
    ['live_started', 'in_progress', 'completed'].includes(visitorStatus)
      ? 3
      : ['chat_started'].includes(visitorStatus)
        ? 2
        : ['confirmed', 'scheduled', 'rescheduled', 'preparing', 'ready'].includes(visitorStatus)
          ? 1
          : 0;
  const visitorProgressPercent = Math.round(((visitorProgressIndex + 1) / visitorProgressSteps.length) * 100);
  const [visitorNowTick, setVisitorNowTick] = useState(Date.now());
  useEffect(() => {
    if (!visitorDetail?.scheduledAt) return undefined;
    const t = window.setInterval(() => setVisitorNowTick(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [visitorDetail?.scheduledAt]);
  const visitorCountdown = useMemo(() => {
    if (!visitorDetail?.scheduledAt) return null;
    const ms = new Date(visitorDetail.scheduledAt).getTime() - visitorNowTick;
    if (Number.isNaN(ms)) return null;
    if (ms <= 0) return { days: 0, hours: 0, mins: 0, secs: 0, isPast: true };
    return {
      days: Math.floor(ms / 86_400_000),
      hours: Math.floor((ms % 86_400_000) / 3_600_000),
      mins: Math.floor((ms % 3_600_000) / 60_000),
      secs: Math.floor((ms % 60_000) / 1000),
      isPast: false,
    };
  }, [visitorDetail?.scheduledAt, visitorNowTick]);

  const renderVisitorDetail = () => (
    <motion.div
      key="visitor-detail"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 32 }}
      className="relative z-10 flex min-h-0 flex-1 flex-col"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2 pt-1 max-lg:pt-[max(0.25rem,env(safe-area-inset-top,0px))] md:px-6 md:pb-4 md:pt-2">
        <div className="mx-auto w-full max-w-4xl space-y-3 md:space-y-4">
          <div className="grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.35)] md:p-5">
              <JourneySectionLabel className="mb-2">Rendez-vous en attente</JourneySectionLabel>
              <h3 className="font-display text-xl font-semibold leading-[1.1] tracking-tight text-white">
                <span className="text-[#D4AF37]">Espace entretien</span>
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-gray-300 md:text-sm">
                Vos informations d&apos;espace entretien sont regroupées ici : salle d&apos;attente, suivi du statut,
                report et annulation.
              </p>
              <div className="mt-3 space-y-1.5 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-left text-xs text-gray-300 md:text-sm">
                <p>
                  <span className="text-gray-500">Réf. </span>
                  <span className="font-mono text-[#D4AF37]">
                    {String(visitorDetail.bookingReference || visitorDetail.appointmentId || '').slice(0, 14).toUpperCase()}
                  </span>
                </p>
                <p>
                  <span className="text-gray-500">Statut </span>
                  <span className="capitalize text-white">{visitorDetail.status || 'scheduled'}</span>
                </p>
                <p>
                  <span className="text-gray-500">Sujet </span>
                  <span className="text-gray-200">{visitorDetail.subject || '—'}</span>
                </p>
                <p>
                  <span className="text-gray-500">Horaire </span>
                  <span className="text-gray-100">
                    {visitorDetail.scheduledAt
                      ? new Date(visitorDetail.scheduledAt).toLocaleString('fr-FR', {
                          dateStyle: 'full',
                          timeStyle: 'short',
                          timeZone: visitorDetail.visitorTimezone || requesterTimezone,
                        })
                      : '—'}
                  </span>
                </p>
                {visitorCountdown ? (
                  <p>
                    <span className="text-gray-500">Compte à rebours </span>
                    <span className="text-[#D4AF37]">
                      {visitorCountdown.days}j {String(visitorCountdown.hours).padStart(2, '0')}h {String(visitorCountdown.mins).padStart(2, '0')}m {String(visitorCountdown.secs).padStart(2, '0')}s
                    </span>
                  </p>
                ) : null}
                {visitorDetail.secretariatName ? (
                  <p className="text-xs text-gray-400">Secrétariat : {visitorDetail.secretariatName}</p>
                ) : null}
                <div className="mt-1.5 rounded-lg border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-2">
                  <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-[0.12em]">
                    <span className="text-[#D4AF37]">Statut du rendez-vous</span>
                    <span className="text-white/80">{visitorProgressPercent}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#b8942e] via-[#D4AF37] to-amber-300"
                      style={{ width: `${visitorProgressPercent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-gray-400">
                    Niveau actuel : <span className="text-[#D4AF37]">{visitorProgressSteps[visitorProgressIndex]?.label}</span>
                  </p>
                </div>
              </div>
              <div className="mt-2 px-0.5 pb-0.5">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {visitorProgressSteps.map((step, idx) => {
                    const isDone = idx < visitorProgressIndex;
                    const isActive = idx === visitorProgressIndex;
                    return (
                      <div
                        key={step.key}
                        className={cn(
                          'rounded-lg border px-2 py-1.5 text-[11px] font-medium',
                          isDone && 'border-emerald-500/35 bg-emerald-500/12 text-emerald-200',
                          isActive && 'border-[#D4AF37]/45 bg-[#D4AF37]/14 text-[#D4AF37]',
                          !isDone && !isActive && 'border-white/12 bg-white/[0.02] text-gray-500',
                        )}
                      >
                        <span className="block text-[9px] uppercase tracking-[0.08em] opacity-75">Étape {idx + 1}</span>
                        <span>{step.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

          </div>

          {rescheduleOpen ? (
            <form
              onSubmit={submitRescheduleRequest}
              className="space-y-3 rounded-xl border border-[#D4AF37]/25 bg-black/35 p-4 text-left backdrop-blur-sm"
            >
              <p className="text-sm font-medium text-white">Demande de report</p>
              <div>
                <Label className="text-xs text-gray-400">Nouveau créneau proposé</Label>
                <Input
                  type="datetime-local"
                  value={rescheduleProposed}
                  onChange={(e) => setRescheduleProposed(e.target.value)}
                  className="mt-1 bg-[#0a0e14] border-white/10"
                  required
                />
              </div>
              <div>
                <Label className="text-xs text-gray-400">Justification</Label>
                <Textarea
                  value={rescheduleJustification}
                  onChange={(e) => setRescheduleJustification(e.target.value)}
                  placeholder="Expliquez pourquoi vous souhaitez reporter…"
                  className="mt-1 min-h-[80px] bg-[#0a0e14] border-white/10 text-sm"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setRescheduleOpen(false)}>
                  Retour
                </Button>
                <Button type="submit" className="bg-[#D4AF37] text-black" disabled={rescheduleSubmitting}>
                  {rescheduleSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Envoyer la demande'}
                </Button>
              </div>
            </form>
          ) : null}

        </div>
      </div>

      <div
        className="relative z-10 shrink-0 space-y-2 border-t border-[#D4AF37]/15 bg-[#0a0908]/96 px-4 py-3 shadow-[0_-16px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl md:px-6 md:py-4"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mb-1 rounded-xl border border-violet-500/25 bg-violet-500/5 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-200">NeuronQR</p>
              <p className="text-[11px] text-violet-200/75">Ajouter une question à traiter pendant l&apos;entretien.</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-violet-300/35 text-violet-100 hover:bg-violet-500/15"
              onClick={() => setNeuronQrOpen(true)}
            >
              Ajouter
            </Button>
          </div>
        </div>

        <Button
          className="h-12 w-full bg-[#D4AF37] text-base font-bold text-black shadow-[0_0_24px_rgba(212,175,55,0.25)] hover:bg-amber-400 max-lg:min-h-[3.25rem]"
          onClick={() => navigate('/prospect/entretien')}
        >
          Salle d&apos;attente
        </Button>
        {visitorPublicRef ? (
          <Button
            asChild
            variant="outline"
            className="h-11 w-full border-[#D4AF37]/35 text-[#D4AF37] hover:bg-[#D4AF37]/10"
          >
            <Link to={`/rendez-vous/${encodeURIComponent(String(visitorPublicRef))}`}>Page publique du rendez-vous</Link>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full border-white/15"
          disabled={!canManageVisitor || downloadingIcs}
          onClick={() => void downloadIcs()}
        >
          {downloadingIcs ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Ajouter à mon agenda (.ics)
        </Button>
        {canManageVisitor ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" className="border-amber-500/30 text-amber-100" onClick={openReschedule}>
              <CalendarClock className="mr-2 h-4 w-4" />
              Demander un report
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-red-500/30 text-red-200 hover:bg-red-500/10"
              disabled={cancelling}
              onClick={() => openCancelConfirm()}
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Annuler'}
            </Button>
          </div>
        ) : null}
        {statusCancelled ? (
          <Button
            type="button"
            variant="secondary"
            className="bg-white/10"
            onClick={() => {
              clearVisitorAppointmentSnapshot();
              setVisitorDetail(null);
            }}
          >
            Prendre un nouveau rendez-vous
          </Button>
        ) : null}
        <Button variant="ghost" className="text-gray-400" onClick={() => onOpenChange?.(false)}>
          Fermer
        </Button>
      </div>

      <Dialog open={neuronQrOpen} onOpenChange={setNeuronQrOpen}>
        <DialogContent className="border-violet-400/30 bg-[#0b0a12] text-white">
          <DialogHeader>
            <DialogTitle className="text-violet-200">Ajouter une question NeuronQR</DialogTitle>
            <DialogDescription className="text-violet-200/80">
              Cette question sera ajoutée à votre préparation d&apos;entretien.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitNeuronQuestion} className="space-y-3">
            <Textarea
              value={neuronQuestion}
              onChange={(e) => setNeuronQuestion(e.target.value)}
              placeholder="Ex: Quels points dois-je prioriser pour ma situation actuelle ?"
              className="min-h-[110px] border-violet-300/20 bg-black/30 text-sm"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setNeuronQrOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                className="bg-violet-500 text-white hover:bg-violet-400"
                disabled={neuronSubmitting}
              >
                {neuronSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ajouter'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
  );

  const renderStudentSuccess = () => (
    <motion.div
      key="success"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 32 }}
      className="relative z-10 flex min-h-0 flex-1 flex-col"
    >
      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-4 pt-2 text-center md:justify-start md:pt-6">
        <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[#D4AF37]/25 bg-gradient-to-br from-[#1a1510]/95 via-[#10141a]/95 to-[#0a0908] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <JourneySectionLabel className="mb-3">Confirmé</JourneySectionLabel>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/15">
            <CheckCircle className="h-7 w-7 text-emerald-400" />
          </div>
          {embedded ? (
            <h3 className="mt-4 text-xl font-bold text-white">Entretien programmé</h3>
          ) : (
            <DialogTitle className="mt-4 text-xl font-bold text-white">Entretien programmé</DialogTitle>
          )}
          <p className="mt-2 text-sm text-gray-400">
            Réf.{' '}
            <span className="font-mono text-[#D4AF37]">
              {submitted.bookingReference
                ? String(submitted.bookingReference).slice(0, 12).toUpperCase()
                : String(submitted.appointmentId || '').slice(0, 8).toUpperCase()}
            </span>
          </p>
          <p className="mt-2 text-sm text-gray-300">
            {new Date(submitted.scheduledAt).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}
          </p>
          <p className="mx-auto mt-3 max-w-sm text-xs text-gray-500">
            Détails dans votre tableau de bord et la messagerie. Les notifications vous y mènent directement.
          </p>
          {submitted.bookingReference ? (
            <Button
              asChild
              variant="outline"
              className="mt-4 w-full border-[#D4AF37]/35 text-[#D4AF37] hover:bg-[#D4AF37]/10"
            >
              <Link to={`/rendez-vous/${encodeURIComponent(String(submitted.bookingReference))}`}>
                Ouvrir la salle d&apos;attente publique
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
      <div
        className="shrink-0 space-y-2 border-t border-[#D4AF37]/15 bg-[#0a0908]/96 px-4 py-3 shadow-[0_-16px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl md:px-6"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <Button
          className="h-12 w-full bg-[#D4AF37] text-base font-bold text-black hover:bg-amber-400 max-lg:min-h-[3.25rem]"
          onClick={() => navigate('/prospect/entretien')}
        >
          Salon entretien
        </Button>
        <Button variant="outline" className="h-11 w-full border-white/15" onClick={() => onOpenChange?.(false)}>
          Fermer
        </Button>
      </div>
    </motion.div>
  );

  const showForm = !visitorDetail && !(submitted && isStudent);
  const viewState = !visitorReady
    ? 'loading'
    : visitorDetail && !isStudent
      ? 'existing_appointment'
      : submitted && isStudent
        ? 'success'
        : 'form';

  useEffect(() => {
    onViewStateChange?.(viewState);
  }, [onViewStateChange, viewState]);

  const stepMotion = {
    initial: { opacity: 0, x: 22 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -14 },
    transition: { type: 'spring', stiffness: 340, damping: 34, mass: 0.82 },
  };

  const slotStaggerContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.04, delayChildren: 0.06 },
    },
  };
  const slotStaggerItem = {
    hidden: { opacity: 0, y: 8, scale: 0.92 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: 'spring', stiffness: 420, damping: 28 },
    },
  };

  // En page embedded desktop, on passe en sélecteur compact pour garantir l'affichage des créneaux + CTA.
  const useInlineCalendarPicker = isMobileFullBooking;
  const slotGridMaxClass = embedded
    ? 'max-h-[min(34vh,320px)] max-lg:max-h-[min(30vh,270px)]'
    : 'max-h-[min(42vh,280px)] max-lg:max-h-[min(52vh,420px)] sm:max-h-[min(48vh,360px)]';

  const bookingSurfaceClass = embedded
    ? cn(
        'relative flex w-full flex-col gap-0 overflow-hidden rounded-3xl border-2 border-[#D4AF37]/35 !bg-[#0a0908] p-0 text-white shadow-[0_0_0_1px_rgba(212,175,55,0.12),0_25px_80px_rgba(0,0,0,0.55)]',
        'h-[min(calc(100dvh-9rem),760px)] max-h-[min(calc(100dvh-9rem),760px)]',
      )
    : cn(
        'relative flex max-h-[min(92vh,820px)] flex-col gap-0 overflow-hidden rounded-2xl border-2 border-[#D4AF37]/35 !bg-[#0a0908] p-0 text-white shadow-[0_0_0_1px_rgba(212,175,55,0.12),0_25px_80px_rgba(0,0,0,0.55)] sm:max-w-2xl',
        'max-lg:!fixed max-lg:inset-0 max-lg:!left-0 max-lg:!top-0 max-lg:h-[100dvh] max-lg:max-h-none max-lg:w-full max-lg:!max-w-none max-lg:!translate-x-0 max-lg:!translate-y-0 max-lg:rounded-none max-lg:border-0 max-lg:shadow-[0_0_120px_rgba(212,175,55,0.06)]',
        'w-full max-w-[min(100vw-1.5rem,36rem)]',
      );

  return (
    <>
      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent className="border-red-500/20 sm:rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler ce rendez-vous ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. Vous pourrez en prendre un autre ensuite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-stretch sm:space-x-0">
            <AlertDialogCancel className="mt-0 border-white/15" disabled={cancelling}>
              Retour
            </AlertDialogCancel>
            <Button
              type="button"
              className="h-11 bg-red-600 font-semibold text-white hover:bg-red-500"
              disabled={cancelling}
              onClick={() => void performCancelAppointment()}
            >
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Oui, annuler'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BookingCalendarSurface
        embedded={embedded}
        open={open}
        onOpenChange={onOpenChange}
        className={bookingSurfaceClass}
      >
        <JourneyAmbientInset />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-[0.95]"
          aria-hidden
        />
        <AnimatePresence mode="wait">
          {!visitorReady && !isStudent ? (
            <div className="relative z-10 flex min-h-[45vh] flex-1 flex-col items-center justify-center gap-4 p-12">
              <motion.div
                animate={{ opacity: [0.55, 1, 0.55] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Loader2 className="h-9 w-9 animate-spin text-[#D4AF37]" />
              </motion.div>
              <p className="max-w-xs text-center text-sm text-gray-400">Préparation de votre espace réservation…</p>
            </div>
          ) : null}

          {visitorReady && visitorDetail && !isStudent ? renderVisitorDetail() : null}

          {visitorReady && submitted && isStudent ? renderStudentSuccess() : null}

          {visitorReady && showForm ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: isMobileFullBooking ? 24 : 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 30 }}
              className="relative z-10 flex min-h-0 flex-1 flex-col"
            >
              {/* ── Header + stepper premium ── */}
              <DialogHeader
                className={cn(
                  'shrink-0 border-b border-white/10 px-5 pb-4 pt-5 max-lg:pb-3',
                  'max-lg:pt-[max(1.1rem,env(safe-area-inset-top,0px))]',
                  embedded && 'px-4 pb-2 pt-3',
                )}
              >
                <div className={cn('mb-4 flex items-center gap-3 max-lg:mb-3', embedded && 'mb-2')}>
                  <motion.div
                    initial={false}
                    animate={{ rotate: [0, -6, 6, 0], scale: [1, 1.05, 1] }}
                    transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 5 }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D4AF37]/25 to-amber-600/10 ring-1 ring-[#D4AF37]/30"
                  >
                    <CalendarGlyph className="h-5 w-5 text-[#D4AF37]" strokeWidth={2} />
                  </motion.div>
                  <div className="min-w-0 flex-1">
                    {embedded ? (
                      <h2
                        id="booking-title"
                        className="font-display text-left text-lg font-semibold tracking-tight text-white max-lg:text-[1.125rem]"
                      >
                        {isNgowazuluBooking ? 'Réserver une consultation Ngowazulu' : 'Prendre rendez-vous'}
                      </h2>
                    ) : (
                      <DialogTitle className="font-display text-left text-lg font-semibold tracking-tight text-white max-lg:text-[1.125rem]">
                        {isNgowazuluBooking ? 'Réserver une consultation Ngowazulu' : 'Prendre rendez-vous'}
                      </DialogTitle>
                    )}
                    <p className="mt-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.24em] text-[#D4AF37]/90">
                      Parcours guidé · 4 étapes
                    </p>
                    {embedded ? (
                      <p className="sr-only">Assistant de réservation en quatre étapes</p>
                    ) : (
                      <DialogDescription className="sr-only">
                        Assistant de réservation en quatre étapes
                      </DialogDescription>
                    )}
                  </div>
                </div>

                <div className={cn('space-y-3', embedded && 'space-y-2')}>
                  <div className="flex items-center justify-between px-0.5 text-[10px] uppercase tracking-[0.14em] text-gray-500">
                    <span>Étape {step} sur 4</span>
                    <motion.span
                      key={step}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="font-medium text-[#D4AF37]/90"
                    >
                      {['Sujet', 'Secrétariat', 'Calendrier', 'Confirmation'][step - 1]}
                    </motion.span>
                  </div>
                  <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#b8942e] via-[#D4AF37] to-amber-300 shadow-[0_0_20px_rgba(212,175,55,0.45)]"
                      initial={false}
                      animate={{ width: `${(step / 4) * 100}%` }}
                      transition={{ type: 'spring', stiffness: 100, damping: 22 }}
                    />
                  </div>
                  <div className={cn('flex justify-between gap-1 px-0.5 pt-1 max-lg:pt-0', embedded && 'pt-0')}>
                    {['Sujet', 'Équipe', 'Créneau', 'OK'].map((shortLabel, i) => {
                      const n = i + 1;
                      const done = step > n;
                      const active = step === n;
                      return (
                        <motion.div
                          key={n}
                          className="flex flex-1 flex-col items-center gap-1"
                          initial={false}
                          animate={{
                            scale: active ? 1.06 : done ? 1.02 : 0.96,
                            opacity: active || done ? 1 : 0.45,
                          }}
                          transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                        >
                          <div
                            className={cn(
                              'flex h-7 w-7 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-shadow md:h-8 md:w-8 md:text-xs',
                              done &&
                                'border-[#D4AF37] bg-[#D4AF37] text-black shadow-[0_0_18px_rgba(212,175,55,0.45)]',
                              active &&
                                !done &&
                                'border-[#D4AF37] bg-[#D4AF37]/15 text-[#D4AF37] shadow-[0_0_22px_rgba(212,175,55,0.28)]',
                              !active &&
                                !done &&
                                'border-white/15 bg-black/20 text-gray-500',
                            )}
                          >
                            {done ? <CheckCircle className="h-3.5 w-3.5 md:h-4 md:w-4" strokeWidth={2.5} /> : n}
                          </div>
                          <span
                            className={cn(
                              'block max-w-[3.25rem] text-center text-[8px] leading-tight sm:max-w-none sm:text-[9px]',
                              active ? 'text-[#D4AF37]' : 'text-gray-500',
                            )}
                          >
                            {shortLabel}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </DialogHeader>

              {/* ── Gate: connexion requise ── */}
              {!session?.access_token ? (
                <div className="p-5">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3 rounded-2xl border border-[#D4AF37]/30 bg-gradient-to-br from-[#1a1510]/90 to-[#0a0908] px-4 py-5 text-sm text-amber-50 shadow-[0_0_40px_rgba(212,175,55,0.08)]"
                  >
                    <JourneySectionLabel>Accès</JourneySectionLabel>
                    <p className="font-semibold text-white">Connexion requise</p>
                    <p className="text-xs text-amber-100/90">
                      Connectez-vous pour réserver {isNgowazuluBooking ? 'une consultation' : 'un entretien'}.
                    </p>
                    <Button
                      type="button"
                      className="h-12 w-full bg-[#D4AF37] text-base font-bold text-black hover:bg-amber-400"
                      onClick={() => navigate('/login', { state: { from: { pathname: '/appointment/request' } } })}>
                      Se connecter
                    </Button>
                  </motion.div>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                  <div
                    className={cn(
                      'min-h-0 flex-1 space-y-4 px-3 py-4 max-lg:px-4 sm:px-6',
                      embedded
                        ? step === 3
                          ? 'overflow-y-auto py-2 sm:px-4'
                          : 'overflow-y-hidden py-2 sm:px-4'
                        : 'overflow-y-auto',
                    )}
                  >
                    <AnimatePresence mode="wait">

                      {/* ══ Étape 1 — Sujet & Description ══ */}
                      {step === 1 && (
                        <motion.div key="step1" {...stepMotion} className="space-y-4">
                          <div>
                            <Label className="text-xs text-gray-400">
                              Sujet {isNgowazuluBooking ? 'de la consultation' : "de l'entretien"}{' '}
                              <span className="text-red-400">*</span>
                            </Label>
                            <Textarea
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              placeholder={
                                isNgowazuluBooking
                                  ? 'Ex : Blocage de vie, rêves troublants, orientation spirituelle…'
                                  : 'Ex : Découvrir les formations, inscription, question spirituelle…'
                              }
                              className="bg-[#0a0e14] border-white/10 mt-1 min-h-[80px] text-sm"
                              rows={3}
                              autoFocus
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-400">Description (optionnel)</Label>
                            <Textarea
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder={
                                isNgowazuluBooking
                                  ? 'Précisez votre situation spirituelle, vos attentes, vos urgences…'
                                  : 'Précisez votre situation, vos attentes ou vos questions…'
                              }
                              className="bg-[#0a0e14] border-white/10 mt-1 min-h-[60px] text-sm"
                              rows={2}
                            />
                          </div>
                          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#D4AF37]/90">
                              Vos coordonnées de notification
                            </p>
                            <div>
                              <Label className="text-xs text-gray-400 flex items-center gap-1.5">
                                <Mail className="h-3 w-3 text-[#D4AF37]/80" />
                                E-mail <span className="text-red-400">*</span>
                              </Label>
                              <Input
                                type="email"
                                autoComplete="email"
                                value={notificationEmail}
                                onChange={(e) => setNotificationEmail(e.target.value)}
                                placeholder="vous@exemple.com"
                                className="mt-1 border-white/10 bg-[#0a0e14] text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-400 flex items-center gap-1.5">
                                <MessageCircle className="h-3 w-3 text-emerald-400/90" />
                                WhatsApp (international) <span className="text-red-400">*</span>
                              </Label>
                              <Input
                                type="tel"
                                autoComplete="tel"
                                value={whatsappPhone}
                                onChange={(e) => setWhatsappPhone(e.target.value)}
                                placeholder="+33612345678"
                                className="mt-1 border-white/10 bg-[#0a0e14] text-sm"
                              />
                              <p className="mt-1 text-[10px] text-gray-500">
                                Indiquez le pays avec + (ex. +33 France, +241 Gabon). Utilisé pour les rappels WhatsApp.
                              </p>
                            </div>
                            <label className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/20 p-2.5">
                              <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4 accent-[#D4AF37]"
                                checked={notificationConsent}
                                data-testid="booking-notification-consent"
                                onChange={(e) => setNotificationConsent(e.target.checked)}
                              />
                              <span className="text-[11px] leading-relaxed text-gray-300">
                                J&apos;accepte de recevoir des notifications liées à ce rendez-vous (confirmation, rappels, mises à jour) par e-mail et WhatsApp.
                              </span>
                            </label>
                            <label className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/20 p-2.5">
                              <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4 accent-[#D4AF37]"
                                checked={smsOptIn}
                                data-testid="booking-sms-opt-in"
                                onChange={(e) => setSmsOptIn(e.target.checked)}
                              />
                              <span className="text-[11px] leading-relaxed text-gray-300">
                                Je souhaite aussi recevoir les rappels par SMS (optionnel).
                              </span>
                            </label>
                            <p className="text-[10px] leading-relaxed text-gray-500">
                              Vos données sont utilisées uniquement pour la gestion de votre rendez-vous.
                              {' '}
                              <Link to="/politique-confidentialite" className="text-[#D4AF37] hover:underline">
                                Voir la politique de confidentialité
                              </Link>
                              .
                            </p>
                          </div>
                          {isStudent ? (
                            <p className="text-[11px] text-gray-500">
                              Compte élève — votre RDV apparaît dans le tableau de bord ; confirmation par e-mail et WhatsApp.
                            </p>
                          ) : (
                            <p className="text-[11px] text-gray-500">
                              Compte visiteur — nous enverrons la confirmation à l’e-mail et au numéro WhatsApp indiqués.
                            </p>
                          )}
                        </motion.div>
                      )}

                      {/* ══ Étape 2 — Fuseau & Secrétariat ══ */}
                      {step === 2 && (
                        <motion.div key="step2" {...stepMotion} className="space-y-4">
                          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-center gap-3">
                            <Globe className="w-4 h-4 text-[#D4AF37] shrink-0" />
                            <div>
                              <p className="text-xs text-gray-500">Votre fuseau horaire détecté</p>
                              <p className="text-sm text-white font-medium">{requesterTimezone}</p>
                            </div>
                          </div>

                          {loadingSecretaries ? (
                            <div className="flex items-center gap-2 text-sm text-gray-500 py-6 justify-center">
                              <Loader2 className="w-5 h-5 animate-spin text-[#D4AF37]" />
                              Recherche du meilleur interlocuteur…
                            </div>
                          ) : secretaryStrategy === 'closed' ? (
                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-4 text-xs text-amber-100 space-y-2">
                              <p className="font-semibold text-amber-200">École actuellement fermée</p>
                              <p>Aucun secrétariat n&apos;est disponible en ce moment. Vous pouvez tout de même choisir un créneau — votre demande sera traitée à l&apos;ouverture.</p>
                            </div>
                          ) : secretaryStrategy === 'fallback' ? (
                            <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-xs text-violet-200">
                              Votre zone est fermée — redirection vers une autre zone disponible.
                            </div>
                          ) : null}

                          {secretaryRec && (
                            <div className="space-y-2">
                              <p className="text-xs text-gray-500">{staffLabel} recommandé</p>
                              {[secretaryRec, ...secretaryAlts].slice(0, 4).map((sec) => {
                                const active = selectedSecretary?.id === sec.id;
                                return (
                                  <button
                                    key={sec.id}
                                    type="button"
                                    onClick={() => setSelectedSecretary(sec)}
                                    className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${
                                      active
                                        ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                                        : 'border-white/10 bg-white/5 hover:border-white/20'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <UserCheck className={`w-4 h-4 ${active ? 'text-[#D4AF37]' : 'text-gray-400'}`} />
                                        <span className="text-sm font-medium text-white">{sec.name}</span>
                                        {sec.isOnline && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" title="En ligne" />}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {sec.score >= 80 && (
                                          <Badge className="text-[9px] bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30">
                                            Recommandé
                                          </Badge>
                                        )}
                                        <span className="text-[10px] text-gray-400">
                                          {sec.region === 'FRANCE' ? '🇫🇷 France'
                                            : sec.region === 'GABON' ? '🇬🇦 Gabon'
                                            : sec.region === 'AF_EU' ? '🌍 Afrique/Europe'
                                            : sec.region === 'US' ? '🌎 Amériques'
                                            : sec.region}
                                        </span>
                                      </div>
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-1 ml-6">
                                      {sec.timezone?.replace(/_/g, ' ')}
                                      {sec.queueEstimate > 0 ? ` · ${sec.queueEstimate} en file` : ''}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {!secretaryRec && !loadingSecretaries && (
                            <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-xs text-gray-400">
                              Aucun interlocuteur disponible. Continuez — votre demande sera assignée manuellement.
                            </div>
                          )}
                        </motion.div>
                      )}

                      {/* ══ Étape 3 — Calendrier ══ */}
                      {step === 3 && (
                        <motion.div key="step3" {...stepMotion} className="space-y-4">
                          {selectedSecretary && (
                            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300 flex items-center gap-2">
                              <UserCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
                              {staffLabel} : <span className="text-white font-medium">{selectedSecretary.name}</span>
                              <span className="text-gray-500">({selectedSecretary.region})</span>
                            </div>
                          )}

                          <div className={cn('flex flex-wrap gap-1.5 text-[11px]', embedded && 'gap-1')}>
                            <Badge variant="outline" className="border-white/15 text-gray-300">
                              <Globe className="w-3 h-3 mr-1" />{requesterTimezone}
                            </Badge>
                            <Badge variant="outline" className={availabilityMeta.schoolOpen ? 'border-emerald-500/30 text-emerald-200' : 'border-white/15 text-gray-400'}>
                              {staffLabel} {availabilityMeta.schoolOpen ? 'actif' : 'hors ligne'} — réservation possible
                            </Badge>
                          </div>

                          {availabilityMeta.message && (
                            <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                              {availabilityMeta.message}
                            </div>
                          )}

                          <motion.div
                            layout
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                            className={cn(
                              'rounded-2xl border border-[#D4AF37]/30 bg-white/[0.03] p-3 shadow-[0_0_40px_rgba(212,175,55,0.08)] backdrop-blur-md sm:p-4',
                              embedded && 'p-2.5 sm:p-3',
                            )}
                          >
                            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                              <Label className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
                                Choisir la date
                              </Label>
                              <p className="font-display text-sm font-medium tracking-tight text-white/90">
                                {parsedSelectedDate
                                  ? formatDateFns(parsedSelectedDate, 'EEEE d MMMM yyyy', { locale: frLocale })
                                  : '—'}
                              </p>
                            </div>

                            {useInlineCalendarPicker ? (
                              <div
                                className={cn(
                                  'flex justify-center',
                                  embedded && 'rounded-2xl border border-white/[0.07] bg-black/25 py-4',
                                )}
                              >
                                <DayPickerCalendar
                                  mode="single"
                                  selected={parsedSelectedDate}
                                  onSelect={(d) => {
                                    if (!d) return;
                                    setSelectedDate(formatDateFns(d, 'yyyy-MM-dd'));
                                  }}
                                  disabled={{ before: startOfDay(new Date()) }}
                                  defaultMonth={parsedSelectedDate || new Date()}
                                  className={cn(
                                    'rounded-xl border border-white/10 bg-black/20 p-2',
                                    embedded && 'scale-[1.01] p-2.5 sm:scale-[1.03] sm:p-3',
                                  )}
                                />
                              </div>
                            ) : (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className={cn(
                                      'w-full justify-between border-[#D4AF37]/30 bg-black/30 px-4 text-left font-display tracking-tight text-white hover:bg-white/5',
                                      embedded ? 'h-11 text-sm font-semibold' : 'h-14 text-base font-semibold',
                                    )}
                                  >
                                    <span>
                                      {parsedSelectedDate
                                        ? formatDateFns(parsedSelectedDate, 'EEEE d MMMM yyyy', { locale: frLocale })
                                        : 'Choisir une date'}
                                    </span>
                                    <CalendarGlyph className="h-5 w-5 shrink-0 text-[#D4AF37]" strokeWidth={2.25} />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                  align="start"
                                  className="w-auto border-[#D4AF37]/25 bg-[#0a0908]/98 p-2 backdrop-blur-xl"
                                >
                                  <DayPickerCalendar
                                    mode="single"
                                    selected={parsedSelectedDate}
                                    onSelect={(d) => {
                                      if (!d) return;
                                      setSelectedDate(formatDateFns(d, 'yyyy-MM-dd'));
                                    }}
                                    disabled={{ before: startOfDay(new Date()) }}
                                    defaultMonth={parsedSelectedDate || new Date()}
                                  />
                                </PopoverContent>
                              </Popover>
                            )}

                            <div className={cn('mt-3 flex justify-end', embedded && 'mt-2')}>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => loadSlots()}
                                disabled={loadingSlots}
                                className={cn(
                                  'border-white/15 bg-white/[0.04] font-display text-white hover:bg-white/10',
                                  embedded ? 'h-9 text-xs' : 'h-11 text-sm',
                                )}
                              >
                                {loadingSlots ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Actualiser les créneaux
                                  </>
                                )}
                              </Button>
                            </div>
                          </motion.div>

                          <div>
                            <Label className="font-display mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF37]/90">
                              Créneaux · 30 min
                            </Label>
                            {loadingSlots ? (
                              <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
                                <Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" />
                                Chargement…
                              </div>
                            ) : slotGrid.length > 0 ? (
                              <div
                                className={cn(
                                  'overflow-y-auto rounded-2xl border border-white/[0.08] bg-black/35 p-2.5 backdrop-blur-sm',
                                  slotGridMaxClass,
                                )}
                              >
                                <motion.div
                                  key={`${selectedDate}-${slotGrid.length}`}
                                  className="grid grid-cols-5 gap-2 sm:grid-cols-6"
                                  variants={slotStaggerContainer}
                                  initial="hidden"
                                  animate="show"
                                >
                                  {slotGrid.map((cell) => {
                                    const bookable = cell.state === 'available';
                                    const taken = cell.state === 'taken';
                                    const outside = cell.state === 'outside_hours';
                                    const past = cell.state === 'past';
                                    const active =
                                      Boolean(selectedSlot) &&
                                      sameSlot(selectedSlot.slotUtc, cell.slotUtc) &&
                                      bookable;
                                    const baseTime = compactTime(cell.slotUtc);
                                    const cellClass = `min-h-[44px] rounded-lg px-1.5 py-2 text-center text-[11px] font-semibold transition-all border sm:text-[12px] ${
                                      past
                                        ? 'cursor-not-allowed border-transparent bg-transparent text-gray-700 opacity-40 line-through'
                                        : outside
                                          ? 'cursor-not-allowed border-transparent bg-white/[0.03] text-gray-600 opacity-40'
                                          : taken
                                            ? 'cursor-not-allowed border-white/10 bg-white/[0.04] text-gray-500 opacity-60 line-through'
                                            : active
                                              ? 'border-[#D4AF37] bg-[#D4AF37]/25 text-white shadow-[0_0_16px_rgba(212,175,55,0.35)] ring-1 ring-[#D4AF37]/40'
                                              : 'cursor-pointer border-emerald-400/40 bg-emerald-500/15 text-emerald-50 ring-1 ring-emerald-500/20 hover:bg-emerald-500/25'
                                    }`;
                                    const tooltip = past
                                      ? 'Heure déjà passée'
                                      : outside
                                        ? 'Hors horaires'
                                        : taken
                                          ? 'Déjà réservé'
                                          : 'Disponible';
                                    return (
                                      <motion.button
                                        key={cell.slotUtc}
                                        type="button"
                                        variants={slotStaggerItem}
                                        whileTap={bookable ? { scale: 0.94 } : { scale: 0.98 }}
                                        className={cellClass}
                                        title={tooltip}
                                        disabled={past || outside}
                                        onClick={() => {
                                          if (bookable) {
                                            selectGridCell(cell);
                                          } else if (!past && !outside) {
                                            toast({
                                              title: 'Indisponible',
                                              description: 'Ce créneau est déjà pris.',
                                              variant: 'destructive',
                                            });
                                          }
                                        }}
                                      >
                                        {baseTime}
                                      </motion.button>
                                    );
                                  })}
                                </motion.div>
                                <p className={cn('mt-2 px-1 text-[10px] text-gray-500', embedded && 'mt-1')}>
                                  <span className="text-emerald-300/90">Vert</span> = réservable · barré = pris · <span className="text-gray-600">gris</span> = hors horaires / passé
                                </p>
                              </div>
                            ) : (
                              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-3 text-xs text-amber-100 flex gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                Aucun créneau ce jour — changez de date ou actualisez.
                              </div>
                            )}
                          </div>

                          {selectedSlot && (
                            <div className="rounded-lg border border-[#D4AF37]/20 bg-[#D4AF37]/5 px-3 py-2 text-xs text-gray-200">
                              <span className="text-[#D4AF37] font-medium">Sélection : </span>
                              {new Date(selectedSlot.slotUtc).toLocaleString('fr-FR', {
                                timeZone: requesterTimezone, dateStyle: 'medium', timeStyle: 'short',
                              })} · {selectedSlot.secretariatName}
                            </div>
                          )}
                        </motion.div>
                      )}

                      {/* ══ Étape 4 — Confirmation ══ */}
                      {step === 4 && (
                        <motion.div key="step4" {...stepMotion} className="space-y-4">
                          <p className="text-sm text-gray-300">Vérifiez les informations avant de confirmer :</p>
                          <div className="rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 divide-y divide-white/5">
                            {[
                              { label: 'Sujet', value: reason },
                              description ? { label: 'Description', value: description } : null,
                              { label: 'E-mail', value: notificationEmail.trim() || '—' },
                              { label: 'WhatsApp', value: whatsappPhone.trim() || '—' },
                              { label: 'Consentement', value: notificationConsent ? 'Oui' : 'Non' },
                              { label: 'SMS', value: smsOptIn ? 'Oui' : 'Non' },
                              selectedSecretary ? { label: staffLabel, value: selectedSecretary.name } : null,
                              selectedSlot ? {
                                label: 'Date & heure',
                                value: new Date(selectedSlot.slotUtc).toLocaleString('fr-FR', {
                                  timeZone: requesterTimezone, dateStyle: 'full', timeStyle: 'short',
                                }),
                              } : null,
                              { label: 'Fuseau', value: requesterTimezone },
                            ].filter(Boolean).map(({ label, value }) => (
                              <div key={label} className="flex px-4 py-2.5 gap-3">
                                <span className="text-xs text-gray-500 w-24 shrink-0 pt-0.5">{label}</span>
                                <span className="text-xs text-white">{value}</span>
                              </div>
                            ))}
                          </div>
                          {lastSyncAt && (
                            <p className="text-[10px] text-gray-600 text-center">
                              Créneaux synchronisés à {new Date(lastSyncAt).toLocaleTimeString('fr-FR')}
                            </p>
                          )}
                        </motion.div>
                      )}

                    </AnimatePresence>
                  </div>

                  {/* ── Footer navigation ── */}
                  <div
                    className="flex shrink-0 gap-2 border-t border-[#D4AF37]/15 bg-[#0a0908]/95 px-4 py-3 shadow-[0_-16px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:px-5 sm:py-4"
                    style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
                  >
                    {step > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 shrink-0 border-white/15 font-display text-[15px] font-semibold tracking-tight text-white hover:bg-white/5 max-lg:min-h-[3rem]"
                        onClick={() => setStep(s => s - 1)}>
                        Retour
                      </Button>
                    )}

                    {step < 4 && (
                      <Button
                        type="button"
                        className="min-h-11 flex-1 bg-[#D4AF37] font-display text-base font-semibold tracking-tight text-black hover:bg-amber-400 max-lg:min-h-[3.25rem]"
                        disabled={
                          step === 1 && (!reason.trim() || !contactEmailOk || !contactWhatsappOk || !notificationConsent)
                        }
                        onClick={() => {
                          if (step === 1) {
                            if (!reason.trim()) {
                              toast({ title: 'Sujet requis', description: "Indiquez le sujet de l'entretien.", variant: 'destructive' });
                              return;
                            }
                            if (!contactEmailOk) {
                              toast({
                                title: 'E-mail',
                                description: 'Indiquez une adresse e-mail valide.',
                                variant: 'destructive',
                              });
                              return;
                            }
                            if (!contactWhatsappOk) {
                              toast({
                                title: 'WhatsApp',
                                description: 'Numéro au format international, ex. +33612345678',
                                variant: 'destructive',
                              });
                              return;
                            }
                            if (!notificationConsent) {
                              toast({
                                title: 'Consentement',
                                description: 'Cochez le consentement pour recevoir les notifications de rendez-vous.',
                                variant: 'destructive',
                              });
                              return;
                            }
                            setStep(2);
                            loadSecretaries();
                          } else if (step === 2) {
                            setStep(3);
                            loadSlots();
                          } else if (step === 3) {
                            if (!selectedSlot) {
                              toast({ title: 'Créneau requis', description: 'Choisissez un créneau vert.', variant: 'destructive' });
                              return;
                            }
                            setStep(4);
                          }
                        }}>
                        Suivant
                      </Button>
                    )}

                    {step === 4 && (
                      <Button
                        type="button"
                        className="min-h-11 flex-1 bg-[#D4AF37] text-base font-bold text-black hover:bg-amber-400 disabled:opacity-60 max-lg:min-h-[3.25rem]"
                        disabled={booking || !selectedSlot}
                        onClick={handleSubmit}>
                        {booking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmer le rendez-vous'}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </BookingCalendarSurface>
    </>
  );
}

export default BookingCalendarModal;
