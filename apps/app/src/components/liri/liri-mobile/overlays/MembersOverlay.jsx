import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, X, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMobileLiriStore } from '@/stores/mobileLiriStore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const LONG_MS = 520;

function LiveBadge() {
  return (
    <span className="absolute left-0.5 top-0.5 rounded bg-[#ff3040] px-1 py-0.5 text-[7px] font-bold uppercase leading-none text-white shadow-[0_0_6px_rgba(255,48,64,0.5)]">
      Live
    </span>
  );
}

/** Visualiseur type égaliseur (décor maquette Arena). */
function VizBars({ className }) {
  const basePx = [10, 18, 12, 22, 15];
  return (
    <div className={cn('flex h-9 items-end justify-end gap-0.5', className)}>
      {basePx.map((h, i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.45)]"
          initial={{ height: h * 0.7 }}
          animate={{ height: [h * 0.45, h, h * 0.6] }}
          transition={{
            duration: 0.85 + i * 0.07,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

/**
 * @param {{ members: Array<{ id: string, name: string, avatar_url?: string, isHost?: boolean, role?: string, lastActiveLabel?: string, locationLabel?: string | null }>, currentUserId?: string }} props
 */
export function MembersOverlay({ members = [], currentUserId }) {
  const closeOverlay = useMobileLiriStore((s) => s.closeOverlay);
  const openMemberActions = useMobileLiriStore((s) => s.openMemberActions);
  const [q, setQ] = useState('');
  const longPressTimer = useRef(null);
  const skipNextClick = useRef(false);

  const clearLong = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startLong = (m) => {
    clearLong();
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      skipNextClick.current = true;
      openMemberActions({
        id: m.id,
        name: m.name,
        avatar: m.avatar_url,
        isHost: m.isHost,
        role: m.role,
        lastActiveLabel: m.lastActiveLabel,
        locationLabel: m.locationLabel || undefined,
      });
    }, LONG_MS);
  };

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return members;
    return members.filter((m) => (m.name || '').toLowerCase().includes(t));
  }, [members, q]);

  const openMember = (m) => {
    openMemberActions({
      id: m.id,
      name: m.name,
      avatar: m.avatar_url,
      isHost: m.isHost,
      role: m.role,
      lastActiveLabel: m.lastActiveLabel,
      locationLabel: m.locationLabel || undefined,
    });
  };

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      className="fixed inset-x-0 bottom-0 z-[210] flex max-h-[min(88dvh,780px)] flex-col rounded-t-[28px] border border-[#D4AF37]/35 bg-[#0a0908]/98 shadow-[0_-24px_64px_rgba(0,0,0,0.65),0_0_40px_-12px_rgba(212,175,55,0.18)] backdrop-blur-2xl"
      data-liri-no-doubletap
    >
      <div className="mx-auto mt-2.5 h-1 w-11 rounded-full bg-[#D4AF37]/35" />
      <div className="flex items-center justify-between gap-2 border-b border-[#D4AF37]/20 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-[#D4AF37]" strokeWidth={1.85} />
          <h2 className="truncate font-serif text-lg font-semibold text-[#D4AF37]">Membres</h2>
        </div>
        <button
          type="button"
          onClick={closeOverlay}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#D4AF37]/25 text-[#D4AF37]/70 transition-colors hover:bg-[#D4AF37]/10"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 pb-2">
        <div className="flex items-center gap-2.5 rounded-2xl border border-[#D4AF37]/30 bg-black/40 px-3 py-2.5 shadow-[inset_0_1px_0_0_rgba(212,175,55,0.1)]">
          <Search className="h-4 w-4 shrink-0 text-[#D4AF37]/55" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher…"
            className="min-w-0 flex-1 bg-transparent text-sm text-[#f5e6c8] placeholder:text-[#D4AF37]/35 outline-none"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <ul className="space-y-2.5">
          {filtered.map((m) => {
            const subtitle = m.isHost
              ? 'Host'
              : currentUserId && m.id === currentUserId
                ? 'Vous'
                : m.role || 'Participant';
            const showLiveTag = Boolean(m.isHost);

            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (skipNextClick.current) {
                      skipNextClick.current = false;
                      return;
                    }
                    openMember(m);
                  }}
                  onTouchStart={() => startLong(m)}
                  onTouchEnd={clearLong}
                  onTouchCancel={clearLong}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    openMember(m);
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border border-[#D4AF37]/28 bg-black/35 px-3 py-2.5 text-left shadow-[0_0_24px_-12px_rgba(212,175,55,0.25),inset_0_1px_0_0_rgba(212,175,55,0.08)] transition-colors active:bg-[#D4AF37]/[0.06]',
                    m.isHost && 'border-[#D4AF37]/45 bg-[#D4AF37]/[0.07]',
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-14 w-14 rounded-xl border border-[#D4AF37]/35 shadow-[0_0_16px_-4px_rgba(212,175,55,0.35)]">
                      {m.avatar_url ? <AvatarImage src={m.avatar_url} alt="" className="object-cover" /> : null}
                      <AvatarFallback className="rounded-xl bg-[#D4AF37]/15 text-lg font-semibold text-[#D4AF37]">
                        {(m.name || '?').slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {showLiveTag ? <LiveBadge /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[#faf3e6]">{m.name}</p>
                    <p className="mt-0.5 truncate text-xs text-[#D4AF37]/65">{subtitle}</p>
                  </div>
                  <VizBars className="w-10 shrink-0 opacity-90" />
                </button>
              </li>
            );
          })}
        </ul>
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-[#D4AF37]/45">Aucun membre ne correspond.</p>
        ) : null}
      </div>
    </motion.div>
  );
}
