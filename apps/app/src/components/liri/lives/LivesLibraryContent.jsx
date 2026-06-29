import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataSync } from '@/contexts/DataSyncContext';
import { authStore } from '@/lib/auth-store';
import { getApiBaseUrl } from '@/lib/apiBase';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlayCircle, Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';

/**
 * Liste lives (à venir + replays) — même agrégation que l'ancienne page /lives.
 * @param {'default' | 'liriMobile'} variant
 */
export default function LivesLibraryContent({ variant = 'default' }) {
  const { years = [] } = useDataSync();

  // Lives RÉELS créés au Studio (table live_sessions, scopés au tenant via l'API) —
  // s'ajoutent aux lives du curriculum. Fail-safe : si l'appel échoue, on garde le curriculum.
  const [sessions, setSessions] = useState([]);
  useEffect(() => {
    const token = authStore.getToken?.();
    if (!token) return;
    let alive = true;
    fetch(`${getApiBaseUrl()}/lives`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': authStore.getTenantSlug?.() || '' },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { const a = d?.data ?? d; if (alive && Array.isArray(a)) setSessions(a); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const { upcomingLives, pastLives } = useMemo(() => {
    const upcoming = [];
    const past = [];
    // 1) Lives du CURRICULUM (semaines : ouverture / clôture)
    (Array.isArray(years) ? years : []).forEach((y) =>
      (Array.isArray(y?.modules) ? y.modules : []).forEach((m) =>
        (Array.isArray(m?.weeks) ? m.weeks : []).forEach((w) => {
          [w?.openingLive, w?.closingLive].forEach((live) => {
            if (!live) return;
            const liveData = { ...live, subtitle: [m?.title, w?.title].filter(Boolean).join(' • ') };
            if (live.status === 'completed') past.push(liveData);
            else upcoming.push(liveData);
          });
        }),
      ),
    );
    // 2) Lives RÉELS du Studio (live_sessions)
    (Array.isArray(sessions) ? sessions : []).forEach((s) => {
      if (!s?.id) return;
      const ended = s.status === 'ended' || s.status === 'completed' || !!s.ended_at;
      const item = {
        id: s.id,
        title: s.title || 'Session live',
        date: s.scheduled_at || s.started_at || s.ended_at || s.created_at,
        subtitle: 'Session live',
        description: s.description || '',
        status: ended ? 'completed' : (s.status || 'scheduled'),
      };
      if (ended) past.push(item); else upcoming.push(item);
    });
    return { upcomingLives: upcoming, pastLives: past };
  }, [years, sessions]);

  const mobile = variant === 'liriMobile';

  return (
    <div className={cn(mobile ? 'space-y-8' : 'max-w-7xl mx-auto space-y-12')}>
      {!mobile ? (
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-white">Bibliothèque des Lives</h1>
          <p className="text-xl text-gray-400">Retrouvez tous les directs, passés et à venir.</p>
        </div>
      ) : (
        <div className="space-y-2 pb-1">
          <LiriWordmark size="kicker" className="text-[color-mix(in_srgb,var(--school-accent)_80%,transparent)]" />
          <h2 className="font-serif text-lg text-[#faf3e6] tracking-tight">Lives & replays</h2>
          <p className="text-xs text-white/42">
            En invité : accès aux directs et rediffusions. Un lien reçu ? Collez-le dans « Connexion » →{' '}
            <Link to={`${ELEVE_MOBILE.connexion}/lien`} className="text-sky-300/95 underline-offset-2 hover:underline">
              Rejoindre avec un lien
            </Link>
            .<span className="mt-1 block text-[11px] text-white/35">
              Animer le live (hôte) : uniquement sur le site web, depuis un ordinateur.
            </span>
          </p>
        </div>
      )}

      <section>
        <h3
          className={cn(
            'font-bold text-white mb-4 flex items-center gap-2',
            mobile ? 'text-base' : 'text-2xl mb-6',
          )}
        >
          <Calendar className={cn('text-[var(--school-accent)]', mobile ? 'h-4 w-4' : 'h-6 w-6')} />
          À venir
        </h3>
        <div className={cn('grid gap-4', mobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6')}>
          {upcomingLives.map((live) => (
            <Card
              key={live.id}
              className={cn(
                'border-white/10',
                mobile ? 'bg-black/40 border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]' : 'bg-[#30302e]',
              )}
            >
              <CardContent className={cn(mobile ? 'p-4' : 'p-6')}>
                <Badge className="bg-[var(--school-accent)] text-black mb-3 text-[10px]">Programmé</Badge>
                <h4 className={cn('font-bold text-white mb-1', mobile ? 'text-base' : 'text-xl mb-2')}>
                  {live.title}
                </h4>
                <p className={cn('text-gray-400 mb-3', mobile ? 'text-xs' : 'text-sm mb-4')}>
                  {live.subtitle}
                </p>
                <div className={cn('flex items-center gap-2 text-gray-300 mb-4', mobile ? 'text-xs' : 'text-sm mb-6')}>
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  {live.date && !Number.isNaN(new Date(live.date).getTime())
                    ? `${new Date(live.date).toLocaleDateString()} à ${new Date(live.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Date à confirmer'}
                </div>
                <Button
                  size={mobile ? 'sm' : 'default'}
                  className={cn(
                    'w-full',
                    mobile
                      ? 'border border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] bg-gradient-to-r from-[color-mix(in_srgb,var(--school-accent)_18%,transparent)] to-[#6b5a14]/20 text-[#fff4dc] hover:from-[color-mix(in_srgb,var(--school-accent)_28%,transparent)] hover:to-[#6b5a14]/28'
                      : 'bg-white/10 hover:bg-white/20 border border-white/10',
                  )}
                >
                  {mobile ? 'Rejoindre le direct (invité)' : "S'inscrire / Rejoindre"}
                </Button>
              </CardContent>
            </Card>
          ))}
          {upcomingLives.length === 0 ? (
            <p className={cn('text-gray-500', mobile && 'text-sm text-white/40')}>
              Aucun live programmé pour le moment.
            </p>
          ) : null}
        </div>
      </section>

      <section>
        <h3
          className={cn(
            'font-bold text-white mb-4 flex items-center gap-2',
            mobile ? 'text-base' : 'text-2xl mb-6',
          )}
        >
          <PlayCircle className={cn('text-[var(--school-accent)]', mobile ? 'h-4 w-4' : 'h-6 w-6')} />
          Replays
        </h3>
        <div className={cn('grid gap-4', mobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6')}>
          {pastLives.map((live) => (
            <Card
              key={live.id}
              className={cn(
                'border-white/10 group cursor-pointer hover:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] transition-colors overflow-hidden',
                mobile ? 'bg-black/40 border-[color-mix(in_srgb,var(--school-accent)_15%,transparent)]' : 'bg-[#30302e]',
              )}
            >
              <div className="aspect-video bg-black relative">
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 group-hover:bg-black/30 transition-colors">
                  <PlayCircle
                    className={cn(
                      'text-white opacity-80 group-hover:scale-110 transition-transform',
                      mobile ? 'h-12 w-12' : 'h-16 w-16',
                    )}
                  />
                </div>
              </div>
              <CardContent className={cn(mobile ? 'p-4' : 'p-6')}>
                <h4 className={cn('font-bold text-white mb-1', mobile ? 'text-sm' : 'text-lg')}>{live.title}</h4>
                <p className={cn('text-gray-400 mb-2', mobile ? 'text-xs' : 'text-sm mb-4')}>
                  {live.date && !Number.isNaN(new Date(live.date).getTime()) ? new Date(live.date).toLocaleDateString() : ''}
                </p>
                <p className={cn('text-gray-300 line-clamp-2', mobile ? 'text-xs' : 'text-sm')}>{live.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
