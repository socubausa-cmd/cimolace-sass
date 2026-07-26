/**
 * LIRI Studio Image — shell : rail designer Konva (Outils/Propriétés) · canvas · IA (suggestions, journal, LONGIA).
 * Route : /studio/liri/studio-image
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ImageIcon } from 'lucide-react';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import SmartboardKonvaEditorV1 from '@/features/smartboard-konva-editor/SmartboardKonvaEditorV1';
import LiriStudioImageIaPanel from '@/features/smartboard-konva-editor/components/LiriStudioImageIaPanel';
import LiriStudioImageToolDock from '@/features/smartboard-konva-editor/components/LiriStudioImageToolDock';

export default function StudioLiriStudioImagePage() {
  return (
    /* Fond #262624 (base LIRI) + barre haute #1f1e1c (chrome, cf. --rail) : la page vit
       DANS la coque du portail, un fond navy y dessinait une couture froide sur tout le tour. */
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#262624] text-white">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-white/[0.08] bg-[#1f1e1c] px-3">
        <Link
          to="/studio/liri"
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[12px] text-white/65 transition hover:bg-white/[0.06] hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <LiriWordmark size="compact" className="text-white/80" />
        </Link>
        <div className="flex items-center gap-2">
          {/* Pastille d'en-tête : violet → corail. Le voile #d97757 à 20 % composé sur la
              barre haute #1f1e1c donne #443028 ; l'icône en #e8a97f y tient 6,13:1 —
              largement au-dessus des 3:1 exigés d'une icône porteuse de sens. */}
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#d97757]/20 text-[#e8a97f]">
            <ImageIcon className="h-4 w-4" />
          </span>
          <div>
            <h1 className="flex items-end gap-1.5 text-[13px] font-semibold tracking-tight">
              <LiriWordmark size="compact" className="text-white/95" />
              <span>Studio Image</span>
            </h1>
            <p className="hidden text-[10px] text-white/35 sm:block">
              Canvas + contexte — zoom dans le plan de travail (Cmd ±)
            </p>
          </div>
        </div>
      </header>

      <LiriStudioImageToolDock />

      <div className="flex min-h-0 flex-1">
        <div className="relative min-h-0 min-w-0 flex-1">
          <SmartboardKonvaEditorV1
            hideChrome
            embedDesignerLeftRail
            enableWorkbenchDigitShortcuts
            longiaThreadScopeId="liri-studio-image"
            className="absolute inset-0"
          />
        </div>
        <LiriStudioImageIaPanel />
      </div>
    </div>
  );
}
