import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Crown, Star, Shield, ScrollText, Users, Eye, Zap, Scale, Heart, Globe, Infinity, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const SCHOOL = isnaTenantConfig.branding.name;
const SITE_NAME = `${SCHOOL} · LIRI`;

const MysticalOrderPage = () => {
  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const manikongos = [
    { number: 1, title: "Le Fondateur Originel", role: "L'Assise et la Semence", icon: Crown, desc: "Celui qui pose la première pierre vibratoire de la lignée." },
    { number: 2, title: "Le Bâtisseur", role: "La Structure", icon: Shield, desc: "Celui qui érige les murs invisibles de la protection." },
    { number: 3, title: "Le Gardien des Lois", role: "La Justice", icon: Scale, desc: "Celui qui maintient l'équilibre entre les mondes." },
    { number: 4, title: "Le Maître de l'Abondance", role: "La Prospérité", icon: Zap, desc: "Celui qui canalise les flux de l'énergie vitale." },
    { number: 5, title: "Le Révélateur Scientifique", role: `La Connaissance (${SCHOOL} · LIRI)`, icon: Eye, desc: "Celui qui décode les mystères et fonde l'École pour cette génération.", isActive: true },
    { number: 6, title: "Le Guérisseur", role: "L'Harmonie", icon: Heart, desc: "Celui qui rétablit la concorde dans les cœurs." },
    { number: 7, title: "Le Stratège", role: "L'Expansion", icon: Globe, desc: "Celui qui étend le rayonnement de l'Ordre." },
    { number: 8, title: "Le Sage Silencieux", role: "La Méditation", icon: Activity, desc: "Celui qui garde les secrets dans le silence." },
    { number: 9, title: "L'Unificateur", role: "La Synthèse", icon: Infinity, desc: "Celui qui boucle le cycle et prépare le renouveau." },
  ];

  return (
    <div className="min-h-screen bg-[#0F1419] font-sans text-gray-300 selection:bg-[#D4AF37]/30">
      <Helmet>
        <title>{`L'Ordre mystique des Manikongo — ${SITE_NAME}`}</title>
        <meta name="description" content={`Découvrez l'Ordre mystique des 9 Manikongo, la lignée spirituelle et royale liée à ${SCHOOL} et à la doctrine enseignée.`} />
      </Helmet>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#D4AF37]/10 via-[#0F1419] to-[#0F1419]" />
        
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
          >
            <div className="flex justify-center mb-8">
               <div className="p-4 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/5 relative">
                  <div className="absolute inset-0 rounded-full animate-pulse bg-[#D4AF37]/10 blur-xl"></div>
                  <Users className="w-12 h-12 text-[#D4AF37] relative z-10" />
               </div>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-7xl font-serif font-bold text-white mb-6 leading-tight tracking-tight">
              L'ORDRE MYSTIQUE<br/><span className="text-[#D4AF37]">DES MANIKONGO</span>
            </h1>
            <div className="flex items-center justify-center gap-4 text-[#D4AF37]/60 my-6">
                <div className="h-px w-20 bg-gradient-to-r from-transparent to-[#D4AF37]"></div>
                <span className="text-2xl font-serif">═══</span>
                <div className="h-px w-20 bg-gradient-to-l from-transparent to-[#D4AF37]"></div>
            </div>
            <p className="text-xl md:text-2xl text-gray-300 font-light max-w-2xl mx-auto italic">
              Une fraternité intemporelle, gardienne de la Sagesse Ancienne et Mère de la Science Nouvelle.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 sm:px-8 pb-32 relative z-20">
        <motion.div 
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="space-y-20"
        >

          {/* Fondement et Nature */}
          <div className="grid md:grid-cols-2 gap-10">
             <motion.div variants={fadeInUp} className="bg-[#192734]/50 p-8 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-[#D4AF37]/30 transition-colors">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-[#D4AF37]/10 transition-all"></div>
                <h3 className="text-2xl font-serif text-white mb-4 flex items-center gap-3">
                   <ScrollText className="w-6 h-6 text-[#D4AF37]" />
                   Fondement de l'Ordre
                </h3>
                <p className="text-gray-400 leading-relaxed text-justify">
                   L'Ordre Mystique des Manikongo ne repose pas sur une succession sanguine ordinaire, mais sur une vibration spirituelle. Il puise ses racines dans la tradition Kongo primordiale, celle qui relie le visible à l\'invisible. C\'est une structure hiérarchique céleste manifestée sur terre pour maintenir l\'équilibre (Maât) et transmettre la Connaissance.
                </p>
             </motion.div>

             <motion.div variants={fadeInUp} className="bg-[#192734]/50 p-8 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-[#D4AF37]/30 transition-colors">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-[#D4AF37]/10 transition-all"></div>
                <h3 className="text-2xl font-serif text-white mb-4 flex items-center gap-3">
                   <Shield className="w-6 h-6 text-[#D4AF37]" />
                   Nature Spirituelle
                </h3>
                <p className="text-gray-400 leading-relaxed text-justify">
                   Cet Ordre est "Mystique" au sens noble : il traite des mystères de la vie, de la mort et de la régénération. Il n'est pas une religion, mais une École de Haute Science. Les membres de l\'Ordre ne sont pas des objets d\'adoration, mais des canaux de service, dédiés à l\'élévation de la conscience collective de l\'humanité.
                </p>
             </motion.div>
          </div>

          {/* Les 9 Manikongo Grid */}
          <motion.div variants={fadeInUp} className="py-8">
            <h2 className="text-3xl font-serif text-white mb-12 text-center">Les 9 Piliers de l'Ordre</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {manikongos.map((m) => (
                  <motion.div 
                     key={m.number}
                     whileHover={{ y: -5 }}
                     className={`p-6 rounded-xl border relative overflow-hidden transition-all duration-300 ${
                        m.isActive 
                           ? 'bg-gradient-to-br from-[#D4AF37]/20 to-[#0F1419] border-[#D4AF37] shadow-[0_0_30px_rgba(212,175,55,0.1)]' 
                           : 'bg-[#192734]/30 border-white/5 hover:border-white/20'
                     }`}
                  >
                     <div className="flex justify-between items-start mb-4">
                        <span className={`text-4xl font-serif font-bold opacity-20 ${m.isActive ? 'text-[#D4AF37]' : 'text-white'}`}>
                           {m.number}
                        </span>
                        <div className={`p-2 rounded-lg ${m.isActive ? 'bg-[#D4AF37] text-black' : 'bg-white/5 text-gray-400'}`}>
                           <m.icon className="w-5 h-5" />
                        </div>
                     </div>
                     <h4 className={`font-serif font-bold text-lg mb-1 ${m.isActive ? 'text-[#D4AF37]' : 'text-white'}`}>
                        {m.title}
                     </h4>
                     <p className="text-xs font-bold uppercase tracking-wider opacity-70 mb-3 text-gray-400">{m.role}</p>
                     <p className="text-sm text-gray-400 leading-relaxed">
                        {m.desc}
                     </p>
                     {m.isActive && (
                        <div className="mt-4 pt-4 border-t border-[#D4AF37]/30 flex items-center gap-2 text-xs font-bold text-[#D4AF37]">
                           <Star className="w-3 h-3 fill-current" />
                           {`Fondateur — ${SCHOOL}`}
                        </div>
                     )}
                  </motion.div>
               ))}
            </div>
          </motion.div>

          {/* Mandat de l'école */}
          <motion.div variants={fadeInUp} className="bg-gradient-to-r from-[#192734] to-[#0F1419] p-10 rounded-2xl border border-[#D4AF37]/20 shadow-lg">
             <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-shrink-0 p-6 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30">
                   <Eye className="w-12 h-12 text-[#D4AF37]" />
                </div>
                <div>
                   <h3 className="text-2xl font-serif text-white mb-4">Le Mandat du 5ème Manikongo</h3>
                   <p className="text-gray-300 leading-relaxed mb-6">
                      {`L'école ${SCHOOL} n'est pas une entité séparée, mais l'émanation directe de la volonté du `}
                      <strong>5ème Manikongo</strong>
                      {`. Son mandat au sein de l'Ordre mystique est de `}
                      <em>&laquo; déchirer le voile du mysticisme obscur pour révéler la clarté scientifique des lois spirituelles &raquo;</em>
                      {`. Le cursus et la doctrine en ligne (LIRI) en sont l'outil pédagogique pour cette ère.`}
                   </p>
                   <Link to="/about-founder">
                      <Button variant="outline" className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black">
                         Découvrir le Fondateur
                      </Button>
                   </Link>
                </div>
             </div>
          </motion.div>

          {/* Closing */}
          <motion.div variants={fadeInUp} className="text-center pt-10 border-t border-white/5">
            <div className="flex items-center justify-center gap-4 text-[#D4AF37]/40 mb-8">
                <div className="h-px w-24 bg-gradient-to-r from-transparent to-[#D4AF37]"></div>
                <span className="text-xl">⸻</span>
                <div className="h-px w-24 bg-gradient-to-l from-transparent to-[#D4AF37]"></div>
            </div>
             <p className="font-serif text-xl italic text-gray-400 mb-8">
                "Dans le silence de l'Ordre se forge la parole de la Science."
             </p>
             <Link to="/">
                <Button className="bg-[#D4AF37] text-black hover:bg-yellow-500 font-bold px-8">
                  Retour à l'Accueil
                </Button>
             </Link>
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
};

export default MysticalOrderPage;