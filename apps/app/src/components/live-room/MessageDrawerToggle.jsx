import React from 'react';
import { MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import UnreadBadge from './UnreadBadge';

export default function MessageDrawerToggle({ open, unreadCount = 0, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative h-11 px-5 rounded-full border inline-flex items-center gap-2 text-base font-medium transition-colors shadow-[0_14px_40px_-24px_rgba(77,113,255,0.9)]',
        open
          ? 'border-[#D4AF37]/45 bg-[#D4AF37]/16 text-[#D4AF37]'
          : 'border-white/20 bg-[#1a2a62]/75 text-white hover:bg-[#243781]/80'
      )}
      title={open ? 'Fermer le forum live' : 'Ouvrir le forum live (messages publics)'}
    >
      <MessageSquare className="w-4 h-4" />
      Forum
      <UnreadBadge count={unreadCount} />
    </button>
  );
}
