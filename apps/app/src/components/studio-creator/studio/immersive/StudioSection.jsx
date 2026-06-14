import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const contentVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

export function StudioSection({
  section,
  isActive,
  index,
  total,
  onCreate,
  onEnterView,
}) {
  const Icon = section.icon;

  return (
    <section
      id={`studio-section-${section.id}`}
      data-section-id={section.id}
      className="relative flex h-full min-h-0 items-center overflow-hidden"
      onMouseEnter={() => onEnterView(index)}
    >
      <div className="w-full max-w-7xl mx-auto px-6 md:px-10 lg:px-14">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <motion.div
            variants={contentVariants}
            initial="hidden"
            animate={isActive ? 'visible' : 'hidden'}
            className="max-w-xl"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-gray-300 mb-5">
              <span className="text-[#D4AF37]">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="text-gray-500">/</span>
              <span className="text-gray-400">{String(total).padStart(2, '0')}</span>
            </div>

            <div className="mb-6">
              <motion.div
                animate={isActive ? { scale: 1, opacity: 1 } : { scale: 0.94, opacity: 0.6 }}
                transition={{ duration: 0.35 }}
                className={cn(
                  'w-16 h-16 rounded-2xl flex items-center justify-center mb-6',
                  section.iconBg,
                  section.iconColor,
                  'shadow-[0_0_0_1px_rgba(255,255,255,0.08)]'
                )}
              >
                <motion.div
                  animate={isActive ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={{ duration: 2, repeat: Infinity, repeatType: 'mirror' }}
                >
                  <Icon className="w-8 h-8" />
                </motion.div>
              </motion.div>

              <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight text-white md:text-5xl lg:text-6xl">
                {section.title}
              </h2>
              <p className="mt-5 text-base leading-relaxed text-white/65 md:text-lg">
                {section.description}
              </p>
            </div>

            <Button
              size="lg"
              onClick={() => onCreate(section.path)}
              className={cn(
                'rounded-xl text-base font-semibold px-6 h-12',
                'bg-[#D4AF37] text-black hover:bg-[#e5c04a]',
                'shadow-[0_8px_40px_rgba(212,175,55,0.25)]'
              )}
            >
              Créer maintenant
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isActive ? { opacity: 1, x: 0 } : { opacity: 0.55, x: 10 }}
            transition={{ duration: 0.45 }}
            className="relative"
          >
            <motion.div
              animate={isActive ? { y: [-5, 5, -5] } : { y: 0 }}
              transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
              className="overflow-hidden rounded-3xl border border-[#D4AF37]/15 bg-[#0f0d0b]/85 p-6 backdrop-blur-xl md:p-8"
            >
              <div className="absolute -right-20 -top-20 w-52 h-52 rounded-full blur-3xl bg-white/10" />
              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs uppercase tracking-[0.2em] text-gray-500">
                    Preview
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400">
                    {section.previewTag}
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="h-36 rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.03]" />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-20 rounded-xl border border-white/10 bg-white/[0.04]" />
                    <div className="h-20 rounded-xl border border-white/10 bg-white/[0.04]" />
                  </div>
                  <div className="h-3 w-3/4 rounded-full bg-white/20" />
                  <div className="h-3 w-1/2 rounded-full bg-white/10" />
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
