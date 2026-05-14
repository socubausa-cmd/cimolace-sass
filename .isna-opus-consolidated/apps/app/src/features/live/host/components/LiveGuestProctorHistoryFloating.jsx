import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Bouton flottant + journal des commandes caméra reçues par l'invité (visible
 * uniquement quand le consentement caméra est requis pour la session).
 */
export const LiveGuestProctorHistoryFloating = ({
  phase,
  isGuestUi,
  hasUser,
  proctoringConsentRequired,
  open,
  setOpen,
  loading,
  rows,
  onRefresh,
}) => {
  if (
    phase !== PHASE.LIVE
    || !isGuestUi
    || !hasUser
    || proctoringConsentRequired !== true
  ) {
    return null;
  }
  return (
    <div
      className="pointer-events-auto fixed z-[54]"
      style={{
        left: 'max(12px, env(safe-area-inset-left))',
        bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))',
        maxWidth: 'min(92vw, 280px)',
      }}
    >
      <button
        type="button"
        onClick={() => {
          setOpen((o) => {
            if (!o) void onRefresh();
            return !o;
          });
        }}
        className="rounded-full border border-violet-400/35 bg-[rgba(46,16,101,.45)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-100/95 shadow-lg backdrop-blur-sm transition-colors hover:bg-[rgba(46,16,101,.65)]"
        title="Commandes caméra enregistrées pour votre compte dans cette session"
      >
        {open ? 'Fermer' : 'Mes commandes caméra'}
      </button>
      {open ? (
        <div
          className="mt-2 max-h-[min(38vh,240px)] overflow-y-auto rounded-xl border border-white/12 bg-[rgba(20,19,28,.92)] p-2.5 shadow-xl backdrop-blur-md"
          style={{ boxShadow: '0 12px 40px rgba(0,0,0,.45)' }}
        >
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-white/45">
            Journal (vous uniquement)
          </p>
          {loading && rows.length === 0 ? (
            <p className="text-[10px] text-white/40">Chargement…</p>
          ) : null}
          {!loading && rows.length === 0 ? (
            <p className="text-[10px] leading-snug text-white/45">
              Aucune commande enregistrée pour l’instant. Les actions du formateur sur votre caméra
              apparaissent ici.
            </p>
          ) : null}
          <ul className="space-y-1.5">
            {rows.map((ev) => {
              const t = ev.created_at ? new Date(ev.created_at) : null;
              const rel =
                t && !Number.isNaN(t.getTime())
                  ? formatDistanceToNow(t, { addSuffix: true, locale: fr })
                  : '—';
              const label = ev.camera_enabled ? 'Caméra allumée' : 'Caméra coupée';
              const ack =
                ev.guest_ack_success === true
                  ? 'Appliqué sur cet appareil'
                  : ev.guest_ack_success === false
                    ? `Non appliqué${ev.guest_ack_error ? ` — ${String(ev.guest_ack_error).slice(0, 80)}` : ''}`
                    : 'En attente d’accusé';
              return (
                <li
                  key={ev.id}
                  className="rounded-lg border border-white/[0.07] bg-black/30 px-2 py-1.5 text-[10px] leading-snug text-white/80"
                >
                  <span className="font-semibold text-violet-200/95">{label}</span>
                  <span className="text-white/40"> · {rel}</span>
                  <div className="mt-0.5 text-[9px] text-white/45">{ack}</div>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.04] py-1 text-[9px] font-semibold text-white/50 transition-colors hover:bg-white/[0.08]"
          >
            Actualiser
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default LiveGuestProctorHistoryFloating;
