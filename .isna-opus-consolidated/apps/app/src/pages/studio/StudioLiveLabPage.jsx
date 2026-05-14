/**
 * Laboratoire Live — hub du Studio Créateur (constructeur de lives)
 * Design aligné avec le shell admin (premium-dashboard-shell / premium-panel).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Clapperboard, Video, Sparkles, Layers, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CARDS = [
  {
    to: '/studio/live-preparation',
    icon: Clapperboard,
    title: 'Live Production',
    desc: "Blueprint, scènes, contenus, modes de salle, accès — avant l'arène.",
    tag: 'Préparation',
    accent: 'from-orange-500/15 to-transparent',
  },
  {
    to: '/studio/live-immersive',
    icon: Layers,
    title: 'Live immersif (messagerie)',
    desc: 'Scènes SmartBoard liées à la conversation — même rendu que pendant le live.',
    tag: 'SmartBoard',
    accent: 'from-amber-500/15 to-transparent',
  },
  {
    to: '/studio/live',
    icon: Video,
    title: 'Studio Live (classique)',
    desc: 'Configuration session live, interactions et contrôle de salle (héritage).',
    tag: 'Realtime',
    accent: 'from-cyan-500/12 to-transparent',
  },
];

export default function StudioLiveLabPage() {
  return (
    <div className="min-h-screen premium-dashboard-shell p-6 pb-20 text-white">
      <div className="mx-auto max-w-7xl space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="premium-panel flex flex-col items-start justify-between gap-4 p-6 md:flex-row md:items-center"
        >
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#D4AF37]" />
              <p className="text-xs uppercase tracking-[0.22em] text-[#D4AF37]/85">Laboratoire Live</p>
            </div>
            <h1 className="text-3xl font-serif font-bold text-white">Constructeur de lives</h1>
            <p className="mt-2 text-gray-400">
              Préparez la régie, les scènes et l&apos;expérience immersive avant l&apos;entrée en direct.
            </p>
          </div>
          <Button asChild variant="outline" className="border-white/10 text-white hover:bg-white/5">
            <Link to="/studio">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour Studio Créateur
            </Link>
          </Button>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((c, i) => (
            <motion.div
              key={c.to}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
            >
              <Link to={c.to} className="group block">
                <div className="premium-panel h-full p-6 transition-all hover:-translate-y-1 hover:border-[#D4AF37]/30">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="rounded-lg bg-white/5 p-3">
                      <c.icon className="h-6 w-6 text-white/90" />
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-600 transition-colors group-hover:text-[#D4AF37]" />
                  </div>
                  <p className="mb-1 text-[11px] uppercase tracking-wider text-gray-500">{c.tag}</p>
                  <h2 className="mb-2 text-xl font-bold text-white">{c.title}</h2>
                  <p className="text-sm leading-relaxed text-gray-400">{c.desc}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
