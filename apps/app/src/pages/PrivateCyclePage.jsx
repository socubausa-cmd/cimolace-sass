import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { CheckCircle2, Star, Shield, HelpCircle, Mail, MessageCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PaymentOptionCard from '@/components/PaymentOptionCard';
import ComparisonTable from '@/components/ComparisonTable';
import { useVitrineContactEmail } from '@/contexts/VitrineContactEmailContext';

const FAQItem = ({ question, answer, isOpen, toggle }) => (
  <div className="border border-white/10 rounded-xl overflow-hidden bg-[#192734]">
    <button 
      onClick={toggle}
      className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
    >
      <span className="font-bold text-white text-lg">{question}</span>
      {isOpen ? <ChevronUp className="text-[#D4AF37]" /> : <ChevronDown className="text-gray-400" />}
    </button>
    {isOpen && (
      <div className="px-6 py-4 text-gray-300 text-base leading-relaxed border-t border-white/5 bg-black/20">
        {answer}
      </div>
    )}
  </div>
);

const PrivateCyclePage = () => {
  const vitrineEmail = useVitrineContactEmail();
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
    { label: "Formation", col1: "1600€", col2: "2400€ (600€/trim)", col3: "2664€ (222€/mois)" },
    { label: "Configuration", col1: "100€", col2: "100€", col3: "100€" },
    { label: "Total", col1: "1700€", col2: "2500€", col3: "2764€" },
    { label: "Économie", col1: "1064€", col2: "264€", col3: "0€" },
    { label: "Durée", col1: "12 Mois", col2: "12 Mois", col3: "12 Mois" },
    { label: "Flexibilité", col1: "Faible", col2: "Moyenne", col3: "Élevée" },
    { label: "Coaching", col1: "Inclus", col2: "Inclus", col3: "Inclus" },
  ];

  const faqs = [
    { q: "Quelle est la différence majeure avec le cycle académique ?", a: "La différence fondamentale réside dans l'accompagnement. En cycle privé, vous bénéficiez de séances de questions/réponses privilégiées et d'un suivi plus étroit de votre évolution personnelle par les instructeurs." },
    { q: "Puis-je payer en plusieurs fois ?", a: "Oui, nous proposons des formules trimestrielles et mensuelles pour étaler votre investissement sur l'année." },
    { q: "À quoi servent les frais de configuration de 100€ ?", a: "Ces frais uniques couvrent l'ouverture administrative de votre dossier, la préparation de vos accès sécurisés et l'alignement énergétique nécessaire à votre entrée dans le cercle privé." },
    { q: "Le diplôme est-il différent ?", a: "Oui, la certification finale mentionne le grade 'Cycle Privé', attestant d'un niveau de maîtrise et d'un suivi supérieur." },
    { q: "Comment se déroule le coaching ?", a: "Les sessions de coaching se déroulent en visioconférence (Zoom/Skype) selon un calendrier défini à l'avance, permettant un échange direct et confidentiel." },
    { q: "Quelle est la politique de remboursement ?", a: "Conformément à nos CGV, toute période commencée est due. Cependant, en cas de force majeure justifiée, un report peut être envisagé." }
  ];

  return (
    <div className="min-h-screen bg-[#0F1419] font-sans text-gray-300 selection:bg-[#D4AF37]/30 pb-20">
      <Helmet>
        <title>Cycle Privé - ISNA Fondation Manikongo</title>
        <meta name="description" content="Cycle Privé : Un accompagnement spirituel personnalisé pour une transformation profonde." />
      </Helmet>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#192734] via-[#0F1419] to-[#0F1419] z-0" />
        <div className="max-w-5xl mx-auto relative z-10 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 border border-[#D4AF37]/30 rounded-full bg-[#D4AF37]/10 backdrop-blur-sm">
              <Star className="w-4 h-4 text-[#D4AF37]" />
              <span className="text-[#D4AF37] text-sm font-bold tracking-widest uppercase">Formation Premium</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-serif font-bold text-white mb-6">Cycle Privé<br/><span className="text-[#D4AF37] text-2xl md:text-4xl block mt-2 font-sans font-light">ISNA Fondation Manikongo</span></h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto font-light leading-relaxed">
              L'accompagnement individuel pour une transformation profonde et durable.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 relative z-20 space-y-24">
        
        {/* Description */}
        <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid md:grid-cols-2 gap-12">
          <motion.div variants={itemVariants}>
            <h2 className="text-3xl font-serif font-bold text-white mb-6">L'Expérience Privée</h2>
            <p className="text-lg text-gray-300 leading-relaxed mb-4">
              Ce cycle est destiné aux étudiants désirant un suivi personnalisé. Contrairement au cycle académique standard, le Cycle Privé vous ouvre les portes d'une interaction plus directe avec l\'enseignement.
            </p>
            <p className="text-lg text-gray-300 leading-relaxed">
              Vous ne serez pas un simple numéro. Votre parcours, vos blocages et vos aspirations seront pris en compte pour adapter la pédagogie à votre rythme vibratoire personnel.
            </p>
          </motion.div>
          
          <motion.div variants={itemVariants} className="bg-[#192734] rounded-2xl p-8 border border-[#D4AF37]/20 shadow-lg shadow-[#D4AF37]/5">
            <h3 className="text-xl font-bold text-white mb-6">Vos Avantages Exclusifs</h3>
            <ul className="space-y-4">
              {[
                "Suivi personnalisé par un instructeur dédié",
                "Sessions de Questions/Réponses en petit groupe",
                "Correction détaillée de vos travaux",
                "Accès prioritaire aux supports avancés",
                "Invitation aux cercles de discussion privés"
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-gray-300">
                  <CheckCircle2 className="w-5 h-5 text-[#D4AF37] shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>

        {/* Configuration Fees */}
        <div className="bg-gradient-to-r from-[#192734] to-[#15202B] border border-[#D4AF37]/30 rounded-2xl p-8 text-center max-w-4xl mx-auto">
          <Shield className="w-12 h-12 text-[#D4AF37] mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">Frais de Configuration Spirituelle</h3>
          <p className="text-[#D4AF37] text-4xl font-bold mb-4">100€ <span className="text-base text-gray-400 font-normal">(paiement unique)</span></p>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Ce montant est indispensable pour valider votre inscription. Il couvre l'ouverture de votre dossier vibratoire et l\'accès initial à la plateforme sécurisée. Ces frais sont à régler une seule fois au début du cursus.
          </p>
        </div>

        {/* Pricing */}
        <div className="space-y-12">
          <h2 className="text-3xl font-serif font-bold text-white text-center">Formules d'Investissement</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <PaymentOptionCard 
              optionNumber="1"
              title="Intégral"
              price={1600}
              total={1700}
              savings="Économie max : 1064€"
              features={["Formation : 1600€", "Frais config : 100€", "Paiement unique", "Accès complet immédiat"]}
              isRecommended={true}
              paymentPlanId="integral_private"
            />
            <PaymentOptionCard 
              optionNumber="2"
              title="Trimestriel"
              price={600}
              frequency="/ trimestre"
              total={2500}
              savings="Économie : 264€"
              features={["4 paiements de 600€", "Frais config : 100€", "Total annuel : 2500€", "Engagement 12 mois"]}
              paymentPlanId="quarterly_private"
            />
            <PaymentOptionCard 
              optionNumber="3"
              title="Mensuel"
              price={222}
              frequency="/ mois"
              total={2764}
              features={["12 paiements de 222€", "Frais config : 100€", "Total annuel : 2764€", "Flexibilité maximale"]}
              paymentPlanId="monthly_private"
            />
          </div>
        </div>

        {/* Comparison Table */}
        <div className="max-w-5xl mx-auto">
           <h3 className="text-2xl font-bold text-white mb-6 text-center">Comparatif des Formules Privées</h3>
           <ComparisonTable data={comparisonData} />
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto">
           <h2 className="text-3xl font-serif font-bold text-white mb-8 text-center">Questions Fréquentes</h2>
           <div className="space-y-4">
             {faqs.map((faq, index) => (
               <FAQItem key={index} question={faq.q} answer={faq.a} isOpen={openFAQ === index} toggle={() => toggleFAQ(index)} />
             ))}
           </div>
        </div>

        {/* Contact */}
        <div className="text-center pb-12 border-t border-white/10 pt-12">
          <h2 className="text-2xl font-bold text-white mb-6">Besoin d'aide pour choisir ?</h2>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Button variant="outline" className="gap-3 h-12 text-white border-white/20 hover:bg-white/10" asChild>
              <a href={`mailto:${vitrineEmail}`}>
                <Mail className="w-5 h-5 text-[#D4AF37]" />
                {vitrineEmail}
              </a>
            </Button>
            <Button variant="outline" className="gap-3 h-12 text-white border-white/20 hover:bg-white/10">
              <MessageCircle className="w-5 h-5 text-[#D4AF37]" />
              Support WhatsApp
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivateCyclePage;