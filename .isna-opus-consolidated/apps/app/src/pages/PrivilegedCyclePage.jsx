import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Crown, CheckCircle2, Lock, Sparkles, ShieldCheck, Sword, Scroll, Mail, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PaymentOptionCard from '@/components/PaymentOptionCard';
import ComparisonTable from '@/components/ComparisonTable';

const FAQItem = ({ question, answer, isOpen, toggle }) => (
  <div className="border border-purple-500/20 rounded-xl overflow-hidden bg-[#151320]">
    <button 
      onClick={toggle}
      className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-purple-500/5 transition-colors"
    >
      <span className="font-bold text-white text-lg">{question}</span>
      {isOpen ? <ChevronUp className="text-purple-400" /> : <ChevronDown className="text-gray-400" />}
    </button>
    {isOpen && (
      <div className="px-6 py-4 text-gray-300 text-base leading-relaxed border-t border-purple-500/10 bg-black/40">
        {answer}
      </div>
    )}
  </div>
);

const PrivilegedCyclePage = () => {
  const [openFAQ, setOpenFAQ] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const toggleFAQ = (index) => setOpenFAQ(openFAQ === index ? null : index);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 50 } }
  };

  const comparisonData = [
    { label: "Formation", col1: "2000€", col2: "3000€ (750€/trim)", col3: "3336€ (278€/mois)" },
    { label: "Total (+100€ config)", col1: "2100€", col2: "3100€", col3: "3436€" },
    { label: "Économie", col1: "1336€", col2: "336€", col3: "0€" },
    { label: "Mentorat", col1: "Illimité", col2: "Illimité", col3: "Illimité" },
    { label: "Accès Temple", col1: "VIP", col2: "VIP", col3: "VIP" },
  ];

  const faqs = [
    { q: "À qui s'adresse ce cycle d'élite ?", a: "Ce cycle est réservé aux âmes prêtes à s'engager totalement dans la voie initiatique, futurs instructeurs ou leaders spirituels." },
    { q: "Comment postuler ?", a: "L'inscription se fait uniquement sur dossier. Vous devez nous envoyer une lettre de motivation spirituelle qui sera analysée vibratoirement par le Grand Maître." },
    { q: "Qu'est-ce que le Temple NGOWAZULU ?", a: "C'est notre espace sacré (virtuel et physique lors des retraites) réservé aux hautes initiations, où se déroulent les rituels les plus puissants." },
    { q: "Aurai-je un contact direct avec le Grand Maître ?", a: "Oui, le cycle privilégié inclut des moments d'échange direct et de mentorat avec le fondateur ou ses plus proches disciples." },
    { q: "Quelle est la durée de l'engagement ?", a: "Le cycle dure 12 mois intensifs, mais le statut d'initié privilégié vous confère un accès à vie à la communauté du cercle intérieur." },
    { q: "Quelles sont les facilités de paiement ?", a: "Malgré le caractère exclusif, nous maintenons les options mensuelles et trimestrielles pour permettre aux plus méritants de nous rejoindre." }
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0F] font-sans text-gray-300 selection:bg-purple-500/30 pb-20">
      <Helmet>
        <title>Cycle Privilégié - ISNA Fondation Manikongo</title>
        <meta name="description" content="Cycle Privilégié : L'élite spirituelle. Transmission directe, rituels sacrés et mentorat sacerdotal." />
      </Helmet>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a1025] via-[#0A0A0F] to-[#0A0A0F] z-0" />
        <div className="absolute top-0 right-0 p-64 bg-purple-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        
        <div className="max-w-5xl mx-auto relative z-10 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 px-5 py-2 mb-8 border border-purple-500/30 rounded-full bg-purple-500/10 backdrop-blur-md shadow-[0_0_15px_rgba(168,85,247,0.3)]">
              <Crown className="w-5 h-5 text-purple-400" />
              <span className="text-purple-300 text-sm font-bold tracking-widest uppercase">Cercle Intérieur</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-serif font-bold text-white mb-6 tracking-tight">
              Cycle Privilégié<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-300 to-purple-400 text-2xl md:text-4xl block mt-4 font-sans font-light">
                ISNA Fondation Manikongo
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-purple-100/80 max-w-3xl mx-auto font-light leading-relaxed mb-8">
              L'élite spirituelle. Transmission directe.
            </p>
            <div className="inline-block bg-red-900/30 border border-red-500/30 px-6 py-2 rounded-lg">
                <p className="text-red-300 text-sm font-semibold flex items-center gap-2">
                    <Lock className="w-4 h-4" /> Sur dossier vibratoire uniquement
                </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 relative z-20 space-y-24">
        
        {/* Description & Advantages */}
        <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid md:grid-cols-2 gap-16 items-center">
          <motion.div variants={itemVariants}>
            <h2 className="text-4xl font-serif font-bold text-white mb-8">L'Héritage Sacré</h2>
            <div className="text-lg text-gray-300 space-y-6 leading-relaxed">
              <p>
                Le <strong className="text-purple-400">Cycle Privilégié</strong> n'est pas une simple formation, c'est une initiation. Il est conçu pour ceux qui sentent l'appel du sacerdoce ou qui aspirent à une maîtrise totale des arts métaphysiques.
              </p>
              <p>
                Ici, le savoir ne se contente pas d'être appris, il est transmis de maître à disciple. Vous accédez aux arcanes secrets de la Fondation Manikongo, protégés du grand public.
              </p>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-gradient-to-br from-[#151320] to-black rounded-3xl p-8 border border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.15)] relative overflow-hidden">
            <div className="absolute top-0 right-0 p-32 bg-purple-600/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                <Sparkles className="text-purple-400" /> Privilèges Initiatiques
            </h3>
            <div className="grid sm:grid-cols-2 gap-6 relative z-10">
               {[
                 { icon: Scroll, text: "Mentorat Sacerdotal" },
                 { icon: ShieldCheck, text: "Coaching situationnel" },
                 { icon: Crown, text: "Accès Temple NGOWAZULU" },
                 { icon: Sparkles, text: "Rituels Sacrés" },
                 { icon: Lock, text: "Héritage Spirituel" },
                 { icon: Sword, text: "Protection Mystique" }
               ].map((item, i) => (
                 <div key={i} className="flex items-center gap-3 text-purple-100/90 font-medium">
                    <item.icon className="w-5 h-5 text-purple-500" />
                    <span>{item.text}</span>
                 </div>
               ))}
            </div>
          </motion.div>
        </motion.div>

        {/* Configuration Fees */}
        <div className="bg-[#151320] border border-purple-500/30 rounded-2xl p-10 text-center max-w-4xl mx-auto shadow-lg relative overflow-hidden group">
          <div className="absolute inset-0 bg-purple-500/5 group-hover:bg-purple-500/10 transition-colors"></div>
          <div className="relative z-10">
            <h3 className="text-2xl font-bold text-white mb-2">Frais de Configuration Spirituelle</h3>
            <p className="text-purple-400 text-5xl font-bold mb-4 my-6">100€</p>
            <p className="text-gray-400 max-w-2xl mx-auto mb-6">
               Ouverture du dossier vibratoire haute fréquence. Indispensable pour l'accès au Temple virtuel.
            </p>
            <div className="inline-block px-4 py-1 rounded border border-purple-500/30 bg-purple-500/10 text-xs text-purple-300 uppercase tracking-widest">
                Obligatoire
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="space-y-12">
          <h2 className="text-4xl font-serif font-bold text-white text-center">Investissement Sacré</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <PaymentOptionCard 
              optionNumber="1"
              title="Intégral"
              price={2000}
              total={2100}
              savings="Économie : 1336€"
              features={["Formation : 2000€", "Frais config : 100€", "Statut VIP immédiat", "Accès à vie"]}
              isRecommended={true}
              paymentPlanId="integral_privileged"
            />
            <PaymentOptionCard 
              optionNumber="2"
              title="Trimestriel"
              price={750}
              frequency="/ trimestre"
              total={3100}
              savings="Économie : 336€"
              features={["4 x 750€", "Frais config : 100€", "Total : 3100€", "Engagement annuel"]}
              paymentPlanId="quarterly_privileged"
            />
            <PaymentOptionCard 
              optionNumber="3"
              title="Mensuel"
              price={278}
              frequency="/ mois"
              total={3436}
              features={["12 x 278€", "Frais config : 100€", "Total : 3436€", "Souplesse maximale"]}
              paymentPlanId="monthly_privileged"
            />
          </div>
        </div>

        {/* Comparison Table */}
        <div className="max-w-5xl mx-auto">
           <h3 className="text-2xl font-bold text-white mb-8 text-center">Tableau Comparatif</h3>
           <ComparisonTable data={comparisonData} />
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto">
           <h2 className="text-3xl font-serif font-bold text-white mb-8 text-center">Questions Initiatiques</h2>
           <div className="space-y-4">
             {faqs.map((faq, index) => (
               <FAQItem key={index} question={faq.q} answer={faq.a} isOpen={openFAQ === index} toggle={() => toggleFAQ(index)} />
             ))}
           </div>
        </div>

        {/* Next Steps */}
        <div className="bg-[#151320] rounded-3xl p-10 border border-purple-500/20">
          <h2 className="text-3xl font-serif font-bold text-white mb-12 text-center">La Marche à Suivre</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[
              "Candidature", "Analyse", "Entretien", "Validation", "Paiement", "Initiation", "Accès"
            ].map((step, i) => (
              <div key={i} className="text-center group">
                <div className="w-10 h-10 rounded-full bg-purple-900/30 border border-purple-500/30 flex items-center justify-center mx-auto mb-3 text-purple-400 font-bold group-hover:bg-purple-500 group-hover:text-white transition-colors">
                    {i + 1}
                </div>
                <p className="text-xs md:text-sm text-gray-400 group-hover:text-purple-300 transition-colors font-medium">{step}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="text-center pb-12 border-t border-white/5 pt-12">
          <h2 className="text-2xl font-bold text-white mb-6">Prêt pour l'ascension ?</h2>
          <Button className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-6 rounded-xl text-lg shadow-[0_0_20px_rgba(147,51,234,0.3)]">
             <Mail className="w-5 h-5 mr-2" /> Envoyer ma candidature
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PrivilegedCyclePage;