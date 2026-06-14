import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { 
  Users, 
  Award, 
  BookOpen, 
  Heart, 
  Star, 
  ShieldCheck, 
  Briefcase,
  GraduationCap
} from 'lucide-react';
import ExpandableCard from '@/components/ui/ExpandableCard';

const TeachersPage = () => {
  const teachers = [
    {
      id: 1,
      name: "Manikongo 5ème",
      title: "Fondateur & Guide Suprême",
      specialty: "Prorascience & Mystique Universelle",
      bio: "Dépositaire de l'Ordre Mystique des Manikongo, il a fondé l'école pour restaurer la connaissance ancestrale et universelle des lois de la nature et de l'âme.",
      experience: "30+ ans d'expérience spirituelle et initiatique",
      modules: ["Tous les cycles", "Initiation Supérieure", "Direction Spirituelle"],
      approach: "Une pédagogie fondée sur l'éveil de la conscience par la rigueur scientifique et la profondeur mystique."
    },
    {
      id: 2,
      name: "Maître de la Perception",
      title: "Doyen des Études Métaphysiques",
      specialty: "Vision Intérieure & Symbolisme",
      bio: "Expert dans le décodage des symboles universels et le développement des facultés de perception subtile.",
      experience: "15 ans d'enseignement",
      modules: ["Module Perception", "Symbolisme Avancé"],
      approach: "Apprendre à voir au-delà des apparences pour saisir l'essence des choses."
    },
    {
      id: 3,
      name: "Maître de la Discipline",
      title: "Responsable de la Vie Scolaire",
      specialty: "Maîtrise de Soi & Éthique",
      bio: "Garant du respect du règlement et de l'application des principes éthiques au quotidien.",
      experience: "Ancien officier, 12 ans de pratique",
      modules: ["Discipline Intérieure", "Gestion des Émotions"],
      approach: "La liberté naît de la discipline acceptée et comprise."
    },
    {
      id: 4,
      name: "Maître des Sciences Nocturnes",
      title: "Instructeur des Mondes Oniriques",
      specialty: "Rêves & Voyages Astraux",
      bio: "Spécialiste de l'exploration de la conscience durant le sommeil et les états modifiés.",
      experience: "20 ans de recherche onirique",
      modules: ["Sciences Nocturnes", "Interprétation des Rêves"],
      approach: "La nuit est une autre journée de travail pour l'initié."
    },
    {
      id: 5,
      name: "Maître du Coaching Spirituel",
      title: "Responsable de l'Accompagnement",
      specialty: "Développement Personnel & Mission de Vie",
      bio: "Accompagne les élèves dans l'intégration des enseignements dans leur vie professionnelle et personnelle.",
      experience: "Coach certifié, 10 ans de pratique",
      modules: ["Coaching de Vie", "Mentorat"],
      approach: "Transformer la connaissance théorique en sagesse pratique."
    }
  ];

  const values = [
    { title: "Intégrité", desc: "Alignement entre pensée, parole et acte.", icon: ShieldCheck },
    { title: "Dévouement", desc: "Service désintéressé envers la communauté.", icon: Heart },
    { title: "Sagesse", desc: "Application juste de la connaissance.", icon: BookOpen },
    { title: "Respect", desc: "Considération pour chaque être vivant.", icon: Users },
    { title: "Excellence", desc: "Recherche constante du meilleur de soi.", icon: Star }
  ];

  return (
    <div className="min-h-screen bg-[#0F1419] font-sans pb-20">
      <Helmet>
        <title>Nos Enseignants - Équipe Pédagogique | PRORASCIENCE ACADEMY</title>
        <meta name="description" content="Découvrez les maîtres et instructeurs de l'ISNA. Une équipe d'experts dédiés à votre évolution spirituelle et intellectuelle." />
      </Helmet>

      {/* Hero Section */}
      <section className="relative h-[400px] lg:h-[500px] w-full overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1701229404076-5629809b331d?q=80&w=2000&auto=format&fit=crop" 
            alt="Library" 
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0F1419]/30 via-[#0F1419]/60 to-[#0F1419]" />
        </div>
        
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-4xl lg:text-6xl font-serif font-bold text-white mb-6">
              Le Collège des <span className="text-[var(--school-accent)]">Maîtres</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
              "Le véritable maître n'est pas celui qui a le plus de disciples, mais celui qui forme le plus de maîtres."
            </p>
          </motion.div>
        </div>
      </section>

      {/* Intro Text */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-3xl font-serif font-bold text-white mb-8">Une Pédagogie d'Excellence</h2>
        <p className="text-gray-400 text-lg leading-relaxed mb-12">
          Notre corps professoral est composé d'initiés et d\'experts rigoureusement sélectionnés par le Fondateur. 
          Chaque enseignant incarne les valeurs de la Prorascience et possède une double compétence : 
          une maîtrise théorique approfondie et une expérience pratique avérée des lois universelles.
        </p>
      </section>

      {/* Teachers Cards */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 mb-20">
        <div className="space-y-6">
          {teachers.map((teacher, index) => (
            <ExpandableCard 
              key={teacher.id} 
              title={teacher.name} 
              icon={GraduationCap}
              defaultExpanded={index === 0}
            >
              <div className="grid md:grid-cols-3 gap-8">
                <div className="col-span-1">
                  <div className="w-full aspect-square bg-[#0F1419] rounded-lg border border-white/10 flex items-center justify-center mb-4">
                     {/* Placeholder for teacher image if available, using initials here */}
                     <span className="text-4xl font-serif font-bold text-[var(--school-accent)]">{teacher.name.charAt(0)}</span>
                  </div>
                  <div className="text-center">
                    <span className="inline-block px-3 py-1 bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)] rounded-full text-xs font-bold uppercase tracking-wider">
                      {teacher.title}
                    </span>
                  </div>
                </div>
                <div className="md:col-span-2 space-y-6">
                  <div>
                    <h4 className="text-[var(--school-accent)] font-bold mb-2">Spécialité</h4>
                    <p className="text-gray-300">{teacher.specialty}</p>
                  </div>
                  <div>
                    <h4 className="text-[var(--school-accent)] font-bold mb-2">Biographie</h4>
                    <p className="text-gray-300 italic">"{teacher.bio}"</p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-[var(--school-accent)] font-bold mb-2">Expérience</h4>
                      <p className="text-gray-400 text-sm">{teacher.experience}</p>
                    </div>
                    <div>
                      <h4 className="text-[var(--school-accent)] font-bold mb-2">Approche</h4>
                      <p className="text-gray-400 text-sm">{teacher.approach}</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/5">
                    <h4 className="text-white font-bold mb-2 text-sm uppercase">Modules enseignés :</h4>
                    <div className="flex flex-wrap gap-2">
                      {teacher.modules.map((mod, i) => (
                        <span key={i} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-sm text-gray-400">
                          {mod}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </ExpandableCard>
          ))}
        </div>
      </section>

      {/* Values Section */}
      <section className="bg-[#192734]/50 py-20 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-serif font-bold text-white mb-4">Nos Valeurs Fondamentales</h2>
            <div className="w-24 h-1 bg-[var(--school-accent)] mx-auto rounded-full"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {values.map((val, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ y: -10 }}
                className="bg-[#0F1419] p-6 rounded-xl border border-white/5 text-center shadow-lg hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-all"
              >
                <div className="w-12 h-12 mx-auto bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] rounded-full flex items-center justify-center text-[var(--school-accent)] mb-4">
                  <val.icon className="w-6 h-6" />
                </div>
                <h3 className="text-white font-bold mb-2">{val.title}</h3>
                <p className="text-gray-400 text-sm">{val.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Continuing Education */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="bg-gradient-to-br from-[#192734] to-[#0F1419] p-10 rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] shadow-2xl">
          <Award className="w-12 h-12 text-[var(--school-accent)] mx-auto mb-6" />
          <h2 className="text-2xl font-serif font-bold text-white mb-4">Formation Continue</h2>
          <p className="text-gray-300 mb-8">
            Nos enseignants suivent eux-mêmes un programme de formation continue rigoureux sous la direction du Fondateur, 
            garantissant ainsi la pureté et l'actualisation constante de l\'enseignement dispensé.
          </p>
          <button className="px-8 py-3 bg-[var(--school-accent)] text-black font-bold rounded hover:bg-[#b5952f] transition-colors">
            Rejoindre l'Académie
          </button>
        </div>
      </section>

    </div>
  );
};

export default TeachersPage;