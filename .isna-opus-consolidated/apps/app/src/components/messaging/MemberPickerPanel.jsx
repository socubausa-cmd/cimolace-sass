/**
 * MemberPickerPanel — floating panel to start a new 1:1 conversation.
 * Lists all space members grouped by role + a recent-conversations tab.
 * Extracted from MessagingPage.jsx (REQ-FE-004).
 */
import React, { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { roleLabels } from '@/lib/messagingUtils';
import { UserAvatar, OnlineDot } from './atoms';

export function MemberPickerPanel({
  open,
  onClose,
  users,
  currentUserId,
  conversations,
  onSelectUser,
  onSelectConversation,
  onReload,
  loading,
}) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('members');

  const otherUsers = useMemo(
    () => users.filter((u) => u.id !== currentUserId),
    [users, currentUserId]
  );

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return otherUsers;
    return otherUsers.filter(
      (u) =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (roleLabels[u.role] || u.role || '').toLowerCase().includes(q)
    );
  }, [otherUsers, search]);

  const roleOrder = ['owner', 'admin', 'teacher', 'secretariat', 'creator', 'proche', 'student'];
  const grouped = useMemo(() => {
    const groups = {};
    filteredUsers.forEach((u) => {
      const r = u.role || 'student';
      if (!groups[r]) groups[r] = [];
      groups[r].push(u);
    });
    return roleOrder
      .filter((r) => groups[r]?.length > 0)
      .map((r) => ({ role: r, members: groups[r] }));
  }, [filteredUsers]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-20 right-4 md:right-8 z-50 w-[340px] max-h-[520px] rounded-2xl border border-white/10 bg-[#0c1118]/90 backdrop-blur-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">Dialogue</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/10 text-gray-400">
                  {otherUsers.length} membre{otherUsers.length !== 1 ? 's' : ''}
                </span>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 pb-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un membre…"
                  className="w-full h-9 pl-9 pr-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-500 outline-none focus:border-[#D4AF37]/40 transition-colors"
                />
              </div>
            </div>

            {/* Tabs */}
            <div className="px-4 pb-2 flex gap-1">
              {[
                { id: 'members', label: 'Membres' },
                { id: 'recent', label: 'Récents' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'h-7 px-3 rounded-lg text-xs font-medium transition-all',
                    tab === t.id
                      ? 'bg-[#D4AF37]/20 text-[#D4AF37]'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-2 pb-3 scrollbar-thin scrollbar-thumb-white/10">
              {tab === 'members' && (
                <>
                  {grouped.map(({ role, members }) => (
                    <div key={role}>
                      <div className="px-2 pt-2.5 pb-1">
                        <p className="text-[10px] uppercase tracking-wider text-[#D4AF37]/70 font-medium">
                          {roleLabels[role] || role}
                          <span className="ml-1 text-gray-600">({members.length})</span>
                        </p>
                      </div>
                      {members.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => { onSelectUser(user); onClose(); }}
                          className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition-all text-left group"
                        >
                          <div className="relative">
                            <UserAvatar user={user} size="sm" />
                            <OnlineDot status={user.status} className="absolute -bottom-0.5 -right-0.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-white truncate group-hover:text-[#D4AF37] transition-colors">
                              {user.name}
                            </p>
                            <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}

                  {filteredUsers.length === 0 && !loading && (
                    <div className="text-center py-8 px-4">
                      {otherUsers.length === 0 ? (
                        <>
                          <p className="text-sm text-gray-400 mb-1">Aucun membre chargé</p>
                          <p className="text-xs text-gray-600 mb-2">
                            La requête Supabase n'a retourné aucun profil.
                          </p>
                          <p className="text-[11px] text-gray-600 mb-4">
                            Vérifiez la policy `profiles` pour autoriser la lecture des autres comptes.
                          </p>
                          <button
                            onClick={onReload}
                            className="inline-flex items-center gap-1.5 h-8 px-4 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-medium hover:bg-[#D4AF37]/25 transition-all"
                          >
                            Réessayer
                          </button>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">Aucun résultat pour "{search}"</p>
                      )}
                    </div>
                  )}

                  {loading && (
                    <div className="flex justify-center py-8">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />
                    </div>
                  )}
                </>
              )}

              {tab === 'recent' && (
                <>
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => { onSelectConversation(conv); onClose(); }}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 transition-all text-left"
                    >
                      <UserAvatar user={conv} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white truncate">{conv.name}</p>
                        <p className="text-[11px] text-gray-500 truncate">
                          {conv.lastMessage?.content || 'Pas de message'}
                        </p>
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#D4AF37] text-[10px] font-bold text-black flex items-center justify-center">
                          {conv.unreadCount}
                        </span>
                      )}
                    </button>
                  ))}
                  {conversations.length === 0 && (
                    <p className="text-center text-sm text-gray-500 py-6">Aucune conversation</p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
