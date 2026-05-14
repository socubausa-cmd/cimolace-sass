/**
 * useDocumentCoachStore — IA Coach Documentaire (LONGIA Architect)
 *
 * Gère le cycle de vie complet de la création guidée d'un document :
 *   idle → detecting → questioning → generating → editing → reviewing
 *
 * Capacités :
 *  · document_architect — détecte le type, choisit le template, injecte les blocs
 *  · writing_coach     — questions guidées, reformulation, complétion, validation
 */
import { create } from 'zustand';
import {
  getTemplatesForCoachType,
  getTemplateById,
  searchTemplates,
  inferCoachTypeFromDomain,
} from '@/features/smartboard-konva-editor/lib/documentTemplateLibrary';

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
export const ASSISTANCE_LEVELS = [
  { level: 1, label: 'Suggestion',      desc: 'L\'IA propose — vous rédigez',      icon: '💡' },
  { level: 2, label: 'Co-rédaction',    desc: 'L\'IA construit section par section', icon: '✍️' },
  { level: 3, label: 'Génération auto', desc: 'L\'IA rédige le document entier',   icon: '⚡' },
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
  writingRequest: null,      // texte brut à reformuler
};

/* ─── Store ──────────────────────────────────────────────────────── */
export const useDocumentCoachStore = create((set, get) => ({
  ...INITIAL,

  /* ── Mode ────────────────────────────────────────────────────── */
  activateDocumentMode: () => {
    set({ isDocumentMode: true });
    get().addCoachMessage({
      role: 'ai',
      text: '✦ **Architecte documentaire** activé — décrivez le document que vous souhaitez créer, ou choisissez un mode ci-dessous.',
    });
  },
  deactivateDocumentMode: () => set({ ...INITIAL }),
  resetFlow: () => set({
    phase: 'idle', detectedType: null, guidedFlow: [], currentQIdx: 0,
    answers: {}, documentPlan: null, suggestions: [], validationIssues: [],
    isGenerating: false, writingRequest: null,
  }),

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

    set({
      detectedType: detected,
      matchedTemplates: matched,
      phase: 'questioning',
      guidedFlow: flow,
      currentQIdx: 0,
      answers: {},
    });

    let prefix = '';
    if (strategy === 'nearest_template' && nearestTemplates?.length) {
      prefix = `✦ Pas d’intention standard exacte — **${nearestTemplates.length} modèle(s)** proches dans la bibliothèque.\n\n`;
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
    return detected;
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
      set({ phase: 'generating', isGenerating: true });
      get().addCoachMessage({
        role: 'ai',
        text: `✦ Parfait, j'ai toutes les informations. **Construction du plan documentaire…**`,
      });
      // Simuler la génération (en prod : appel API)
      setTimeout(() => {
        get().buildDocumentPlan(newAnswers);
      }, 900);
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

    get().addCoachMessage({
      role: 'ai',
      text:
        `✦ **Plan créé** — ${plan.blocks.length} blocs · ${plan.pages} page${plan.pages > 1 ? 's' : ''} · Ton : ${plan.tone}${tplInfo}\n\n` +
        `Mode : **${lvl?.label}**\n\n` +
        `${assistanceLevel === 3 ? 'Cliquez **Générer le document** pour que je rédige le contenu complet.' : 'Les blocs sont prêts sur le canvas. Souhaitez-vous que je rédige le contenu ?'}`,
    });

    get()._generateSuggestions(plan);
    return plan;
  },

  /* ── Suggestions contextuelles ───────────────────────────────── */
  _generateSuggestions: (plan) => {
    const s = [];
    if (!plan.answers?.signature && plan.type !== 'cv') {
      s.push({ type: 'suggest_signature', text: 'Ajouter une zone de signature',  severity: 'info'    });
    }
    if (plan.type === 'letter' && !plan.answers?.objet) {
      s.push({ type: 'suggest_header',    text: 'Préciser l\'objet de la lettre', severity: 'warning' });
    }
    if (plan.pages > 1) {
      s.push({ type: 'suggest_page_break', text: 'Optimiser les sauts de page',   severity: 'info'    });
    }
    if (plan.type === 'report') {
      s.push({ type: 'suggest_subtitle', text: 'Ajouter des sous-titres de sections', severity: 'info' });
    }
    set({ suggestions: s });
  },

  /* ── Validation ──────────────────────────────────────────────── */
  validateDocument: () => {
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

    set({ validationIssues: issues, phase: 'reviewing' });

    const msg = issues.length === 0
      ? '✦ Document **validé** — aucun problème détecté. Prêt pour export PDF ✓'
      : `✦ **${issues.length} point${issues.length > 1 ? 's' : ''} à vérifier** avant finalisation.`;

    get().addCoachMessage({ role: 'ai', text: msg });
    return issues;
  },

  /* ── Reformulation ───────────────────────────────────────────── */
  requestRewrite: (instruction, mode = 'formalize') => {
    const modeLabels = {
      formalize:   'Rendre plus formel',
      simplify:    'Simplifier',
      legalize:    'Juridiciser',
      expand:      'Développer',
      compress:    'Résumer',
      admin:       'Style administratif',
    };
    set({ writingRequest: { instruction, mode }, phase: 'editing' });
    get().addCoachMessage({ role: 'user', text: `Reformuler : "${instruction}"` });
    get().addCoachMessage({
      role: 'ai',
      text: `✦ **${modeLabels[mode] ?? mode}** — en cours de traitement.\n\n*(En production : le texte reformulé apparaîtra sur le bloc sélectionné.)*`,
    });
  },

  /* ── Setters simples ─────────────────────────────────────────── */
  setAssistanceLevel: (level) => set({ assistanceLevel: level }),
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
    set({
      isDocumentMode: true,
      phase: typeof snap.phase === 'string' ? snap.phase : 'idle',
      detectedType: detected,
      selectedTemplate: snap.selectedTemplate ?? null,
      currentQIdx: typeof snap.currentQIdx === 'number' ? snap.currentQIdx : 0,
      answers: snap.answers && typeof snap.answers === 'object' ? { ...snap.answers } : {},
      assistanceLevel: typeof snap.assistanceLevel === 'number' ? snap.assistanceLevel : 2,
      matchedTemplates: fallbackMatched,
      guidedFlow: flow,
      coachMessages: Array.isArray(snap.coachMessages) ? snap.coachMessages : [],
      documentPlan: null,
      suggestions: [],
      validationIssues: [],
      isGenerating: false,
      writingRequest: null,
    });
  },
}));
