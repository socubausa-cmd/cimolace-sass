/**
 * Zone 3 — « Zone interactive » : présence, **4 places intervenants** (salle privilégiée),
 * mains levées, Q&A hôte, script. Ce n'est pas un doublon du hub Signaux : les tuiles
 * **Mains levées** / **Zone 3** dans LONGIA sont des raccourcis vers le même état temps réel ;
 * ce panneau concentre l'UI complète (grille 2×2, invitation par place, onglets).
 */
import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Users, Crown, Hand, X, UserPlus, HelpCircle, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  designerShellEmbedPanel,
  designerShellCloseBtn,
  designerShellSegmentedRail,
  designerShellSegmentedSlot,
  designerShellMicroLabel,
  designerShellBtnGold,
} from '@/lib/liriDesignerShellClasses';
import { NeuronQHostTab } from './NeuronQPanel';
import MasterScriptPanel from './MasterScriptPanel';

// ── Tab: Membres connectés ────────────────────────────────────────────────────
function MembresTab({ members, privilegedSeats, onGrantSeat, isHost, currentUserId }) {
  const VISIBLE = 8;
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? members : members.slice(0, VISIBLE);

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-500 gap-2">
        <Users className="w-6 h-6 opacity-30" />
        <p className="text-xs">Aucun membre connecté</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {visible.map((m) => {
        const initials = (m.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
        const isPrivileged = privilegedSeats.some((s) => s.userId === m.userId);
        const isSelf = m.userId === String(currentUserId || '');

        return (
          <div
            key={m.userId}
            className={cn(
              'flex items-center gap-2.5 px-2 py-1.5 rounded-xl transition-colors',
              isPrivileged
                ? 'bg-[color-mix(in_srgb,var(--school-accent)_8%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_18%,transparent)]'
                : 'hover:bg-white/[0.04] border border-transparent'
            )}
          >
            {/* Avatar with online dot */}
            <div className="relative flex-shrink-0">
              {m.avatar_url ? (
                <img src={m.avatar_url} alt={m.name} className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[color-mix(in_srgb,var(--school-accent)_28%,transparent)] to-[#1a2540] flex items-center justify-center text-[10px] font-bold text-[var(--school-accent)]">
                  {initials}
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-[1.5px] border-[#0c1425]" />
            </div>

            {/* Name + role */}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-white/88 truncate flex items-center gap-1">
                {m.name}
                {isSelf && <span className="text-[9px] text-gray-500 font-normal">(vous)</span>}
              </p>
              <p className="text-[9px] text-gray-500 capitalize truncate">{m.role || 'membre'}</p>
            </div>

            {isPrivileged && <Crown className="w-3 h-3 text-[var(--school-accent)] flex-shrink-0" />}

            {/* Host can invite non-privileged members */}
            {isHost && !isSelf && !isPrivileged && (
              <button
                type="button"
                onClick={() => {
                  const nextPos = [1, 2, 3, 4].find((p) => !privilegedSeats.some((s) => s.position === p)) || 1;
                  onGrantSeat?.(m, nextPos);
                }}
                className="flex-shrink-0 h-6 w-6 rounded-lg bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_22%,transparent)] text-[var(--school-accent)] flex items-center justify-center hover:bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] transition-colors"
                title="Inviter en salle privilégiée"
              >
                <UserPlus className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}

      {members.length > VISIBLE && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full h-8 rounded-xl bg-white/[0.04] border border-white/10 text-[11px] text-gray-400 hover:text-white hover:bg-white/[0.07] transition-colors mt-1"
        >
          {showAll ? 'Réduire' : `+ ${members.length - VISIBLE} autres membres`}
        </button>
      )}
    </div>
  );
}

// ── Tab: Salle privilégiée (4 sièges 2×2) ────────────────────────────────────
function SallePrivilegieeTab({ seats, members, onGrantSeat, onRevokeSeat, isHost }) {
  const [pickingForPos, setPickingForPos] = useState(null);
  const inviteCandidates = members.filter((m) => !seats.some((s) => s.userId === m.userId));

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <p className={designerShellMicroLabel}>4 places intervenants</p>

      {/* 2 × 2 grid */}
      <div className="grid shrink-0 grid-cols-2 gap-2">
        {[1, 2, 3, 4].map((pos) => {
          const seat = seats.find((s) => s.position === pos);
          const initials = seat ? (seat.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : null;

          return (
            <div
              key={pos}
              className={cn(
                'relative rounded-2xl p-2.5 flex flex-col items-center gap-1 min-h-[86px] transition-all border cursor-pointer',
                seat
                  ? 'bg-[color-mix(in_srgb,var(--school-accent)_7%,transparent)] border-[color-mix(in_srgb,var(--school-accent)_22%,transparent)]'
                  : isHost
                    ? 'bg-white/[0.025] border-white/10 border-dashed hover:bg-white/[0.05] hover:border-white/20'
                    : 'bg-white/[0.025] border-white/10 border-dashed cursor-default'
              )}
              onClick={() => { if (!seat && isHost) setPickingForPos(pos); }}
            >
              {/* Position badge */}
              <span className="absolute top-1.5 left-1.5 text-[7px] font-bold text-white/25 bg-black/20 rounded px-1 leading-4">
                #{pos}
              </span>

              {seat ? (
                <>
                  {seat.avatar_url ? (
                    <img src={seat.avatar_url} alt={seat.name} className="w-9 h-9 rounded-full object-cover ring-1 ring-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] mt-1" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[color-mix(in_srgb,var(--school-accent)_28%,transparent)] to-[#1a2540] flex items-center justify-center text-xs font-bold text-[var(--school-accent)] ring-1 ring-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] mt-1">
                      {initials}
                    </div>
                  )}
                  <p className="text-[9px] text-white/80 truncate w-full text-center font-medium">
                    {(seat.name || 'Membre').split(' ')[0]}
                  </p>
                  <span className="flex items-center gap-0.5 text-[7px] text-[color-mix(in_srgb,var(--school-accent)_60%,transparent)]">
                    <Crown className="w-2 h-2" /> Intervenant
                  </span>
                  {isHost && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onRevokeSeat?.(seat.userId); }}
                      className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-red-500/12 border border-red-400/22 text-red-400 flex items-center justify-center hover:bg-red-500/22 transition-colors"
                      title="Retirer"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className="w-9 h-9 rounded-full border border-dashed border-white/12 flex items-center justify-center mt-1">
                    {isHost
                      ? <UserPlus className="w-4 h-4 text-white/18" />
                      : <span className="text-white/12 text-base font-light">+</span>}
                  </div>
                  <p className="text-[8px] text-white/22 text-center">
                    {isHost ? 'Cliquer pour inviter' : 'Place libre'}
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Choix du membre : dans le flux (plus de position absolute — emboîté dans l'onglet Salle) */}
      <AnimatePresence initial={false}>
        {pickingForPos !== null && (
          <motion.div
            key="salle-invite-picker"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="min-h-0 overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_28%,transparent)] bg-[#0a0c12]/98 shadow-[inset_0_1px_0_rgba(212,175,55,0.08)] ring-1 ring-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-white/88">
                Inviter en place <span className="text-[var(--school-accent)]">#{pickingForPos}</span>
              </p>
              <button
                type="button"
                onClick={() => setPickingForPos(null)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-gray-400 transition-colors hover:bg-white/[0.08] hover:text-white"
                aria-label="Fermer le choix de membre"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="max-h-[min(42vh,280px)] space-y-1 overflow-y-auto px-3 py-2.5 [scrollbar-width:thin]">
              {inviteCandidates.map((m) => {
                const initials = (m.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => {
                      onGrantSeat?.(m, pickingForPos);
                      setPickingForPos(null);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-transparent bg-white/[0.03] p-2 text-left transition-all hover:border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_8%,transparent)]"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[color-mix(in_srgb,var(--school-accent)_28%,transparent)] to-[#1a2540] text-[10px] font-bold text-[var(--school-accent)]">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-white/88">{m.name}</p>
                      <p className="text-[9px] capitalize text-gray-500">{m.role || 'membre'}</p>
                    </div>
                  </button>
                );
              })}
              {inviteCandidates.length === 0 && (
                <p className="px-1 py-4 text-center text-[11px] leading-snug text-gray-500">
                  Tous les membres présents sont déjà invités sur une place.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Tab: Mains levées ─────────────────────────────────────────────────────────
function MainsLeveesTab({ raisedHands, onLowerHand, onGrantSeat, isHost, privilegedSeats, members }) {
  if (raisedHands.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-500 gap-2">
        <Hand className="w-6 h-6 opacity-30" />
        <p className="text-xs">Aucune main levée</p>
        <p className="text-[10px] text-gray-600">Les participants peuvent lever la main</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {raisedHands.map((h) => {
        const initials = (h.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
        const isPrivileged = privilegedSeats.some((s) => s.userId === h.userId);
        const elapsed = Math.floor((Date.now() - h.at) / 1000);
        const elapsedStr = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m`;

        return (
          <div
            key={h.userId}
            className="flex items-center gap-2.5 p-2 rounded-xl bg-amber-500/7 border border-amber-400/14"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500/28 to-[#1a2540] flex items-center justify-center text-[10px] font-bold text-amber-300 flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-white/88 truncate">{h.name}</p>
              <p className="text-[9px] text-amber-400/55">✋ Il y a {elapsedStr}</p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              {isHost && !isPrivileged && (
                <button
                  type="button"
                  onClick={() => {
                    const nextPos = [1, 2, 3, 4].find((p) => !privilegedSeats.some((s) => s.position === p)) || 1;
                    const member = members.find((m) => m.userId === h.userId) || { userId: h.userId, name: h.name };
                    onGrantSeat?.(member, nextPos);
                    onLowerHand?.(h.userId);
                  }}
                  className="h-6 px-2 rounded-lg bg-[color-mix(in_srgb,var(--school-accent)_14%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_28%,transparent)] text-[9px] text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_22%,transparent)] transition-colors"
                >
                  Inviter
                </button>
              )}
              <button
                type="button"
                onClick={() => onLowerHand?.(h.userId)}
                className="h-6 w-6 rounded-lg bg-white/[0.06] border border-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
                title="Baisser la main"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Zone3Panel export ────────────────────────────────────────────────────
export default function Zone3Panel({
  open,
  onClose,
  // Présence
  members = [],
  // Mains levées
  raisedHands = [],
  onLowerHand,
  // Sièges privilégiés
  privilegedSeats = [],
  onGrantSeat,
  onRevokeSeat,
  // Contexte
  currentUserId,
  isHost = false,
  onRaiseHand,
  myHandRaised = false,
  // NEURON-Q (hôte)
  neuronqEnabled = true,
  questions = [],
  onMarkAnswered,
  onMarkSkipped,
  qaMode = false,
  onToggleQaMode,
  // Master Script (hôte)
  scriptSections = [],
  scriptCurrentSection = null,
  scriptLoading = false,
  scriptImproving = null,
  onScriptAdd,
  onScriptUpdate,
  onScriptDelete,
  onScriptMove,
  onScriptImprove,
  totalSlides = 1,
  /** Panneau pleine largeur / safe-area (maquette LIRI mobile) */
  mobileLayout = false,
  /**
   * Rendu dans un tiroir (ex. hub LONGIA Signaux) : pas de `position:absolute` flottant,
   * le panneau remplit le parent flex pour rester emboîté et responsive.
   */
  embedded = false,
}) {
  const [activeTab, setActiveTab] = useState('membres');

  useEffect(() => {
    if (!neuronqEnabled && activeTab === 'questions') setActiveTab('membres');
  }, [neuronqEnabled, activeTab]);

  const pendingQCount = questions.filter((q) => q.status === 'pending').length;

  const tabs = [
    { id: 'membres',   label: 'Membres',   icon: Users,      count: members.length },
    { id: 'salle',     label: 'Salle',     icon: Crown,      count: privilegedSeats.length },
    { id: 'mains',     label: 'Mains',     icon: Hand,       count: raisedHands.length,  alert: raisedHands.length > 0 },
    ...(isHost ? [
      ...(neuronqEnabled
        ? [{ id: 'questions', label: 'Q&A', icon: HelpCircle, count: pendingQCount, alert: pendingQCount > 0 }]
        : []),
      { id: 'script',    label: 'Script',  icon: BookOpen,   count: scriptSections.length },
    ] : []),
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={embedded ? false : { opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={embedded ? { opacity: 0 } : { opacity: 0, x: 18 }}
          transition={{ duration: embedded ? 0.12 : 0.25, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            designerShellEmbedPanel,
            'flex min-h-0 flex-col',
            embedded
              ? 'relative z-auto h-full max-h-[min(94vh,800px)] min-h-0 w-full flex-1'
              : cn(
                  'absolute z-[35] max-h-[min(86vh,720px)]',
                  mobileLayout
                    ? 'top-[max(5.5rem,env(safe-area-inset-top)+3.25rem)] left-2 right-2 bottom-[max(6.5rem,env(safe-area-inset-bottom)+5.25rem)] w-auto max-w-none'
                    : 'top-[128px] bottom-[104px] right-4 w-[272px]',
                ),
          )}
        >
          {/* En-tête — même gabarit que LIRI Control Mesh */}
          <div className="flex shrink-0 flex-col gap-2 border-b border-white/[0.08] px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-amber-200/95">
                  Zone interactive
                </div>
                <p className="text-[8px] leading-snug text-white/38">
                  Présence · salle privilégiée · mains · script
                </p>
              </div>
              {!embedded ? (
                <button
                  type="button"
                  onClick={onClose}
                  className={designerShellCloseBtn}
                  aria-label="Fermer la zone interactive"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              ) : null}
            </div>
          </div>

          {/* Corps — aligné Control Mesh (gap + padding) */}
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 pb-3 pt-2">
            <div className={cn(designerShellSegmentedRail, 'flex-shrink-0 flex-wrap')}>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    title={tab.label}
                    aria-label={tab.label}
                    className={cn(designerShellSegmentedSlot(active), 'relative min-h-[40px] flex-1 basis-[22%]')}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    {!embedded ? (
                      <span className="line-clamp-2 text-[8px] font-semibold leading-tight">{tab.label}</span>
                    ) : (
                      <span className="sr-only">{tab.label}</span>
                    )}
                    {tab.count > 0 ? (
                      <span
                        className={cn(
                          'absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full border px-1 text-[8px] font-bold',
                          active
                            ? 'border-[var(--school-accent)] bg-[var(--school-accent)] text-black'
                            : tab.alert
                              ? 'border-amber-500 bg-amber-500 text-black'
                              : 'border-white/10 bg-white/18 text-white/75',
                        )}
                      >
                        {tab.count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div
              className={cn(
                'relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin] [scrollbar-color:rgba(251,191,36,0.25)_transparent]',
                'bg-[radial-gradient(circle_at_14%_10%,rgba(255,255,255,0.06),transparent_38%)]',
              )}
            >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.16 }}
              >
                {activeTab === 'membres' && (
                  <MembresTab
                    members={members}
                    privilegedSeats={privilegedSeats}
                    onGrantSeat={onGrantSeat}
                    isHost={isHost}
                    currentUserId={currentUserId}
                  />
                )}
                {activeTab === 'salle' && (
                  <SallePrivilegieeTab
                    seats={privilegedSeats}
                    members={members}
                    onGrantSeat={onGrantSeat}
                    onRevokeSeat={onRevokeSeat}
                    isHost={isHost}
                  />
                )}
                {activeTab === 'mains' && (
                  <MainsLeveesTab
                    raisedHands={raisedHands}
                    onLowerHand={onLowerHand}
                    onGrantSeat={onGrantSeat}
                    isHost={isHost}
                    privilegedSeats={privilegedSeats}
                    members={members}
                  />
                )}
                {activeTab === 'questions' && isHost && (
                  <NeuronQHostTab
                    questions={questions}
                    onMarkAnswered={onMarkAnswered}
                    onMarkSkipped={onMarkSkipped}
                    qaMode={qaMode}
                    onToggleQaMode={onToggleQaMode}
                  />
                )}
                {activeTab === 'script' && isHost && (
                  <MasterScriptPanel
                    sections={scriptSections}
                    currentSection={scriptCurrentSection}
                    loading={scriptLoading}
                    improving={scriptImproving}
                    onAddSection={onScriptAdd}
                    onUpdateSection={onScriptUpdate}
                    onDeleteSection={onScriptDelete}
                    onMoveSection={onScriptMove}
                    onImproveSection={onScriptImprove}
                    totalSlides={totalSlides}
                  />
                )}
              </motion.div>
            </AnimatePresence>
            </div>
          </div>

          {/* Footer: lever la main (participants uniquement) */}
          {!isHost && (
            <div className="flex-shrink-0 border-t border-white/[0.08] px-3 pb-3 pt-2">
              <button
                type="button"
                onClick={myHandRaised ? () => onLowerHand?.(currentUserId) : onRaiseHand}
                className={cn(
                  designerShellBtnGold,
                  'flex h-10 w-full items-center justify-center gap-2 text-[11px]',
                  myHandRaised && 'border-amber-400/45 bg-amber-500/20 text-amber-100',
                )}
              >
                <Hand className="h-3.5 w-3.5" strokeWidth={2} />
                {myHandRaised ? '✋ Main levée — baisser' : 'Lever la main'}
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
