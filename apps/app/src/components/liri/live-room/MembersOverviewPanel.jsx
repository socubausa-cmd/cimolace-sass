import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Panneau liste membres (zone 3) — fond flouté, cartes larges type « carte principale », scroll vertical.
 */
export function MembersOverviewPanel({
  open,
  onClose,
  members = [],
  onSelectMember,
  title = 'Membres connectés',
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[48] flex flex-col rounded-2xl overflow-hidden"
        >
          <div className="absolute inset-0 bg-[#0a0f18]/55 backdrop-blur-md" aria-hidden />
          <div className="relative flex flex-col flex-1 min-h-0 border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] bg-[#0c1018]/88 m-1 rounded-xl shadow-xl">
            <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[var(--school-accent)]" />
                <span className="text-sm font-semibold text-white/90">{title}</span>
                <span className="text-[10px] text-white/45 tabular-nums">({members.length})</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="h-8 w-8 rounded-full bg-white/8 border border-white/12 text-gray-300 flex items-center justify-center hover:text-white"
                aria-label="Fermer le panneau membres"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2 [scrollbar-width:thin]">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {members.length === 0 ? (
                  <p className="text-sm text-white/45 col-span-full text-center py-8">Aucun membre listé.</p>
                ) : (
                  members.map((m) => {
                    const uid = String(m.userId || m.id || '');
                    const initials = (m.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <button
                        key={uid || m.name}
                        type="button"
                        onClick={() => onSelectMember?.(m)}
                        className={cn(
                          'flex flex-col rounded-xl border border-white/12 bg-black/35 overflow-hidden text-left',
                          'hover:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_8%,transparent)] transition-colors min-h-[120px]',
                        )}
                      >
                        <div className="flex-1 flex items-center gap-3 p-3 min-h-[88px]">
                          {m.avatar_url ? (
                            <img src={m.avatar_url} alt="" className="h-14 w-14 rounded-xl object-cover border border-white/10 flex-shrink-0" />
                          ) : (
                            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[color-mix(in_srgb,var(--school-accent)_28%,transparent)] to-[#1a2540] flex items-center justify-center text-sm font-bold text-[var(--school-accent)] flex-shrink-0 border border-white/10">
                              {initials}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white truncate">{m.name || 'Membre'}</p>
                            <p className="text-[10px] text-amber-400/85 truncate">{m.role || 'connecté'}</p>
                          </div>
                        </div>
                        <div className="px-3 py-1.5 border-t border-white/8 bg-white/[0.03] text-[9px] text-[color-mix(in_srgb,var(--school-accent)_90%,transparent)] text-center">
                          Ouvrir la fiche vidéo
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default MembersOverviewPanel;
