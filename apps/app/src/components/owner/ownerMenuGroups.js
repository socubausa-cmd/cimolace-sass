import {
  LayoutDashboard, BookOpen, HeartHandshake as Handshake, Calendar, Library, CreditCard,
  Building2, Users, Settings, Bell, HelpCircle, Users as UsersIcon, Award, PieChart,
  Database, Users2, Sparkles, Link2, Megaphone, Flame, Star, ExternalLink, MessageCircle, Tags,
  Film, ShoppingBag, HeartPulse,
} from 'lucide-react';

/**
 * Les 6 familles du back-office école (24 entrées) — SOURCE UNIQUE.
 * Réutilisée par le back-office historique (OwnerDashboardLayout → LiriDashboardShell)
 * ET par le portail LIRI (onglet École `/liri/ecole`) qui embarque tout le back-office
 * dans SON shell (LiriPortalShell). Chaque id/href est inchangé.
 *
 * @param {string} payoutTenantSlug slug tenant pour l'URL d'encaissement
 * @param {string} basePath base des liens internes (def. '/owner-dashboard' ;
 *   le portail passe '/liri/ecole' pour que les href restent dans le portail).
 */
export function buildOwnerMenuGroups(payoutTenantSlug, basePath = '/owner-dashboard') {
  // Consommé aussi par le portail LIRI (basePath '/liri/ecole') : dans ce cas l'item
  // « Encaissement » doit RESTER dans le realm LIRI — jamais /t/:slug/* (= realm ISNA/tenant),
  // qui téléporterait l'utilisateur LIRI dans le back-office tenant (fuite cloison 3-realms).
  const isLiri = String(basePath || '').startsWith('/liri');
  return [
    {
      section: 'Pilotage',
      items: [
        { id: 'dashboard', icon: LayoutDashboard, label: "Vue d'ensemble" },
        { id: 'reports', icon: PieChart, label: 'Rapports' },
        { id: 'notifications', icon: Bell, label: 'Notifications' },
      ],
    },
    {
      section: 'Pédagogie',
      items: [
        { id: 'formations', icon: BookOpen, label: 'Formations' },
        { id: 'masterclass-factory', icon: Sparkles, label: 'Créer un cours (IA)', href: '/dashboard/tools/masterclass-factory' },
        // Vidéothèque : les replays des directs. Le créateur y va pour EXTRAIRE le cours
        // écrit d'une séance (bouton « Extraire le cours (PDF) », réservé owner/admin/
        // enseignant). Sans cette entrée il n'existait AUCUN chemin owner vers la page —
        // seul l'élève la voyait, alors que l'action est réservée aux créateurs.
        // Route LIRI-only → on ne l'expose PAS depuis le back-office historique, sinon
        // fuite de realm (cf. item « Encaissement » plus bas, même garde `isLiri`).
        ...(isLiri ? [{ id: 'videotheque', icon: Film, label: 'Vidéothèque', href: '/liri/videotheque' }] : []),
        // Atelier de cours : transformer une source (replay, TikTok, document)
        // en cours. Même garde `isLiri` — route LIRI-only.
        ...(isLiri ? [{ id: 'atelier', icon: Sparkles, label: 'Atelier de cours', href: '/liri/atelier' }] : []),
        { id: 'school-life', icon: Calendar, label: 'Vie Scolaire' },
        { id: 'coaching-mentoring', icon: Handshake, label: 'Coaching & Mentorat' },
        { id: 'workshops', icon: UsersIcon, label: 'Ateliers' },
        { id: 'ngowazulu-mentorat', icon: Flame, label: 'Ngowazulu Ateliers' },
        { id: 'certificates', icon: Award, label: 'Certificats' },
      ],
    },
    {
      section: 'Contenu & communauté',
      items: [
        { id: 'resources', icon: Library, label: 'Ressources' },
        { id: 'forum', icon: MessageCircle, label: 'Communication' },
        { id: 'reviews', icon: Star, label: 'Avis & Témoignages' },
        { id: 'support', icon: HelpCircle, label: 'Support' },
      ],
    },
    {
      section: 'Finances',
      items: [
        { id: 'catalog', icon: Tags, label: 'Catalogue & tarifs' },
        { id: 'payments', icon: CreditCard, label: 'Paiements' },
        // Boutique numérique : ventes du livre + demandes d'accompagnement. Les deux
        // arrivaient en base et par e-mail sans AUCUN écran de suivi.
        { id: 'book-orders', icon: ShoppingBag, label: 'Ventes du livre' },
        { id: 'accompaniment', icon: HeartPulse, label: 'Demandes d’accompagnement' },
        { id: 'tenant-encaissement', icon: ExternalLink, label: 'Encaissement (URL tenant)', href: isLiri ? '/liri/compte' : `/t/${payoutTenantSlug}/admin/settings` },
        { id: 'chariow-externes', icon: Link2, label: 'Chariow Externes', href: '/admin/billing?tab=external' },
      ],
    },
    {
      section: 'Croissance',
      items: [
        { id: 'studio-creator', icon: Sparkles, label: 'Studio Créateur', href: '/studio' },
        { id: 'marketing-automation', icon: Megaphone, label: 'Marketing Automation', href: '/liri/crm?tab=automation' },
        { id: 'ngowazulu-operations', icon: Flame, label: 'Ngowazulu Opérations' },
        { id: 'knowledge-base', icon: Database, label: 'Base de connaissances', href: `${basePath}/knowledge-base` },
      ],
    },
    {
      section: 'Administration',
      items: [
        { id: 'school-info', icon: Building2, label: 'École' },
        { id: 'team', icon: Users2, label: 'Équipe' },
        { id: 'users', icon: Users, label: 'Utilisateurs' },
        { id: 'settings', icon: Settings, label: 'Paramètres' },
      ],
    },
  ];
}
