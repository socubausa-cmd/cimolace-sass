/**
 * Routes de l'application **LIRI** « Élève » (LIRI Student) — hébergement de l’école / espace membre.
 * Ce n’est pas le portail vitrine « Prorascience » (marketing) : dès qu’un membre se connecte, il est dans **LIRI**
 * (web ou natif, préfixe `/m/eleve/...` pour la coque mobile).
 *
 * Cette application est volontairement isolée du Studio (création de cours,
 * outils enseignant, lives en hôte). Elle expose 4 onglets principaux :
 *   - home (tableau de bord)
 *   - live (cours en direct & rejoindre une session)
 *   - bibliotheque (catalogue, mes cours, progression)
 *   - communaute (chat, annonces, communautés)
 *
 * Les URL historiques `/m/liri/*` redirigent vers ces routes (app élève unifiée).
 *
 * Paiement Chariow (parcours complet mobile) :
 *   `…/forfaits` ou `…/modules-forfaits` (alias) → `payer` (`?plan` + `interval`) → `billing/checkout/:id`
 *   → ouverture URL prestataire (`openPaymentCheckoutUrl` + @capacitor/browser en natif)
 *   → retour app → rafraîchissement statut sur `BillingCheckoutView`.
 */
export const ELEVE_MOBILE_BASE = '/m/eleve';

export const ELEVE_MOBILE = {
  home: `${ELEVE_MOBILE_BASE}`,
  live: `${ELEVE_MOBILE_BASE}/live`,
  /** Chargement / checklist avant entrée dans le live (option `?session=uuid` pour rediriger vers `/live/:id`). */
  liveLoading: `${ELEVE_MOBILE_BASE}/live/loading`,
  /** Accès au live refusé (lien expiré, non invité, session indisponible). */
  liveAccessDenied: `${ELEVE_MOBILE_BASE}/live/access-denied`,
  /** Post-session : récap, suite pédagogique, Neuron (option `?session=uuid`). */
  liveTermine: `${ELEVE_MOBILE_BASE}/live/termine`,
  /** Salle d’attente : le formateur n’a pas encore démarré (`?session=uuid` optionnel). */
  liveWaiting: `${ELEVE_MOBILE_BASE}/live/waiting`,
  /** Messagerie de session pendant le live (UI maquette / démo, `?session=uuid` optionnel). */
  liveChat: `${ELEVE_MOBILE_BASE}/live/chat`,
  /**
   * **Affichage immersif** salle de live (invité) — variante par défaut, sans LiveKit, avant `/live/:sessionId`.
   * Voir `liveRoomImmersiveAlpha` et `src/lib/eleveLiveImmersive.js` pour d’autres variantes.
   */
  liveRoomMaquette: `${ELEVE_MOBILE_BASE}/live/maquette`,
  /** Même principe immersif, variante **Alpha** (maquette visuelle en cours d’intégration). */
  liveRoomImmersiveAlpha: `${ELEVE_MOBILE_BASE}/live/maquette/alpha`,
  /** Maquette salle (prof + “Ma vidéo” + membres + chat/questions + barre d’actions) — `LiriMobileHostView`. */
  liveRoomHostView: `${ELEVE_MOBILE_BASE}/live/maquette/host`,
  bibliotheque: `${ELEVE_MOBILE_BASE}/bibliotheque`,
  communaute: `${ELEVE_MOBILE_BASE}/communaute`,
  profile: `${ELEVE_MOBILE_BASE}/profil`,
  classe: `${ELEVE_MOBILE_BASE}/classe`,
  messages: `${ELEVE_MOBILE_BASE}/messages`,
  /** Choisir un contact pour un nouveau fil (app élève). */
  messagesNew: `${ELEVE_MOBILE_BASE}/messages/nouveau`,
  /** Fil 1:1 — `participantId` = autre compte. */
  messageThread: (participantId) =>
    `${ELEVE_MOBILE_BASE}/messages/${encodeURIComponent(String(participantId))}`,
  neuron: `${ELEVE_MOBILE_BASE}/neuron`,
  replays: `${ELEVE_MOBILE_BASE}/replays`,
  /** Agenda (école, calendrier, RDV, lives formation) — `EleveAgendaScreen`. */
  agenda: `${ELEVE_MOBILE_BASE}/agenda`,
  /**
   * Parité portail « Espace étudiant » (mêmes tables & logique que `StudentSchoolLifePage` web) — coque LIRI.
   */
  etudiant: `${ELEVE_MOBILE_BASE}/etudiant`,
  etudiantFormations: `${ELEVE_MOBILE_BASE}/etudiant/formations`,
  etudiantEvaluations: `${ELEVE_MOBILE_BASE}/etudiant/evaluations`,
  etudiantNotes: `${ELEVE_MOBILE_BASE}/etudiant/notes`,
  etudiantAbsences: `${ELEVE_MOBILE_BASE}/etudiant/absences`,
  etudiantDocuments: `${ELEVE_MOBILE_BASE}/etudiant/documents`,
  /**
   * Rubriques portail web (même menu que l’Espace étudiant) — `VieScolaireWebParityMenu`, onglet barre du bas.
   * (Plus sous « Vie scolaire » : c’est un accès global.)
   */
  enLigne: `${ELEVE_MOBILE_BASE}/en-ligne`,
  /** Notes, assiduité, événements d’école (données secrétariat) — `EleveVieScolaireLayout` + sous-routes. */
  vieScolaire: `${ELEVE_MOBILE_BASE}/vie-scolaire`,
  vieScolaireCalendrier: `${ELEVE_MOBILE_BASE}/vie-scolaire/calendrier`,
  vieScolaireResultats: `${ELEVE_MOBILE_BASE}/vie-scolaire/resultats`,
  vieScolaireAnnonces: `${ELEVE_MOBILE_BASE}/vie-scolaire/annonces`,
  /** Prise de rendez-vous progressive, native mobile / Capacitor. */
  appointmentRequest: `${ELEVE_MOBILE_BASE}/rendez-vous`,
  /** Parcours d’accès (welcome, lien, code) — sans shell à onglets. */
  connexion: `${ELEVE_MOBILE_BASE}/connexion`,
  /** Connexion avec UI alignée LIRI mobile (`EleveConnectionLayout`). */
  login: `${ELEVE_MOBILE_BASE}/login`,
  course: (id) => `${ELEVE_MOBILE_BASE}/cours/${encodeURIComponent(String(id))}`,
  /** Préfixe checkout paiement (formation, abonnement) — suivi + QR / Mobile Money. */
  billingCheckoutBase: `${ELEVE_MOBILE_BASE}/billing/checkout`,
  billingCheckout: (paymentId) =>
    `${ELEVE_MOBILE_BASE}/billing/checkout/${encodeURIComponent(String(paymentId))}`,
  /** Souscription / renouvellement (même logique que `/paiements/payer`). */
  payer: `${ELEVE_MOBILE_BASE}/paiements/payer`,
  /** Confirmation commande e‑commerce (retour checkout). */
  checkoutSuccess: `${ELEVE_MOBILE_BASE}/checkout-success`,
  /** Infos build / diagnostic (miroir de `/version`). */
  version: `${ELEVE_MOBILE_BASE}/version`,
  /** Forfaits d’abonnement par cycle (écran distinct du catalogue modules). */
  forfaits: `${ELEVE_MOBILE_BASE}/forfaits`,
  /** @deprecated Alias : redirigé vers `forfaits`. */
  modulesForfaits: `${ELEVE_MOBILE_BASE}/modules-forfaits`,
  /** Catalogue des 21 modules (mobile Capacitor). */
  modules: `${ELEVE_MOBILE_BASE}/modules`,
  /** Programme scolaire annuel — calendrier pédagogique par cycle et trimestre. */
  calendrierAnnuel: `${ELEVE_MOBILE_BASE}/calendrier-annuel`,
  /** Boutique Sacrée NGOWAZULU — écran natif Capacitor. */
  shop: `${ELEVE_MOBILE_BASE}/boutique`,
  /** Multi-rôles : choisir Élève / Propriétaire / Secrétaire / … (coque LIRI). */
  chooseAccountType: `${ELEVE_MOBILE_BASE}/choisir-compte`,
  /** Vitrine Prorascience / ISNA — version coque (mobile & Capacitor), distincte du portail web long. */
  prorascience: `${ELEVE_MOBILE_BASE}/prorascience`,
  /** Même contenu que `/ecoles` (Les 21 sciences), dans la coque vitrine mobile. */
  prorascienceLes21Sciences: `${ELEVE_MOBILE_BASE}/prorascience/les-21-sciences`,
};

/**
 * Liste des préfixes de routes RÉSERVÉES au Studio / Hôte / Admin.
 * L'app mobile élève bloque toute navigation vers ces routes pour empêcher
 * un élève d'atterrir par accident sur des outils enseignants.
 */
export const STUDIO_FORBIDDEN_PREFIXES = Object.freeze([
  '/studio',
  '/dev',
  '/dev/smartboard',
  '/dev/smartboard-designer',
  '/dev/liri',
  '/dev/liri-host-ui',
  '/secretariat',
  '/secretariat-space',
  '/backend',
  '/admin',
  '/live-studio',
  '/live-host',
  '/host',
]);

export function isStudioRoute(pathname = '') {
  if (!pathname) return false;
  const p = String(pathname).toLowerCase();
  return STUDIO_FORBIDDEN_PREFIXES.some(
    (prefix) => p === prefix || p.startsWith(`${prefix}/`),
  );
}
