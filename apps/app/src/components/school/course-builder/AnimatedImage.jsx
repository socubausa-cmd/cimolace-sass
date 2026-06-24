import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ImageIcon } from 'lucide-react';

/**
 * ANIMATED IMAGE — donne VIE à une image générée (analogie) sans service vidéo :
 * effet Ken Burns (zoom + travelling lents en boucle) + voile de lumière mouvant.
 * cf. docs/CAHIER_DE_CHARGE_PRECEPTEUR.md — « à chaque analogie : générer l'image et l'animer ».
 *
 * (Évolution future : image→vidéo réelle via Runway/Kling. Ici = Ken Burns, robuste.)
 */
export default function AnimatedImage({ src, alt = '', loading = false, className = '' }) {
  const rm = useReducedMotion();
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-black/10 ${className}`}>
      {/* shimmer pendant la génération / le chargement */}
      {(loading || (!loaded && src)) ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(110deg, #1e293b 30%, #334155 50%, #1e293b 70%)', backgroundSize: '200% 100%' }}
            animate={rm ? {} : { backgroundPosition: ['200% 0', '-200% 0'] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
          />
          <div className="relative flex items-center gap-2 text-white/60">
            <ImageIcon className="h-4 w-4 animate-pulse" />
            <span className="text-xs font-semibold">{loading ? 'Le Précepteur dessine l’image…' : 'Chargement…'}</span>
          </div>
        </div>
      ) : null}

      {src ? (
        <motion.img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          initial={{ scale: 1.02, opacity: 0 }}
          animate={loaded ? {
            opacity: 1,
            scale: rm ? 1.02 : [1.02, 1.14, 1.06, 1.02],
            x: rm ? 0 : ['0%', '-2.5%', '1.5%', '0%'],
            y: rm ? 0 : ['0%', '1.5%', '-1%', '0%'],
          } : { opacity: 0 }}
          transition={{
            opacity: { duration: 0.7, ease: 'easeOut' },
            scale: { duration: 20, repeat: Infinity, ease: 'easeInOut' },
            x: { duration: 20, repeat: Infinity, ease: 'easeInOut' },
            y: { duration: 20, repeat: Infinity, ease: 'easeInOut' },
          }}
          className="h-full w-full object-cover"
        />
      ) : null}

      {/* voile de lumière qui dérive (donne de la vie) */}
      {src && loaded && !rm ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(120% 80% at 30% 20%, rgba(255,255,255,0.18), transparent 55%)' }}
          animate={{ opacity: [0.5, 0.85, 0.5], backgroundPosition: ['30% 20%', '70% 60%', '30% 20%'] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : null}

      {/* léger vignettage bas pour ancrer une légende éventuelle */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/35 to-transparent" />
    </div>
  );
}
