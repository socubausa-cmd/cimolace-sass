import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Building2, Calendar, Users, Scale, Clock, MessageSquare } from 'lucide-react';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const SCHOOL = isnaTenantConfig.branding.name;
const SITE_NAME = `${SCHOOL} · LIRI`;

const SchoolFunctioningPage = () => {
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

  return (
    <div className="min-h-screen bg-[#0F1419] font-sans text-gray-300 selection:bg-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] pb-20">
      <Helmet>
        <title>{`Fonctionnement de l'école — ${SITE_NAME}`}</title>
        <meta name="description" content={`Découvrez le fonctionnement institutionnel, les horaires et l'organisation de ${SCHOOL}.`} />
      </Helmet>

      {/* Hero Section */}
      <section className="relative h-[40vh] min-h-[400px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1544531586-fde5298cdd40?q=80&w=2070&auto=format&fit=crop" 
            alt="School Building" 
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
              <span className="text-[var(--school-accent)] text-sm font-bold tracking-widest uppercase">Institutionnel</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-serif font-bold text-white mb-6 tracking-tight">
              Fonctionnement de l'École
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto font-light">
              Règles, rythmes et organisation de la vie académique.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 sm:px-8 lg:px-12 -mt-10 relative z-20">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="space-y-12"
        >
          
          {/* Section 1: Philosophy */}
          <motion.div variants={itemVariants} className="bg-[#192734] rounded-2xl p-8 md:p-10 shadow-xl border border-white/5 hover:border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] transition-all duration-300">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-4xl">🏛️</span>
              <h2 className="text-2xl md:text-3xl font-bold text-white font-serif">1. Philosophie Institutionnelle</h2>
            </div>
            <div className="space-y-4 text-lg leading-relaxed text-gray-300">
              <p>
                {`${SCHOOL} fonctionne sur un modèle hybride alliant la rigueur universitaire et la discipline des écoles initiatiques traditionnelles. L'autonomie, la ponctualité et le respect de la hiérarchie du savoir sont les piliers de notre fonctionnement quotidien.`}
              </p>
            </div>
          </motion.div>

          {/* Separator */}
          <div className="flex justify-center items-center py-2 opacity-30">
             <div className="h-px w-24 bg-gradient-to-r from-transparent via-[var(--school-accent)] to-transparent"></div>
             <span className="mx-4 text-[var(--school-accent)] text-xl">⸻</span>
             <div className="h-px w-24 bg-gradient-to-r from-transparent via-[var(--school-accent)] to-transparent"></div>
          </div>

          {/* Section 2: Calendar & Rhythm */}
          <motion.div variants={itemVariants} className="bg-[#192734] rounded-2xl p-8 md:p-10 shadow-xl border border-white/5 hover:border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] transition-all duration-300">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-4xl">📅</span>
              <h2 className="text-2xl md:text-3xl font-bold text-white font-serif">2. Rythme Scolaire</h2>
            </div>
            <div className="space-y-6 text-gray-300">
              <div className="flex flex-col md:flex-row gap-6">
                 <div className="flex-1 bg-black/20 p-4 rounded-xl border border-white/5">
                    <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                       <Clock className="w-4 h-4 text-[var(--school-accent)]" /> Session Hebdomadaire
                    </h3>
                    <p className="text-sm">Les cours magistraux sont dispensés chaque semaine via notre plateforme virtuelle. Des sessions de questions/réponses en direct sont organisées le week-end.</p>
                 </div>
                 <div className="flex-1 bg-black/20 p-4 rounded-xl border border-white/5">
                    <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                       <Calendar className="w-4 h-4 text-[var(--school-accent)]" /> Année Académique
                    </h3>
                    <p className="text-sm">L'année est divisée en 3 trimestres, ponctués par des évaluations continues et un examen final obligatoire pour le passage au cycle supérieur.</p>
                 </div>
              </div>
            </div>
          </motion.div>

          {/* Separator */}
          <div className="flex justify-center items-center py-2 opacity-30">
             <div className="h-px w-24 bg-gradient-to-r from-transparent via-[var(--school-accent)] to-transparent"></div>
             <span className="mx-4 text-[var(--school-accent)] text-xl">⸻</span>
             <div className="h-px w-24 bg-gradient-to-r from-transparent via-[var(--school-accent)] to-transparent"></div>
          </div>

          {/* Section 3: Student Life */}
          <motion.div variants={itemVariants} className="bg-[#192734] rounded-2xl p-8 md:p-10 shadow-xl border border-white/5 hover:border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] transition-all duration-300">
             <div className="flex items-center gap-4 mb-6">
              <span className="text-4xl">🎓</span>
              <h2 className="text-2xl md:text-3xl font-bold text-white font-serif">3. Vie de l'Étudiant</h2>
            </div>
            <ul className="space-y-4 text-lg leading-relaxed text-gray-300 list-none pl-2">
              <li className="flex gap-3">
                 <span className="text-[var(--school-accent)]">✦</span>
                 <span><strong>Plateforme Numérique :</strong> Chaque élève dispose d'un espace personnel pour accéder aux cours, rendre ses devoirs et suivre sa progression.</span>
              </li>
              <li className="flex gap-3">
                 <span className="text-[var(--school-accent)]">✦</span>
                 <span><strong>Bibliothèque :</strong> Accès illimité aux ressources documentaires, archives vidéo et lexiques spécialisés.</span>
              </li>
              <li className="flex gap-3">
                 <span className="text-[var(--school-accent)]">✦</span>
                 <span><strong>Communauté :</strong> Participation aux forums de discussion surveillés par les instructeurs pour approfondir les thématiques.</span>
              </li>
            </ul>
          </motion.div>

           {/* Section 4: Rules */}
           <motion.div variants={itemVariants} className="bg-gradient-to-br from-red-900/10 to-[#192734] rounded-2xl p-8 md:p-10 shadow-xl border border-red-500/10 hover:border-red-500/30 transition-all duration-300">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-4xl">⚖️</span>
              <h2 className="text-2xl md:text-3xl font-bold text-white font-serif">4. Règlement Intérieur</h2>
            </div>
            <p className="text-lg leading-relaxed text-gray-300 mb-4">
              {`${SCHOOL} exige une conduite irréprochable. Le respect mutuel, l'intégrité intellectuelle et la discrétion sont des valeurs non négociables.`}
            </p>
            <div className="bg-black/40 p-4 rounded-lg border border-white/5 text-sm text-gray-400 italic">
               "Tout manquement grave à l'éthique ou divulgation de contenus réservés entraînera une exclusion immédiate et définitive."
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="flex justify-center pt-8">
             <Link to="/">
                <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 px-8 py-6 rounded-xl">
                  Retour à l'accueil
                </Button>
             </Link>
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
};

export default SchoolFunctioningPage;