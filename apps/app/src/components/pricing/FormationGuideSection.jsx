import React from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Wrench, BrainCircuit, ShieldCheck, ArrowRight, Users, User, Crown, BookOpen } from 'lucide-react';

const guides = [
  {
    badge: 'Académique',
    cycle: 'Cycle Autonome',
    icon: BookOpen,
    emoji: '🧘',
    color: 'purple',
    price: '55€/mois',
    description: "Le socle théorique indispensable. Accédez à tous les cours en autonomie complète, étudiez à votre rythme sans contrainte de calendrier.",
    target: "Étudiants curieux, chercheurs indépendants, autodidactes.",
    includes: ['Cours PDF et audios', 'Étude libre et flexible', 'Évolution possible vers les cycles supérieurs'],
    excludes: ['Aucun suivi ni coaching'],
    progression: "J'acquiers la connaissance à mon rythme.",
  },
  {
    badge: 'Académie+',
    cycle: 'Cycle Académique',
    icon: GraduationCap,
    emoji: '🎓',
    color: 'blue',
    price: '111€/mois',
    description: "La formation structurée en groupe avec classes virtuelles, échanges collectifs et certification ISNA officielle.",
    target: "Débutants motivés, chercheurs spirituels souhaitant un cadre structuré.",
    includes: ['Formation complète (PDF + vidéos + classes)', 'Classes collectives', 'Certification ISNA'],
    excludes: ['Pas de coaching individuel'],
    progression: "J'incarne le savoir par l'expérience collective.",
  },
  {
    badge: 'Académie Pro',
    cycle: 'Cycle Privé',
    icon: BrainCircuit,
    emoji: '🔑',
    color: 'yellow',
    price: '222€/mois',
    description: "Formation complète avec coaching spirituel personnalisé. Un formateur qualifié vous suit individuellement pour adapter l'enseignement à votre vibration.",
    target: "Élèves engagés cherchant un suivi personnel et un encadrement adapté.",
    includes: ['Tout le contenu Académie+', 'Coaching individuel personnalisé', 'Suivi par un formateur dédié'],
    excludes: ['Pas de montorat sacerdotal'],
    progression: "Je progresse avec un guide personnel.",
  },
  {
    badge: 'Mentorat',
    cycle: 'Cycle Privilégié',
    icon: ShieldCheck,
    emoji: '🛡️',
    color: 'red',
    price: '278€/mois',
    description: "Le cycle le plus complet et le plus puissant. Montorat sacerdotal direct par le 5ᵉ Manikongo, accès au Temple NGOWAZULU et aux rituels initiatiques sacrés.",
    target: "Disciples appelés à exercer un sacerdoce, engagement total requis.",
    includes: ['Tout le contenu Académie Pro', 'Montorat sacerdotal complet', 'Rituels initiatiques', 'Protection spirituelle'],
    excludes: ['Sélection sur dossier vibratoire'],
    progression: "Je m'éveille à ma véritable nature sacrée.",
  },
];

const colorMap = {
  purple: { border: 'border-purple-500/30', bg: 'bg-purple-600', text: 'text-purple-400', badge: 'bg-purple-500/15 text-purple-300 border-purple-500/20', light: 'bg-purple-500/5' },
  blue:   { border: 'border-blue-500/30',   bg: 'bg-blue-600',   text: 'text-blue-400',   badge: 'bg-blue-500/15 text-blue-300 border-blue-500/20',     light: 'bg-blue-500/5' },
  yellow: { border: 'border-yellow-500/30', bg: 'bg-yellow-600', text: 'text-yellow-400', badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20', light: 'bg-yellow-500/5' },
  red:    { border: 'border-red-500/30',    bg: 'bg-red-600',    text: 'text-red-400',    badge: 'bg-red-500/15 text-red-300 border-red-500/20',         light: 'bg-red-500/5' },
};

const GuideCard = ({ badge, cycle, icon: Icon, emoji, color, price, description, target, includes, excludes, progression, step }) => {
  const c = colorMap[color];
  return (
    <div className={`relative rounded-2xl border ${c.border} bg-[#141c27] overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-black/20 h-full flex flex-col`}>
      {/* Step number */}
      <div className={`absolute top-4 left-4 w-7 h-7 rounded-full ${c.bg} flex items-center justify-center`}>
        <span className="text-xs font-bold text-white">{step}</span>
      </div>

      {/* Header */}
      <div className="pt-6 pb-4 px-5 text-center">
        <span className="text-3xl block mb-2">{emoji}</span>
        <span className={`inline-block px-3 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-widest border mb-2 ${c.badge}`}>
          {badge}
        </span>
        <h3 className="text-lg font-bold text-white font-serif">{cycle}</h3>
        <p className={`text-sm font-semibold ${c.text} mt-1`}>À partir de {price}</p>
      </div>

      {/* Body */}
      <div className="px-5 pb-5 flex-grow space-y-4">
        <p className="text-sm text-gray-400 leading-relaxed">{description}</p>

        {/* Pour qui */}
        <div className={`${c.light} rounded-lg p-3 border ${c.border}`}>
          <p className="text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Users className="w-3 h-3" /> Pour qui ?
          </p>
          <p className="text-sm text-gray-400">{target}</p>
        </div>

        {/* Inclus */}
        <div>
          <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1.5">Ce qui est inclus :</p>
          <ul className="space-y-1">
            {includes.map((item, i) => (
              <li key={i} className="flex items-start gap-1.5 text-sm text-gray-300">
                <span className="text-emerald-400 mt-0.5">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Limite */}
        {excludes && excludes.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-orange-400/80 uppercase tracking-wider mb-1">Limite :</p>
            <ul className="space-y-1">
              {excludes.map((item, i) => (
                <li key={i} className="text-sm text-gray-500 italic flex items-start gap-1.5">
                  <span className="text-orange-400/50 mt-0.5">✗</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Progression */}
        <div className="pt-2 border-t border-white/5">
          <p className={`text-xs italic ${c.text} flex items-center gap-1.5`}>
            <ArrowRight className="w-3 h-3" /> "{progression}"
          </p>
        </div>
      </div>
    </div>
  );
};

const FormationGuideSection = () => {
  return (
    <div className="space-y-8">
      {/* Visual progression arrow */}
      <div className="flex items-center justify-center gap-3 text-gray-500 text-xs uppercase tracking-widest">
        <span>Découverte</span>
        <div className="flex items-center gap-1">
          <div className="w-8 h-px bg-gradient-to-r from-purple-500 to-blue-500" />
          <ArrowRight className="w-3 h-3 text-blue-400" />
          <div className="w-8 h-px bg-gradient-to-r from-blue-500 to-yellow-500" />
          <ArrowRight className="w-3 h-3 text-yellow-400" />
          <div className="w-8 h-px bg-gradient-to-r from-yellow-500 to-red-500" />
          <ArrowRight className="w-3 h-3 text-red-400" />
        </div>
        <span>Maîtrise</span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {guides.map((guide, idx) => (
          <GuideCard key={idx} step={idx + 1} {...guide} />
        ))}
      </div>

      {/* Orientation CTA */}
      <div className="text-center pt-4 space-y-4">
        <p className="text-sm text-gray-400">
          Vous ne savez pas quel cycle choisir ? Un conseiller peut vous orienter gratuitement.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="/appointment/request"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--school-accent)] text-black font-bold text-sm hover:bg-yellow-500 transition-all duration-200 hover:scale-[1.02] shadow-lg"
          >
            <User className="w-4 h-4" />
            Prendre rendez-vous avec un conseiller
            <ArrowRight className="w-4 h-4" />
          </a>
          <Link
            to="/accompagnement/coaching"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 font-semibold text-sm hover:bg-yellow-500/20 transition-all duration-200"
          >
            Coaching Therapeute
          </Link>
          <Link
            to="/accompagnement/mentorat"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 font-semibold text-sm hover:bg-red-500/20 transition-all duration-200"
          >
            Montorat Spirituel
          </Link>
        </div>
      </div>
    </div>
  );
};

export default FormationGuideSection;