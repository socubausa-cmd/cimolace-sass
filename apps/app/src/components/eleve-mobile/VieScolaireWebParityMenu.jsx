import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  BookOpen,
  Book,
  School,
  Library,
  Archive,
  Calendar,
  Video,
  GraduationCap,
  FileText,
  AlertTriangle,
  Download,
  MessageCircle,
  CreditCard,
  Receipt,
  User,
  ChevronRight,
} from 'lucide-react';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { EleveSectionTitle } from '@/components/eleve-mobile/EleveMobileShell';
import { EV_MUTED, EV_R, EV_LINE, EV_SH } from '@/pages/eleve-mobile/eleveMobileScreensShared';
import { cn } from '@/lib/utils';

/**
 * Entrées alignées sur le menu de `StudentSchoolLifeSidebar` (portail web)
 * afin d'ouvrir les mêmes pages, tout en passant le plus souvent par les routes
 * LIRI (`/m/eleve/...`) quand elles existent côté coque.
 */
const RUBRIQUES = [
  { to: ELEVE_MOBILE.etudiant, label: 'Tableau de bord', sub: 'Stats, aperçu (LIRI)', icon: LayoutDashboard, accent: 'violet' },
  { to: ELEVE_MOBILE.etudiantFormations, label: 'Mes formations', sub: 'Inscriptions, parcours', icon: BookOpen, accent: 'violet' },
  { to: ELEVE_MOBILE.classe, label: 'Ma classe', sub: 'Classe & membres (LIRI)', icon: Book, accent: 'violet' },
  { to: ELEVE_MOBILE.vieScolaire, label: 'Vie scolaire', sub: 'Notes, agenda, assiduité (LIRI)', icon: School, accent: 'violet' },
  { to: ELEVE_MOBILE.bibliotheque, label: 'Bibliothèque LIRI', sub: 'Cours & suivi', icon: Library, accent: 'violet' },
  {
    to: '/student-school-life/bibliotheque-ressources',
    label: 'Ressources',
    sub: 'Médiathèque (ouvre le portail web)',
    icon: Archive,
  },
  { to: ELEVE_MOBILE.agenda, label: 'Agenda LIRI', sub: 'Planning & RDV', icon: Calendar, accent: 'violet' },
  { to: ELEVE_MOBILE.appointmentRequest, label: 'Rendez-vous', sub: 'Demander un entretien', icon: Video },
  { to: ELEVE_MOBILE.etudiantEvaluations, label: 'Évaluations', sub: 'Examens & résultats', icon: GraduationCap, accent: 'violet' },
  { to: ELEVE_MOBILE.etudiantNotes, label: 'Notes & résultats', sub: 'Relevés & moyennes', icon: FileText, accent: 'violet' },
  { to: ELEVE_MOBILE.etudiantAbsences, label: 'Absences', sub: 'Assiduité', icon: AlertTriangle, accent: 'violet' },
  { to: ELEVE_MOBILE.etudiantDocuments, label: 'Documents', sub: 'Factures & certificats', icon: Download, accent: 'violet' },
  { to: ELEVE_MOBILE.communaute, label: 'Forum communauté', sub: 'Échanges & annonces (LIRI)', icon: MessageCircle, accent: 'violet' },
  { to: ELEVE_MOBILE.forfaits, label: 'Forfaits LIRI', sub: 'Abonnement, cycles', icon: CreditCard, accent: 'violet' },
  { to: '/mes-factures', label: 'Mes factures', sub: 'Historique de paiement (ouvre le portail web)', icon: Receipt },
  { to: ELEVE_MOBILE.profile, label: 'Mon profil LIRI', sub: 'Compte & paramètres', icon: User, accent: 'violet' },
];

const accentRing = {
  amber: 'bg-amber-500/12 text-amber-200 ring-amber-400/25',
  violet: 'bg-violet-500/12 text-violet-200 ring-violet-400/25',
  default: 'bg-white/[0.06] text-white/80 ring-white/10',
};

/**
 * @param {object} [props]
 * @param {string} [props.className]
 */
export function VieScolaireWebParityMenu({ className }) {
  return (
    <div className={cn('w-full', className)}>
      <EleveSectionTitle className="!mb-2.5" dot>
        Même espace qu'en ligne
      </EleveSectionTitle>
      <p className="mb-3 text-[11.5px] font-medium leading-relaxed" style={{ color: EV_MUTED }}>
        Toutes les rubriques du portail <span className="text-white/75">Espace étudiant</span> (menu latéral web) :
        côté web détaillé, ou itinéraires raccourcis vers l'app LIRI.
      </p>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {RUBRIQUES.map((item) => {
          const Icon = item.icon;
          const ar = item.accent ? accentRing[item.accent] : accentRing.default;
          return (
            <Link key={item.to + item.label} to={item.to} className="block min-w-0">
              <motion.div
                initial={false}
                whileTap={{ scale: 0.99 }}
                className="flex items-center gap-3 p-3"
                style={{
                  borderRadius: EV_R.lg,
                  background: [
                    'radial-gradient(ellipse 90% 60% at 0% 0%, rgba(123, 97, 255, 0.1) 0%, transparent 55%)',
                    'linear-gradient(198deg, rgba(20, 22, 40, 0.92) 0%, rgba(8, 10, 20, 0.96) 100%)',
                  ].join(', '),
                  border: `1px solid ${EV_LINE}`,
                  boxShadow: ['inset 0 1px 0 rgba(255,255,255,0.04)', EV_SH.sm].join(', '),
                }}
              >
                <div
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1',
                    ar,
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[14px] font-extrabold text-white/95">{item.label}</p>
                  <p className="mt-0.5 truncate text-[10.5px] font-medium" style={{ color: EV_MUTED }}>
                    {item.sub}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/35" strokeWidth={2.2} />
              </motion.div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default VieScolaireWebParityMenu;
