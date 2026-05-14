import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle2, FileText, CreditCard, CalendarCheck } from 'lucide-react';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const SCHOOL = isnaTenantConfig.branding.name;
const SITE_NAME = `${SCHOOL} · LIRI`;

const EnrollmentTermsPage = () => {
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
    <div className="min-h-screen bg-[#0F1419] font-sans text-gray-300 selection:bg-[#D4AF37]/30 pb-20">
      <Helmet>
        <title>{`Modalités d'inscription — ${SITE_NAME}`}</title>
        <meta name="description" content={`Conditions d'admission, processus d'inscription et prérequis pour rejoindre ${SCHOOL}.`} />
      </Helmet>

      {/* Hero Section */}
      <section className="relative h-[40vh] min-h-[400px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=2070&auto=format&fit=crop" 
            alt="Inscription" 
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
            <div className="inline-block px-4 py-1.5 mb-6 border border-[#D4AF37]/30 rounded-full bg-[#D4AF37]/10 backdrop-blur-sm">
              <span className="text-[#D4AF37] text-sm font-bold tracking-widest uppercase">Admission</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-serif font-bold text-white mb-6 tracking-tight">
              Modalités d'Inscription
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto font-light">
              Rejoindre l'académie est un engagement envers soi-même et la connaissance.
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
          
          {/* Section 1: Prerequisites */}
          <motion.div variants={itemVariants} className="bg-[#192734] rounded-2xl p-8 md:p-10 shadow-xl border border-white/5 hover:border-[#D4AF37]/20 transition-all duration-300">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-4xl">📋</span>
              <h2 className="text-2xl md:text-3xl font-bold text-white font-serif">1. Prérequis d'Admission</h2>
            </div>
            <div className="space-y-4 text-lg leading-relaxed text-gray-300">
              <p>
                {`Aucun diplôme académique préalable n'est exigé. ${SCHOOL} est ouverte à tous les esprits curieux et déterminés, quelle que soit leur origine ou leur parcours scolaire.`}
              </p>
              <ul className="space-y-2 mt-4 text-base">
                 <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-1 shrink-0" />
                    <span>Être âgé de 18 ans révolus (ou autorisation parentale).</span>
                 </li>
                 <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-1 shrink-0" />
                    <span>Maîtrise suffisante de la langue française (écrit et oral).</span>
                 </li>
                 <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-1 shrink-0" />
                    <span>Disposer d'une connexion internet stable et d'un ordinateur/tablette.</span>
                 </li>
              </ul>
            </div>
          </motion.div>

          {/* Separator */}
          <div className="flex justify-center items-center py-2 opacity-30">
             <div className="h-px w-24 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent"></div>
             <span className="mx-4 text-[#D4AF37] text-xl">⸻</span>
             <div className="h-px w-24 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent"></div>
          </div>

          {/* Section 2: Registration Process */}
          <motion.div variants={itemVariants} className="bg-[#192734] rounded-2xl p-8 md:p-10 shadow-xl border border-white/5 hover:border-[#D4AF37]/20 transition-all duration-300">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-4xl">📝</span>
              <h2 className="text-2xl md:text-3xl font-bold text-white font-serif">2. Procédure d'Inscription</h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 mt-6">
                <div className="bg-black/20 p-6 rounded-xl border border-white/5 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-16 bg-[#D4AF37]/5 rounded-full -mr-8 -mt-8 group-hover:bg-[#D4AF37]/10 transition-colors"></div>
                   <div className="relative z-10">
                      <div className="w-8 h-8 rounded-full bg-[#D4AF37] text-black font-bold flex items-center justify-center mb-4">1</div>
                      <h3 className="font-bold text-white mb-2">Création de Compte</h3>
                      <p className="text-sm text-gray-400">Remplissez le formulaire en ligne avec vos informations personnelles véridiques via la page "S'inscrire".</p>
                   </div>
                </div>

                <div className="bg-black/20 p-6 rounded-xl border border-white/5 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-16 bg-[#D4AF37]/5 rounded-full -mr-8 -mt-8 group-hover:bg-[#D4AF37]/10 transition-colors"></div>
                   <div className="relative z-10">
                      <div className="w-8 h-8 rounded-full bg-[#D4AF37] text-black font-bold flex items-center justify-center mb-4">2</div>
                      <h3 className="font-bold text-white mb-2">Choix du Forfait</h3>
                      <p className="text-sm text-gray-400">Sélectionnez le module ou le cycle complet correspondant à vos objectifs d'apprentissage.</p>
                   </div>
                </div>

                <div className="bg-black/20 p-6 rounded-xl border border-white/5 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-16 bg-[#D4AF37]/5 rounded-full -mr-8 -mt-8 group-hover:bg-[#D4AF37]/10 transition-colors"></div>
                   <div className="relative z-10">
                      <div className="w-8 h-8 rounded-full bg-[#D4AF37] text-black font-bold flex items-center justify-center mb-4">3</div>
                      <h3 className="font-bold text-white mb-2">Paiement Sécurisé</h3>
                      <p className="text-sm text-gray-400">Réglez les frais d'inscription via nos moyens de paiement sécurisés (Carte Bancaire, Virement).</p>
                   </div>
                </div>

                <div className="bg-black/20 p-6 rounded-xl border border-white/5 relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-16 bg-[#D4AF37]/5 rounded-full -mr-8 -mt-8 group-hover:bg-[#D4AF37]/10 transition-colors"></div>
                   <div className="relative z-10">
                      <div className="w-8 h-8 rounded-full bg-[#D4AF37] text-black font-bold flex items-center justify-center mb-4">4</div>
                      <h3 className="font-bold text-white mb-2">Validation</h3>
                      <p className="text-sm text-gray-400">Après vérification, vous recevrez vos accès complets à la plateforme étudiant sous 24h.</p>
                   </div>
                </div>
            </div>
          </motion.div>

          {/* Separator */}
          <div className="flex justify-center items-center py-2 opacity-30">
             <div className="h-px w-24 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent"></div>
             <span className="mx-4 text-[#D4AF37] text-xl">⸻</span>
             <div className="h-px w-24 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent"></div>
          </div>

          {/* Section 3: Administrative Info */}
          <motion.div variants={itemVariants} className="bg-[#192734] rounded-2xl p-8 md:p-10 shadow-xl border border-white/5 hover:border-[#D4AF37]/20 transition-all duration-300">
             <div className="flex items-center gap-4 mb-6">
              <span className="text-4xl">💼</span>
              <h2 className="text-2xl md:text-3xl font-bold text-white font-serif">3. Documents à Fournir</h2>
            </div>
            <div className="bg-black/20 border border-white/5 rounded-xl p-6">
               <ul className="space-y-3 text-gray-300">
                  <li className="flex items-center gap-3">
                     <FileText className="w-5 h-5 text-[#D4AF37]" /> Copie d'une pièce d'identité valide (CNI ou Passeport).
                  </li>
                  <li className="flex items-center gap-3">
                     <FileText className="w-5 h-5 text-[#D4AF37]" /> Justificatif de domicile de moins de 3 mois.
                  </li>
                  <li className="flex items-center gap-3">
                     <FileText className="w-5 h-5 text-[#D4AF37]" /> Photo d'identité numérique récente.
                  </li>
               </ul>
            </div>
            <p className="mt-4 text-sm text-gray-500 italic text-center">
               Ces documents sont requis pour la validation finale de votre dossier étudiant.
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
             <Link to="/signup">
                <Button className="w-full sm:w-auto bg-[#D4AF37] text-black hover:bg-yellow-500 text-lg px-8 py-6 rounded-xl font-semibold">
                  S'inscrire maintenant
                </Button>
             </Link>
             <Link to="/">
                <Button variant="outline" className="w-full sm:w-auto border-white/20 text-white hover:bg-white/10 text-lg px-8 py-6 rounded-xl">
                  Retour à l'accueil
                </Button>
             </Link>
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
};

export default EnrollmentTermsPage;