import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSearch, GraduationCap } from 'lucide-react';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import {
  LiriMobileScreenShell,
  LiriGoldCard,
  LiriSectionLabel,
} from '@/components/mobile-liri/LiriMobileScreenShell';
import { LIRI_MOBILE } from '@/lib/liriMobileRoutes';
import { parseLiveSessionIdFromInput } from '@/pages/mobile-liri/MobileArenaScreen';

export default function MobilePostLivePasteScreen() {
  const navigate = useNavigate();
  const [paste, setPaste] = useState('');
  const sessionId = useMemo(() => parseLiveSessionIdFromInput(paste), [paste]);

  const go = () => {
    if (!sessionId) return;
    navigate(LIRI_MOBILE.postLiveSession(sessionId));
  };

  return (
    <LiriMobileScreenShell contentClassName="overflow-y-auto pb-8">
      <div className="pt-2 pb-4">
        <LiriSectionLabel>
          <span className="inline-flex flex-wrap items-end gap-1">
            <LiriWordmark size="kicker" className="text-current" />
            <span>· NeuroRecall</span>
          </span>
        </LiriSectionLabel>
        <h1 className="mt-1 font-serif text-xl text-[#faf3e6] tracking-tight">Fiche post-live</h1>
        <p className="mt-1 text-sm text-white/48">
          Replay, résumé IA, NeuronQ archivées, NeuroRecall (flashcards, rapports). Collez l’ID de session ou l’URL du
          live.
        </p>
      </div>

      <LiriGoldCard className="p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/35 bg-cyan-500/10">
            <GraduationCap className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <p className="font-semibold text-white/95">Accès rapide</p>
            <p className="mt-1 text-xs text-white/45">
              Les enseignants peuvent aussi ouvrir la même fiche depuis le studio (préparation live → post-live).
            </p>
          </div>
        </div>
      </LiriGoldCard>

      <LiriGoldCard variant="subtle" className="mb-4 border-[#D4AF37]/22 p-4">
        <p className="flex items-center gap-2 text-xs font-semibold text-[#D4AF37]/90">
          <FileSearch className="h-3.5 w-3.5" />
          Ouvrir une session
        </p>
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="https://…/live/xxxxxxxx-… ou UUID"
          rows={3}
          className="mt-3 w-full resize-none rounded-xl border border-white/12 bg-black/50 px-3 py-2 text-sm text-white/90 placeholder:text-white/25 focus:border-[#D4AF37]/45 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/30"
        />
        <button
          type="button"
          disabled={!sessionId}
          onClick={go}
          className="mt-3 w-full min-h-11 rounded-2xl border border-[#D4AF37]/50 bg-[#D4AF37]/15 text-sm font-semibold text-[#f5e6c8] disabled:opacity-35 disabled:pointer-events-none"
        >
          Ouvrir la fiche
        </button>
      </LiriGoldCard>
    </LiriMobileScreenShell>
  );
}
