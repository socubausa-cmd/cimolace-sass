import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sparkles, Star, Shield, Crown, GraduationCap, ArrowRight, Check } from 'lucide-react';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const FormationsPackagesPage = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1, 
      transition: { type: "spring", stiffness: 50 }
    }
  };

  const cardHover = {
    rest: { scale: 1 },
    hover: { 
      scale: 1.02,
      transition: { duration: 0.3 }
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1419] font-sans text-gray-300 selection:bg-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] pb-20">
      <Helmet>
        <title>{`Formations et forfaits — ${isnaTenantConfig.branding.name}`}</title>
        <meta name="description" content={`Détails des cycles de formation et des forfaits (${isnaTenantConfig.branding.name}) : académique, modulaire, privé et privilégié.`} />
      </Helmet>

      {/* Hero Section */}
      <section className="relative h-[45vh] min-h-[450px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=2073&auto=format&fit=crop" 
            alt="Library Books" 
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0F1419]/80 via-[#0F1419]/60 to-[#0F1419]" />
        </div>
        
        <div className="relative z-10 text-center px-4 max-w-5xl mx-auto mt-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-block px-4 py-1.5 mb-6 border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] rounded-full bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] backdrop-blur-sm">
              <span className="text-[var(--school-accent)] text-sm font-bold tracking-widest uppercase">Cursus</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-serif font-bold text-white mb-6 tracking-tight">
              Formations & Forfaits
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto font-light">
              Choisissez la voie qui correspond à votre quête de savoir et d'élévation.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 -mt-10 relative z-20">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="space-y-16"
        >
          
          {/* Section 1: The 3 Cycles */}
          <div className="space-y-8">
             <motion.div variants={itemVariants} className="text-center mb-10">
                <span className="text-4xl block mb-4">🎓</span>
                <h2 className="text-3xl md:text-4xl font-serif font-bold text-white">Les Cycles Académiques</h2>
                <div className="w-20 h-1 bg-[var(--school-accent)] mx-auto mt-4 rounded-full"></div>
             </motion.div>

             <div className="grid md:grid-cols-3 gap-6">
                {/* Cycle 1 */}
                <motion.div variants={itemVariants} whileHover="hover" initial="rest" animate="rest" className="bg-[#192734] rounded-2xl p-8 border border-white/5 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-24 bg-blue-500/5 rounded-full -mr-12 -mt-12 group-hover:bg-blue-500/10 transition-all duration-500"></div>
                   <h3 className="text-2xl font-bold text-white mb-2 relative z-10">Cycle Débutant</h3>
                   <div className="text-blue-400 text-sm font-bold uppercase tracking-wider mb-4 relative z-10">Année 1 • L'Éveil</div>
                   <p className="text-gray-400 leading-relaxed mb-6 relative z-10">
                      Introduction fondamentale à la cosmologie prorascientifique. Déconstruction des paradigmes limitants et apprentissage de la logique universelle.
                   </p>
                   <ul className="space-y-2 text-sm text-gray-300 relative z-10 mb-6">
                      <li className="flex gap-2"><Check className="w-4 h-4 text-blue-400" /> Base de la métaphysique</li>
                      <li className="flex gap-2"><Check className="w-4 h-4 text-blue-400" /> Histoire universelle</li>
                      <li className="flex gap-2"><Check className="w-4 h-4 text-blue-400" /> Gestion de la pensée</li>
                   </ul>
                </motion.div>

                {/* Cycle 2 */}
                <motion.div variants={itemVariants} whileHover="hover" initial="rest" animate="rest" className="bg-[#192734] rounded-2xl p-8 border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] relative overflow-hidden group shadow-lg shadow-[color-mix(in_srgb,var(--school-accent)_5%,transparent)]">
                   <div className="absolute top-0 right-0 p-24 bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] rounded-full -mr-12 -mt-12 group-hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] transition-all duration-500"></div>
                   <h3 className="text-2xl font-bold text-white mb-2 relative z-10">Cycle Maîtrise</h3>
                   <div className="text-[var(--school-accent)] text-sm font-bold uppercase tracking-wider mb-4 relative z-10">Année 2 • La Puissance</div>
                   <p className="text-gray-400 leading-relaxed mb-6 relative z-10">
                      Approfondissement technique des lois. Application pratique pour transformer sa réalité. Développement des facultés supérieures.
                   </p>
                   <ul className="space-y-2 text-sm text-gray-300 relative z-10 mb-6">
                      <li className="flex gap-2"><Check className="w-4 h-4 text-[var(--school-accent)]" /> Lois de la vibration</li>
                      <li className="flex gap-2"><Check className="w-4 h-4 text-[var(--school-accent)]" /> Géométrie sacrée</li>
                      <li className="flex gap-2"><Check className="w-4 h-4 text-[var(--school-accent)]" /> Science des nombres</li>
                   </ul>
                </motion.div>

                {/* Cycle 3 */}
                <motion.div variants={itemVariants} whileHover="hover" initial="rest" animate="rest" className="bg-[#192734] rounded-2xl p-8 border border-white/5 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-24 bg-purple-500/5 rounded-full -mr-12 -mt-12 group-hover:bg-purple-500/10 transition-all duration-500"></div>
                   <h3 className="text-2xl font-bold text-white mb-2 relative z-10">Cycle Transmission</h3>
                   <div className="text-purple-400 text-sm font-bold uppercase tracking-wider mb-4 relative z-10">Année 3 • L'Héritage</div>
                   <p className="text-gray-400 leading-relaxed mb-6 relative z-10">
                      Niveau expert réservé aux initiés confirmés. Formation à la pédagogie et à la transmission du savoir pour devenir instructeur.
                   </p>
                   <ul className="space-y-2 text-sm text-gray-300 relative z-10 mb-6">
                      <li className="flex gap-2"><Check className="w-4 h-4 text-purple-400" /> Pédagogie avancée</li>
                      <li className="flex gap-2"><Check className="w-4 h-4 text-purple-400" /> Leadership spirituel</li>
                      <li className="flex gap-2"><Check className="w-4 h-4 text-purple-400" /> Maîtrise totale</li>
                   </ul>
                </motion.div>
             </div>
          </div>

          {/* Separator */}
          <div className="flex justify-center items-center py-8 opacity-30">
             <div className="h-px w-32 bg-gradient-to-r from-transparent via-[var(--school-accent)] to-transparent"></div>
             <span className="mx-6 text-[var(--school-accent)] text-2xl">⸻</span>
             <div className="h-px w-32 bg-gradient-to-r from-transparent via-[var(--school-accent)] to-transparent"></div>
          </div>

          {/* Section 2: Packages */}
          <div className="space-y-8">
             <motion.div variants={itemVariants} className="text-center mb-10">
                <span className="text-4xl block mb-4">📦</span>
                <h2 className="text-3xl md:text-4xl font-serif font-bold text-white">Nos Forfaits</h2>
                <p className="text-gray-400 mt-4 max-w-2xl mx-auto">Choisissez le niveau d'accompagnement qui vous convient.</p>
             </motion.div>

             <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Forfait Modulaire */}
                <motion.div variants={itemVariants} className="bg-[#15202B] rounded-xl p-6 border border-white/5 flex flex-col hover:border-gray-500 transition-colors">
                   <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center mb-4 text-gray-300">
                      <Sparkles className="w-6 h-6" />
                   </div>
                   <h3 className="text-xl font-bold text-white mb-2">Modulaire</h3>
                   <p className="text-gray-400 text-sm mb-6 flex-grow">
                      Accès à la carte. Idéal pour découvrir des sujets spécifiques sans engagement long terme.
                   </p>
                   <div className="mt-auto pt-4 border-t border-white/5">
                      <span className="text-2xl font-bold text-white">Variable</span>
                      <span className="text-gray-500 text-sm"> / module</span>
                   </div>
                </motion.div>

                {/* Forfait Académique */}
                <motion.div variants={itemVariants} className="bg-[#15202B] rounded-xl p-6 border border-white/5 flex flex-col hover:border-blue-500 transition-colors relative">
                   <div className="w-12 h-12 bg-blue-900/30 rounded-lg flex items-center justify-center mb-4 text-blue-400">
                      <GraduationCap className="w-6 h-6" />
                   </div>
                   <h3 className="text-xl font-bold text-white mb-2">Académique</h3>
                   <p className="text-gray-400 text-sm mb-6 flex-grow">
                      Le cursus standard. Accès aux cours hebdomadaires, supports PDF et examens trimestriels.
                   </p>
                   <div className="mt-auto pt-4 border-t border-white/5">
                      <span className="text-2xl font-bold text-white">Standard</span>
                      <span className="text-gray-500 text-sm"> / an</span>
                   </div>
                </motion.div>

                {/* Forfait Privé */}
                <motion.div variants={itemVariants} className="bg-[#15202B] rounded-xl p-6 border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] flex flex-col hover:border-[var(--school-accent)] transition-colors relative shadow-lg shadow-[color-mix(in_srgb,var(--school-accent)_5%,transparent)]">
                   <div className="absolute top-0 right-0 bg-[var(--school-accent)] text-black text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase">Populaire</div>
                   <div className="w-12 h-12 bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] rounded-lg flex items-center justify-center mb-4 text-[var(--school-accent)]">
                      <Star className="w-6 h-6" />
                   </div>
                   <h3 className="text-xl font-bold text-white mb-2">Privé</h3>
                   <p className="text-gray-400 text-sm mb-6 flex-grow">
                      Suivi personnalisé. Inclut des séances de coaching individuel mensuelles et corrections détaillées.
                   </p>
                   <div className="mt-auto pt-4 border-t border-white/5">
                      <span className="text-2xl font-bold text-white">Premium</span>
                      <span className="text-gray-500 text-sm"> / an</span>
                   </div>
                </motion.div>

                {/* Forfait Privilégié */}
                <motion.div variants={itemVariants} className="bg-gradient-to-b from-[#15202B] to-black rounded-xl p-6 border border-purple-500/30 flex flex-col hover:border-purple-500 transition-colors relative">
                   <div className="w-12 h-12 bg-purple-900/30 rounded-lg flex items-center justify-center mb-4 text-purple-400">
                      <Crown className="w-6 h-6" />
                   </div>
                   <h3 className="text-xl font-bold text-white mb-2">Privilégié</h3>
                   <p className="text-gray-400 text-sm mb-6 flex-grow">
                      L'excellence absolue. Mentorat direct, accès prioritaire à tous les événements et retraites.
                   </p>
                   <div className="mt-auto pt-4 border-t border-white/5">
                      <span className="text-2xl font-bold text-white">Élite</span>
                      <span className="text-gray-500 text-sm"> / an</span>
                   </div>
                </motion.div>

             </div>
          </div>

          <motion.div variants={itemVariants} className="flex justify-center pt-8">
             <Link to="/signup">
                <Button className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 text-lg px-10 py-6 rounded-xl font-semibold shadow-lg shadow-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] flex items-center gap-2 group">
                  S'inscrire à une formation
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
             </Link>
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
};

export default FormationsPackagesPage;