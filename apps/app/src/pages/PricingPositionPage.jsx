import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Target, 
  ShieldCheck, 
  Users, 
  Award, 
  Euro, 
  BookOpen, 
  Star, 
  Briefcase, 
  HelpCircle, 
  Mail, 
  Phone, 
  MessageCircle, 
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useVitrineContactEmail } from '@/contexts/VitrineContactEmailContext';

const PricingPositionPage = () => {
  const vitrineEmail = useVitrineContactEmail();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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

  const objectives = [
    {
      icon: ShieldCheck,
      title: "Crédibilité Institutionnelle",
      desc: "Nos tarifs reflètent la rigueur académique et la qualité unique de notre enseignement, nous positionnant comme une école de référence en Europe."
    },
    {
      icon: Users,
      title: "Accessibilité Contrôlée",
      desc: "Nous maintenons des portes d'entrée accessibles (modules courts) tout en valorisant l'engagement à long terme (cycles complets)."
    },
    {
      icon: TrendingUp,
      title: "Progression Naturelle",
      desc: "Une structure tarifaire évolutive qui accompagne l'étudiant de la découverte à la maîtrise, sans barrière financière insurmontable au démarrage."
    }
  ];

  const academicPricing = [
    { year: "Année 1", price: "60€ - 120€ / mois", level: "Fondations", desc: "Accessibilité maximale pour les débutants. Volume de masse." },
    { year: "Année 2", price: "80€ - 150€ / mois", level: "Approfondissement", desc: "Filtrage naturel des étudiants engagés. Contenu plus technique." },
    { year: "Année 3", price: "100€ - 200€ / mois", level: "Maîtrise", desc: "Expertise pointue. Accès à des savoirs restreints." }
  ];

  const modularPricing = [
    { type: "Module Court", price: "50€ - 120€", duration: "3 - 10h", target: "Découverte" },
    { type: "Intermédiaire", price: "120€ - 250€", duration: "10 - 30h", target: "Compétence Spécifique" },
    { type: "Intensif", price: "250€ - 400€", duration: "30h +", target: "Certification" }
  ];

  const progressionSteps = [
    { step: "01", title: "Gratuit", desc: "Contenu public, YouTube, Articles" },
    { step: "02", title: "Découverte", desc: "Modules courts (50-100€)" },
    { step: "03", title: "Académique", desc: "Cursus annuel structuré" },
    { step: "04", title: "Avancé", desc: "Années supérieures & Spécialisations" },
    { step: "05", title: "Privé", desc: "Mentorat & Coaching individuel" },
    { step: "06", title: "Élite", desc: "Cercle Intérieur & Sacerdoce" },
  ];

  return (
    <div className="min-h-screen bg-[#0F1419] font-sans text-gray-300 selection:bg-[#D4AF37]/30 pb-20">
      <Helmet>
        <title>Positionnement Prix Prorascience - Europe</title>
        <meta name="description" content="Découvrez la stratégie tarifaire officielle et transparente de l'École Prorascience en Europe." />
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
              <Euro className="w-4 h-4 text-[#D4AF37]" />
              <span className="text-[#D4AF37] text-sm font-bold tracking-widest uppercase">Transparence Officielle</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-serif font-bold text-white mb-6">
              Positionnement Prix<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-yellow-200">Prorascience – Europe</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto font-light leading-relaxed">
              Une stratégie tarifaire cohérente, conçue pour allier excellence académique et accessibilité, adaptée au marché européen de la formation spirituelle.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Logique Générale */}
      <div className="max-w-4xl mx-auto px-6 mb-24 relative z-20">
        <motion.div 
          initial={{ opacity: 0 }} 
          whileInView={{ opacity: 1 }} 
          viewport={{ once: true }}
          className="bg-[#192734] border-l-4 border-[#D4AF37] rounded-r-xl p-8 md:p-12 shadow-xl"
        >
          <h2 className="text-2xl font-serif font-bold text-white mb-4">Logique Générale de Prix</h2>
          <p className="text-lg text-gray-300 leading-relaxed text-justify">
            Le positionnement de la <strong>Prorascience Academy</strong> se situe à l'intersection des <em>Écoles de Mystères traditionnelles</em> (souvent élitistes et fermées) et des <em>Instituts de Formation modernes</em> (structurés et certifiants).
          </p>
          <p className="text-lg text-gray-300 leading-relaxed text-justify mt-4">
            Nos tarifs ne sont pas ceux d'un simple créateur de contenu web, ni ceux d\'une université d\'État subventionnée. Ils reflètent la valeur d\'un <strong>accompagnement humain expert</strong>, d\'une infrastructure technologique solide et d\'un corpus de connaissances rares et structurées.
          </p>
        </motion.div>
      </div>

      {/* Objectifs */}
      <div className="max-w-7xl mx-auto px-6 mb-24 relative z-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-serif font-bold text-white mb-4">Objectifs de Notre Positionnement</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {objectives.map((obj, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-[#15202B] p-8 rounded-2xl border border-white/5 hover:border-[#D4AF37]/30 transition-colors group"
            >
              <obj.icon className="w-10 h-10 text-[#D4AF37] mb-6 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold text-white mb-3">{obj.title}</h3>
              <p className="text-gray-400 leading-relaxed">{obj.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-20 space-y-24">
        
        {/* Formation Académique */}
        <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
          <div className="flex items-center gap-4 mb-8">
            <BookOpen className="w-8 h-8 text-[#D4AF37]" />
            <h2 className="text-3xl font-serif font-bold text-white">Formation Académique</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {academicPricing.map((item, i) => (
              <motion.div key={i} variants={itemVariants} className="bg-[#192734] rounded-xl p-6 border border-white/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-16 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                <div className="text-sm font-bold text-[#D4AF37] uppercase tracking-wider mb-2">{item.year}</div>
                <h3 className="text-2xl font-bold text-white mb-4">{item.level}</h3>
                <div className="text-3xl font-bold text-white mb-4">{item.price}</div>
                <p className="text-gray-400 text-sm border-t border-white/10 pt-4">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Formations Modulaires */}
        <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true }}>
           <div className="flex items-center gap-4 mb-8">
            <Target className="w-8 h-8 text-blue-400" />
            <h2 className="text-3xl font-serif font-bold text-white">Formations Modulaires</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {modularPricing.map((item, i) => (
              <motion.div key={i} variants={itemVariants} className="bg-[#15202B] rounded-xl p-6 border border-blue-500/20">
                <div className="flex justify-between items-start mb-4">
                   <h3 className="text-xl font-bold text-white">{item.type}</h3>
                   <span className="bg-blue-500/10 text-blue-400 text-xs px-2 py-1 rounded border border-blue-500/20">{item.duration}</span>
                </div>
                <div className="text-2xl font-bold text-white mb-2">{item.price}</div>
                <p className="text-gray-400 text-sm">Cible : <span className="text-gray-300">{item.target}</span></p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Mentorat & Coaching Split */}
        <div className="grid md:grid-cols-2 gap-12">
          {/* Mentorat */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-[#192734] to-[#15202B] rounded-2xl p-8 border border-[#D4AF37]/20"
          >
            <div className="flex items-center gap-3 mb-6">
              <Star className="w-6 h-6 text-[#D4AF37]" />
              <h2 className="text-2xl font-bold text-white">Mentorat Spirituel</h2>
            </div>
            <div className="space-y-6">
              <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                <h4 className="text-gray-400 text-sm uppercase font-bold mb-1">Mensuel</h4>
                <p className="text-3xl font-bold text-[#D4AF37]">150€ - 300€ <span className="text-sm text-gray-500 font-normal">/ mois</span></p>
                <p className="text-sm text-gray-400 mt-2">Suivi régulier, transmission d'expérience.</p>
              </div>
              <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                <h4 className="text-gray-400 text-sm uppercase font-bold mb-1">Annuel</h4>
                <p className="text-3xl font-bold text-[#D4AF37]">1500€ - 2500€ <span className="text-sm text-gray-500 font-normal">/ an</span></p>
                <p className="text-sm text-gray-400 mt-2">Engagement long terme, relation maître-disciple.</p>
              </div>
            </div>
          </motion.div>

          {/* Coaching */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-[#192734] to-[#15202B] rounded-2xl p-8 border border-blue-500/20"
          >
            <div className="flex items-center gap-3 mb-6">
              <Briefcase className="w-6 h-6 text-blue-400" />
              <h2 className="text-2xl font-bold text-white">Coaching Spirituel</h2>
            </div>
            <div className="space-y-6">
              <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                <h4 className="text-gray-400 text-sm uppercase font-bold mb-1">À la séance</h4>
                <p className="text-3xl font-bold text-blue-400">150€ - 300€ <span className="text-sm text-gray-500 font-normal">/ séance</span></p>
                <p className="text-sm text-gray-400 mt-2">Intervention ponctuelle, déblocage précis.</p>
              </div>
              <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                <h4 className="text-gray-400 text-sm uppercase font-bold mb-1">Package Mensuel</h4>
                <p className="text-3xl font-bold text-blue-400">600€ - 1200€ <span className="text-sm text-gray-500 font-normal">/ mois</span></p>
                <p className="text-sm text-gray-400 mt-2">Accompagnement intensif vers un objectif.</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Forfait Privilégié */}
        <div className="bg-gradient-to-r from-purple-900/20 to-[#151320] border border-purple-500/30 rounded-2xl p-8 md:p-12 text-center relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl font-serif font-bold text-white mb-4">Forfait Privilégié & Cercle Intérieur</h2>
            <p className="text-gray-300 max-w-2xl mx-auto mb-8">
              L'offre ultime pour les étudiants visant le sacerdoce ou une transformation radicale. Accès illimité aux ressources, mentorat prioritaire et rituels exclusifs.
            </p>
            <div className="inline-block bg-purple-500/10 border border-purple-500/30 px-8 py-4 rounded-2xl">
              <p className="text-4xl font-bold text-purple-300">1500€ - 3000€ <span className="text-base text-gray-400 font-normal">/ an</span></p>
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto rounded-xl border border-white/10 shadow-xl bg-[#15202B]">
          <table className="w-full min-w-[800px] text-left border-collapse">
            <thead>
              <tr className="bg-[#192734]">
                <th className="p-4 text-gray-400 font-medium border-b border-white/10">Offre</th>
                <th className="p-4 text-white font-bold border-b border-white/10">Format</th>
                <th className="p-4 text-[#D4AF37] font-bold border-b border-white/10">Prix Moyen</th>
                <th className="p-4 text-gray-400 font-medium border-b border-white/10">Positionnement</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: "Module Court", format: "Vidéo / PDF", price: "80€", pos: "Entrée de gamme" },
                { name: "Cycle Académique (An 1)", format: "Annuel / Hebdo", price: "800€ / an", pos: "Standard" },
                { name: "Cycle Académique (An 2+)", format: "Annuel / Spécialisé", price: "1200€ / an", pos: "Intermédiaire" },
                { name: "Mentorat", format: "Relationnel", price: "2000€ / an", pos: "Premium" },
                { name: "Cycle Privé / Privilégié", format: "Intégral VIP", price: "2500€+ / an", pos: "Élite" },
              ].map((row, i) => (
                <tr key={i} className={`border-b border-white/5 hover:bg-white/5 ${i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'}`}>
                  <td className="p-4 text-white font-medium">{row.name}</td>
                  <td className="p-4 text-gray-300">{row.format}</td>
                  <td className="p-4 text-[#D4AF37] font-bold">{row.price}</td>
                  <td className="p-4 text-gray-400">{row.pos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Logique de Progression */}
        <div className="py-12">
          <h2 className="text-3xl font-serif font-bold text-white mb-12 text-center">Logique de Progression</h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {progressionSteps.map((step, i) => (
              <div key={i} className="relative group">
                <div className="h-full bg-[#192734] border border-white/10 rounded-xl p-4 hover:border-[#D4AF37]/50 transition-colors flex flex-col justify-between min-h-[160px]">
                  <div>
                    <div className="text-2xl font-bold text-[#D4AF37]/20 mb-2">{step.step}</div>
                    <h3 className="text-white font-bold text-base mb-2">{step.title}</h3>
                  </div>
                  <p className="text-sm text-gray-400">{step.desc}</p>
                </div>
                {i < 5 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 w-4 h-px bg-white/20 z-10"></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Principes */}
        <div className="bg-[#15202B] rounded-3xl p-8 md:p-12 border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">Les 5 Principes de Notre Tarification</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            {[
              "Transparence totale",
              "Juste rémunération des instructeurs",
              "Investissement technologique continu",
              "Bourses au mérite (cas par cas)",
              "Stabilité des prix sur l'année scolaire"
            ].map((principle, i) => (
              <div key={i} className="flex flex-col items-center text-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-green-500/80" />
                <p className="text-base font-medium text-gray-300">{principle}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <HelpCircle className="w-8 h-8 text-[#D4AF37]" />
            <h2 className="text-3xl font-serif font-bold text-white">Questions Fréquentes</h2>
          </div>
          <div className="space-y-4">
            {[
              { q: "Pourquoi ces fourchettes de prix ?", a: "Les prix peuvent varier selon les promotions en cours, les options de paiement choisies (mensuel vs annuel) et les modules additionnels sélectionnés." },
              { q: "Existe-t-il des facilités de paiement ?", a: "Oui, pour toutes les formations supérieures à 300€, nous proposons systématiquement un paiement en 3x ou 10x sans frais cachés." },
              { q: "Les prix augmentent-ils chaque année ?", a: "Nous réévaluons nos tarifs chaque rentrée scolaire (Septembre) pour suivre l'inflation et l'amélioration de nos services, mais le prix est garanti pour la durée de votre cycle engagé." },
              { q: "Puis-je me faire rembourser ?", a: "Nous appliquons le délai légal de rétractation de 14 jours pour les achats en ligne. Au-delà, tout trimestre entamé est dû, sauf cas de force majeure." },
              { q: "Pourquoi le coaching est-il plus cher ?", a: "Le coaching mobilise un instructeur en temps réel (synchrone), ce qui est la ressource la plus rare, contrairement aux cours pré-enregistrés (asynchrone)." },
              { q: "Y a-t-il des coûts cachés ?", a: "Non. Le seul coût additionnel peut être l'achat de certains livres recommandés ou de matériel pour les travaux pratiques, mais cela reste à votre discrétion." }
            ].map((faq, index) => (
              <div key={index} className="bg-[#192734] border border-white/10 rounded-xl p-6">
                <h3 className="text-white font-bold mb-2 text-base md:text-lg">{faq.q}</h3>
                <p className="text-gray-400 text-sm md:text-base leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Synthèse Officielle */}
        <div className="text-center max-w-2xl mx-auto border-t border-white/10 pt-12">
          <h2 className="text-2xl font-serif font-bold text-white mb-6">Synthèse Officielle</h2>
          <p className="text-gray-300 italic text-lg leading-relaxed mb-8">
            "Notre politique de prix n'est pas un frein, mais un filtre et un garant. Elle permet de réunir une communauté d'étudiants sérieux, prêts à investir en eux-mêmes, tout en garantissant la pérennité et l'indépendance de notre institution."
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Link to="/contact">
               <Button className="bg-[#D4AF37] text-black hover:bg-yellow-500 gap-2 h-12 px-8">
                <MessageCircle className="w-5 h-5" />
                Discuter de mon budget
              </Button>
            </Link>
            <Link to="/formations-packages">
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 gap-2 h-12 px-8">
                <ArrowRight className="w-5 h-5" />
                Voir les offres actuelles
              </Button>
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-gray-500">
             <span className="flex items-center gap-2"><Mail className="w-4 h-4" /> {vitrineEmail}</span>
             <span className="flex items-center gap-2"><Phone className="w-4 h-4" /> +33 7 66 52 57 08</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PricingPositionPage;