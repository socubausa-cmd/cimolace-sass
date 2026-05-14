/**
 * Classes Tailwind alignées sur le shell Smartboard Designer
 * (StudioSmartboardKonvaPage — #0F1117, rails #12111a, panneaux #14131c, grille canvas).
 * Réutilisable par les tiroirs live (messagerie, paramètres studio).
 */

export const designerShellBackdrop =
  'fixed inset-0 z-[190] bg-[#080910]/86 backdrop-blur-[22px]';

/**
 * Voile très léger — plateau bien visible ; à peine assombri / flouté pour marquer le tiroir messagerie (live salle).
 */
export const designerShellBackdropLiveStage =
  'fixed inset-0 z-[190] cursor-pointer bg-[#080910]/14 backdrop-blur-[4px]';

/** Tiroir droit — bord gauche net, fond shell principal */
export function designerShellDrawerClass(widthClass = 'w-[min(100vw,460px)]') {
  return [
    'fixed right-0 top-0 bottom-0 z-[200] flex flex-col',
    widthClass,
    'border-l border-white/[0.08]',
    'bg-[#0F1117]',
    'shadow-[-28px_0_80px_-16px_rgba(0,0,0,0.72)]',
    'ring-1 ring-inset ring-white/[0.03]',
  ].join(' ');
}

export const designerShellHeader =
  'flex shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#12111a] px-5 py-3.5';

export const designerShellSidebar =
  'shrink-0 overflow-y-auto border-r border-white/[0.08] bg-[#12111a]/70 px-2 py-3 [scrollbar-width:thin] [scrollbar-color:rgba(245,158,11,0.15)_transparent]';

export const designerShellMainScroll =
  'min-h-0 flex-1 overflow-y-auto px-4 py-3 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.12)_transparent] bg-[#0a0b0f] bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:44px_44px]';

export const designerShellComposer =
  'shrink-0 border-t border-white/[0.08] bg-[#12111a]/95 px-4 py-3 backdrop-blur-sm';

/** Composer unique type ChatGPT — un seul bloc arrondi ; textarea / input sans bordure à l’intérieur */
export const designerShellComposerUnified =
  'flex w-full max-w-full items-end gap-0.5 rounded-[1.25rem] border border-white/[0.11] bg-[#12111a] px-1 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-[border-color,box-shadow]';

/** Icônes (galerie, caméra, plus) incrustées à gauche du champ */
export const designerShellComposerUnifiedIconBtn =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/[0.07] hover:text-white/92 disabled:opacity-35';

/** Zone de saisie multiligne dans le composer unifié */
export const designerShellComposerUnifiedTextarea =
  'min-h-[44px] max-h-[min(200px,40vh)] min-w-0 flex-1 resize-none border-0 bg-transparent px-1.5 py-2 text-[12px] leading-snug text-white/95 outline-none placeholder:text-white/38';

/** Champ une ligne (messagerie) dans le composer unifié */
export const designerShellComposerUnifiedInput =
  'min-h-[44px] min-w-0 flex-1 border-0 bg-transparent px-1.5 py-2.5 text-[12px] text-white/95 outline-none placeholder:text-white/38';

/** Envoi rond — hub LONGIA */
export const designerShellComposerUnifiedSendViolet =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-500/35 bg-[#7c3aed] text-white shadow-[0_2px_12px_rgba(124,58,237,0.45)] transition hover:bg-[#6d28d9] disabled:cursor-not-allowed disabled:opacity-38 disabled:shadow-none';

/** Envoi rond — tiroir messagerie (accent ambre) */
export const designerShellComposerUnifiedSendAmber =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-50 shadow-[0_2px_12px_rgba(245,158,11,0.2)] transition hover:bg-amber-500/24 disabled:cursor-not-allowed disabled:opacity-38 disabled:shadow-none';

export const designerShellCloseBtn =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/50 transition-all hover:border-white/14 hover:bg-white/[0.08] hover:text-white';

export const designerShellInput =
  'min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0a0b0f] px-3 py-2.5 text-[12px] text-white/95 outline-none placeholder:text-white/35 focus:border-cyan-500/35 focus:ring-1 focus:ring-cyan-500/15';

export const designerShellBtnGold =
  'shrink-0 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-2.5 text-[12px] font-semibold text-amber-100/95 transition-colors hover:bg-amber-500/16 disabled:cursor-not-allowed disabled:opacity-40';

export const designerShellMessageBubble = (mine) =>
  [
    'mb-2 rounded-2xl border px-3 py-2.5',
    mine
      ? 'border-amber-500/20 bg-amber-500/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
      : 'border-white/[0.08] bg-[#14131c]/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
  ].join(' ');

export const designerShellMemberRowActive =
  'mb-1 flex w-full items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2 py-2 text-left text-[11px] font-medium text-white';

export const designerShellMemberRowIdle =
  'mb-1 flex w-full items-center gap-2 rounded-xl border border-transparent px-2 py-2 text-left text-[11px] text-white/80 transition-colors hover:border-white/[0.06] hover:bg-white/[0.04]';

export const designerShellIconBadge =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/[0.08] text-cyan-300 shadow-[0_0_20px_-8px_rgba(34,211,238,0.35)]';

/** Panneau incrusté (colonne live — Control Mesh, etc.) */
export const designerShellEmbedPanel =
  'flex flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-[#14131c]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-inset ring-white/[0.02]';

/** Bloc interne type « carte » sur fond canvas */
export const designerShellCardInset =
  'rounded-xl border border-white/[0.08] bg-[#0a0b0f]/95 p-2.5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.1)_transparent]';

export const designerShellMicroLabel =
  'text-[9px] font-semibold uppercase tracking-[0.08em] text-white/42';

export const designerShellChipAmber =
  'rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[8px] font-semibold text-amber-100/90 transition-colors hover:bg-amber-500/16';

export const designerShellChipViolet =
  'rounded-lg border border-violet-400/25 bg-violet-500/10 px-2 py-1 text-[8px] font-semibold text-violet-200/90 transition-colors hover:bg-violet-500/16';

export const designerShellChipGhost =
  'rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[8px] font-medium text-white/50 transition-colors hover:border-white/14 hover:bg-white/[0.07]';

export const designerShellChipEmerald =
  'rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2 py-1 text-[8px] font-semibold text-emerald-200/90 transition-colors hover:bg-emerald-500/16';

export const designerShellChipRose =
  'rounded-lg border border-rose-500/35 bg-rose-500/10 px-2 py-1 text-[8px] font-semibold text-rose-200/90 transition-colors hover:bg-rose-500/16';

/** Rail segmenté 2 options (ex. deux caméras / deux micros) */
export const designerShellSegmentedRail =
  'flex gap-1 rounded-xl border border-white/[0.09] bg-[#0a0b0f] p-1';

export function designerShellSegmentedSlot(active) {
  return [
    'flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-center transition-all',
    active
      ? 'border border-amber-500/40 bg-amber-500/[0.14] text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
      : 'border border-transparent text-white/55 hover:bg-white/[0.05] hover:text-white/85',
  ].join(' ');
}

/** Liste de sources périphériques (caméra / micro studio) */
export function designerShellDeviceRow(active) {
  return [
    'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all',
    active
      ? 'border-amber-500/35 bg-amber-500/[0.1] text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
      : 'border-white/[0.08] bg-[#0a0b0f]/80 text-white/65 hover:border-white/14 hover:bg-white/[0.04] hover:text-white/88',
  ].join(' ');
}
