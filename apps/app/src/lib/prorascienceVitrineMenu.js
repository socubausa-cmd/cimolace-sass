import {
  BookMarked,
  BookOpen,
  Briefcase,
  CalendarClock,
  HelpCircle,
  Home,
  Info,
  Layers3,
  Mail,
  MessageCircle,
  MessagesSquare,
  Shield,
  UserCircle,
  Users,
} from 'lucide-react';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const V = ELEVE_MOBILE.prorascience;

/**
 * Menu hamburger (vitrine mobile) — routes sous `/m/eleve/prorascience/...` (même contenu que le site public, UI mobile).
 */
export function getProrascienceVitrineMenuSections() {
  return [
    {
      id: 'principale',
      title: 'Navigation',
      items: [
        { to: `${V}/forfaits`, label: 'Forfaits & tarifs', sub: 'Offres & prix', Icon: Layers3 },
        { to: `${V}/formations`, label: 'Formations', sub: 'Catalogue', Icon: BookMarked },
        { to: `${V}/les-21-sciences`, label: 'Les 21 sciences', sub: 'Curriculum officiel', Icon: BookOpen },
        { to: `${V}/isna-pro`, label: 'ISNA Pro', sub: 'Présentation pro', Icon: Briefcase },
        { to: `${V}/a-propos`, label: 'À propos', sub: 'Présentation', Icon: Info },
      ],
    },
    {
      id: 'accompagnement',
      title: 'Accompagnement',
      items: [
        { to: `${V}/accompagnement/mentorat`, label: 'Mentorat', sub: 'Suivi', Icon: UserCircle },
        { to: `${V}/accompagnement/coaching`, label: 'Coaching', sub: 'Soutien', Icon: Users },
        { to: `${V}/accompagnement/coaching-vs-mentorat`, label: 'Coaching vs mentorat', sub: 'Comparatif', Icon: MessagesSquare },
      ],
    },
    {
      id: 'institution',
      title: 'Institution',
      items: [
        { to: `${V}/a-propos`, label: 'À propos', sub: isnaTenantConfig.branding.name, Icon: Shield },
        { to: `${V}/fondateur`, label: 'Le fondateur', sub: 'Biographie', Icon: UserCircle },
        { to: `${V}/equipe`, label: 'L\'équipe', sub: 'Qui sommes-nous', Icon: Users },
        { to: `${V}/faq`, label: 'FAQ', sub: 'Questions fréquentes', Icon: HelpCircle },
        { to: `${V}/contact`, label: 'Contact', sub: 'Écrire à l\'école', Icon: Mail },
      ],
    },
    {
      id: 'communaute',
      title: 'Communauté',
      items: [{ to: `${V}/communaute`, label: 'Communauté', sub: 'Vie du réseau LIRI', Icon: MessageCircle }],
    },
  ];
}

/**
 * Raccourcis barre bas — vitrine uniquement (pas l'onglet LIRI Accueil/Cours/Live).
 * Centre : prise de rendez-vous.
 */
export function getProrascienceVitrineTabBarItems() {
  return {
    left: [
      { to: V, label: 'Accueil', Icon: Home, end: true },
      { to: `${V}/forfaits`, label: 'Forfaits', Icon: Layers3, end: false },
    ],
    center: {
      to: ELEVE_MOBILE.appointmentRequest,
      label: 'Rendez-vous',
      shortLabel: 'Rendez-vous',
      Icon: CalendarClock,
    },
    right: [
      { to: `${V}/a-propos`, label: 'À propos', Icon: Info, end: false },
      { to: `${V}/contact`, label: 'Contact', Icon: Mail, end: false },
    ],
  };
}
