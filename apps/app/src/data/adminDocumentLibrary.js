/**
 * Bibliothèque système : templates + blocs + textes + actions rapides + assistant.
 * Consommé par `adminDocumentTemplateEngine.js` et l'UI du studio administratif.
 */
export const templateLibrary = [
  {
    id: 'tpl_letter_admin_001',
    name: 'Lettre administrative classique',
    type: 'letter',
    structure: {
      header: true,
      footer: true,
      zones: ['sender', 'recipient', 'subject', 'body', 'signature'],
    },
    default_blocks: [
      'blk_header_standard',
      'blk_recipient',
      'blk_subject',
      'blk_body',
      'blk_closing',
      'blk_signature',
    ],
  },
  {
    id: 'tpl_contract_001',
    name: 'Contrat professionnel',
    type: 'contract',
    structure: {
      header: true,
      footer: true,
      pagination: true,
      zones: ['title', 'parties', 'articles', 'signature'],
    },
    default_blocks: ['blk_contract_title', 'blk_parties', 'blk_article', 'blk_article', 'blk_signature'],
  },
  {
    id: 'tpl_memo_001',
    name: 'Note / mémo interne',
    type: 'memo',
    structure: {
      header: true,
      footer: true,
      zones: ['subject', 'body'],
    },
    default_blocks: ['blk_subject', 'blk_paragraph', 'blk_signature'],
  },
];

export const blockLibrary = [
  {
    id: 'blk_header_standard',
    type: 'header',
    label: 'En-tête expéditeur (corps)',
    default_content: '{{sender_block}}',
  },
  {
    id: 'blk_recipient',
    type: 'recipient',
    label: 'Destinataire',
    default_content: 'À l\'attention de : {{recipient}}',
  },
  {
    id: 'blk_subject',
    type: 'text_block',
    label: 'Objet',
    default_content: 'Objet : {{subject}}',
  },
  {
    id: 'blk_paragraph',
    type: 'paragraph_group',
    label: 'Paragraphe',
    default_content: 'Votre texte ici…',
  },
  {
    id: 'blk_body',
    type: 'body_block',
    label: 'Corps du texte',
    default_content: '{{content}}',
  },
  {
    id: 'blk_closing',
    type: 'closing',
    label: 'Formule de politesse',
    default_content:
      'Nous vous prions d\'agréer, Madame, Monsieur, l\'expression de nos salutations distinguées.',
  },
  {
    id: 'blk_title',
    type: 'title_block',
    label: 'Titre de document',
    default_content: '{{title}}',
  },
  {
    id: 'blk_contract_title',
    type: 'title_block',
    label: 'Titre contrat',
    default_content: 'CONTRAT — {{title}}',
  },
  {
    id: 'blk_parties',
    type: 'parties_block',
    label: 'Bloc parties',
    default_content: 'Entre les soussignés : {{party_a}} / {{party_b}}',
  },
  {
    id: 'blk_article',
    type: 'article_block',
    label: 'Article',
    default_content: 'Article {{n}} — …',
  },
  {
    id: 'blk_signature',
    type: 'signature_block',
    label: 'Signatures',
    default_content: '',
  },
];

export const textLibrary = {
  paragraphs: [
    'Je me permets de vous adresser la présente pour…',
    'Il a été convenu ce qui suit :',
    'Conformément aux dispositions en vigueur, nous vous informons que…',
    'Pour toute précision, le service reste à votre disposition.',
    'Nous vous remercions de l\'attention portée à ce dossier.',
  ],
  clauses: [
    'Les parties s\'engagent à respecter la confidentialité des informations échangées.',
    'Les modalités de paiement sont fixées selon l\'échéancier joint ou mentionné aux conditions particulières.',
    'En cas de litige, les parties recherchent une solution amiable avant toute action.',
    'Le présent document est rédigé en deux exemplaires originaux.',
  ],
};

/** Clés alignées sur la logique produit (insérer / structurer). */
export const quickActions = [
  { id: 'add_paragraph', label: 'Paragraphe vide' },
  { id: 'add_signature', label: 'Bloc signatures' },
  { id: 'add_header', label: 'Bloc expéditeur' },
  { id: 'add_subject', label: 'Ligne Objet' },
  { id: 'add_clause', label: 'Clause type' },
];

export const assistantMode = {
  steps: [
    { id: 'doc_type', label: 'Type de document', field: 'type' },
    { id: 'recipient', label: 'Destinataire', field: 'recipient' },
    { id: 'subject', label: 'Objet', field: 'subject' },
    { id: 'content', label: 'Contenu / consigne', field: 'content' },
    { id: 'signature', label: 'Signature (nom / fonction)', field: 'signature' },
  ],
};
