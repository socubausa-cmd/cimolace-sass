import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import PricingSection5 from '@/components/ui/pricing';

const CimolacePricing = () => {
  return (
    <section id="pricing" className="relative bg-[#0a0a0f]">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-violet-600/5 rounded-full blur-[120px]" />
      </div>

      {/* Section label */}
      <div className="relative z-10 text-center pt-20 px-6">
        <motion.span
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-block text-xs text-violet-400 tracking-[0.3em] uppercase"
        >
          Tarification
        </motion.span>
      </div>

      {/* New pricing cards with VerticalCutReveal + NumberFlow */}
      <div className="relative z-10">
        <PricingSection5 />
      </div>

      {/* Bottom note */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="relative z-10 pb-16 text-center"
      >
        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/5 border border-white/10">
          <Zap className="w-4 h-4 text-violet-400" />
          <span className="text-gray-400 text-sm">
            Setup en <strong className="text-white">48h</strong>. Support humain inclus.{' '}
            <strong className="text-white">Sans engagement.</strong>
          </span>
        </div>
      </motion.div>
    </section>
  );
};

export default CimolacePricing;
