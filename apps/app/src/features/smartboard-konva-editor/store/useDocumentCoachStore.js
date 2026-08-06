/**
 * useDocumentCoachStore — IA Coach Documentaire (LONGIA Architect)
 *
 * Gère le cycle de vie complet de la création guidée d'un document :
 *   idle → detecting → questioning → generating → editing → reviewing
 *
 * Ce qui est LOCAL (aucun réseau) :
 *  · détection du type par mots-clés (DETECTION_MAP), rapprochement catalogue
 *  · construction du plan de structure (buildDocumentPlan) — choix d'un modèle,
 *    pas une rédaction
 *  · pré-analyse de registre (analyserContexteLocal)
 *
 * Ce qui appelle réellement un modèle (via `lib/documentIntelligence.js`) :
 *  · affinage du contexte (registre + formalité)
 *  · rédaction intégrale du document (mode `auto`)
 *  · reformulations, blocs de suggestion, terminologie
 *
 * ⛔ MODE CONTRÔLE LIBRE (`modeAssistance === 'libre'`) : le verrou est posé dans
 *    documentIntelligence — aucune de ces fonctions ne part sur le réseau.
 * ⛔ L'IA PROPOSE, elle n'écrit jamais : ce store ne touche pas au canvas.
 *    Les propositions attendent dans `rewriteProposals` / `blocSuggestions` ;
 *    l'insertion se fait côté interface via `consommerProposition(id)`.
 */
import { create } from 'zustand';
import {
  getTemplatesForCoachType,
  getTemplateById,
  searchTemplates,
  inferCoachTypeFromDomain,
} from '@/features/smartboard-konva-editor/lib/documentTemplateLibrary';
import {
  MODES_ASSISTANCE,
  REGISTRES,
  definirModeAssistance,
  analyserContexteLocal,
  detecterContexte,
  suggererBlocs,
  suggererFormulation,
  suggererMotTechnique,
  regenererSuggestion as regenererSuggestionIA,
  redigerDocumentComplet,
} from '@/features/smartboard-konva-editor/lib/documentIntelligence';
import { critiquerMiseEnPage } from '@/features/smartboard-konva-editor/lib/documentDesignCritique';

export { MODES_ASSISTANCE };

/* ─── Métadonnées des types de document ──────────────────────────── */
export const DOC_TYPE_META = {
  letter: {
    label: 'Lettre', icon: '📧', tone: 'administrative',
    requiredBlocks: ['entête', 'objet', 'corps', 'formule de politesse', 'signature'],
  },
  contract: {
    label: 'Contrat', icon: '📋', tone: 'legal',
    requiredBlocks: ['parties', 'objet', 'durée', 'modalités', 'clauses', 'signatures'],
  },
  attestation: {
    label: 'Attestation', icon: '📜', tone: 'institutional',
    requiredBlocks: ['entête', 'corps de l\'attestation', 'date', 'signature'],
  },
  cv: {
    label: 'CV', icon: '👤', tone: 'modern_professional',
    requiredBlocks: ['identité', 'formation', 'expérience', 'compétences'],
  },
  invoice: {
    label: 'Facture', icon: '🧾', tone: 'formal',
    requiredBlocks: ['émetteur', 'destinataire', 'lignes de facture', 'total', 'conditions de paiement'],
  },
  minutes: {
    label: 'Procès-verbal', icon: '📝', tone: 'institutional',
    requiredBlocks: ['date et lieu', 'participants', 'ordre du jour', 'délibérations', 'signature'],
  },
  certificate: {
    label: 'Certificat', icon: '🏆', tone: 'formal',
    requiredBlocks: ['titre', 'bénéficiaire', 'objet', 'date', 'signature'],
  },
  report: {
    label: 'Rapport', icon: '📊', tone: 'formal',
    requiredBlocks: ['titre', 'résumé exécutif', 'contexte', 'analyse', 'conclusion', 'annexes'],
  },
  internal_policy: {
    label: 'Règlement intérieur', icon: '📌', tone: 'institutional',
    requiredBlocks: ['préambule', 'articles', 'dispositions', 'sanctions', 'signatures'],
  },
  student_record: {
    label: 'Fiche élève', icon: '🎓', tone: 'simple',
    requiredBlocks: ['identité', 'classe', 'notes', 'observations', 'cachet'],
  },
};

/* ─── Flux de questions guidées par type ──────────────────────────── */
export const GUIDED_FLOWS = {
  letter: [
    { id: 'dest',      q: 'À qui cette lettre est-elle destinée ?',                      type: 'text'    },
    { id: 'objet',     q: 'Quel est l\'objet de la lettre ?',                             type: 'text'    },
    { id: 'contenu',   q: 'Décrivez brièvement le contenu principal.',                    type: 'textarea'},
    { id: 'ton',       q: 'Quel ton souhaitez-vous ?', type: 'select',
      options: ['Administratif', 'Formel', 'Cordial', 'Juridique']                                        },
    { id: 'signature', q: 'Faut-il ajouter formule de politesse et signature ?',          type: 'confirm' },
  ],
  contract: [
    { id: 'parties',   q: 'Qui sont les parties (noms ou rôles) ?',                       type: 'text'    },
    { id: 'objet',     q: 'Quel est l\'objet du contrat ?',                                type: 'text'    },
    { id: 'duree',     q: 'Quelle est la durée ou la date d\'effet ?',                     type: 'text'    },
    { id: 'montant',   q: 'Quel est le montant ou la contrepartie ?',                      type: 'text'    },
    { id: 'clauses',   q: 'Souhaitez-vous des clauses particulières ? (ex : résiliation)', type: 'textarea'},
  ],
  attestation: [
    { id: 'benef',     q: 'Pour qui est cette attestation ?',                              type: 'text'    },
    { id: 'fait',      q: 'Quel fait doit être attesté ?',                                 type: 'textarea'},
    { id: 'date',      q: 'Quelle date doit apparaître ?',                                 type: 'text'    },
    { id: 'signataire',q: 'Qui signe l\'attestation ?',                                    type: 'text'    },
  ],
  cv: [
    { id: 'nom',       q: 'Nom et prénom du candidat ?',                                   type: 'text'    },
    { id: 'poste',     q: 'Poste ou titre recherché ?',                                    type: 'text'    },
    { id: 'experience',q: 'Années d\'expérience et secteur ?',                             type: 'text'    },
    { id: 'style',     q: 'Style visuel souhaité ?', type: 'select',
      options: ['Classique sobre', 'Moderne coloré', 'Minimaliste', 'Institutionnel']                      },
  ],
  invoice: [
    { id: 'emetteur',  q: 'Nom / raison sociale de l\'émetteur ?',                         type: 'text'    },
    { id: 'client',    q: 'Nom du client ou de la société cliente ?',                       type: 'text'    },
    { id: 'services',  q: 'Décrivez les prestations ou produits facturés.',                 type: 'textarea'},
    { id: 'paiement',  q: 'Délai et mode de paiement souhaité ?',                           type: 'text'    },
  ],
  default: [
    { id: 'destinataire', q: 'Pour qui est ce document ?',                                 type: 'text'    },
    { id: 'objet',        q: 'Quel est l\'objet principal ?',                               type: 'text'    },
    { id: 'contenu',      q: 'Quelles informations essentielles faut-il inclure ?',         type: 'textarea'},
    { id: 'ton',          q: 'Quel niveau de formalité ?', type: 'select',
      options: ['Simple', 'Formel', 'Administratif', 'Juridique']                                          },
  ],
};

/* ─── Niveaux d'assistance ───────────────────────────────────────── */
/** `mode` relie chaque niveau au verrou IA de documentIntelligence. */
export const ASSISTANCE_LEVELS = [
  { level: 1, label: 'Suggestion',      desc: 'L\'IA propose — vous rédigez',      icon: '💡', mode: 'suggestions' },
  { level: 2, label: 'Co-rédaction',    desc: 'L\'IA construit section par section', icon: '✍️', mode: 'suggestions' },
  { level: 3, label: 'Génération auto', desc: 'L\'IA rédige le document entier',   icon: '⚡', mode: 'auto'        },
];

/* ─── Détection d'intention ──────────────────────────────────────── */
const DETECTION_MAP = [
  { keys: ['lettre', 'letter', 'courrier', 'demande',  'réclamation', 'reclamation'], type: 'letter'          },
  { keys: ['contrat', 'contract', 'accord', 'convention', 'mise en demeure'],         type: 'contract'        },
  { keys: ['attestation', 'atteste', 'certifie', 'certif', 'justificatif'],           type: 'attestation'     },
  { keys: ['cv', 'curriculum', 'candidature', 'résumé', 'resume'],                    type: 'cv'              },
  { keys: ['facture', 'invoice', 'devis', 'bon de commande'],                         type: 'invoice'         },
  { keys: ['procès-verbal', 'pv ', 'compte rendu', 'réunion', 'reunion'],             type: 'minutes'         },
  { keys: ['certificat', 'certificate', 'diplome', 'diplôme'],                        type: 'certificate'     },
  { keys: ['rapport', 'report', 'bilan', 'analyse'],                                  type: 'report'          },
  { keys: ['règlement', 'reglement', 'règles intérieures', 'policy'],                 type: 'internal_policy' },
  { keys: ['fiche élève', 'fiche etudiant', 'bulletin', 'relevé de notes'],           type: 'student_record'  },
];

function detectDocumentType(text) {
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const loose = normalized.replace(/[''`]/g, ' ');
  if (
    (loose.includes('demande') && loose.includes('emploi')) ||
    loose.includes('lettre de motivation') ||
    loose.includes('candidature spont') ||
    /\b(job application|cover letter)\b/.test(normalized)
  ) {
    return 'letter';
  }
  for (const { keys, type } of DETECTION_MAP) {
    if (keys.some(k => normalized.includes(k))) return type;
  }
  return null;
}

/** Sans mot-clé exact : recherche catalogue puis base lettre (jamais bloquant). */
function inferNearestDocumentIntent(userText) {
  const hits = searchTemplates(userText);
  if (hits.length) {
    const coachT = inferCoachTypeFromDomain(hits[0].domain) || 'letter';
    return { type: coachT, strategy: 'nearest_template', nearestTemplates: hits.slice(0, 8) };
  }
  const n = userText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/\b(creer|créer|generer|générer|rediger|rédiger|modele|modèle|papier|document|lettre|fiche|dossier)\b/.test(n)) {
    return { type: 'letter', strategy: 'generative_default', nearestTemplates: null };
  }
  return { type: 'letter', strategy: 'generative_fallback', nearestTemplates: null };
}

/* ─── État initial ───────────────────────────────────────────────── */
const INITIAL = {
  isDocumentMode: false,
  phase: 'idle',             // 'idle'|'detecting'|'questioning'|'generating'|'editing'|'reviewing'
  detectedType: null,
  selectedTemplate: null,
  matchedTemplates: [],      // ← templates de la bibliothèque correspondant au type
  assistanceLevel: 2,
  guidedFlow: [],
  currentQIdx: 0,
  answers: {},
  documentPlan: null,
  suggestions: [],
  validationIssues: [],
  coachMessages: [],
  isGenerating: false,
  writingRequest: null,      // dernière demande de reformulation (instruction + mode)

  /* ── Étage IA de rédaction ─────────────────────────────────────── */
  modeAssistance: 'suggestions', // 'libre' | 'suggestions' | 'auto'
  derniereDemande: '',           // dernier texte libre de l'utilisateur (source du contexte)
  contexteDocument: null,        // sortie de detecterContexte
  blocSuggestions: [],           // blocs prêts à insérer (tirer / coller / régénérer)
  rewriteProposals: [],          // reformulations proposées — JAMAIS appliquées d'office
  termeSuggestions: [],          // mots techniques proposés
  documentRedige: null,          // sortie de redigerDocumentComplet
  critiqueMiseEnPage: null,      // sortie de critiquerMiseEnPage (constats + corrections)
  iaOccupee: null,               // libellé de la tâche IA en cours, sinon null
  iaErreur: null,                // dernier échec IA, dit à l'utilisateur
};

/* ─── Store ──────────────────────────────────────────────────────── */
export const useDocumentCoachStore = create((set, get) => ({
  ...INITIAL,

  /* ── Mode ────────────────────────────────────────────────────── */
  activateDocumentMode: (modeAssistance) => {
    const mode = modeAssistance ?? get().modeAssistance ?? 'suggestions';
    definirModeAssistance(mode);
    set({ isDocumentMode: true, modeAssistance: mode });
    get().addCoachMessage({
      role: 'ai',
      text: mode === 'libre'
        ? '✦ **Contrôle libre** — aucune IA ne sera appelée. Vous écrivez, je n’interviens que si vous basculez sur « Suggestions ».'
        : '✦ **Architecte documentaire** activé — décrivez le document que vous souhaitez créer, ou choisissez un mode ci-dessous.',
    });
  },
  deactivateDocumentMode: () => {
    definirModeAssistance('suggestions');
    set({ ...INITIAL });
  },
  resetFlow: () => set({
    phase: 'idle', detectedType: null, guidedFlow: [], currentQIdx: 0,
    answers: {}, documentPlan: null, suggestions: [], validationIssues: [],
    isGenerating: false, writingRequest: null,
    contexteDocument: null, blocSuggestions: [], rewriteProposals: [],
    termeSuggestions: [], documentRedige: null, critiqueMiseEnPage: null,
    iaOccupee: null, iaErreur: null,
  }),

  /**
   * Interrupteur du cahier des charges n°3.
   * ⛔ 'libre' pose le verrou DANS documentIntelligence : plus aucun appel réseau,
   *    y compris en arrière-plan (affinage de contexte, suggestions automatiques).
   * @param {'libre'|'suggestions'|'auto'} mode
   */
  setModeAssistance: (mode) => {
    const applique = definirModeAssistance(mode);
    set({ modeAssistance: applique, iaErreur: null });
    if (applique === 'libre') {
      // Les propositions en attente ne sont pas jetées : elles restent visibles
      // tant que l'utilisateur ne les a pas insérées ou effacées lui-même.
      set({ iaOccupee: null });
    }
    get().addCoachMessage({
      role: 'ai',
      text: applique === 'libre'
        ? '✦ **Contrôle libre** — je n’appelle plus aucun modèle. Rien ne part de votre navigateur.'
        : applique === 'auto'
          ? '✦ **Rédaction auto** — je rédigerai le document entier une fois vos réponses données.'
          : '✦ **Suggestions** — je propose quand vous m’appelez, vous gardez la main.',
    });
    return applique;
  },

  /* ── Détection d'intention ───────────────────────────────────── */
  detectIntent: (userText) => {
    get().addCoachMessage({ role: 'user', text: userText });

    let detected = detectDocumentType(userText);
    let strategy = 'keyword_type';
    /** @type {ReturnType<typeof searchTemplates>|null} */
    let nearestTemplates = null;

    if (!detected) {
      const near = inferNearestDocumentIntent(userText);
      detected = near.type;
      strategy = near.strategy;
      nearestTemplates = near.nearestTemplates;
    }

    const meta = DOC_TYPE_META[detected];
    const flow = GUIDED_FLOWS[detected] ?? GUIDED_FLOWS.default;
    const matched =
      nearestTemplates && nearestTemplates.length > 0
        ? nearestTemplates
        : getTemplatesForCoachType(detected);

    // Pré-analyse de registre : 100 % locale, elle ne coûte aucun aller-retour
    // et sert de socle même en mode contrôle libre.
    const contexteLocal = analyserContexteLocal(userText, detected);

    set({
      detectedType: detected,
      matchedTemplates: matched,
      phase: 'questioning',
      guidedFlow: flow,
      currentQIdx: 0,
      answers: {},
      contexteDocument: contexteLocal,
      derniereDemande: userText,
    });

    let prefix = '';
    if (strategy === 'nearest_template' && nearestTemplates?.length) {
      prefix = `✦ Pas d'intention standard exacte — **${nearestTemplates.length} modèle(s)** proches dans la bibliothèque.\n\n`;
    } else if (strategy === 'generative_default' || strategy === 'generative_fallback') {
      prefix = `✦ Base **${meta.label}** proposée (sans titre catalogue obligatoire) — nous personnalisons ensemble.\n\n`;
    }

    const tplNames = matched.slice(0, 3).map(t => t.name).join(' · ');
    const tplLine = matched.length
      ? `**${matched.length} modèle${matched.length > 1 ? 's' : ''}** : ${tplNames}…\n\n`
      : `Aucun modèle ne porte ce libellé exact — on part de la **structure** ci-dessous.\n\n`;

    get().addCoachMessage({
      role: 'ai',
      text:
        prefix +
        `✦ Document : **${meta.label}** ${meta.icon}\n` +
        `Structure : ${meta.requiredBlocks.join(' · ')}\n\n` +
        tplLine +
        `**${flow[0].q}**`,
    });

    // Affinage du registre par le modèle — asynchrone, sans bloquer la question
    // en cours. Verrouillé en mode libre par documentIntelligence.
    void get().affinerContexte(userText, detected);

    return detected;
  },

  /* ── Point 4 du cahier : contexte administratif / commercial / juridique ── */
  /**
   * Affine registre + niveau de formalité. Ne remplace le contexte local que si
   * le modèle a réellement répondu ; sinon on garde l'analyse locale et on le DIT
   * (`contexteDocument.degrade`).
   */
  affinerContexte: async (texte, typeDoc) => {
    if (get().modeAssistance === 'libre') return get().contexteDocument;
    const type = typeDoc ?? get().detectedType ?? null;
    set({ iaOccupee: 'contexte', iaErreur: null });
    try {
      const ctx = await detecterContexte(texte, type);
      set({ contexteDocument: ctx, iaOccupee: null });
      if (ctx?.source === 'llm') {
        const reg = REGISTRES[ctx.registre];
        get().addCoachMessage({
          role: 'ai',
          text: `✦ Contexte lu : **${reg?.label ?? ctx.registre}** · formalité **${ctx.formaliteLabel}** (${ctx.niveauFormalite}/5)`
            + (ctx.intention ? `\n${ctx.intention}` : ''),
        });
      }
      return ctx;
    } catch (e) {
      set({ iaOccupee: null, iaErreur: e?.message ?? 'Analyse du contexte impossible' });
      return get().contexteDocument;
    }
  },

  /* ── Répondre à une question guidée ─────────────────────────── */
  answerQuestion: (answer) => {
    const { guidedFlow, currentQIdx, answers } = get();
    const q = guidedFlow[currentQIdx];
    if (!q) return;

    const newAnswers = { ...answers, [q.id]: answer };
    const nextIdx = currentQIdx + 1;
    const isLast = nextIdx >= guidedFlow.length;

    set({ answers: newAnswers, currentQIdx: nextIdx });

    if (isLast) {
      const auto = get().modeAssistance === 'auto';
      set({ phase: 'generating', isGenerating: true });
      get().addCoachMessage({
        role: 'ai',
        text: auto
          ? '✦ J’ai toutes les informations. **Je rédige le document…**'
          : '✦ J’ai toutes les informations. **Choix de la structure…**',
      });
      // Le plan est LOCAL et immédiat (choix d'un modèle + liste des blocs).
      // Seule la rédaction part sur le réseau, et uniquement en mode auto.
      get().buildDocumentPlan(newAnswers);
      if (auto) void get().genererDocumentComplet();
    } else {
      const next = guidedFlow[nextIdx];
      get().addCoachMessage({ role: 'ai', text: `✦ **${next.q}**` });
    }
  },

  /* ── Construire le plan documentaire ────────────────────────── */
  buildDocumentPlan: (answers) => {
    const { detectedType, matchedTemplates, assistanceLevel } = get();
    const meta = DOC_TYPE_META[detectedType] ?? { requiredBlocks: [], tone: 'formal', label: 'Document' };

    // Choisit le meilleur template depuis la bibliothèque (1er match ou override si réponse style)
    const recommendedTpl = matchedTemplates[0] ?? null;

    const plan = {
      type: detectedType,
      label: meta.label,
      icon:  meta.icon ?? '📄',
      blocks: recommendedTpl?.zones ?? meta.requiredBlocks,
      tone: answers.ton ?? answers.style ?? meta.tone,
      pages: (recommendedTpl?.zones?.length ?? meta.requiredBlocks.length) > 6 ? 2 : 1,
      answers,
      // Référence au template de la bibliothèque
      libraryTemplateId: recommendedTpl?.id ?? null,
      libraryTemplateName: recommendedTpl?.name ?? null,
      styleVariants: recommendedTpl?.style_variants ?? [],
      quickActions: recommendedTpl?.quick_actions ?? [],
      generatedAt: Date.now(),
    };

    const lvl = ASSISTANCE_LEVELS.find(l => l.level === assistanceLevel);
    set({ documentPlan: plan, selectedTemplate: recommendedTpl?.id ?? null, phase: 'editing', isGenerating: false });

    const tplInfo = recommendedTpl
      ? `\nModèle sélectionné : **${recommendedTpl.name}** · ${(recommendedTpl.style_variants?.length ?? 1)} variante${recommendedTpl.style_variants?.length > 1 ? 's' : ''} de style`
      : '';

    // ⛔ Le libellé doit décrire ce qui vient RÉELLEMENT de se passer : à ce stade
    //    une STRUCTURE a été choisie, aucun texte n'a été rédigé. L'ancien message
    //    renvoyait vers un bouton « Générer le document » qui n'existait nulle part.
    const modeAssistance = get().modeAssistance;
    const suite =
      modeAssistance === 'libre'
        ? 'Contrôle libre : rien ne sera rédigé sans votre demande.'
        : modeAssistance === 'auto'
          ? 'Rédaction du contenu en cours…'
          : 'Structure prête. Demandez-moi la rédaction d’un bloc quand vous le souhaitez.';

    get().addCoachMessage({
      role: 'ai',
      text:
        `✦ **Structure choisie** — ${plan.blocks.length} blocs · ${plan.pages} page${plan.pages > 1 ? 's' : ''} · Ton : ${plan.tone}${tplInfo}\n\n` +
        `Mode : **${lvl?.label}**\n\n` +
        suite,
    });

    get()._generateSuggestions(plan);
    return plan;
  },

  /* ── Point 2 du cahier : l'IA rédige TOUT le document ───────────── */
  /**
   * Rédige le contenu de tous les blocs requis du type détecté.
   * ⛔ Le résultat est DÉPOSÉ dans `documentRedige` — il n'est jamais écrit
   *    d'office sur le canvas ni par-dessus le texte de l'utilisateur.
   *    L'interface propose l'insertion ; l'utilisateur la déclenche.
   */
  genererDocumentComplet: async () => {
    const { modeAssistance, detectedType, documentPlan, answers, contexteDocument, derniereDemande } = get();
    if (modeAssistance === 'libre') {
      get().addCoachMessage({
        role: 'ai',
        text: '✦ Mode **contrôle libre** : je ne rédige rien. Basculez sur « Rédaction auto » si vous voulez que je m’en charge.',
      });
      return null;
    }

    const meta = DOC_TYPE_META[detectedType] ?? null;
    const blocsRequis = meta?.requiredBlocks ?? documentPlan?.blocks ?? [];
    const contexte =
      contexteDocument ?? analyserContexteLocal(derniereDemande || '', detectedType);

    set({ phase: 'generating', isGenerating: true, iaOccupee: 'redaction', iaErreur: null });

    const res = await redigerDocumentComplet(detectedType, contexte, answers, {
      blocsRequis,
      titreDocument: documentPlan?.libraryTemplateName ?? meta?.label ?? 'Document',
      modeleNom: documentPlan?.libraryTemplateName ?? null,
      longueur: answers?.longueur ?? null,
    });

    if (!res?.ok) {
      set({ phase: 'editing', isGenerating: false, iaOccupee: null, iaErreur: res?.message ?? 'Rédaction impossible' });
      get().addCoachMessage({
        role: 'ai',
        text: `✦ **Rédaction impossible** — ${res?.message ?? 'modèle injoignable'}.\nLa structure reste en place ; réessayez ou rédigez à la main.`,
      });
      return res;
    }

    set({ documentRedige: res, phase: 'editing', isGenerating: false, iaOccupee: null });

    const trous = res.blocsIncomplets?.length
      ? `\n⚠️ ${res.blocsIncomplets.length} bloc(s) non rédigé(s) : ${res.blocsIncomplets.join(' · ')}`
      : '';
    get().addCoachMessage({
      role: 'ai',
      text:
        `✦ **Document rédigé** — ${res.blocs.length} blocs prêts à insérer.${trous}\n\n` +
        'Rien n’a été posé sur la page : à vous d’insérer les blocs que vous gardez.',
    });
    return res;
  },

  /* ── Suggestions contextuelles ───────────────────────────────── */
  /**
   * Remarques locales sur la structure. `bloc` (quand il est présent) rend la
   * remarque ACTIONNABLE : l'interface peut la brancher sur `demanderBlocs(bloc)`
   * pour obtenir du texte prêt à insérer plutôt qu'un simple conseil.
   */
  _generateSuggestions: (plan) => {
    const s = [];
    if (!plan.answers?.signature && plan.type !== 'cv') {
      s.push({ type: 'suggest_signature', text: 'Ajouter une zone de signature',  severity: 'info',    bloc: 'signature' });
    }
    if (plan.type === 'letter' && !plan.answers?.objet) {
      s.push({ type: 'suggest_header',    text: 'Préciser l\'objet de la lettre', severity: 'warning', bloc: 'objet' });
    }
    if (plan.pages > 1) {
      s.push({ type: 'suggest_page_break', text: 'Optimiser les sauts de page',   severity: 'info'    });
    }
    if (plan.type === 'report') {
      s.push({ type: 'suggest_subtitle', text: 'Ajouter des sous-titres de sections', severity: 'info', bloc: 'sous-titres de sections' });
    }
    set({ suggestions: s });
  },

  /* ── Validation ──────────────────────────────────────────────── */
  /**
   * @param {Array<{x?:number,y?:number,width?:number,height?:number,type?:string,content?:{text?:string},style?:{fontSize?:number,fill?:string}}>} [objetsScene]
   *   Objets réels de la page. ⛔ Sans eux, la validation ne regarde QUE le
   *   questionnaire : un verdict « prêt pour export » sur une page dont les blocs
   *   se superposent serait un mensonge. L'appelant doit passer la scène.
   */
  validateDocument: (objetsScene) => {
    const { documentPlan, answers } = get();
    const issues = [];
    if (!documentPlan) {
      issues.push({ type: 'missing_plan', message: 'Aucun plan documentaire détecté', severity: 'error' });
    } else {
      if (!answers?.signature && documentPlan.type !== 'cv') {
        issues.push({ type: 'missing_signature', message: 'Signature ou cachet manquant', severity: 'warning' });
      }
      if (!answers?.destinataire && !answers?.dest && !answers?.benef) {
        issues.push({ type: 'missing_recipient', message: 'Destinataire non renseigné', severity: 'warning' });
      }
      if (!answers?.objet && documentPlan.type === 'letter') {
        issues.push({ type: 'missing_subject', message: 'Objet de la lettre manquant', severity: 'warning' });
      }
    }

    /* ── Mise en page réelle ──────────────────────────────────────
       ⛔ Aucun contrôle géométrique n'est réécrit ici : `critiquerMiseEnPage`
          (lib/documentDesignCritique.js) mesure déjà débordement, marges,
          chevauchement, contraste WCAG et hiérarchie typographique.
          Deux validateurs vivants finiraient par rendre deux verdicts. */
    const objets = Array.isArray(objetsScene) ? objetsScene : null;
    let sceneLue = false;
    if (objets) {
      sceneLue = true;
      const critique = critiquerMiseEnPage(objets, {}, {
        typeDoc: documentPlan?.type ?? get().detectedType ?? null,
        templateId: documentPlan?.libraryTemplateId ?? null,
        registre: get().contexteDocument?.registre ?? null,
      });
      const gravites = { bloquant: 'error', majeur: 'error', mineur: 'warning', info: 'info' };
      for (const c of critique.constats ?? []) {
        issues.push({
          type: c.regle,
          message: c.mesure ? `${c.titre} — ${c.mesure}` : c.titre,
          severity: gravites[c.gravite] ?? 'warning',
          objetIds: c.objetIds ?? [],
          correction: c.correction ?? null,
        });
      }
      set({ critiqueMiseEnPage: critique });
    } else {
      // Un verdict qui n'a pas regardé la page ne peut pas dire « prêt pour export ».
      issues.push({
        type: 'scene_not_read',
        message: 'Mise en page non analysée (scène non transmise au validateur)',
        severity: 'warning',
      });
      set({ critiqueMiseEnPage: null });
    }

    set({ validationIssues: issues, phase: 'reviewing' });

    const bloquants = issues.filter((i) => i.severity === 'error').length;
    const msg = issues.length === 0
      ? '✦ Document **validé** — structure et mise en page contrôlées. Prêt pour export PDF ✓'
      : bloquants > 0
        ? `✦ **${bloquants} problème${bloquants > 1 ? 's' : ''} bloquant${bloquants > 1 ? 's' : ''}** avant export` +
          (issues.length > bloquants ? ` · ${issues.length - bloquants} point(s) à vérifier` : '')
        : `✦ **${issues.length} point${issues.length > 1 ? 's' : ''} à vérifier** avant finalisation.` +
          (sceneLue ? '' : '\n\n*Mise en page non contrôlée.*');

    get().addCoachMessage({ role: 'ai', text: msg });
    return issues;
  },

  /* ── Reformulation (point 1 du cahier) ──────────────────────────── */
  /**
   * Reformule un extrait et DÉPOSE les propositions dans `rewriteProposals`.
   *
   * ⛔ Aucune écriture automatique : le texte collé par l'utilisateur n'est ni
   *    remplacé ni perdu (il reste dans `writingRequest.instruction`).
   *    L'insertion passe par `consommerProposition(id)` côté interface.
   *
   * @param {string} instruction — le texte à reformuler
   * @param {'formalize'|'simplify'|'legalize'|'expand'|'compress'|'admin'} [mode]
   */
  requestRewrite: async (instruction, mode = 'formalize') => {
    const source = String(instruction ?? '').trim();
    if (!source) return null;

    const modeLabels = {
      formalize:   'Rendre plus formel',
      simplify:    'Simplifier',
      legalize:    'Juridiciser',
      expand:      'Développer',
      compress:    'Résumer',
      admin:       'Style administratif',
    };
    const modeIntentions = {
      formalize: 'monter d’un cran en formalité, sans alourdir',
      simplify:  'rendre immédiatement compréhensible, phrases courtes',
      legalize:  'terminologie juridique rigoureuse, aucune ambiguïté',
      expand:    'développer et préciser, sans inventer de fait nouveau',
      compress:  'condenser en gardant tous les faits',
      admin:     'style administratif français consacré',
    };

    set({ writingRequest: { instruction: source, mode }, phase: 'editing' });
    get().addCoachMessage({ role: 'user', text: `Reformuler : "${source.slice(0, 160)}${source.length > 160 ? '…' : ''}"` });

    if (get().modeAssistance === 'libre') {
      get().addCoachMessage({
        role: 'ai',
        text: '✦ Mode **contrôle libre** : aucune reformulation n’est demandée à un modèle. Votre texte est intact.',
      });
      return null;
    }

    set({ iaOccupee: 'reformulation', iaErreur: null });
    const contexte = get().contexteDocument ?? analyserContexteLocal(source, get().detectedType);
    const res = await suggererFormulation(source, contexte, {
      intention: modeIntentions[mode] ?? mode,
      nombre: 3,
    });

    if (!res?.ok) {
      set({ iaOccupee: null, iaErreur: res?.message ?? 'Reformulation indisponible' });
      get().addCoachMessage({
        role: 'ai',
        text: `✦ **${modeLabels[mode] ?? mode}** — indisponible : ${res?.message ?? 'modèle injoignable'}.\nVotre texte est conservé tel quel.`,
      });
      return res;
    }

    set({ rewriteProposals: res.propositions, iaOccupee: null });
    get().addCoachMessage({
      role: 'ai',
      text:
        `✦ **${modeLabels[mode] ?? mode}** — ${res.propositions.length} proposition${res.propositions.length > 1 ? 's' : ''} :\n\n` +
        res.propositions.map((p, i) => `**${i + 1}.** ${p.texte}${p.note ? `\n*${p.note}*` : ''}`).join('\n\n') +
        (res.partiel ? '\n\n*(Repli : une seule variante disponible.)*' : '') +
        '\n\nAucun bloc n’a été modifié — insérez celle que vous gardez.',
    });
    return res;
  },

  /* ── Blocs de suggestion (tirer / coller / régénérer) ───────────── */
  /**
   * @param {string} blocManquant — nom du bloc, ex. « objet », « formule de politesse »
   */
  demanderBlocs: async (blocManquant, opts = {}) => {
    if (get().modeAssistance === 'libre') {
      get().addCoachMessage({ role: 'ai', text: '✦ Mode **contrôle libre** : aucune suggestion n’est demandée.' });
      return null;
    }
    const { detectedType, answers, documentPlan, derniereDemande } = get();
    const contexte = get().contexteDocument ?? analyserContexteLocal(derniereDemande || '', detectedType);
    set({ iaOccupee: 'blocs', iaErreur: null });

    const res = await suggererBlocs(contexte, blocManquant, {
      titreDocument: documentPlan?.libraryTemplateName ?? DOC_TYPE_META[detectedType]?.label,
      reponses: answers,
      nombre: opts.nombre ?? 3,
    });

    if (!res?.ok) {
      set({ iaOccupee: null, iaErreur: res?.message ?? 'Suggestions indisponibles' });
      return res;
    }
    // Remplacement par emplacement : deux demandes sur le même bloc ne s'empilent pas.
    const autres = get().blocSuggestions.filter((s) => s.cle !== blocManquant);
    set({ blocSuggestions: [...autres, ...res.propositions], iaOccupee: null });
    return res;
  },

  /** Terminologie du domaine pour un extrait (le « mot juste » du point 1). */
  demanderMotTechnique: async (extrait) => {
    if (get().modeAssistance === 'libre') return null;
    const contexte = get().contexteDocument ?? analyserContexteLocal(extrait, get().detectedType);
    set({ iaOccupee: 'terminologie', iaErreur: null });
    const res = await suggererMotTechnique(extrait, contexte);
    if (!res?.ok) {
      set({ iaOccupee: null, iaErreur: res?.message ?? 'Terminologie indisponible' });
      return res;
    }
    set({ termeSuggestions: res.propositions, iaOccupee: null });
    return res;
  },

  /**
   * Régénère une suggestion EN PLACE (même identifiant) : la carte est remplacée,
   * pas dupliquée, et le texte précédent est explicitement écarté.
   * @param {string} suggestionId
   */
  regenererSuggestion: async (suggestionId) => {
    if (get().modeAssistance === 'libre') return null;
    const s = get()._trouverSuggestion(suggestionId);
    if (!s) return null;

    set({ iaOccupee: 'regeneration', iaErreur: null });
    const res = await regenererSuggestionIA(s, {
      contexte: get().contexteDocument,
      reponses: get().answers,
      extraitOrigine: get().writingRequest?.instruction,
    });
    if (!res?.ok || !res.propositions?.length) {
      set({ iaOccupee: null, iaErreur: res?.message ?? 'Régénération indisponible' });
      return res;
    }
    const nouvelle = res.propositions[0];
    const remplacer = (liste) => liste.map((x) => (x.id === suggestionId ? nouvelle : x));
    set({
      blocSuggestions: remplacer(get().blocSuggestions),
      rewriteProposals: remplacer(get().rewriteProposals),
      termeSuggestions: remplacer(get().termeSuggestions),
      iaOccupee: null,
    });
    return res;
  },

  /** Recherche une suggestion, toutes familles confondues. */
  _trouverSuggestion: (id) => {
    const s = get();
    return (
      s.blocSuggestions.find((x) => x.id === id) ??
      s.rewriteProposals.find((x) => x.id === id) ??
      s.termeSuggestions.find((x) => x.id === id) ??
      null
    );
  },

  /**
   * Rend le texte d'une proposition pour insertion par l'interface.
   *
   * ⛔ Ce store ne touche pas au canvas : c'est l'appelant qui fait
   *    `updateObject(id, { content: { text } })` ou `addObjects(...)`.
   *    Séparer les deux garantit qu'aucune génération ne peut écraser le
   *    travail de l'utilisateur sans un geste de sa part.
   * @returns {string|null}
   */
  consommerProposition: (id) => {
    const s = get()._trouverSuggestion(id);
    if (!s) return null;
    get().addCoachMessage({ role: 'ai', text: `✦ Proposition insérée par vos soins (${s.famille}).` });
    return s.texte;
  },

  /** Efface les propositions en attente sans rien insérer. */
  effacerPropositions: () => set({ blocSuggestions: [], rewriteProposals: [], termeSuggestions: [] }),

  /* ── Setters simples ─────────────────────────────────────────── */
  /** Le niveau porte son mode : choisir « Génération auto » arme réellement l'IA. */
  setAssistanceLevel: (level) => {
    const lvl = ASSISTANCE_LEVELS.find(l => l.level === level);
    set({ assistanceLevel: level });
    if (lvl?.mode) get().setModeAssistance(lvl.mode);
  },
  setPhase:           (phase) => set({ phase }),
  selectTemplate:     (id)    => {
    set({ selectedTemplate: id });
    get().addCoachMessage({ role: 'ai', text: `✦ Modèle **${id}** sélectionné.` });
  },

  /* ── Messages du coach ───────────────────────────────────────── */
  addCoachMessage: (msg) => set(s => ({
    coachMessages: [
      ...s.coachMessages,
      { ...msg, id: `cm_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, ts: Date.now() },
    ],
  })),
  clearCoachMessages: () => set({ coachMessages: [] }),

  /* ── Persistance workspace (`designerStudio.documentCoach`) ─── */
  exportForWorkspace: () => {
    const s = get();
    return {
      isDocumentMode: s.isDocumentMode,
      phase: s.phase,
      detectedType: s.detectedType,
      selectedTemplate: s.selectedTemplate,
      currentQIdx: s.currentQIdx,
      answers: { ...s.answers },
      assistanceLevel: s.assistanceLevel,
      modeAssistance: s.modeAssistance,
      derniereDemande: s.derniereDemande,
      contexteDocument: s.contexteDocument,
      matchedTemplateIds: (s.matchedTemplates || []).map((t) => t.id).filter(Boolean),
      coachMessages: s.coachMessages.slice(-32),
    };
  },

  hydrateFromWorkspace: (snap) => {
    if (!snap || typeof snap !== 'object') return;
    if (!snap.isDocumentMode) {
      get().deactivateDocumentMode();
      return;
    }
    const ids = Array.isArray(snap.matchedTemplateIds) ? snap.matchedTemplateIds : [];
    const matched = ids.map((id) => getTemplateById(id)).filter(Boolean);
    const detected = snap.detectedType || 'letter';
    const fallbackMatched = matched.length ? matched : getTemplatesForCoachType(detected);
    const flow = GUIDED_FLOWS[detected] ?? GUIDED_FLOWS.default;
    // ⛔ Le mode d'assistance doit être RÉARMÉ dans documentIntelligence à la
    //    réouverture : sans ça, un espace de travail sauvé en « contrôle libre »
    //    se rouvrirait avec le verrou IA levé.
    const mode = definirModeAssistance(
      typeof snap.modeAssistance === 'string' ? snap.modeAssistance : 'suggestions',
    );
    set({
      isDocumentMode: true,
      phase: typeof snap.phase === 'string' ? snap.phase : 'idle',
      detectedType: detected,
      selectedTemplate: snap.selectedTemplate ?? null,
      currentQIdx: typeof snap.currentQIdx === 'number' ? snap.currentQIdx : 0,
      answers: snap.answers && typeof snap.answers === 'object' ? { ...snap.answers } : {},
      assistanceLevel: typeof snap.assistanceLevel === 'number' ? snap.assistanceLevel : 2,
      modeAssistance: mode,
      derniereDemande: typeof snap.derniereDemande === 'string' ? snap.derniereDemande : '',
      contexteDocument: snap.contexteDocument && typeof snap.contexteDocument === 'object' ? snap.contexteDocument : null,
      matchedTemplates: fallbackMatched,
      guidedFlow: flow,
      coachMessages: Array.isArray(snap.coachMessages) ? snap.coachMessages : [],
      documentPlan: null,
      suggestions: [],
      validationIssues: [],
      isGenerating: false,
      writingRequest: null,
      blocSuggestions: [],
      rewriteProposals: [],
      termeSuggestions: [],
      documentRedige: null,
      critiqueMiseEnPage: null,
      iaOccupee: null,
      iaErreur: null,
    });
  },
}));
