/**
 * Curriculum « Les 21 sciences » (partagé page web /ecoles + vitrine mobile /m/eleve/.../les-21-sciences).
 */
import {
  Activity,
  Atom,
  Clock,
  Compass,
  Crown,
  Eye,
  Flame,
  Gem,
  Ghost,
  Globe,
  Heart,
  Leaf,
  Lock,
  MapPin,
  MessageSquare,
  Scale,
  Shield,
  Skull,
  Users,
  Waves,
  Wind,
} from 'lucide-react';

export const ECOLES_SCIENCE_COLOR_PALETTE = [
  { color: 'from-violet-500/20 to-violet-900/10', border: 'border-violet-500/30', accent: 'text-violet-400', bg: 'bg-violet-500/10' },
  { color: 'from-blue-500/20 to-blue-900/10', border: 'border-blue-500/30', accent: 'text-blue-400', bg: 'bg-blue-500/10' },
  { color: 'from-cyan-500/20 to-cyan-900/10', border: 'border-cyan-500/30', accent: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  { color: 'from-indigo-500/20 to-indigo-900/10', border: 'border-indigo-500/30', accent: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  { color: 'from-rose-500/20 to-rose-900/10', border: 'border-rose-500/30', accent: 'text-rose-400', bg: 'bg-rose-500/10' },
  { color: 'from-amber-500/20 to-amber-900/10', border: 'border-amber-500/30', accent: 'text-amber-400', bg: 'bg-amber-500/10' },
  { color: 'from-yellow-500/20 to-yellow-900/10', border: 'border-yellow-500/30', accent: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { color: 'from-purple-500/20 to-purple-900/10', border: 'border-purple-500/30', accent: 'text-purple-400', bg: 'bg-purple-500/10' },
  { color: 'from-teal-500/20 to-teal-900/10', border: 'border-teal-500/30', accent: 'text-teal-400', bg: 'bg-teal-500/10' },
  { color: 'from-orange-500/20 to-orange-900/10', border: 'border-orange-500/30', accent: 'text-orange-400', bg: 'bg-orange-500/10' },
  { color: 'from-pink-500/20 to-pink-900/10', border: 'border-pink-500/30', accent: 'text-pink-400', bg: 'bg-pink-500/10' },
  { color: 'from-emerald-500/20 to-emerald-900/10', border: 'border-emerald-500/30', accent: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { color: 'from-lime-500/20 to-lime-900/10', border: 'border-lime-500/30', accent: 'text-lime-400', bg: 'bg-lime-500/10' },
  { color: 'from-green-500/20 to-green-900/10', border: 'border-green-500/30', accent: 'text-green-400', bg: 'bg-green-500/10' },
  { color: 'from-sky-500/20 to-sky-900/10', border: 'border-sky-500/30', accent: 'text-sky-400', bg: 'bg-sky-500/10' },
  { color: 'from-red-500/20 to-red-900/10', border: 'border-red-500/30', accent: 'text-red-400', bg: 'bg-red-500/10' },
  { color: 'from-fuchsia-500/20 to-fuchsia-900/10', border: 'border-fuchsia-500/30', accent: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10' },
  { color: 'from-slate-500/20 to-slate-900/10', border: 'border-slate-500/30', accent: 'text-slate-400', bg: 'bg-slate-500/10' },
  { color: 'from-stone-500/20 to-stone-900/10', border: 'border-stone-500/30', accent: 'text-stone-400', bg: 'bg-stone-500/10' },
  { color: 'from-zinc-400/20 to-zinc-900/10', border: 'border-zinc-400/30', accent: 'text-zinc-300', bg: 'bg-zinc-400/10' },
  { color: 'from-sky-500/20 to-indigo-900/10', border: 'border-sky-500/30', accent: 'text-sky-300', bg: 'bg-sky-500/10' },
];

export const ECOLES_SCIENCE_ICONS = [
  Atom,
  Globe,
  Waves,
  Compass,
  Heart,
  Users,
  Crown,
  Ghost,
  Eye,
  Flame,
  MessageSquare,
  Gem,
  Leaf,
  Activity,
  Shield,
  Skull,
  Lock,
  Wind,
  MapPin,
  Clock,
  Scale,
];

export const ECOLES_SCIENCES = [
  { number: 1, name: "Ontologie Sacrée", subtitle: "Science de l'origine de l'être", content: ['Origine du monde', "Nature de l'Être", 'Principe de création', 'Potentia Prima', "Loi d'encapsulation"], objective: "Comprendre d'où vient le monde et pourquoi il existe." },
  { number: 2, name: 'Cosmologie Sacrée', subtitle: "Science de la structure de l'univers", content: ["Structure de l'espace", 'Structure du temps', 'Champs invisibles', 'Hiérarchie cosmique'], objective: "Comprendre l'architecture du monde." },
  { number: 3, name: 'Mécanique Vibratoire', subtitle: 'Science des lois invisibles', content: ['Résonance', 'Intrication', 'Causalité invisible', "Champs d'influence"], objective: 'Comprendre les lois invisibles de l’univers.' },
  { number: 4, name: 'Science du Destin', subtitle: "Science de la trajectoire de l'être", content: ['Karma', 'Nuage de futur', 'Trajectoire du destin', 'Lecture du chemin de vie'], objective: 'Comprendre comment le destin se construit et peut être modifié.' },
  { number: 5, name: "Science de l'Incarnation", subtitle: "Vie, mort et continuité de l'âme", content: ["Naissance de l'âme", "Processus d'incarnation", 'Mort', 'Réincarnation'], objective: "Comprendre la trajectoire de l'être dans le temps." },
  { number: 6, name: 'Science des Ancêtres', subtitle: 'Science de la mémoire de la lignée', content: ['Autel ancestral', 'Appel des ancêtres', 'Purification familiale', 'Réparation karmique'], objective: 'Comprendre et honorer la mémoire de la lignée.' },
  { number: 7, name: 'Science des Divinités', subtitle: 'Science des forces cosmiques', content: ['Panthéon', 'Génies', 'Totems', 'Esprits de la nature'], objective: 'Comprendre les archétypes de puissance.' },
  { number: 8, name: 'Science des Esprits', subtitle: 'Science des entités invisibles', content: ['Esprits errants', 'Esprits protecteurs', 'Esprits parasites', 'Pactes spirituels'], objective: 'Comprendre les entités du monde invisible.' },
  { number: 9, name: 'Science de la Divination', subtitle: 'Science de la lecture des signes', content: ['Songes', 'Visions', 'Géomancie', 'Lecture symbolique'], objective: 'Apprendre à lire les messages du monde invisible.' },
  { number: 10, name: 'Science des Rituels', subtitle: "Science de l'action spirituelle", content: ['Invocation', 'Évocation', 'Libation', 'Consécration', 'Sacralisation'], objective: 'Apprendre à agir spirituellement sur la réalité.' },
  { number: 11, name: 'Science du Verbe Sacré', subtitle: 'Science du pouvoir de la parole', content: ['Bénédiction', 'Malédiction', 'Nom initiatique', 'Parole performative'], objective: 'Maîtriser le pouvoir créateur de la parole.' },
  { number: 12, name: 'Science des Talismans', subtitle: 'Science des objets de puissance', content: ['Fétiches', 'Nkisi', 'Talismans', 'Objets consacrés'], objective: 'Comprendre et créer des objets de puissance.' },
  { number: 13, name: 'Science des Plantes Sacrées', subtitle: 'Pharmacopée spirituelle', content: ['Plantes médicinales', 'Plantes magiques', 'Fumigations', 'Bains spirituels'], objective: 'Maîtriser la pharmacopée spirituelle africaine.' },
  { number: 14, name: 'Science de la Guérison', subtitle: "Science de la réparation de l'être", content: ['Extraction de mal', 'Purification', 'Harmonisation énergétique'], objective: "Apprendre à réparer et restaurer l'être." },
  { number: 15, name: 'Science de la Protection', subtitle: 'Science de la défense spirituelle', content: ['Protections rituelles', 'Boucliers spirituels', 'Neutralisation des attaques'], objective: 'Apprendre à protéger la vie.' },
  { number: 16, name: 'Science de la Sorcellerie', subtitle: "Mécanismes d'attaque spirituelle", content: ['Envoûtement', 'Ensorcellement', 'Pactes occultes', 'Réseaux mystiques'], objective: 'Comprendre les attaques spirituelles et leurs mécanismes.' },
  { number: 17, name: 'Science de la Sexualité Sacrée', subtitle: 'Pouvoir créateur du sexe', content: ['Pacte sexuel', 'Magie sexuelle', 'Énergie des menstruations'], objective: 'Comprendre le pouvoir créateur et destructeur de la sexualité.' },
  { number: 18, name: 'Science du Corps Spirituel', subtitle: 'Science des centres énergétiques', content: ['Respiration rituelle', 'Transe', 'Danse sacrée', 'Purification corporelle'], objective: "Maîtriser le corps comme instrument spirituel." },
  { number: 19, name: 'Science des Lieux Sacrés', subtitle: 'Géographie spirituelle', content: ['Lieux de puissance', 'Sanctuaires', "Activation d'espace"], objective: "Comprendre la dimension spirituelle des lieux." },
  { number: 20, name: 'Science du Temps Sacré', subtitle: 'Science des cycles spirituels', content: ['Jours sacrés', 'Cycles lunaires', 'Saisons spirituelles'], objective: 'Comprendre les cycles du temps sacré.' },
  { number: 21, name: 'Mayekou', subtitle: "Science de la sagesse et de l'ordre social", content: ['Justice spirituelle', 'Loi communautaire', 'Harmonie sociale'], objective: "Apprendre à vivre en harmonie avec le monde et les autres." },
];

export const ECOLES_CYCLES_DATA = [
  { number: 1, name: 'Fondements', verb: 'Comprendre', scienceNums: [1, 2, 3, 5], accent: 'from-violet-500 to-blue-500', border: 'border-violet-500/30', description: "Comprendre les bases de la réalité : d'où vient le monde, comment il est structuré, quelles lois le gouvernent." },
  { number: 2, name: 'Sciences Invisibles', verb: 'Percevoir', scienceNums: [9, 6, 8, 7], accent: 'from-indigo-500 to-purple-500', border: 'border-indigo-500/30', description: 'Apprendre à percevoir les dimensions cachées : divination, ancêtres, esprits et divinités.' },
  { number: 3, name: 'Maîtrise', verb: 'Agir', scienceNums: [10, 15, 14, 12], accent: 'from-emerald-500 to-green-500', border: 'border-emerald-500/30', description: "Passer à l'action : rituels, protection, guérison et création d'objets de puissance." },
  { number: 4, name: 'Haute Initiation', verb: 'Autorité', scienceNums: [4, 16, 17, 21], accent: 'from-sky-500 to-violet-600', border: 'border-sky-500/30', description: 'Atteindre la maîtrise suprême : destin, sorcellerie, sexualité sacrée et sagesse sociale.' },
];

/** Alias rétrocompat page web */
export const colorPalette = ECOLES_SCIENCE_COLOR_PALETTE;
export const iconsList = ECOLES_SCIENCE_ICONS;
export const sciences = ECOLES_SCIENCES;
export const cyclesData = ECOLES_CYCLES_DATA;
