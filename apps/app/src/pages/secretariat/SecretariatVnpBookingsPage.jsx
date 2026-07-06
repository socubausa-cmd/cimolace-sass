/**
 * SecretariatVnpBookingsPage — Demandes publiques prises via le VNP (VibeNavigation Protocol).
 *
 * Le site public (prorascience.org, moteur Cimolace OS) laisse un VISITEUR ANONYME :
 *   • réserver un RDV        → `vnp_booking_requests` (service/nom/email/créneau souhaité/message)
 *   • laisser un message     → `contact_requests`     (formulaire de contact)
 * Ces deux tables n'ont pas d'UI côté back-office : cette page les liste, filtre par statut,
 * et permet au secrétariat de faire AVANCER le statut (Confirmer / Annuler / Terminé, etc.).
 *
 * Lecture   : client Supabase (RLS scope déjà au(x) tenant(s) du membre).
 * Écriture  : RPC SECURITY DEFINER `vnp_set_booking_request_status` / `vnp_set_contact_request_status`
 *             (gatées sur l'appartenance active au tenant — cf. migration 20260706160000).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarClock, RefreshCw, Loader2, Inbox, Check, X, Flag,
  Mail, Clock, User as UserIcon, MessageSquare, Archive, Reply, Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';

/* ── Statuts RDV ──────────────────────────────────────────────── */
const BOOKING_STATUS = {
  requested: { label: 'À traiter', dot: 'bg-amber-500',   chip: 'border-amber-200 bg-amber-50 text-amber-700' },
  confirmed: { label: 'Confirmé',  dot: 'bg-emerald-500', chip: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  completed: { label: 'Terminé',   dot: 'bg-zinc-400',    chip: 'border-[var(--lt-border)] bg-[var(--lt-inner-bg)] text-[var(--lt-sub)]' },
  cancelled: { label: 'Annulé',    dot: 'bg-red-500',     chip: 'border-red-200 bg-red-50 text-red-700' },
};
const BOOKING_FILTERS = [
  { value: 'all',       label: 'Toutes' },
  { value: 'requested', label: 'À traiter' },
  { value: 'confirmed', label: 'Confirmées' },
  { value: 'completed', label: 'Terminées' },
  { value: 'cancelled', label: 'Annulées' },
];

/* ── Statuts messages de contact ──────────────────────────────── */
const CONTACT_STATUS = {
  new:      { label: 'Nouveau',  dot: 'bg-amber-500',   chip: 'border-amber-200 bg-amber-50 text-amber-700' },
  read:     { label: 'Lu',       dot: 'bg-blue-500',    chip: 'border-blue-200 bg-blue-50 text-blue-700' },
  replied:  { label: 'Répondu',  dot: 'bg-emerald-500', chip: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  archived: { label: 'Archivé',  dot: 'bg-zinc-400',    chip: 'border-[var(--lt-border)] bg-[var(--lt-inner-bg)] text-[var(--lt-sub)]' },
};
const CONTACT_FILTERS = [
  { value: 'all',      label: 'Tous' },
  { value: 'new',      label: 'Nouveaux' },
  { value: 'read',     label: 'Lus' },
  { value: 'replied',  label: 'Répondus' },
  { value: 'archived', label: 'Archivés' },
];

function fmtDate(v, pattern = 'dd MMM yyyy · HH:mm') {
  if (!v) return '—';
  try { return format(new Date(v), pattern, { locale: fr }); } catch { return '—'; }
}

/* ── Puce statut ──────────────────────────────────────────────── */
function StatusChip({ conf }) {
  if (!conf) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] rounded-full px-2 py-0.5 border font-medium ${conf.chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
      {conf.label}
    </span>
  );
}

/* ── Filtres (chips) ──────────────────────────────────────────── */
function FilterBar({ options, value, onChange, counts }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`text-xs rounded-lg border px-3 py-1.5 font-medium transition-all ${
            value === opt.value
              ? 'bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)] border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] text-[var(--lt-gold-ink)]'
              : 'bg-[var(--lt-card-bg)] border-[var(--lt-border)] text-[var(--lt-sub)] hover:border-black/25 hover:text-[var(--lt-text)]'
          }`}
        >
          {opt.label}
          {counts && counts[opt.value] != null && counts[opt.value] > 0 && (
            <span className="ml-1.5 text-[10px] opacity-70">{counts[opt.value]}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ── Bouton d'action inline ───────────────────────────────────── */
function ActionButton({ icon: Icon, label, onClick, busy, tone = 'neutral' }) {
  const tones = {
    confirm: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    danger:  'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
    neutral: 'border-[var(--lt-border)] bg-[var(--lt-card-bg)] text-[var(--lt-sub)] hover:text-[var(--lt-text)] hover:border-black/25',
  };
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 text-xs rounded-lg border px-2.5 py-1.5 font-medium transition-all disabled:opacity-50 ${tones[tone] || tones.neutral}`}
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}

/* ── Carte RDV ────────────────────────────────────────────────── */
function BookingCard({ row, onStatus, busyId }) {
  const conf = BOOKING_STATUS[row.status] || BOOKING_STATUS.requested;
  const busy = busyId === row.id;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-card-bg)] p-4 shadow-[var(--lt-card-shadow)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--lt-text)] truncate">{row.service || 'Consultation'}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-[var(--lt-muted)]">
            <span className="inline-flex items-center gap-1"><UserIcon className="w-3.5 h-3.5" />{row.name || 'Anonyme'}</span>
            <a href={`mailto:${row.email}`} className="inline-flex items-center gap-1 hover:text-[var(--lt-text)] hover:underline">
              <Mail className="w-3.5 h-3.5" />{row.email}
            </a>
          </div>
        </div>
        <StatusChip conf={conf} />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--lt-sub)]">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="w-3.5 h-3.5 text-[var(--lt-gold-ink)]" />
          Créneau souhaité : <strong className="text-[var(--lt-text)] font-medium">{fmtDate(row.preferred_at)}</strong>
        </span>
        <span className="inline-flex items-center gap-1 text-[var(--lt-muted)]">
          <Clock className="w-3 h-3" />reçue {fmtDate(row.created_at, 'dd MMM · HH:mm')}
        </span>
      </div>

      {row.message ? (
        <p className="mt-2.5 text-sm text-[var(--lt-sub)] bg-[var(--lt-inner-bg)] border border-[var(--lt-border)] rounded-lg px-3 py-2 whitespace-pre-wrap break-words">
          {row.message}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {row.status !== 'confirmed' && row.status !== 'completed' && (
          <ActionButton icon={Check} label="Confirmer" tone="confirm" busy={busy} onClick={() => onStatus(row, 'confirmed')} />
        )}
        {row.status === 'confirmed' && (
          <ActionButton icon={Flag} label="Terminé" busy={busy} onClick={() => onStatus(row, 'completed')} />
        )}
        {row.status !== 'cancelled' && (
          <ActionButton icon={X} label="Annuler" tone="danger" busy={busy} onClick={() => onStatus(row, 'cancelled')} />
        )}
        {(row.status === 'cancelled' || row.status === 'completed') && (
          <ActionButton icon={RefreshCw} label="Rouvrir" busy={busy} onClick={() => onStatus(row, 'requested')} />
        )}
      </div>
    </motion.div>
  );
}

/* ── Carte message de contact ─────────────────────────────────── */
function ContactCard({ row, onStatus, busyId }) {
  const conf = CONTACT_STATUS[row.status] || CONTACT_STATUS.new;
  const busy = busyId === row.id;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-card-bg)] p-4 shadow-[var(--lt-card-shadow)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--lt-text)] truncate">{row.subject || 'Message de contact'}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-[var(--lt-muted)]">
            <span className="inline-flex items-center gap-1"><UserIcon className="w-3.5 h-3.5" />{row.name || 'Anonyme'}</span>
            <a href={`mailto:${row.email}`} className="inline-flex items-center gap-1 hover:text-[var(--lt-text)] hover:underline">
              <Mail className="w-3.5 h-3.5" />{row.email || '—'}
            </a>
            <span className="inline-flex items-center gap-1 text-[var(--lt-muted)]"><Clock className="w-3 h-3" />{fmtDate(row.created_at, 'dd MMM · HH:mm')}</span>
          </div>
        </div>
        <StatusChip conf={conf} />
      </div>

      <p className="mt-2.5 text-sm text-[var(--lt-sub)] bg-[var(--lt-inner-bg)] border border-[var(--lt-border)] rounded-lg px-3 py-2 whitespace-pre-wrap break-words">
        {row.message}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {row.email ? (
          <a
            href={`mailto:${row.email}?subject=${encodeURIComponent('Re: ' + (row.subject || 'Votre message'))}`}
            onClick={() => { if (row.status === 'new') onStatus(row, 'replied'); }}
            className="inline-flex items-center gap-1.5 text-xs rounded-lg border px-2.5 py-1.5 font-medium transition-all border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          >
            <Reply className="w-3.5 h-3.5" />Répondre
          </a>
        ) : null}
        {row.status === 'new' && (
          <ActionButton icon={Eye} label="Marquer lu" busy={busy} onClick={() => onStatus(row, 'read')} />
        )}
        {row.status !== 'replied' && (
          <ActionButton icon={Check} label="Répondu" tone="confirm" busy={busy} onClick={() => onStatus(row, 'replied')} />
        )}
        {row.status !== 'archived' && (
          <ActionButton icon={Archive} label="Archiver" busy={busy} onClick={() => onStatus(row, 'archived')} />
        )}
      </div>
    </motion.div>
  );
}

/* ── Page ─────────────────────────────────────────────────────── */
export default function SecretariatVnpBookingsPage() {
  const [tab, setTab] = useState('bookings'); // 'bookings' | 'contacts'
  const [bookings, setBookings] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [bookingFilter, setBookingFilter] = useState('all');
  const [contactFilter, setContactFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [b, c] = await Promise.all([
        supabase.from('vnp_booking_requests').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('contact_requests').select('*').order('created_at', { ascending: false }).limit(300),
      ]);
      if (b.error) throw b.error;
      setBookings(b.data || []);
      // contact_requests peut échouer (rôle non-staff) sans casser la page RDV.
      setContacts(c.error ? [] : (c.data || []));
    } catch (e) {
      setError(e?.message || 'Impossible de charger les demandes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('sec-vnp-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vnp_booking_requests' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_requests' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load]);

  const setBookingStatus = useCallback(async (row, status) => {
    setBusyId(row.id);
    setNotice('');
    const prev = row.status;
    setBookings((list) => list.map((r) => (r.id === row.id ? { ...r, status } : r))); // optimiste
    const { data, error: rpcErr } = await supabase.rpc('vnp_set_booking_request_status', { p_id: row.id, p_status: status });
    const updated = Array.isArray(data) ? data[0] : data;
    if (rpcErr) {
      setBookings((list) => list.map((r) => (r.id === row.id ? { ...r, status: prev } : r))); // rollback
      setNotice(`Échec : ${rpcErr.message}`);
    } else if (updated?.id) {
      setBookings((list) => list.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
      setNotice(`RDV « ${updated.service} » → ${BOOKING_STATUS[updated.status]?.label || updated.status}.`);
    }
    setBusyId(null);
  }, []);

  const setContactStatus = useCallback(async (row, status) => {
    setBusyId(row.id);
    setNotice('');
    const prev = row.status;
    setContacts((list) => list.map((r) => (r.id === row.id ? { ...r, status } : r)));
    const { data, error: rpcErr } = await supabase.rpc('vnp_set_contact_request_status', { p_id: row.id, p_status: status });
    const updated = Array.isArray(data) ? data[0] : data;
    if (rpcErr) {
      setContacts((list) => list.map((r) => (r.id === row.id ? { ...r, status: prev } : r)));
      setNotice(`Échec : ${rpcErr.message}`);
    } else if (updated?.id) {
      setContacts((list) => list.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
      setNotice(`Message → ${CONTACT_STATUS[updated.status]?.label || updated.status}.`);
    }
    setBusyId(null);
  }, []);

  const bookingCounts = useMemo(() => {
    const c = { all: bookings.length };
    for (const r of bookings) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [bookings]);
  const contactCounts = useMemo(() => {
    const c = { all: contacts.length };
    for (const r of contacts) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [contacts]);

  const filteredBookings = useMemo(
    () => (bookingFilter === 'all' ? bookings : bookings.filter((r) => r.status === bookingFilter)),
    [bookings, bookingFilter],
  );
  const filteredContacts = useMemo(
    () => (contactFilter === 'all' ? contacts : contacts.filter((r) => r.status === contactFilter)),
    [contacts, contactFilter],
  );

  const pendingBookings = bookingCounts.requested || 0;
  const pendingContacts = contactCounts.new || 0;

  const TabButton = ({ id, label, badge }) => (
    <button
      onClick={() => setTab(id)}
      className={`inline-flex items-center gap-2 text-sm rounded-xl border px-3.5 py-2 font-medium transition-all ${
        tab === id
          ? 'bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] text-[var(--lt-gold-ink)]'
          : 'bg-[var(--lt-card-bg)] border-[var(--lt-border)] text-[var(--lt-sub)] hover:text-[var(--lt-text)] hover:border-black/25'
      }`}
    >
      {label}
      {badge > 0 && (
        <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-amber-500 text-white">{badge}</span>
      )}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--lt-text)] flex items-center gap-2">
            <Inbox className="w-5 h-5 text-[var(--lt-gold-ink)]" />
            Demandes du site (VNP)
          </h2>
          <p className="text-xs text-[var(--lt-muted)] mt-0.5">
            {pendingBookings} RDV à traiter · {pendingContacts} message{pendingContacts > 1 ? 's' : ''} nouveau{pendingContacts > 1 ? 'x' : ''}
          </p>
        </div>
        <Button onClick={load} variant="outline" size="sm" disabled={loading}
          className="border-[var(--lt-border)] bg-[var(--lt-card-bg)] text-[var(--lt-text)] hover:opacity-80">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Onglets RDV / Messages */}
      <div className="flex flex-wrap gap-2">
        <TabButton id="bookings" label="Rendez-vous" badge={pendingBookings} />
        <TabButton id="contacts" label="Messages de contact" badge={pendingContacts} />
      </div>

      {notice ? (
        <div className="rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] px-3 py-2 text-sm text-[var(--lt-gold-ink)]">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      {/* Filtres */}
      {tab === 'bookings' ? (
        <FilterBar options={BOOKING_FILTERS} value={bookingFilter} onChange={setBookingFilter} counts={bookingCounts} />
      ) : (
        <FilterBar options={CONTACT_FILTERS} value={contactFilter} onChange={setContactFilter} counts={contactCounts} />
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-[var(--lt-muted)]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…
        </div>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence mode="popLayout">
            {tab === 'bookings' ? (
              filteredBookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-[var(--lt-muted)] gap-3">
                  <CalendarClock className="w-10 h-10 opacity-40" />
                  <p className="text-sm">Aucune demande de rendez-vous</p>
                </div>
              ) : (
                filteredBookings.map((row) => (
                  <BookingCard key={row.id} row={row} onStatus={setBookingStatus} busyId={busyId} />
                ))
              )
            ) : filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-[var(--lt-muted)] gap-3">
                <MessageSquare className="w-10 h-10 opacity-40" />
                <p className="text-sm">Aucun message de contact</p>
              </div>
            ) : (
              filteredContacts.map((row) => (
                <ContactCard key={row.id} row={row} onStatus={setContactStatus} busyId={busyId} />
              ))
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
