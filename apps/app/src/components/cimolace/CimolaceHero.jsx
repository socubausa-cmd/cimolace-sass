import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, ArrowRight, Sparkles, GraduationCap } from 'lucide-react';
import AnimatedTextCycle from '@/components/ui/animated-text-cycle';
import { SplineScene } from '@/components/ui/splite';
import { Spotlight } from '@/components/ui/spotlight';
import { Card } from '@/components/ui/card';

const modules = [
  { name: 'Virtuel Mbolo', angle: 0, color: '#8b5cf6' },
  { name: 'Smart Logistics', angle: 36, color: '#06b6d4' },
  { name: 'Payflow Africa', angle: 72, color: '#8b5cf6' },
  { name: 'LIRI Live', angle: 108, color: '#06b6d4' },
  { name: 'LIRI Spirit', angle: 144, color: '#8b5cf6' },
  { name: 'LIRI AI Core', angle: 180, color: '#06b6d4' },
  { name: 'LIRI EDU', angle: 216, color: '#8b5cf6' },
  { name: 'LIRI Event', angle: 252, color: '#06b6d4' },
  { name: 'LIRI Agents', angle: 288, color: '#8b5cf6' },
  { name: 'LIRI Scheduler', angle: 324, color: '#06b6d4' },
];

const CimolaceHero = () => {
  const coreRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (coreRef.current) {
        coreRef.current.classList.add('scale-105');
        setTimeout(() => {
          if (coreRef.current) {
            coreRef.current.classList.remove('scale-105');
          }
        }, 400);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#0a0a0f]">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-violet-500/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[150px]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMC4yIiBzdHJva2Utb3BhY2l0eT0iMC4wMyIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30" />
      </div>

      {/* Animated Gradient Orbs */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-violet-500/20 to-cyan-500/20 rounded-full blur-[100px]"
      />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 pt-32 pb-20">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          {/* Left: Text Content */}
          <div className="flex-1 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8"
            >
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-sm text-gray-300">L'écosystème intelligent pour l\'Afrique</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-5xl lg:text-7xl font-bold text-white leading-tight mb-6"
            >
              Une plateforme.
              <br />
              <span className="bg-gradient-to-r from-violet-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
                Plusieurs{' '}
                <AnimatedTextCycle
                  words={['intelligences.', 'solutions.', 'automatisations.', 'modules.', 'technologies.']}
                  interval={2800}
                  className="bg-gradient-to-r from-violet-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent"
                />
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="text-xl text-gray-400 mb-10 max-w-xl mx-auto lg:mx-0"
            >
              <AnimatedTextCycle
                words={['Construis,', 'Vends,', 'Forme,', 'Connecte,', 'Livre,', 'Automatise,', 'Déploie,']}
                interval={2400}
                className="text-violet-400"
              />{' '}et fais évoluer ton business avec une seule infrastructure IA.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <Link to="/cimolace/launch">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-600 to-violet-500 text-white font-semibold rounded-xl hover:shadow-2xl hover:shadow-violet-500/30 transition-all cursor-pointer"
                >
                  <GraduationCap className="w-5 h-5" />
                  Lancer mon infrastructure
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </motion.div>
              </Link>
              <motion.a
                href="#modules"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/5 border border-white/10 text-white font-semibold rounded-xl hover:bg-white/10 transition-all"
              >
                Explorer l'écosystème
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </motion.a>
            </motion.div>
          </div>

          {/* Right: Spline 3D Scene */}
          <motion.div
            className="flex-1 relative"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card className="w-full h-[480px] lg:h-[560px] bg-black/[0.6] border-white/[0.08] relative overflow-hidden">
              <Spotlight size={350} />

              {/* Corner glow accents */}
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-violet-600/20 rounded-full blur-[80px] pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-cyan-600/15 rounded-full blur-[80px] pointer-events-none" />

              {/* Spline 3D */}
              <SplineScene
                scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
                className="w-full h-full"
              />

              {/* Overlay badge */}
              <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
                <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                <span className="text-[11px] text-white/70 font-medium tracking-wide">CIMOLACE AI — Infrastructure active</span>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-6 h-10 rounded-full border-2 border-white/20 flex justify-center pt-2"
        >
          <div className="w-1.5 h-1.5 bg-violet-400 rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default CimolaceHero;
