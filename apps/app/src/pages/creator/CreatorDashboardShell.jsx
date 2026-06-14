import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import OwnerFormationBuilder from '@/components/school/formations/OwnerFormationBuilder';
import { FORUM_COMMUNITY_PATH } from '@/lib/forumDashboardPaths';

/**
 * Espace créateur : barre d'accès au forum communauté (même contenu que l'espace élève).
 */
export default function CreatorDashboardShell() {
  return (
    <div className="relative min-h-screen bg-[#0F1419]">
      <div className="sticky top-0 z-40 flex justify-end border-b border-white/10 bg-[#0F1419]/95 px-4 py-2 backdrop-blur-sm">
        <Link
          to={FORUM_COMMUNITY_PATH.student}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-[#D4AF37] hover:bg-white/5 transition-colors"
        >
          <MessageCircle className="w-4 h-4 shrink-0" />
          Forum communauté
        </Link>
      </div>
      <OwnerFormationBuilder />
    </div>
  );
}
