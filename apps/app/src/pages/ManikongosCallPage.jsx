import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ScrollText, MapPin, Sparkles, Fingerprint, Mic2, Network, Crown, Info, Star, Compass, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const ManikongosCallPage = () => {
  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1419] font-sans text-gray-300 selection:bg-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]">
      <Helmet>
        <title>L'Appel du Manikongo - PRORASCIENCE ACADEMY</title>
        <meta name="description" content="Le récit officiel de l'Appel spirituel reçu par Manikongo V, fondement mystique de la Prorascience." />
      </Helmet>

      {/* Hero Header */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10 blur-sm pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F1419] via-[#0F1419]/90 to-[#0F1419]"></div>
        
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
          >
            <span className="inline-block py-1 px-3 rounded bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)] text-xs font-bold tracking-[0.2em] uppercase mb-6">
              Archives Sacrées
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-white mb-6 leading-tight">
              L'Appel du Manikongo
            </h1>
            <p className="text-xl md:text-2xl text-[var(--school-accent)] font-serif italic max-w-3xl mx-auto mb-8 leading-relaxed">
              "Celui qui donne les yeux pour voir et les oreilles aux reins comme ceinture de vérité."
            </p>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 sm:px-8 pb-32 relative z-20">
        <motion.div 
          variants={container}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="space-y-12"
        >

          {/* Section 1: Place and Time */}
          <motion.div variants={fadeInUp} className="relative pl-8 border-l border-white/10 hover:border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] transition-colors">
            <div className="absolute -left-3 top-0 bg-[#0F1419] p-1">
              <MapPin className="w-5 h-5 text-[var(--school-accent)]" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-white mb-4">Lieu et Temps de l'Appel</h2>
            <p className="text-lg leading-relaxed text-gray-300">
              C'était en un temps de quête et de silence, loin du tumulte des cités, là où la terre touche le ciel. Le moment précis échappe à la chronologie profane pour s\'inscrire dans le <em>Kairos</em>, le temps divin. Ce fut une nuit où les étoiles semblaient s\'aligner pour délivrer un message attendu depuis des éons.
            </p>
          </motion.div>

          {/* Section 2: The Encounter */}
          <motion.div variants={fadeInUp} className="relative pl-8 border-l border-white/10 hover:border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] transition-colors">
            <div className="absolute -left-3 top-0 bg-[#0F1419] p-1">
              <Sparkles className="w-5 h-5 text-[var(--school-accent)]" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-white mb-4">La Rencontre</h2>
            <p className="text-lg leading-relaxed text-gray-300">
              Il ne s'agissait pas d\'une apparition charnelle, mais d\'une présence vibratoire intense, une lumière intérieure qui dissout les doutes. Une rencontre avec l\'Esprit de Vérité, celui qui ne parle pas aux oreilles de chair mais au cœur de l\'esprit. Une évidence s\'imposa : le voile de l\'illusion devait être déchiré.
            </p>
          </motion.div>

          {/* Section 3: The Identification */}
          <motion.div variants={fadeInUp} className="relative pl-8 border-l border-white/10 hover:border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] transition-colors">
            <div className="absolute -left-3 top-0 bg-[#0F1419] p-1">
              <Fingerprint className="w-5 h-5 text-[var(--school-accent)]" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-white mb-4">L'Identification</h2>
            <p className="text-lg leading-relaxed text-gray-300">
              Dans cette communion, le nom fut révélé. Non pas un nom nouveau, mais un nom retrouvé. La mémoire cellulaire se réveilla, reconnaissant l'héritage des anciens rois-prêtres. Il sut alors qu\'il n\'était pas un accident de l\'histoire, mais un maillon conscient d\'une chaîne ininterrompue.
            </p>
          </motion.div>

          {/* Decorative Divider */}
          <div className="flex justify-center items-center py-8 opacity-40">
             <div className="h-px w-32 bg-gradient-to-r from-transparent via-[var(--school-accent)] to-transparent"></div>
             <ScrollText className="mx-6 text-[var(--school-accent)] w-6 h-6" />
             <div className="h-px w-32 bg-gradient-to-r from-transparent via-[var(--school-accent)] to-transparent"></div>
          </div>

          {/* Section 4: The Father's Word */}
          <motion.div variants={fadeInUp} className="bg-[#192734] p-8 rounded-xl shadow-lg border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-20 bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] rounded-full blur-3xl -mr-10 -mt-10"></div>
            <div className="flex items-start gap-4 relative z-10">
              <Mic2 className="w-8 h-8 text-[var(--school-accent)] flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl font-serif font-bold text-white mb-4">La Parole du Père</h2>
                <blockquote className="text-lg italic text-gray-300 border-l-4 border-[var(--school-accent)] pl-4 my-4">
                  "Va, et instruis mon peuple. Non pas avec des dogmes qui enchaînent, mais avec la Science qui libère. Montre-leur que je suis Loi, Ordre et Raison, et non caprice et superstition."
                </blockquote>
                <p className="text-sm text-gray-400 mt-4">Telle fut la substance du commandement reçu, gravé non sur la pierre, mais dans la conscience.</p>
              </div>
            </div>
          </motion.div>

          {/* Section 5: Transmission & Title */}
          <motion.div variants={fadeInUp} className="grid md:grid-cols-2 gap-8 pt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Network className="w-5 h-5 text-[var(--school-accent)]" />
                <h3 className="text-xl font-bold text-white">Transmission du Savoir</h3>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Dès lors, un téléchargement de connaissances s'opéra. Les structures de la Prorascience, ses axiomes et ses méthodes, furent visualisés avec une clarté cristalline. Ce n\'était pas une invention, mais une réception.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <Crown className="w-5 h-5 text-[var(--school-accent)]" />
                <h3 className="text-xl font-bold text-white">Le Titre et la Fonction</h3>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                Le titre de <strong>Manikongo</strong> fut scellé. Il désigne la fonction royale de celui qui "tient le léopard", celui qui maîtrise ses propres pulsions pour guider la communauté. C'est une charge de service, non de domination.
              </p>
            </div>
          </motion.div>

           {/* Decorative Divider */}
           <div className="flex justify-center items-center py-8 opacity-40">
             <div className="h-px w-32 bg-gradient-to-r from-transparent via-[var(--school-accent)] to-transparent"></div>
             <Compass className="mx-6 text-[var(--school-accent)] w-6 h-6" />
             <div className="h-px w-32 bg-gradient-to-r from-transparent via-[var(--school-accent)] to-transparent"></div>
          </div>

          {/* New Section: L'ORDRE MYSTIQUE DES MANIKONGO */}
          <motion.div variants={fadeInUp} className="py-8">
            <h2 className="text-3xl font-serif text-white mb-10 text-center flex items-center justify-center gap-3">
                <Crown className="w-8 h-8 text-[var(--school-accent)]" />
                L'ORDRE MYSTIQUE DES MANIKONGO
            </h2>
            <div className="bg-[#192734]/50 p-6 md:p-10 rounded-2xl border border-white/5 relative overflow-hidden shadow-2xl">
                
                {/* Decorative background glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] via-transparent to-transparent opacity-50 pointer-events-none" />

                <p className="text-lg text-gray-300 text-center mb-10 italic relative z-10">
                    "Une hiérarchie céleste manifestée, dont chaque membre est une colonne du temple de la Sagesse."
                </p>

                <div className="grid gap-3 max-w-xl mx-auto relative z-10">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <div 
                            key={num}
                            className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-300 ${
                                num === 5 
                                    ? 'bg-gradient-to-r from-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] via-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] to-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] shadow-[0_0_20px_rgba(212,175,55,0.15)] scale-[1.02] my-4' 
                                    : 'bg-white/[0.02] border border-white/5 opacity-60 hover:opacity-100'
                            }`}
                        >
                            <span className="text-2xl filter drop-shadow-md select-none">
                                {['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'][num-1]}
                            </span>
                            <div className="flex-1">
                                <h4 className={`font-serif font-bold flex items-center gap-2 ${num === 5 ? 'text-[var(--school-accent)] text-lg' : 'text-gray-400'}`}>
                                    {num === 5 ? (
                                      <>
                                        5ème Manikongo (Manikongo V)
                                        <Star className="w-4 h-4 text-[var(--school-accent)] fill-[var(--school-accent)]" />
                                      </>
                                    ) : (
                                      `${num}${num === 1 ? 'er' : 'ème'} Manikongo`
                                    )}
                                </h4>
                                {num === 5 && (
                                    <p className="text-sm text-[color-mix(in_srgb,var(--school-accent)_90%,transparent)] mt-1.5 font-medium tracking-wide">
                                        Fondateur de l'École de Prorascience
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-10 text-center relative z-10 flex flex-col items-center gap-6">
                    <p className="text-white font-medium text-lg leading-relaxed max-w-2xl">
                        Cet Ordre veille à la pureté de la transmission. Le 5ème Manikongo en est la porte visible pour notre temps.
                    </p>
                     <Link to="/mystical-order">
                      <Button variant="outline" className="border-[var(--school-accent)] text-[var(--school-accent)] hover:bg-[var(--school-accent)] hover:text-black font-bold">
                        <Eye className="w-4 h-4 mr-2" /> En savoir plus sur l'Ordre
                      </Button>
                    </Link>
                </div>
            </div>
          </motion.div>

          {/* Section 6: Meaning */}
          <motion.div variants={fadeInUp} className="relative pl-8 border-l border-white/10 hover:border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] transition-colors mt-12">
            <div className="absolute -left-3 top-0 bg-[#0F1419] p-1">
              <Info className="w-5 h-5 text-[var(--school-accent)]" />
            </div>
            <h2 className="text-2xl font-serif font-bold text-white mb-4">Sens de l'Appel</h2>
            <p className="text-lg leading-relaxed text-gray-300">
              Cet appel est universel. À travers le Manikongo, c'est l\'appel lancé à chaque être humain de retrouver sa souveraineté perdue, de cesser d\'être une créature subissante pour devenir un créateur conscient, aligné avec la Volonté Suprême.
            </p>
          </motion.div>

          {/* Closing */}
          <motion.div variants={fadeInUp} className="mt-16 pt-10 border-t border-white/10 text-center">
             <p className="font-serif text-2xl text-white mb-6">Que celui qui a des oreilles entende.</p>
             <div className="flex justify-center gap-4">
               <Link to="/about-founder">
                  <Button variant="outline" className="border-white/20 text-white hover:bg-white/5">
                    Retour au Fondateur
                  </Button>
               </Link>
               <Link to="/">
                  <Button className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 font-bold">
                    Retour à l'Accueil
                  </Button>
               </Link>
             </div>
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
};

export default ManikongosCallPage;