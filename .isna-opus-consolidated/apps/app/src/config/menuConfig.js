import {
  GraduationCap,
  Users,
  Calendar,
  BookOpen,
  Info,
} from 'lucide-react';

export const menuConfig = [
  {
    id: 'formations',
    label: 'Formations',
    icon: GraduationCap,
    submenu: [
      { label: 'Cours publics', path: '/formations/list' },
      { label: 'Catalogue des formations', path: '/formations/catalogue' },
      { label: 'Mes formations', path: '/formations/mes-formations' },
      { label: 'Doctrine Pédagogique', path: '/doctrine-pedagogique' },
      { label: 'Cycle des Fondements', path: '/curriculum/first-year' },
    ]
  },
  {
    id: 'accompaniment',
    label: 'Accompagnement',
    icon: Users,
    submenu: [
      { label: 'Coaching thérapeute', path: '/accompagnement/coaching' },
      { label: 'Mentorat Spirituel', path: '/accompagnement/mentorat' },
      { label: 'Coaching vs Mentorat', path: '/accompagnement/coaching-vs-mentorat' },
      { label: 'Suivi Pédagogique', path: '/accompagnement/suivi-pedagogique' },
      { label: 'Soutien Émotionnel', path: '/accompagnement/soutien-emotionnel' },
    ]
  },
  {
    id: 'school-life',
    label: 'Vie Étudiante',
    icon: Calendar,
    submenu: [
      { label: 'Tableau de bord étudiant', path: '/student-school-life/dashboard' },
      { label: 'Espace Vie scolaire', path: '/student-school-life/vie-scolaire' },
      { label: 'Agenda & Événements', path: '/student-school-life/agenda' },
      { label: 'Absences', path: '/student-school-life/absences' },
    ]
  },
  {
    id: 'resources',
    label: 'Ressources',
    icon: BookOpen,
    submenu: [
      { label: 'Bibliothèque', path: '/bibliotheque' },
      { label: 'Grande bibliothèque', path: '/grande-bibliotheque' },
      { label: 'Ressources pédagogiques', path: '/resources' },
      { label: 'FAQ', path: '/faq' },
    ]
  },
  {
    id: 'about',
    label: 'À Propos',
    icon: Info,
    submenu: [
      { label: 'Notre Vision', path: '/a-propos' },
      { label: 'Le Fondateur', path: '/a-propos/fondateur' },
      { label: "L"Origine de l'Appel", path: "/origine-appel' },
      { label: "L'Équipe", path: '/equipe' },
      { label: 'Nous contacter', path: '/nous-contacter' },
      { label: 'FAQ', path: '/faq' },
    ]
  }
];