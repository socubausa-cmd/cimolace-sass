/**
 * SearchPanel — floating conversation search overlay.
 * Extracted from MessagingPage.jsx (REQ-FE-004).
 */
import React, { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Search } from 'lucide-react';
import { UserAvatar } from './atoms';

export function SearchPanel({ open, onClose, conversations, onSelect }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return conversations.slice(0, 8);
    return conversations.filter((c) => c.name?.toLowerCase().includes(q));
  }, [conversations, query]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: 12, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 12, scale: 0.96 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-24 right-4 md:right-8 z-50 w-[300px] max-h-[360px] rounded-2xl border border-white/10 bg-[#0c1118]/90 backdrop-blur-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden"
          >
            <div className="px-4 pt-3 pb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Recherche</p>
              <button onClick={onClose} className="text-gray-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="px-4 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Chercher une conversation…"
                  className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-gray-500 outline-none focus:border-[#D4AF37]/40 transition-colors"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-2 scrollbar-thin scrollbar-thumb-white/10">
              {filtered.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => { onSelect(conv); onClose(); }}
                  className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-all text-left"
                >
                  <UserAvatar user={conv} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-white truncate">{conv.name}</p>
                    <p className="text-[10px] text-gray-600 truncate">
                      {conv.lastMessage?.content || ''}
                    </p>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-xs text-gray-500 py-4">Aucun résultat</p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
