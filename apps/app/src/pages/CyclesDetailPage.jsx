import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Mail, 
  MessageCircle,
  ChevronDown,
  ChevronUp,
  GraduationCap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import PaymentOptionCard from '@/components/PaymentOptionCard';
import ComparisonTable from '@/components/ComparisonTable';
import { useVitrineContactEmail } from '@/contexts/VitrineContactEmailContext';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const SCHOOL = isnaTenantConfig.branding.name;

const FAQItem = ({ question, answer, isOpen, toggle }) => {
  return (
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
};

const CyclesDetailPage = ({ cycleId: cycleIdProp }) => {
  const vitrineEmail = useVitrineContactEmail();
  const { id: paramId } = useParams();
  const id = cycleIdProp ?? paramId;
  const [openFAQ, setOpenFAQ] = React.useState(null);

  // Scroll to top on load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const toggleFAQ = (index) => {
    setOpenFAQ(openFAQ === index ? null : index);
  };

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

  const academicData = [
    { label: "Montant", col1: "800€", col2: "300€ / trim", col3: "111€ / mois" },
    { label: "Total / an", col1: "800€", col2: "1200€", col3: "1332€" },
    { label: "Économie", col1: "532€", col2: "132€", col3: "0€" },
    { label: "Durée", col1: "1 An", col2: "1 An", col3: "1 An" },
    { label: "Flexibilité", col1: "Faible", col2: "Moyenne", col3: "Élevée" },
    { label: "Accès", col1: "Immédiat", col2: "Immédiat", col3: "Immédiat" },
  ];

  const faqs = [
    {
      q: "Y a-t-il des prérequis pour s'inscrire ?",
      a: "Aucun diplôme n'est requis. Seule une maîtrise de la langue française et une connexion internet stable sont nécessaires, ainsi qu'une réelle volonté d'apprendre."
    },
    {
      q: "Puis-je changer de formule de paiement en cours de route ?",
      a: "Oui, il est possible de passer d'un paiement mensuel à un paiement intégral pour bénéficier de la réduction restante, sur demande auprès du secrétariat."
    },
    {
      q: "Comment se déroulent les examens ?",
      a: "Les examens sont des QCM et des questions de réflexion à soumettre en ligne à la fin de chaque trimestre. Un grand examen final valide l'année."
    },
    {
      q: "Le diplôme est-il reconnu par l'État ?",
      a: `${isnaTenantConfig.branding.fullName} délivre une certification privée (certification ${SCHOOL}) reconnue par notre réseau d'institutions partenaires, mais non par l'État académique classique.`
    },
    {
      q: "Que se passe-t-il si je rate un cours ?",
      a: "Tous les cours sont enregistrés et disponibles en replay 24h/24 sur votre espace étudiant. Vous ne perdez jamais le fil."
    }
  ];

  return (
    <div className="min-h-screen bg-[#0F1419] font-sans text-gray-300 selection:bg-[#D4AF37]/30 pb-20">
      <Helmet>
        <title>{`Cycle académique — ${SCHOOL}`}</title>
        <meta name="description" content={`Cycle académique ${SCHOOL} : formation complète, certification et communauté d'élite.`} />
      </Helmet>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#15202B] via-[#0F1419] to-[#0F1419] z-0" />
        <div className="absolute top-0 right-0 p-64 bg-[#D4AF37]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        
        <div className="max-w-5xl mx-auto relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 border border-[#D4AF37]/30 rounded-full bg-[#D4AF37]/10 backdrop-blur-sm">
              <GraduationCap className="w-4 h-4 text-[#D4AF37]" />
              <span className="text-[#D4AF37] text-sm font-bold tracking-widest uppercase">Formation Certifiante</span>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-white mb-6 tracking-tight leading-tight">
              CYCLE <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-yellow-200">ACADÉMIQUE</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto font-light leading-relaxed">
              {`Le parcours d'excellence pour maîtriser les fondamentaux du cursus ${SCHOOL}.`}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 relative z-20 space-y-24">
        
        {/* Description & Advantages */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid md:grid-cols-2 gap-12 items-start"
        >
          <motion.div variants={itemVariants}>
            <h2 className="text-3xl font-serif font-bold text-white mb-6">Le Programme</h2>
            <div className="text-lg text-gray-300 space-y-4 leading-relaxed">
              <p>
                Le <strong className="text-white">Cycle Académique</strong> est le cœur de notre enseignement. Conçu pour être accessible tout en étant rigoureux, il vous guide pas à pas dans la compréhension des lois métaphysiques et de la cosmologie prorascientifique.
              </p>
              <p>
                Durant 12 mois, vous accéderez à une bibliothèque de savoirs structurés, des exercices pratiques et une communauté d'apprenants passionnés. Ce cycle est idéal pour ceux qui souhaitent se former sérieusement sans pour autant nécessiter un accompagnement privé intensif.
              </p>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-[#192734] rounded-2xl p-8 border border-white/5 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-6">Ce que ce cycle inclut :</h3>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-green-400 uppercase tracking-wider mb-2">Avantages</h4>
                <ul className="space-y-2">
                  {[
                    "Formation théorique et pratique complète",
                    "Classes collectives hebdomadaires",
                    `Certification ${SCHOOL} en fin de cursus`,
                    "Accès illimité à la communauté Discord",
                    "Supports de cours PDF et Replays"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-gray-300 text-sm">
                      <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="h-px bg-white/10 w-full"></div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-2">Limitations (vs Cycle Privé)</h4>
                <ul className="space-y-2">
                  {[
                    "Aucun coaching individuel (One-to-One)",
                    "Pas de correction personnalisée des devoirs (Auto-correction)",
                    "Pas d'accès prioritaire aux retraites"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-gray-400 text-sm">
                      <XCircle className="w-5 h-5 text-red-500/70 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Separator */}
        <div className="flex justify-center items-center opacity-30">
            <div className="h-px w-32 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent"></div>
            <span className="mx-6 text-[#D4AF37] text-2xl">⸻</span>
            <div className="h-px w-32 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent"></div>
        </div>

        {/* Pricing Options */}
        <div id="tarifs">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-serif font-bold text-white mb-4">Options de Paiement</h2>
            <p className="text-gray-400 text-lg">Investissez dans votre avenir avec flexibilité.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <PaymentOptionCard 
              optionNumber="1"
              title="Paiement Intégral"
              price={800}
              totalPrice={800}
              savings="-20% (Économie de 532€)"
              features={[
                "Accès immédiat à l'année complète",
                "Tous les bonus inclus",
                "Priorité sur le support technique",
                "Meilleur rapport qualité/prix"
              ]}
              isRecommended={true}
              paymentPlanId="integral_academic"
            />
            
            <PaymentOptionCard 
              optionNumber="2"
              title="Trimestriel"
              price={300}
              period="/ trimestre"
              totalPrice={1200}
              savings="-10%"
              features={[
                "Paiement tous les 3 mois",
                "Engagement sur l'année",
                "Accès débloqué par trimestre",
                "Idéal pour lisser le budget"
              ]}
              paymentPlanId="quarterly_academic"
            />

            <PaymentOptionCard 
              optionNumber="3"
              title="Mensuel"
              price={111}
              period="/ mois"
              totalPrice={1332}
              features={[
                "Paiement mensuel automatique",
                "Engagement sur 12 mois",
                "Accès progressif au contenu",
                "Flexibilité maximale"
              ]}
              paymentPlanId="monthly_academic"
            />
          </div>
        </div>

        {/* Comparison Table */}
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-white mb-6 text-center">Comparatif détaillé</h3>
          <ComparisonTable data={academicData} />
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <HelpCircle className="w-8 h-8 text-[#D4AF37]" />
            <h2 className="text-3xl font-serif font-bold text-white">Questions Fréquentes</h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <FAQItem 
                key={index}
                question={faq.q}
                answer={faq.a}
                isOpen={openFAQ === index}
                toggle={() => toggleFAQ(index)}
              />
            ))}
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-[#15202B] rounded-3xl p-8 md:p-12 border border-white/5">
          <h2 className="text-3xl font-serif font-bold text-white mb-10 text-center">Les prochaines étapes</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {[
              { num: "01", title: "Choix", text: "Sélectionnez votre formule ci-dessus" },
              { num: "02", title: "Compte", text: "Créez votre espace étudiant sécurisé" },
              { num: "03", title: "Paiement", text: "Réglez votre inscription en ligne" },
              { num: "04", title: "Accès", text: "Recevez vos identifiants par email" },
              { num: "05", title: "Début", text: "Commencez votre premier cours !" },
            ].map((step, i) => (
              <div key={i} className="text-center relative">
                <div className="text-4xl font-bold text-[#D4AF37]/20 mb-2 font-serif">{step.num}</div>
                <h3 className="text-lg font-bold text-white mb-1">{step.title}</h3>
                <p className="text-sm text-gray-400">{step.text}</p>
                {i < 4 && (
                  <div className="hidden md:block absolute top-6 -right-1/2 w-full h-px border-t border-dashed border-white/10 z-0"></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact Section */}
        <div className="text-center pb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Encore des questions ?</h2>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Button variant="outline" className="border-white/20 hover:bg-white/5 gap-3 h-12" asChild>
              <a href={`mailto:${vitrineEmail}`}>
                <Mail className="w-5 h-5 text-[#D4AF37]" />
                {vitrineEmail}
              </a>
            </Button>
            <Button variant="outline" className="border-white/20 hover:bg-white/5 gap-3 h-12">
              <MessageCircle className="w-5 h-5 text-[#D4AF37]" />
              Support WhatsApp
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CyclesDetailPage;