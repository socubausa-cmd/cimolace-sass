/**
 * Studio — Agent pédagogique LIRI (génération 10 étapes via IA).
 * Route : /studio/liri-agent
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import LIRIAgent from '@/components/liri/LIRIAgent';

export default function StudioLiriAgentPage() {
  return (
    <div className="min-h-[100dvh] bg-[#0a0c10] text-white">
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-[#0a0c10]/95 px-4 py-3 backdrop-blur-md">
        <Link
          to="/studio"
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:border-[#D4AF37]/40 hover:text-[#D4AF37]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour au studio
        </Link>
        <span className="inline-flex items-end gap-1.5 text-[10px] uppercase tracking-[0.2em] text-white/40">
          <LiriWordmark size="kicker" className="text-white/40" subtleGlow />
          <span>Agent</span>
        </span>
      </div>
      <div className="mx-auto max-w-5xl px-2 pb-10 pt-4">
        <div className="overflow-hidden rounded-xl border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
          <LIRIAgent />
        </div>
      </div>
    </div>
  );
}
