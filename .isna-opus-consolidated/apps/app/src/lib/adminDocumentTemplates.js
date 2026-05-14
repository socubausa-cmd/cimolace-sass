import { DEFAULT_FOOTER, DEFAULT_HEADER, DEFAULT_DOCUMENT_STYLE, newPage } from '@/lib/adminDocumentStorage';

/**
 * @param {Partial<import('@/lib/adminDocumentStorage').AdminDocumentStyle>} [styleOverride]
 * @returns {import('@/lib/adminDocumentStorage').AdminDocumentState}
 */
function base(title, header, footer, pages, styleOverride) {
  return {
    version: 1,
    title,
    header,
    footer,
    documentStyle: { ...DEFAULT_DOCUMENT_STYLE, ...styleOverride },
    pages,
    savedAt: Date.now(),
  };
}

const p = (text) => ({
  type: 'paragraph',
  content: text ? [{ type: 'text', text }] : [],
});

const pb = (parts) => ({
  type: 'paragraph',
  content: parts,
});

/** Courrier une page */
export function templateCourrier() {
  const pg = newPage();
  pg.bodyJson = {
    type: 'doc',
    content: [
      pb([
        { type: 'text', text: 'À l’attention de : ' },
        { type: 'text', marks: [{ type: 'bold' }], text: 'Nom / Service' },
      ]),
      p(''),
      pb([
        { type: 'text', marks: [{ type: 'bold' }], text: 'Objet : ' },
        { type: 'text', text: '…' },
      ]),
      p(''),
      p('Madame, Monsieur,'),
      p(''),
      p(
        'Nous vous adressons le présent courrier pour… (développez ici le fond du texte, la justification et les suites données.)',
      ),
      p(''),
      p('Nous vous prions d’agréer, Madame, Monsieur, l’expression de nos salutations distinguées.'),
      p(''),
      p('Nom, prénom'),
      p('Fonction'),
    ],
  };
  pg.bodyHtml = '';
  return base('Courrier — brouillon', DEFAULT_HEADER, DEFAULT_FOOTER, [pg]);
}

/** PV — deux pages */
export function templatePV() {
  const p1 = newPage();
  p1.bodyJson = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Procès-verbal de réunion' }] },
      p(''),
      p('Date : _______________    Lieu : _______________'),
      p(''),
      p('Participants présents :'),
      p('— …'),
      p(''),
      p('Excusés :'),
      p('— …'),
      p(''),
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Ordre du jour' }] },
      p('1. …'),
      p('2. …'),
      p('3. …'),
    ],
  };
  p1.bodyHtml = '';

  const p2 = newPage();
  p2.bodyJson = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Décisions et synthèse' }] },
      p(''),
      p('Compte rendu des échanges et décisions adoptées…'),
      p(''),
      p(''),
      p('Fait à _______________, le __ / __ / ______'),
      p(''),
      p('Signatures :'),
      p(''),
    ],
  };
  p2.bodyHtml = '';

  return base('PV de réunion', DEFAULT_HEADER, 'PV interne · Page {page} / {total}', [p1, p2]);
}

/** Attestation — une page */
export function templateAttestation() {
  const pg = newPage();
  pg.bodyJson = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'ATTESTATION' }] },
      p(''),
      p(
        'Je soussigné(e), ___________________________________, certifie sur l’honneur que :',
      ),
      p(''),
      p('_________________________________________________________________'),
      p(''),
      p('Fait pour servir et valoir ce que de droit.'),
      p(''),
      p('Fait à _______________, le __ / __ / ______'),
      p(''),
      p('Signature et cachet :'),
    ],
  };
  pg.bodyHtml = '';
  return base('Attestation', DEFAULT_HEADER, DEFAULT_FOOTER, [pg]);
}

/** Contrat / convention — deux pages */
export function templateContrat() {
  const a = newPage();
  a.bodyJson = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'CONVENTION / CONTRAT' }] },
      p(''),
      p('Entre les soussignés :'),
      p(''),
      pb([
        { type: 'text', marks: [{ type: 'bold' }], text: 'Partie A — ' },
        { type: 'text', text: 'dénomination, adresse, représentée par …' },
      ]),
      p(''),
      pb([
        { type: 'text', marks: [{ type: 'bold' }], text: 'Partie B — ' },
        { type: 'text', text: 'dénomination, adresse, représentée par …' },
      ]),
      p(''),
      p('Il a été convenu et arrêté ce qui suit :'),
      p(''),
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Article 1 — Objet' }] },
      p('…'),
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Article 2 — Durée et lieu' }] },
      p('…'),
    ],
  };
  a.bodyHtml = '';

  const b = newPage();
  b.bodyJson = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Article 3 — Obligations' }] },
      p('…'),
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Article 4 — Résiliation' }] },
      p('…'),
      p(''),
      p('Fait à _______________, le __ / __ / ______'),
      p(''),
      p('Pour la Partie A :                    Pour la Partie B :'),
      p(''),
      p('____________________                  ____________________'),
      p('Nom et qualité                        Nom et qualité'),
    ],
  };
  b.bodyHtml = '';

  return base('Convention / contrat', DEFAULT_HEADER, 'Document contractuel · Page {page} / {total}', [a, b]);
}

/** CV structuré */
export function templateCV() {
  const pg = newPage();
  pg.bodyJson = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Nom Prénom' }] },
      p('Titre ou poste visé · Ville · Téléphone · Courriel'),
      p(''),
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Profil' }] },
      p('Synthèse en quelques lignes (compétences clés, objectifs).'),
      p(''),
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Expérience professionnelle' }] },
      p('20XX – 20XX · Poste — Organisation'),
      p('Missions et réalisations…'),
      p(''),
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Formation' }] },
      p('20XX · Diplôme — Établissement'),
      p(''),
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Compétences & langues' }] },
      p('— …'),
    ],
  };
  pg.bodyHtml = '';
  return base('Curriculum vitæ', DEFAULT_HEADER, DEFAULT_FOOTER, [pg], { fontSize: 12, lineHeight: 1.4 });
}

/** Facture simple */
export function templateFacture() {
  const pg = newPage();
  pg.bodyJson = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'FACTURE' }] },
      p(''),
      pb([
        { type: 'text', marks: [{ type: 'bold' }], text: 'N° ' },
        { type: 'text', text: 'FAC-____    Date : __ / __ / ______' },
      ]),
      p(''),
      p('Émetteur : …'),
      p('Adresse : …'),
      p(''),
      p('Client : …'),
      p('Adresse de facturation : …'),
      p(''),
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Détail' }] },
      p('Désignation — quantité — prix unitaire — montant HT'),
      p('— …'),
      p(''),
      p('Total HT : …    TVA : …    Total TTC : …'),
      p(''),
      p('Conditions de paiement : …'),
      p('IBAN : …'),
    ],
  };
  pg.bodyHtml = '';
  return base('Facture', DEFAULT_HEADER, DEFAULT_FOOTER, [pg]);
}

/** Lettre officielle (ministère, administration) */
export function templateLettreOfficielle() {
  const pg = newPage();
  pg.bodyJson = {
    type: 'doc',
    content: [
      p('Réf. : … / …'),
      p(''),
      p('À Madame / Monsieur'),
      p('Fonction'),
      p('Organisation'),
      p('Adresse'),
      p(''),
      p('Ville, le __ / __ / ______'),
      p(''),
      pb([
        { type: 'text', marks: [{ type: 'bold' }], text: 'Objet : ' },
        { type: 'text', text: '…' },
      ]),
      p(''),
      p('Madame, Monsieur,'),
      p(''),
      p('J’ai l’honneur de vous informer que…'),
      p(''),
      p('Je vous prie d’agréer, Madame, Monsieur, l’expression de ma considération distinguée.'),
      p(''),
      p('Nom et prénom'),
      p('Fonction'),
    ],
  };
  pg.bodyHtml = '';
  return base('Lettre officielle', DEFAULT_HEADER, DEFAULT_FOOTER, [pg]);
}

/** Rapport d’activité / synthèse */
export function templateRapport() {
  const pg = newPage();
  pg.bodyJson = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Rapport' }] },
      p('Période : _______________    Auteur : _______________'),
      p(''),
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '1. Contexte' }] },
      p('…'),
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '2. Activités réalisées' }] },
      p('…'),
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '3. Résultats' }] },
      p('…'),
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: '4. Perspectives' }] },
      p('…'),
      p(''),
      p('Annexes : …'),
    ],
  };
  pg.bodyHtml = '';
  return base('Rapport', DEFAULT_HEADER, DEFAULT_FOOTER, [pg]);
}

/** Fiche élève */
export function templateFicheEleve() {
  const pg = newPage();
  pg.bodyJson = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Fiche élève' }] },
      p(''),
      pb([
        { type: 'text', marks: [{ type: 'bold' }], text: 'Identité : ' },
        { type: 'text', text: 'Nom, prénom, date de naissance, classe' },
      ]),
      p(''),
      pb([
        { type: 'text', marks: [{ type: 'bold' }], text: 'Responsable légal : ' },
        { type: 'text', text: '… · Téléphone · Courriel' },
      ]),
      p(''),
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Suivi pédagogique' }] },
      p('Points forts : …'),
      p('Points à renforcer : …'),
      p(''),
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Vie scolaire' }] },
      p('Assiduité, comportement, remarques…'),
      p(''),
      { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Décisions / mesures' }] },
      p('…'),
      p(''),
      p('Date : _______________    Signature du responsable : _______________'),
    ],
  };
  pg.bodyHtml = '';
  return base('Fiche élève', DEFAULT_HEADER, 'Fiche confidentielle · Page {page} / {total}', [pg]);
}

/** Règlement intérieur — deux pages */
export function templateReglement() {
  const a = newPage();
  a.bodyJson = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'RÈGLEMENT INTÉRIEUR' }] },
      p(''),
      p('Article 1 — Objet et champ d’application'),
      p('Le présent règlement fixe les règles…'),
      p(''),
      p('Article 2 — Horaires et accès'),
      p('…'),
      p(''),
      p('Article 3 — Comportement attendu'),
      p('…'),
      p(''),
      p('Article 4 — Sanctions'),
      p('…'),
    ],
  };
  a.bodyHtml = '';

  const b = newPage();
  b.bodyJson = {
    type: 'doc',
    content: [
      p('Article 5 — Dispositions diverses'),
      p('…'),
      p(''),
      p('Article 6 — Entrée en vigueur'),
      p('Le présent règlement entre en vigueur le __ / __ / ______'),
      p(''),
      p('Fait à _______________, le __ / __ / ______'),
      p(''),
      p('Le responsable : ___________________________'),
    ],
  };
  b.bodyHtml = '';

  return base('Règlement intérieur', DEFAULT_HEADER, 'Règlement interne · Page {page} / {total}', [a, b]);
}

/** Certificat de scolarité / de suivi — une page */
export function templateCertificat() {
  const pg = newPage();
  pg.bodyJson = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'CERTIFICAT' }] },
      p(''),
      p('L’organisme soussigné certifie que :'),
      p(''),
      pb([
        { type: 'text', marks: [{ type: 'bold' }], text: 'Nom et prénom : ' },
        { type: 'text', text: '___________________________________' },
      ]),
      p(''),
      pb([
        { type: 'text', marks: [{ type: 'bold' }], text: 'Né(e) le : ' },
        { type: 'text', text: '__ / __ / ______    Classe ou niveau : _______________' },
      ]),
      p(''),
      p('a suivi régulièrement la formation / le parcours prévu pour la période du _______________ au _______________.'),
      p(''),
      p('Fait pour servir et valoir ce que de droit.'),
      p(''),
      p('Fait à _______________, le __ / __ / ______'),
      p(''),
      p('Signature et cachet de l’établissement :'),
    ],
  };
  pg.bodyHtml = '';
  return base('Certificat', DEFAULT_HEADER, DEFAULT_FOOTER, [pg]);
}

/** Reçu simple (paiement ou acquit) */
export function templateRecu() {
  const pg = newPage();
  pg.bodyJson = {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'REÇU' }] },
      p(''),
      pb([
        { type: 'text', marks: [{ type: 'bold' }], text: 'N° : ' },
        { type: 'text', text: 'REC-____    Date : __ / __ / ______' },
      ]),
      p(''),
      p('Reçu de : _________________________________________________'),
      p(''),
      p('La somme de : _______________ (en lettres : _________________________________)'),
      p(''),
      p('Correspondant à : _________________________________________'),
      p(''),
      p('Mode de règlement : □ espèces  □ virement  □ carte  □ autre : _________'),
      p(''),
      p('Fait à _______________, le __ / __ / ______'),
      p(''),
      p('Signature :'),
    ],
  };
  pg.bodyHtml = '';
  return base('Reçu', DEFAULT_HEADER, DEFAULT_FOOTER, [pg]);
}
