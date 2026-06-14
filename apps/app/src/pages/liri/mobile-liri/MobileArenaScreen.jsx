import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Swords, Radio, MessageCircle, Link2 } from 'lucide-react';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import {
  LiriMobileScreenShell,
  LiriGoldCard,
  LiriSectionLabel,
} from '@/components/liri/mobile-liri/LiriMobileScreenShell';
import { LIRI_MOBILE } from '@/lib/liriMobileRoutes';
import { activeTenantConfig as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';

/** Extrait l'UUID d'une session depuis un collage d'URL ou d'ID brut. */
export function parseLiveSessionIdFromInput(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const inText = s.match(uuid);
  if (inText) return inText[0];
  try {
    const u = new URL(s.includes('://') ? s : `https://local.invalid${s.startsWith('/') ? '' : '/'}${s}`);
    const seg = (u.pathname || '').match(/\/live\/([^/?#]+)/i);
    if (seg?.[1] && uuid.test(seg[1])) return seg[1].match(uuid)[0];
  } catch {
    const seg = s.match(/\/live\/([0-9a-f-]{36})/i);
    if (seg?.[1] && uuid.test(seg[1])) return seg[1].match(uuid)[0];
  }
  return '';
}

export default function MobileArenaScreen() {
  const navigate = useNavigate();
  const [joinPaste, setJoinPaste] = useState('');
  const sessionId = useMemo(() => parseLiveSessionIdFromInput(joinPaste), [joinPaste]);

  const handleJoinArena = () => {
    if (!sessionId) return;
    navigate(`/live/${sessionId}`);
  };

  return (
    <LiriMobileScreenShell contentClassName="overflow-y-auto pb-8">
      <div className="pt-2 pb-4">
        <LiriSectionLabel>
          <LiriWordmark size="kicker" className="text-current" />
        </LiriSectionLabel>
        <h1 className="mt-1 font-serif text-xl text-[#faf3e6] tracking-tight">Arena</h1>
        <p className="mt-1 text-sm text-white/48">
          Débats, votes et interactions — vous rejoignez une session depuis un lien ou la liste des lives.
        </p>
      </div>

      <LiriGoldCard className="p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]">
            <Swords className="h-5 w-5 text-[var(--school-accent)]" />
          </div>
          <div>
            <p className="font-semibold text-white/95">Regarder ou participer</p>
            <p className="mt-1 text-xs text-white/45">
              Les salles Arena s'ouvrent depuis une session live invitée. La navigation basse est masquée pendant
              l'immersion.
            </p>
          </div>
        </div>
      </LiriGoldCard>

      <LiriGoldCard variant="subtle" className="mb-4 border-[color-mix(in_srgb,var(--school-accent)_22%,transparent)] p-4">
        <p className="flex items-center gap-2 text-xs font-semibold text-[color-mix(in_srgb,var(--school-accent)_90%,transparent)]">
          <Link2 className="h-3.5 w-3.5" />
          Rejoindre avec un lien
        </p>
        <p className="mt-1 text-[11px] text-white/40">
          Collez l'URL du live (ex. …/live/xxxxxxxx-…) ou seulement l\'ID de session. Connectez-vous si demandé.
        </p>
        <textarea
          value={joinPaste}
          onChange={(e) => setJoinPaste(e.target.value)}
          placeholder={`${isnaTenantConfig.branding.publicSiteOrigin}/live/…`}
          rows={2}
          className="mt-3 w-full resize-none rounded-xl border border-white/12 bg-black/50 px-3 py-2 text-sm text-white/90 placeholder:text-white/25 focus:border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] focus:outline-none focus:ring-1 focus:ring-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]"
        />
        <button
          type="button"
          disabled={!sessionId}
          onClick={handleJoinArena}
          className="mt-3 flex h-11 w-full items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] bg-gradient-to-r from-[color-mix(in_srgb,var(--school-accent)_22%,transparent)] to-[#6b5a14]/18 text-sm font-semibold text-[#fff4dc] disabled:cursor-not-allowed disabled:opacity-35 active:scale-[0.99] transition-transform"
        >
          Ouvrir l'Arena
        </button>
      </LiriGoldCard>

      <Link
        to={LIRI_MOBILE.live}
        className="mb-3 flex items-center justify-center gap-2 rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] bg-gradient-to-r from-[color-mix(in_srgb,var(--school-accent)_18%,transparent)] to-[#8a7018]/14 py-3 text-sm font-semibold text-[#fff4dc] shadow-[0_0_24px_-10px_rgba(212,175,55,0.3)] active:scale-[0.99] transition-transform"
      >
        <Radio className="h-4 w-4" />
        Voir les lives
      </Link>

      <Link
        to="/messages"
        className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] py-3 text-sm text-white/80"
      >
        <MessageCircle className="h-4 w-4 text-[var(--school-accent)]" />
        Invitations via messagerie
      </Link>

      <Link to={LIRI_MOBILE.home} className="mt-8 block text-center text-xs text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)]">
        Retour accueil LIRI
      </Link>
    </LiriMobileScreenShell>
  );
}
