import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDataSync } from '@/contexts/DataSyncContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlayCircle, Calendar, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';

/**
 * Liste lives (à venir + replays) — même agrégation que l’ancienne page /lives.
 * @param {'default' | 'liriMobile'} variant
 */
export default function LivesLibraryContent({ variant = 'default' }) {
  const { years = [] } = useDataSync();

  const { upcomingLives, pastLives } = useMemo(() => {
    const upcoming = [];
    const past = [];
    (Array.isArray(years) ? years : []).forEach((y) =>
      (Array.isArray(y?.modules) ? y.modules : []).forEach((m) =>
        (Array.isArray(m?.weeks) ? m.weeks : []).forEach((w) => {
          [w?.openingLive, w?.closingLive].forEach((live) => {
            if (!live) return;
            const liveData = { ...live, moduleTitle: m?.title, weekTitle: w?.title };
            if (live.status === 'completed') past.push(liveData);
            else upcoming.push(liveData);
          });
        }),
      ),
    );
    return { upcomingLives: upcoming, pastLives: past };
  }, [years]);

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
          <LiriWordmark size="kicker" className="text-[#D4AF37]/80" />
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
          <Calendar className={cn('text-[#D4AF37]', mobile ? 'h-4 w-4' : 'h-6 w-6')} />
          À venir
        </h3>
        <div className={cn('grid gap-4', mobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6')}>
          {upcomingLives.map((live) => (
            <Card
              key={live.id}
              className={cn(
                'border-white/10',
                mobile ? 'bg-black/40 border-[#D4AF37]/20' : 'bg-[#192734]',
              )}
            >
              <CardContent className={cn(mobile ? 'p-4' : 'p-6')}>
                <Badge className="bg-[#D4AF37] text-black mb-3 text-[10px]">Programmé</Badge>
                <h4 className={cn('font-bold text-white mb-1', mobile ? 'text-base' : 'text-xl mb-2')}>
                  {live.title}
                </h4>
                <p className={cn('text-gray-400 mb-3', mobile ? 'text-xs' : 'text-sm mb-4')}>
                  {live.moduleTitle} • {live.weekTitle}
                </p>
                <div className={cn('flex items-center gap-2 text-gray-300 mb-4', mobile ? 'text-xs' : 'text-sm mb-6')}>
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  {new Date(live.date).toLocaleDateString()} à {new Date(live.date).toLocaleTimeString()}
                </div>
                <Button
                  size={mobile ? 'sm' : 'default'}
                  className={cn(
                    'w-full',
                    mobile
                      ? 'border border-[#D4AF37]/45 bg-gradient-to-r from-[#D4AF37]/18 to-[#6b5a14]/20 text-[#fff4dc] hover:from-[#D4AF37]/28 hover:to-[#6b5a14]/28'
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
          <PlayCircle className={cn('text-[#D4AF37]', mobile ? 'h-4 w-4' : 'h-6 w-6')} />
          Replays
        </h3>
        <div className={cn('grid gap-4', mobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6')}>
          {pastLives.map((live) => (
            <Card
              key={live.id}
              className={cn(
                'border-white/10 group cursor-pointer hover:border-[#D4AF37]/40 transition-colors overflow-hidden',
                mobile ? 'bg-black/40 border-[#D4AF37]/15' : 'bg-[#192734]',
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
                  {new Date(live.date).toLocaleDateString()}
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
