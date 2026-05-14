import React from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { EleveSectionTitle } from '@/components/eleve-mobile/EleveMobileShell';
import { EV_BG, EV_MUTED, EV_PAGE_AMBIENT, EV_R, listCardSurface, safeFormat } from './vieScolaireSharedUI.jsx';

export default function EleveVieScolaireAnnoncesTab() {
  const data = useOutletContext();
  if (!data) return null;
  const { loading, notifPreview } = data;
  const list = notifPreview || [];

  return (
    <div
      className="w-full px-4 pb-3 pt-0"
      style={{ backgroundColor: EV_BG, backgroundImage: EV_PAGE_AMBIENT, minHeight: '40dvh' }}
    >
      <EleveSectionTitle className="!mb-2" action="Tout" actionTo="/notifications">
        Notifications
      </EleveSectionTitle>
      {loading ? (
        <div className="space-y-1.5 py-1" aria-busy>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-[16px] border border-white/[0.08] bg-white/[0.04]"
            />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div
          className="flex items-start gap-3 p-3.5"
          style={{ borderRadius: EV_R.lg, ...listCardSurface() }}
        >
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(139, 92, 246, 0.12)' }}
          >
            <Bell className="h-5 w-5 text-violet-300" />
          </div>
          <div>
            <p className="text-[14px] font-extrabold text-white/95">Aucune annonce récente</p>
            <p className="mt-0.5 text-[12.5px] font-medium leading-relaxed" style={{ color: EV_MUTED }}>
              Les messages de l’école apparaîtront ici. Tu peux aussi consulter la boîte complète.
            </p>
            <Link
              to="/notifications"
              className="mt-2.5 inline-flex text-[12px] font-bold text-violet-300/95 underline-offset-2 hover:underline"
            >
              Ouvrir les notifications
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {list.map((n) => (
            <div
              key={n.id}
              className="flex items-start gap-2.5 p-2.5"
              style={{ borderRadius: EV_R.lg, ...listCardSurface() }}
            >
              <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-300" />
              <div className="min-w-0">
                <p className="line-clamp-3 text-[12px] leading-snug text-white/92">{n.line}</p>
                <p className="mt-0.5 text-[9.5px] font-medium" style={{ color: EV_MUTED }}>
                  {safeFormat(n.at, "d MMM, HH:mm")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
