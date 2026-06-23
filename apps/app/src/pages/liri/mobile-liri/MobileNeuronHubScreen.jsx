import React from 'react';
import { Link } from 'react-router-dom';
import { Brain, GraduationCap, HelpCircle, ChevronRight, Swords } from 'lucide-react';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import {
  LiriMobileScreenShell,
  LiriGoldCard,
  LiriSectionLabel,
} from '@/components/liri/mobile-liri/LiriMobileScreenShell';
import { LIRI_MOBILE } from '@/lib/liriMobileRoutes';
import { getActiveTenantBranding } from '@/lib/tenant/activeBranding';

export default function MobileNeuronHubScreen() {
  return (
    <LiriMobileScreenShell contentClassName="overflow-y-auto pb-8">
      <div className="pt-2 pb-4">
        <LiriSectionLabel>
          <span className="inline-flex flex-wrap items-end gap-1">
            <LiriWordmark size="kicker" className="text-current" />
            <span>· Intelligence live</span>
          </span>
        </LiriSectionLabel>
        <h1 className="mt-1 font-serif text-xl text-[#faf3e6] tracking-tight">NeuronQ &amp; NeuroRecall</h1>
        <p className="mt-1 text-sm text-white/48">
          Questions pendant le direct, puis mémoire et révision après la session.
        </p>
      </div>

      <Link to={LIRI_MOBILE.arena} className="block mb-3">
        <LiriGoldCard className="p-4 transition-transform active:scale-[0.99]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]">
              <Swords className="h-6 w-6 text-[var(--school-accent)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white/95 flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-[color-mix(in_srgb,var(--school-accent)_90%,transparent)] shrink-0" />
                NeuronQ en direct
              </p>
              <p className="mt-1 text-xs text-white/45 leading-relaxed">
                Rejoignez une Arena ou un live : bouton « Poser une question », reformulation IA, file pour l'hôte (zone
                interactive).
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-white/25 shrink-0" />
          </div>
        </LiriGoldCard>
      </Link>

      <Link to={LIRI_MOBILE.postLive} className="block mb-3">
        <LiriGoldCard variant="subtle" className="p-4 border-cyan-500/25 transition-transform active:scale-[0.99]">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/35 bg-cyan-500/10">
              <GraduationCap className="h-6 w-6 text-cyan-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white/95 flex items-center gap-2">
                <Brain className="h-4 w-4 text-cyan-300/90 shrink-0" />
                NeuroRecall (post-live)
              </p>
              <p className="mt-1 text-xs text-white/45 leading-relaxed">
                Résumé IA, mindmap, replay, flashcards, rapports par thème — ouvrez une session terminée par son ID.
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-white/25 shrink-0" />
          </div>
        </LiriGoldCard>
      </Link>

      <p className="text-center text-[10px] text-white/25 mt-6">{`NeuronQ · NeuroRecall · ${getActiveTenantBranding().name}`}</p>
    </LiriMobileScreenShell>
  );
}
