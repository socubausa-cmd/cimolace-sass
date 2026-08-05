import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Check, MessageCircle, Trash2, UserPlus, UserCheck, Users } from 'lucide-react';
import { livesApi } from '@/lib/api-v2';
import { getLiveModeConfig } from '@/lib/liveModeConfig';

/**
 * Gestion des invitations NOMINATIVES — fonctionnalité COMMUNE du moteur LIRI Live,
 * déclinée par le mode via `liveModeConfig` (élève / proche / fidèle / intervenant…).
 * Équivalent générique du InviteProcheModal de la téléconsultation, branché sur les
 * endpoints `/lives/:id/invites` (créer / lister / admettre / révoquer). Le lien
 * nominatif `/live/:id/invite/:inviteId` réutilise l'écran de connexion commun (Phase 1).
 */

const GOLD = '#d4a36a';

function tenantSlugFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get('tenant') || '';
  } catch {
    return '';
  }
}

const STATUS_META = {
  invited: { label: 'Envoyé', cls: 'text-amber-300 bg-amber-400/10 border-amber-400/25' },
  admitted: { label: 'Admis', cls: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/25' },
  revoked: { label: 'Révoqué', cls: 'text-white/40 bg-white/5 border-white/10' },
};

const inputCls =
  'min-w-0 flex-1 rounded-lg border border-white/12 bg-black/25 px-3 py-2 text-[12.5px] text-white placeholder:text-white/35 outline-none focus:border-[#d4a36a]/60';

function IconBtn({ title, onClick, children, tone }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.04] transition-colors hover:bg-white/[0.1]"
      style={tone ? { color: tone } : undefined}
    >
      {children}
    </button>
  );
}

export default function LiveInviteManagePanel({ sessionId, sessionType, groupInviteUrl = '' }) {
  const cfg = useMemo(() => getLiveModeConfig(sessionType), [sessionType]);
  const slug = tenantSlugFromUrl();

  const [invites, setInvites] = useState([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [groupCopied, setGroupCopied] = useState(false);

  const refresh = useCallback(() => {
    if (!sessionId) return;
    livesApi
      .listInvites(sessionId)
      .then((r) => setInvites(Array.isArray(r) ? r : []))
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return undefined;
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [sessionId, refresh]);

  const linkFor = (id) =>
    `${window.location.origin}/live/${sessionId}/invite/${id}${slug ? `?tenant=${encodeURIComponent(slug)}` : ''}`;

  const copy = useCallback(async (id) => {
    try {
      await navigator.clipboard.writeText(linkFor(id));
      setCopiedId(id);
      setTimeout(() => setCopiedId(''), 2000);
    } catch {
      /* clipboard refusé */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, slug]);

  const create = async () => {
    if (busy) return;
    setBusy(true);
    setErr('');
    try {
      const inv = await livesApi.createInvite(sessionId, {
        display_name: name.trim() || undefined,
        email: email.trim() || undefined,
        relationship: relationship.trim() || undefined,
        kind: 'guest',
      });
      setName('');
      setEmail('');
      setRelationship('');
      setInvites((p) => [...p, inv]);
      // Repli : si l'email n'est pas parti, on copie le lien pour l'envoyer soi-même.
      if (inv?.email_status !== 'sent' && inv?.id) copy(inv.id);
    } catch (e) {
      setErr(
        e?.response?.data?.error?.message ||
          e?.response?.data?.message ||
          e?.message ||
          'Invitation impossible.',
      );
    } finally {
      setBusy(false);
    }
  };

  const wa = (inv) => {
    const msg =
      `Bonjour ${String(inv.display_name || '').trim()}, vous êtes invité·e à rejoindre ${cfg.vocab.session}.` +
      `\n\nCliquez pour entrer :\n${linkFor(inv.id)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };
  const copyGroup = async () => {
    if (!groupInviteUrl) return;
    try {
      await navigator.clipboard.writeText(groupInviteUrl);
      setGroupCopied(true);
      setTimeout(() => setGroupCopied(false), 2000);
    } catch {
      /* clipboard refusé */
    }
  };
  const waGroup = () => {
    if (!groupInviteUrl) return;
    const msg = `Vous êtes invité·e à rejoindre ${cfg.vocab.session}.\n\n${groupInviteUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };
  const admit = async (id) => {
    await livesApi.admitInvite(sessionId, id).catch(() => {});
    refresh();
  };
  const revoke = async (id) => {
    await livesApi.revokeInvite(sessionId, id).catch(() => {});
    refresh();
  };

  const active = invites.filter((i) => i && i.status !== 'revoked');
  const plural = `${cfg.vocab.participant}s`;

  return (
    <div className="flex flex-col gap-3">
      {/* Invitation nominative */}
      <div className="flex items-center gap-2">
        <UserPlus size={15} style={{ color: GOLD }} aria-hidden="true" />
        <span className="text-[12.5px] font-semibold text-white/85">Inviter un·e {cfg.vocab.participant.toLowerCase()}</span>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom de l'invité"
            className={inputCls}
          />
          <input
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            placeholder="Info (classe…)"
            className={inputCls}
            style={{ maxWidth: 118 }}
          />
        </div>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (facultatif)"
            className={inputCls}
          />
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-[12.5px] font-bold text-[#2a2118] transition-colors active:scale-[0.98] disabled:opacity-60"
            style={{ background: GOLD }}
          >
            Inviter
          </button>
        </div>
        {err && <p className="text-[11.5px] text-red-300">{err}</p>}
      </div>

      {/* Lien de groupe (commun) */}
      {groupInviteUrl && (
        <div className="mt-1 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2">
          <Users size={14} className="shrink-0 text-white/50" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-white/45" title={groupInviteUrl}>
            {groupInviteUrl}
          </span>
          <IconBtn title="Copier le lien de groupe" onClick={copyGroup}>
            {groupCopied ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} className="text-white/70" />}
          </IconBtn>
          <IconBtn title="Partager par WhatsApp" onClick={waGroup} tone="#4ade80">
            <MessageCircle size={13} />
          </IconBtn>
        </div>
      )}

      {/* Liste des invités */}
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[11.5px] font-medium text-white/55">
          {plural} invités
        </span>
        <span className="text-[11px] text-white/35">{active.length}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {active.length === 0 && (
          <p className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-center text-[11.5px] text-white/40">
            Aucune invitation pour l'instant.
          </p>
        )}
        {active.map((inv) => {
          const st = STATUS_META[inv.status] || STATUS_META.invited;
          const initials = String(inv.display_name || '?')
            .split(' ')
            .slice(0, 2)
            .map((w) => w[0])
            .join('')
            .toUpperCase();
          return (
            <div
              key={inv.id}
              className="flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2"
            >
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold text-[#2a2118]"
                style={{ background: GOLD }}
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] text-white/90">{inv.display_name}</div>
                {inv.relationship && (
                  <div className="truncate text-[10.5px] text-white/45">{inv.relationship}</div>
                )}
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${st.cls}`}>
                {st.label}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                {inv.status !== 'admitted' && (
                  <IconBtn title="Admettre" onClick={() => admit(inv.id)} tone="#4ade80">
                    <UserCheck size={13} />
                  </IconBtn>
                )}
                <IconBtn title="WhatsApp" onClick={() => wa(inv)} tone="#4ade80">
                  <MessageCircle size={13} />
                </IconBtn>
                <IconBtn title={copiedId === inv.id ? 'Copié' : 'Copier le lien'} onClick={() => copy(inv.id)}>
                  {copiedId === inv.id ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} className="text-white/70" />}
                </IconBtn>
                <IconBtn title="Révoquer" onClick={() => revoke(inv.id)} tone="#f87171">
                  <Trash2 size={13} />
                </IconBtn>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
