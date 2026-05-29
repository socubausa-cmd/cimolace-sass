import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import ParticipantFluxCard from './ParticipantFluxCard';

export default function ParticipantFluxMorePanel({ open, participants = [], activeId, onClose, onPromote, className = '' }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter((p) => String(p?.name || '').toLowerCase().includes(q));
  }, [participants, query]);

  if (!open) return null;

  return (
    <div className={`absolute right-5 top-20 z-40 w-[min(92vw,340px)] rounded-[24px] border border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(255,255,255,0.06))] backdrop-blur-2xl p-3 shadow-[0_30px_80px_-35px_rgba(0,0,0,0.9)] ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-white/90">+12</p>
        <button type="button" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-white/10 text-gray-300">
          <X className="w-4 h-4 mx-auto" />
        </button>
      </div>
      <div className="h-9 rounded-xl border border-white/10 bg-black/25 px-2.5 flex items-center gap-2 mb-3">
        <Search className="w-3.5 h-3.5 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un participant..."
          className="bg-transparent text-sm text-white w-full outline-none placeholder:text-gray-500"
        />
      </div>
      <div className="grid grid-cols-3 gap-2 max-h-[38vh] overflow-y-auto pr-1">
        {filtered.map((p) => (
          <div key={p.id} className="space-y-1">
            <ParticipantFluxCard
              participant={p}
              active={p.id === activeId}
              depth={0.92}
              onClick={() => {
                onPromote?.(p.id);
                onClose?.();
              }}
            />
            <button type="button" onClick={() => { onPromote?.(p.id); onClose?.(); }} className="h-6 w-full rounded-lg bg-white/[0.04] border border-white/10 hover:border-[#D4AF37]/35 hover:text-[#D4AF37] text-[10px] text-gray-300">Monter</button>
          </div>
        ))}
      </div>
    </div>
  );
}
