import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import { bookingApi } from '@/lib/api-v2';
import {
  CalendarClock, Check, X, Mail, Phone, Loader2, RefreshCw, Inbox, MessageSquareText,
} from 'lucide-react';

const TZ = 'Europe/Paris';

function fmtWhen(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short', timeZone: TZ }).format(d);
  } catch { return d.toISOString(); }
}

/** Les demandes publiques encodent le contact du demandeur dans les NOTES (texte libre). On l'extrait. */
function parseNotes(notes) {
  const s = String(notes || '');
  const grab = (re) => { const m = s.match(re); return m ? m[1].trim() : ''; };
  return {
    sujet: grab(/Sujet\s*:\s*([\s\S]*?)(?:\s*Description\s*:|$)/i),
    description: grab(/Description\s*:\s*([\s\S]*?)(?:\s*E-?mail\s*:|$)/i),
    email: grab(/E-?mail\s*:\s*([^\s]+@[^\s]+)/i),
    whatsapp: grab(/WhatsApp\s*:\s*([+\d][\d\s]{5,})/i),
  };
}
function waHref(num) {
  const d = String(num || '').replace(/\D/g, '');
  return d.length >= 6 ? `https://wa.me/${d}` : null;
}

const STATUS = {
  requested: { label: 'À confirmer', dot: '#e6a23c', chip: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
  confirmed: { label: 'Confirmé', dot: '#5b9e6a', chip: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  cancelled: { label: 'Refusé', dot: '#c26565', chip: 'border-red-500/40 bg-red-500/10 text-red-300' },
};

export default function LiriRdvAdminPage() {
  return (
    <LiriPortalShell active="rdv">
      <RdvBody />
    </LiriPortalShell>
  );
}

function RdvBody() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('requested'); // requested | confirmed | all
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const list = await bookingApi.listAppointments();
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      setErr(e?.response?.data?.error?.message || e?.message || 'Impossible de charger les rendez-vous.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const decide = async (id, status) => {
    setBusyId(id);
    setErr('');
    try {
      await bookingApi.updateAppointment(id, { status });
      await load();
    } catch (e) {
      setErr(e?.response?.data?.error?.message || 'Action impossible.');
    } finally { setBusyId(null); }
  };

  const counts = useMemo(() => ({
    requested: items.filter((a) => a.status === 'requested').length,
    confirmed: items.filter((a) => a.status === 'confirmed').length,
    all: items.length,
  }), [items]);

  const shown = useMemo(
    () => (filter === 'all' ? items : items.filter((a) => a.status === filter)),
    [items, filter],
  );

  const TABS = [
    { key: 'requested', label: 'À confirmer', n: counts.requested },
    { key: 'confirmed', label: 'Confirmés', n: counts.confirmed },
    { key: 'all', label: 'Tous', n: counts.all },
  ];

  return (
    <div className="h-full min-h-0 overflow-y-auto px-5 py-6 md:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#d97757]/15 text-[#e8a184]">
              <CalendarClock className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#f5f4ee]">Rendez-vous</h1>
              <p className="text-[12.5px] text-[#f5f4ee]/50">Demandes de séances de prière & consultations — à confirmer.</p>
            </div>
          </div>
          <button
            type="button" onClick={load} disabled={loading}
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-[#f5f4ee]/60 transition-colors hover:text-[#f5f4ee] disabled:opacity-50"
            title="Rafraîchir"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Onglets */}
        <div className="mt-5 flex gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key} type="button" onClick={() => setFilter(t.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                filter === t.key ? 'bg-[#d97757] text-[#1c1a18]' : 'border border-white/10 text-[#f5f4ee]/65 hover:text-[#f5f4ee]'
              }`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 text-[11px] ${filter === t.key ? 'bg-black/15' : 'bg-white/10'}`}>{t.n}</span>
            </button>
          ))}
        </div>

        {err && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{err}</p>}

        {loading ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-[#f5f4ee]/50">
            <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
          </div>
        ) : shown.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-2 text-center text-[#f5f4ee]/45">
            <Inbox className="h-8 w-8" />
            <p className="text-[14px]">{filter === 'requested' ? 'Aucune demande en attente. 🎉' : 'Rien à afficher ici.'}</p>
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {shown.map((a) => {
              const st = STATUS[a.status] || { label: a.status, dot: '#888', chip: 'border-white/15 bg-white/5 text-[#f5f4ee]/60' };
              const when = fmtWhen(a?.booking_slots?.start_at);
              const info = parseNotes(a.notes);
              const wa = waHref(info.whatsapp);
              const isBusy = busyId === a.id;
              return (
                <li key={a.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#f5f4ee]">{info.sujet || a?.booking_slots?.title || 'Rendez-vous'}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-[#e8a184]">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {when || 'Créneau non précisé'}
                      </p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${st.chip}`}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} /> {st.label}
                    </span>
                  </div>

                  {info.description && (
                    <p className="mt-2.5 flex gap-2 rounded-lg bg-white/[0.03] p-2.5 text-[13px] leading-snug text-[#f5f4ee]/75">
                      <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-[#f5f4ee]/40" />
                      <span>{info.description}</span>
                    </p>
                  )}

                  {/* Contact du demandeur (externe) — joignable directement */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {info.email && (
                      <a href={`mailto:${info.email}`}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/10 px-3 text-[12.5px] text-[#f5f4ee]/80 transition-colors hover:border-[#d97757]/40 hover:text-[#f5f4ee]">
                        <Mail className="h-3.5 w-3.5" /> {info.email}
                      </a>
                    )}
                    {wa ? (
                      <a href={wa} target="_blank" rel="noopener noreferrer"
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 text-[12.5px] text-emerald-300 transition-colors hover:bg-emerald-500/20">
                        <Phone className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    ) : info.whatsapp ? (
                      <span className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/10 px-3 text-[12.5px] text-[#f5f4ee]/60">
                        <Phone className="h-3.5 w-3.5" /> {info.whatsapp}
                      </span>
                    ) : null}
                  </div>

                  {/* Actions de confirmation */}
                  {a.status === 'requested' && (
                    <div className="mt-3 flex gap-2 border-t border-white/[0.06] pt-3">
                      <button
                        type="button" disabled={isBusy} onClick={() => decide(a.id, 'confirmed')}
                        className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#d97757] px-4 text-[13.5px] font-bold text-[#1c1a18] transition-colors hover:bg-[#e08b6d] disabled:opacity-60"
                      >
                        {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmer
                      </button>
                      <button
                        type="button" disabled={isBusy} onClick={() => decide(a.id, 'cancelled')}
                        className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-white/12 px-4 text-[13.5px] font-semibold text-[#f5f4ee]/70 transition-colors hover:border-red-500/40 hover:text-red-300 disabled:opacity-60"
                      >
                        <X className="h-4 w-4" /> Refuser
                      </button>
                    </div>
                  )}
                  {a.status === 'confirmed' && (
                    <div className="mt-3 border-t border-white/[0.06] pt-3">
                      <button
                        type="button" disabled={isBusy} onClick={() => decide(a.id, 'cancelled')}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2 text-[12.5px] text-[#f5f4ee]/50 transition-colors hover:text-red-300"
                      >
                        {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Annuler ce rendez-vous
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
