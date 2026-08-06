import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import { bookingApi } from '@/lib/api-v2';
import {
  CalendarClock, Check, X, Mail, Phone, Loader2, RefreshCw, Inbox, MessageSquareText,
  CalendarPlus, Radio, Send, ChevronRight, ArrowLeft, RotateCcw, Sparkles,
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
/** Date compacte pour les lignes de liste : « jeu. 6 août · 21:00 ». */
function fmtShort(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    const day = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ }).format(d);
    const time = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short', timeZone: TZ }).format(d);
    return `${day} · ${time}`;
  } catch { return d.toISOString(); }
}
/** ISO → valeur pour <input type="datetime-local"> (heure locale du navigateur). */
function toLocalInput(iso) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 24 * 3600 * 1000);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Le contact du demandeur (RDV public sans compte) est encodé dans les NOTES. On l'extrait. */
function parseNotes(notes) {
  const s = String(notes || '');
  const grab = (re) => { const m = s.match(re); return m ? m[1].trim() : ''; };
  return {
    service: grab(/Service\s*:\s*([\s\S]*?)(?:\s*Sujet\s*:|$)/i),
    sujet: grab(/Sujet\s*:\s*([\s\S]*?)(?:\s*Description\s*:|$)/i),
    description: grab(/Description\s*:\s*([\s\S]*?)(?:\s*E-?mail\s*:|$)/i),
    email: grab(/E-?mail\s*:\s*([^\s]+@[^\s]+)/i),
    whatsapp: grab(/WhatsApp\s*:\s*([+\d][\d\s]{5,})/i),
  };
}
function waHref(num, text) {
  const d = String(num || '').replace(/\D/g, '');
  if (d.length < 6) return null;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
function requesterLabel(info) {
  return info.email || info.whatsapp || 'Demandeur anonyme';
}

const STATUS = {
  requested: { label: 'À confirmer', dot: '#e6a23c', chip: 'border-amber-500/40 bg-amber-500/10 text-amber-300' },
  confirmed: { label: 'Confirmé', dot: '#5b9e6a', chip: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  cancelled: { label: 'Refusé', dot: '#c26565', chip: 'border-red-500/40 bg-red-500/10 text-red-300' },
};
const statusOf = (a) => STATUS[a?.status] || { label: a?.status, dot: '#888', chip: 'border-white/15 bg-white/5 text-[#f5f4ee]/60' };

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
  const [msg, setMsg] = useState('');
  const [filter, setFilter] = useState('requested'); // requested | confirmed | all
  const [busyId, setBusyId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);   // pilote le volet détail (desktop)
  const [mobileOpen, setMobileOpen] = useState(false);  // ouvre le tiroir détail (mobile)
  // Panneau « Reporter » (dépliage progressif) + formulaire manuel.
  const [reporterOpen, setReporterOpen] = useState(false);
  const [rStart, setRStart] = useState('');
  const [rReason, setRReason] = useState('');
  const [drafting, setDrafting] = useState(false); // rédaction IA du mot de report en cours

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

  const counts = useMemo(() => ({
    requested: items.filter((a) => a.status === 'requested').length,
    confirmed: items.filter((a) => a.status === 'confirmed').length,
    all: items.length,
  }), [items]);
  const shown = useMemo(
    () => (filter === 'all' ? items : items.filter((a) => a.status === filter)),
    [items, filter],
  );
  // Sélection auto du 1er élément (volet desktop) — jamais d'ouverture auto du tiroir mobile.
  useEffect(() => {
    if (!shown.length) { setSelectedId(null); return; }
    if (!shown.some((a) => a.id === selectedId)) setSelectedId(shown[0].id);
  }, [shown, selectedId]);
  const selected = useMemo(() => shown.find((a) => a.id === selectedId) || null, [shown, selectedId]);

  // Referme les panneaux de report quand on change de RDV.
  useEffect(() => { setReporterOpen(false); setErr(''); }, [selectedId]);

  const act = async (id, body) => {
    setBusyId(id); setErr('');
    try { await bookingApi.updateAppointment(id, body); setReporterOpen(false); await load(); }
    catch (e) { setErr(e?.response?.data?.error?.message || 'Action impossible.'); }
    finally { setBusyId(null); }
  };
  const confirm = (id) => act(id, { status: 'confirmed' });
  const cancel = (id) => {
    const reason = window.prompt('Motif du refus / annulation (optionnel) — il sera envoyé au demandeur :') || undefined;
    act(id, { status: 'cancelled', reason });
  };
  const openReporter = (a) => {
    setReporterOpen(true);
    setRStart(toLocalInput(a?.booking_slots?.start_at));
    setRReason('');
    setErr('');
  };
  const submitReschedule = (id) => {
    if (!rStart) { setErr('Choisissez une nouvelle date/heure.'); return; }
    let iso;
    try { iso = new Date(rStart).toISOString(); } catch { setErr('Date invalide.'); return; }
    act(id, { newStartAt: iso, reason: rReason.trim() || undefined });
  };
  const startLive = async (id) => {
    setBusyId(id); setErr('');
    try {
      const r = await bookingApi.startLive(id);
      const sid = r?.liveSessionId;
      if (sid) window.location.assign(`/live/host/${sid}`);
      else setErr('Séance live indisponible.');
    } catch (e) {
      setErr(e?.response?.data?.error?.message || 'Impossible d’ouvrir le studio.');
      setBusyId(null);
    }
  };
  // Envoie au demandeur un LIEN de re-planification (email + WhatsApp) : il choisit lui-même
  // un nouveau créneau parmi les disponibilités. C'est le flux « report par message + lien ».
  const sendLink = async (id) => {
    setBusyId(id); setErr(''); setMsg('');
    try {
      const r = await bookingApi.sendRescheduleLink(id, rReason.trim() || undefined);
      const chans = [];
      if (r?.sentEmail) chans.push('email');
      if (r?.sentWhatsApp) chans.push('WhatsApp');
      if (chans.length) setMsg(`Lien de report envoyé par ${chans.join(' + ')}. 📨`);
      else if (r?.hasEmail || r?.hasWhatsApp) setMsg('Lien généré, envoi en file (email).');
      else setMsg('Lien généré, mais aucun contact (email/WhatsApp) trouvé sur ce RDV.');
      setReporterOpen(false);
      await load();
    } catch (e) {
      setErr(e?.response?.data?.error?.message || 'Envoi du lien impossible.');
    } finally { setBusyId(null); }
  };

  // IA — rédige (ou réécrit à partir de ta note) le mot de report envoyé au demandeur.
  const draftMessage = async (id) => {
    setDrafting(true); setErr('');
    try {
      const r = await bookingApi.draftRescheduleMessage(id, rReason.trim() || undefined);
      if (r?.message) setRReason(r.message);
    } catch (e) {
      setErr(e?.response?.data?.error?.message || e?.message || 'Rédaction IA indisponible.');
    } finally { setDrafting(false); }
  };

  const openRow = (a) => { setSelectedId(a.id); setMobileOpen(true); };

  const TABS = [
    { key: 'requested', label: 'À confirmer', n: counts.requested },
    { key: 'confirmed', label: 'Confirmés', n: counts.confirmed },
    { key: 'all', label: 'Tous', n: counts.all },
  ];

  const detailProps = {
    a: selected, busyId, err, reporterOpen, rStart, rReason, drafting,
    setRStart, setRReason, confirm, cancel, startLive, sendLink, openReporter,
    submitReschedule, draftMessage, closeReporter: () => setReporterOpen(false),
  };

  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-5 md:px-7">
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col">
        {/* En-tête */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#d97757]/15 text-[#e8a184]">
              <CalendarClock className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-[#f5f4ee]">Rendez-vous</h1>
              <p className="text-[12.5px] text-[#f5f4ee]/50">Sélectionne une demande pour la traiter.</p>
            </div>
          </div>
          <button type="button" onClick={load} disabled={loading} aria-label="Rafraîchir"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-xl border border-white/10 text-[#f5f4ee]/60 transition-colors hover:text-[#f5f4ee] disabled:opacity-50"
            title="Rafraîchir">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Onglets */}
        <div className="mt-4 flex gap-1.5">
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setFilter(t.key)} aria-pressed={filter === t.key}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                filter === t.key ? 'bg-[#d97757] text-[#1c1a18]' : 'border border-white/10 text-[#f5f4ee]/65 hover:text-[#f5f4ee]'
              }`}>
              {t.label}
              <span className={`rounded-full px-1.5 text-[11px] ${filter === t.key ? 'bg-black/15' : 'bg-white/10'}`}>{t.n}</span>
            </button>
          ))}
        </div>

        {msg && <p className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-300">{msg}</p>}

        {/* Corps : liste (gauche) + détail (droite, desktop) */}
        {loading ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-[#f5f4ee]/50">
            <Loader2 className="h-5 w-5 animate-spin" /> Chargement…
          </div>
        ) : shown.length === 0 ? (
          <div className="mt-16 flex flex-col items-center gap-2 text-center text-[#f5f4ee]/45">
            <Inbox className="h-8 w-8" />
            <p className="text-[14px]">{filter === 'requested' ? 'Aucune demande en attente. 🎉' : 'Rien à afficher ici.'}</p>
          </div>
        ) : (
          <div className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(300px,360px)_1fr]">
            {/* LISTE compacte scannable */}
            <ul className="min-h-0 space-y-1.5 overflow-y-auto pb-4 pr-0.5 lg:pr-1" role="listbox" aria-label="Rendez-vous">
              {shown.map((a) => (
                <RdvRow key={a.id} a={a} selected={a.id === selectedId} onOpen={() => openRow(a)} />
              ))}
            </ul>

            {/* DÉTAIL — volet desktop (sticky) */}
            <div className="hidden min-h-0 overflow-y-auto rounded-2xl border border-white/[0.08] bg-white/[0.02] lg:block">
              {selected ? <RdvDetail {...detailProps} /> : (
                <div className="flex h-full items-center justify-center p-8 text-center text-[13px] text-[#f5f4ee]/40">
                  Sélectionne un rendez-vous à gauche.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* DÉTAIL — tiroir mobile (plein écran) */}
      {mobileOpen && selected && (
        <div className="fixed inset-0 z-40 flex flex-col bg-[#1f1d1b] lg:hidden">
          <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
            <button type="button" onClick={() => setMobileOpen(false)} aria-label="Retour"
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-xl border border-white/10 text-[#f5f4ee]/70 transition-colors hover:text-[#f5f4ee]">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="text-[14px] font-semibold text-[#f5f4ee]">Détail du rendez-vous</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <RdvDetail {...detailProps} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Ligne de liste — compacte et scannable (statut, sujet, demandeur, date, extrait). */
function RdvRow({ a, selected, onOpen }) {
  const st = statusOf(a);
  const info = parseNotes(a.notes);
  const when = fmtShort(a?.booking_slots?.start_at);
  const title = info.sujet || a?.booking_slots?.title || 'Rendez-vous';
  return (
    <li role="option" aria-selected={selected}>
      <button type="button" onClick={onOpen}
        className={`flex w-full cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
          selected
            ? 'border-[#d97757]/45 bg-[#d97757]/[0.1]'
            : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'
        }`}>
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: st.dot }} title={st.label} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-[13.5px] font-semibold text-[#f5f4ee]">{title}</span>
            {when && <span className="shrink-0 whitespace-nowrap text-[11px] text-[#e8a184]">{when}</span>}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-[#f5f4ee]/45">
            {info.service && <span className="truncate">{info.service}</span>}
            {info.service && <span className="text-[#f5f4ee]/25">·</span>}
            <span className="truncate">{requesterLabel(info)}</span>
          </span>
          {info.description && (
            <span className="mt-1 block truncate text-[12px] text-[#f5f4ee]/55">{info.description}</span>
          )}
        </span>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#f5f4ee]/30" />
      </button>
    </li>
  );
}

/** Volet détail — message complet + contact + actions hiérarchisées. */
function RdvDetail({
  a, busyId, err, reporterOpen, rStart, rReason, drafting, setRStart, setRReason,
  confirm, cancel, startLive, sendLink, openReporter, submitReschedule, draftMessage, closeReporter,
}) {
  const st = statusOf(a);
  const info = parseNotes(a.notes);
  const when = fmtWhen(a?.booking_slots?.start_at);
  const title = info.sujet || a?.booking_slots?.title || 'Rendez-vous';
  const waMsg = `Bonjour, au sujet de votre rendez-vous « ${info.sujet || 'séance'} »${when ? ` du ${when}` : ''} — `;
  const wa = waHref(info.whatsapp, waMsg);
  const isBusy = busyId === a.id;

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* En-tête détail */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {info.service && (
            <span className="mb-1.5 inline-block rounded-full border border-[#d97757]/30 bg-[#d97757]/10 px-2 py-0.5 text-[10.5px] font-semibold text-[#e8a184]">{info.service}</span>
          )}
          <h2 className="text-[17px] font-bold leading-tight text-[#f5f4ee]">{title}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[#e8a184]">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" /> {when || 'Créneau non précisé'}
          </p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${st.chip}`}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} /> {st.label}
        </span>
      </div>

      {/* Message complet (scrollable si long) */}
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#f5f4ee]/40">
          <MessageSquareText className="h-3.5 w-3.5" /> Message du demandeur
        </p>
        {info.description ? (
          <p className="max-h-[38vh] overflow-y-auto whitespace-pre-line rounded-xl bg-white/[0.03] p-3.5 text-[13.5px] leading-relaxed text-[#f5f4ee]/80">
            {info.description}
          </p>
        ) : (
          <p className="rounded-xl bg-white/[0.03] p-3.5 text-[13px] italic text-[#f5f4ee]/40">Aucun message joint.</p>
        )}
      </div>

      {/* Contact */}
      {(info.email || info.whatsapp) && (
        <div className="flex flex-wrap items-center gap-2">
          {info.email && (
            <a href={`mailto:${info.email}`}
              className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 px-3 text-[12.5px] text-[#f5f4ee]/80 transition-colors hover:border-[#d97757]/40 hover:text-[#f5f4ee]">
              <Mail className="h-3.5 w-3.5" /> {info.email}
            </a>
          )}
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 text-[12.5px] text-emerald-300 transition-colors hover:bg-emerald-500/20">
              <Phone className="h-3.5 w-3.5" /> WhatsApp
            </a>
          ) : info.whatsapp ? (
            <span className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-white/10 px-3 text-[12.5px] text-[#f5f4ee]/60">
              <Phone className="h-3.5 w-3.5" /> {info.whatsapp}
            </span>
          ) : null}
        </div>
      )}

      {err && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{err}</p>}

      {/* Actions — hiérarchisées : 1 primaire, puis Reporter / Refuser */}
      {a.status !== 'cancelled' && (
        <div className="mt-1 flex flex-col gap-2.5 border-t border-white/[0.06] pt-4">
          {a.status === 'requested' && (
            <button type="button" disabled={isBusy} onClick={() => confirm(a.id)}
              className="inline-flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#d97757] px-4 text-[14.5px] font-bold text-[#1c1a18] transition-colors hover:bg-[#e08b6d] disabled:opacity-60">
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-[18px] w-[18px]" />} Confirmer le rendez-vous
            </button>
          )}
          {a.status === 'confirmed' && (
            <button type="button" disabled={isBusy} onClick={() => startLive(a.id)}
              className="inline-flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#e2553f] px-4 text-[14.5px] font-bold text-white transition-colors hover:bg-[#ef6a52] disabled:opacity-60">
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-[18px] w-[18px]" />} Démarrer / préparer le live
            </button>
          )}

          <div className="flex gap-2">
            <button type="button" disabled={isBusy} onClick={() => (reporterOpen ? closeReporter() : openReporter(a))}
              aria-expanded={reporterOpen}
              className={`inline-flex min-h-[42px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 text-[13.5px] font-semibold transition-colors disabled:opacity-60 ${
                reporterOpen
                  ? 'border-[#d97757]/50 bg-[#d97757]/[0.12] text-[#e8a184]'
                  : 'border-white/[0.12] text-[#f5f4ee]/75 hover:border-[#d97757]/40 hover:text-[#f5f4ee]'
              }`}>
              <RotateCcw className="h-4 w-4" /> Reporter
            </button>
            <button type="button" disabled={isBusy} onClick={() => cancel(a.id)}
              className="inline-flex min-h-[42px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/[0.12] px-3 text-[13.5px] font-semibold text-[#f5f4ee]/75 transition-colors hover:border-red-500/40 hover:text-red-300 disabled:opacity-60">
              <X className="h-4 w-4" /> {a.status === 'requested' ? 'Refuser' : 'Annuler'}
            </button>
          </div>

          {/* Reporter — dépliage progressif : lien au demandeur OU date manuelle */}
          {reporterOpen && (
            <div className="space-y-3 rounded-xl border border-[#d97757]/25 bg-[#d97757]/[0.06] p-3.5">
              {/* Mot au demandeur — partagé par les 2 options, rédigeable par l'IA */}
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#f5f4ee]/45">Mot au demandeur (optionnel)</span>
                  <button type="button" disabled={drafting || isBusy} onClick={() => draftMessage(a.id)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#d97757]/45 bg-[#d97757]/10 px-2.5 py-1 text-[11.5px] font-semibold text-[#e8a184] transition-colors hover:bg-[#d97757]/20 disabled:opacity-60"
                    title="L'IA rédige le message (ou le réécrit à partir de ta note)">
                    {drafting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Rédiger avec l'IA
                  </button>
                </div>
                <textarea value={rReason} onChange={(e) => setRReason(e.target.value)} rows={3}
                  placeholder="Explication envoyée au demandeur — ou laisse l'IA la rédiger."
                  className="w-full resize-y rounded-lg border border-white/10 bg-[#262624] px-3 py-2 text-sm leading-relaxed text-[#f5f4ee] outline-none placeholder:text-[#f5f4ee]/35 focus:border-[#d97757]" />
              </div>

              {/* Option A — le demandeur choisit son créneau parmi les disponibilités */}
              <button type="button" disabled={isBusy} onClick={() => sendLink(a.id)}
                className="inline-flex min-h-[42px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#d97757]/40 bg-[#d97757]/10 px-3 text-[13px] font-semibold text-[#e8a184] transition-colors hover:bg-[#d97757]/20 disabled:opacity-60"
                title="Le demandeur choisit lui-même un nouveau créneau parmi tes disponibilités (email + WhatsApp)">
                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Envoyer un lien au demandeur
              </button>

              <div className="flex items-center gap-2 text-[11px] text-[#f5f4ee]/35">
                <span className="h-px flex-1 bg-white/10" /> ou fixe la date toi-même <span className="h-px flex-1 bg-white/10" />
              </div>

              {/* Option B — date fixée par l'hôte */}
              <div className="flex flex-col gap-2">
                <input type="datetime-local" value={rStart} onChange={(e) => setRStart(e.target.value)}
                  className="h-10 rounded-lg border border-white/10 bg-[#262624] px-3 text-sm text-[#f5f4ee] outline-none focus:border-[#d97757] [color-scheme:dark]" />
                <button type="button" disabled={isBusy} onClick={() => submitReschedule(a.id)}
                  className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#d97757] px-4 text-[13px] font-bold text-[#1c1a18] transition-colors hover:bg-[#e08b6d] disabled:opacity-60">
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />} Valider le report
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
