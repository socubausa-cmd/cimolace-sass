/**
 * Tests documentCorrection — exécution :
 *   node --test apps/app/src/features/smartboard-konva-editor/lib/documentCorrection.test.mjs
 *
 * ⛔ AUCUN RÉSEAU : le modèle est injecté (`appelModele`) et simulé. Ce qui est
 *    vérifié ici, ce n'est pas la qualité de Mistral, c'est le FILTRE qui le tient :
 *    positions relocalisées, noms propres protégés, réécritures reclassées en style,
 *    chiffres et négations intouchables.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TYPES_CORRECTION,
  CATEGORIE_STYLE,
  corriger,
  corrigerLocal,
  appliquerCorrections,
  classerProposition,
  zonesProtegees,
  distanceEdition,
  construirePromptCorrection,
  resumerCorrections,
  lireJson,
  lireProposition,
  typeConnu,
} from './documentCorrection.js';

/** Modèle simulé : rend toujours la même liste, sans réseau. */
const modeleQuiRend = (corrections, provider = 'mistral-small-latest') =>
  async () => ({ provider, json: { corrections } });

const idsDe = (r) => r.corrections.map((c) => `${c.avant}→${c.apres}`);
const raisons = (r) => r.rejets.map((x) => x.raison);

/* ── 1. Passe locale, sans modèle ─────────────────────────────────── */

test('corrigerLocal repère une faute du lexique fermé et la situe', () => {
  const texte = 'Nous avons malgrés tout reçu le dossier.';
  const { corrections } = corrigerLocal(texte);
  const c = corrections.find((x) => x.avant === 'malgrés');
  assert.ok(c, 'la faute doit être relevée');
  assert.equal(c.apres, 'malgré');
  assert.equal(c.type, 'orthographe');
  assert.equal(c.categorie, 'faute');
  assert.equal(texte.slice(c.position.debut, c.position.fin), 'malgrés');
  assert.ok(c.explication.length > 5);
});

test('corrigerLocal conserve la majuscule d’origine', () => {
  const { corrections } = corrigerLocal('Malgrés cela, le délai tient.');
  const c = corrections.find((x) => x.avant === 'Malgrés');
  assert.ok(c);
  assert.equal(c.apres, 'Malgré');
});

test('corrigerLocal couvre les cinq types', () => {
  const texte = [
    'tout les dossiers sont là.', // accord
    'malgré que ce soit tard, ok.', // grammaire
    'un mot mot répété ici.', // grammaire (doublon)
    'le  texte  espacé.', // typographie
    'un,deux et trois.', // ponctuation
  ].join(' ');
  const { corrections } = corrigerLocal(texte);
  const types = new Set(corrections.map((c) => c.type));
  for (const t of ['accord', 'grammaire', 'typographie', 'ponctuation']) {
    assert.ok(types.has(t), `type ${t} attendu, obtenu ${[...types].join(',')}`);
  }
  for (const c of corrections) assert.ok(TYPES_CORRECTION[c.type], `type inconnu ${c.type}`);
});

test('corrigerLocal ne double pas le mot légitime « nous nous »', () => {
  const { corrections } = corrigerLocal('Nous nous permettons de vous relancer.');
  assert.equal(corrections.filter((c) => c.type === 'grammaire').length, 0);
});

test('corrigerLocal ajoute l’espace française avant les deux-points mais pas dans une heure', () => {
  const { corrections } = corrigerLocal('Objet: relance. Rendez-vous à 14:30 demain.');
  const posees = corrections.filter((c) => c.apres === ' :');
  assert.equal(posees.length, 1, 'seul « Objet: » doit être corrigé');
  assert.equal(posees[0].position.debut, 'Objet'.length);
});

test('corrigerLocal remet la majuscule après un point, sauf après une abréviation', () => {
  const r1 = corrigerLocal('Le dossier est clos. nous restons disponibles.');
  assert.ok(r1.corrections.some((c) => c.avant === 'n' && c.apres === 'N'));
  const r2 = corrigerLocal('Reçu de M. dupont hier.');
  assert.equal(r2.corrections.filter((c) => c.type === 'typographie' && c.apres === 'D').length, 0);
});

test('corrigerLocal ne touche jamais un texte propre', () => {
  const propre = 'Nous vous prions d’agréer, Madame, l’expression de nos salutations distinguées.';
  const { corrections } = corrigerLocal(propre);
  assert.deepEqual(corrections, []);
});

/* ── 2. Zones protégées — le nom de l’entreprise ──────────────────── */

test('zonesProtegees couvre sigles, montants, e-mails, URL et crochets', () => {
  const texte = 'Virement de 1 500 000 XAF à contact@orabank.ga via https://orabank.ga, réf. [numéro].';
  const zones = zonesProtegees(texte, { inclureNomsPropres: true });
  const couvert = (frag) => {
    const i = texte.indexOf(frag);
    assert.ok(i >= 0, `fragment absent : ${frag}`);
    return zones.some(([d, f]) => i >= d && i + frag.length <= f);
  };
  assert.ok(couvert('XAF'), 'sigle XAF');
  assert.ok(couvert('contact@orabank.ga'), 'e-mail');
  assert.ok(couvert('[numéro]'), 'crochet');
  assert.ok(zones.some(([d, f]) => texte.slice(d, f).includes('orabank.ga')), 'URL');
});

test('corriger rejette une « correction » qui vise le nom de l’entreprise', async () => {
  const texte = 'La banque Orabank confirme le virement.';
  const res = await corriger(texte, {
    termesProteges: ['Orabank'],
    appelModele: modeleQuiRend([
      { avant: 'Orabank', apres: 'Ora Bank', type: 'orthographe', explication: 'nom mal écrit' },
    ]),
  });
  assert.equal(res.corrections.length, 0);
  assert.ok(raisons(res).includes('zone_protegee'));
});

test('corriger protège un nom propre non déclaré et un sigle métier', async () => {
  const texte = 'Le dossier de Ngowazulu mentionne le SIRET du prestataire.';
  const res = await corriger(texte, {
    appelModele: modeleQuiRend([
      { avant: 'Ngowazulu', apres: 'Ngo Wazulu', type: 'orthographe', explication: 'x' },
      { avant: 'SIRET', apres: 'Siret', type: 'typographie', explication: 'x' },
    ]),
  });
  assert.equal(res.corrections.length, 0);
  assert.deepEqual(raisons(res), ['zone_protegee', 'zone_protegee']);
});

/* ── 3. Anti-hallucination ───────────────────────────────────────── */

test('corriger rejette une correction dont le texte « avant » n’existe pas', async () => {
  const res = await corriger('Le courrier est parti hier.', {
    appelModele: modeleQuiRend([
      { avant: 'anexe', apres: 'annexe', type: 'orthographe', explication: 'deux n' },
    ]),
  });
  assert.equal(res.corrections.length, 0);
  assert.ok(raisons(res).includes('introuvable'));
});

test('corriger relocalise lui-même la position, même si le modèle n’en donne aucune', async () => {
  const texte = 'Le reglement sera transmis. Le reglement final suivra.';
  const res = await corriger(texte, {
    appelModele: modeleQuiRend([
      {
        avant: 'reglement', apres: 'règlement', type: 'orthographe',
        explication: 'accent grave', contexte: 'Le reglement final',
      },
    ]),
  });
  assert.equal(res.corrections.length, 1);
  const c = res.corrections[0];
  assert.equal(texte.slice(c.position.debut, c.position.fin), 'reglement');
  assert.equal(c.position.debut, texte.lastIndexOf('reglement'), 'le contexte doit lever l’ambiguïté');
});

test('corriger survit à une panne du modèle et le DIT', async () => {
  const res = await corriger('Nous avons malgrés tout répondu.', {
    appelModele: async () => { throw new Error('502 upstream'); },
  });
  assert.equal(res.ok, true);
  assert.equal(res.degrade, true);
  assert.match(res.degradeMessage, /502/);
  assert.ok(res.corrections.some((c) => c.avant === 'malgrés'), 'la passe locale reste rendue');
});

/* ── 4. Faute ≠ style ────────────────────────────────────────────── */

test('classerProposition — accents et casse restent des fautes', () => {
  assert.equal(classerProposition('reglement', 'règlement', 'orthographe').verdict, 'faute');
  assert.equal(classerProposition('etat', 'état', 'orthographe').verdict, 'faute');
});

test('classerProposition — une réécriture bascule en style', () => {
  const v = classerProposition(
    'Je vous demande de bien vouloir',
    'Je sollicite votre bienveillance concernant ce dossier',
    'grammaire',
  );
  assert.equal(v.verdict, 'style');
});

test('classerProposition — un chiffre modifié est rejeté', () => {
  const v = classerProposition('le 12 mars', 'le 13 mars', 'orthographe');
  assert.equal(v.verdict, 'rejet');
  assert.equal(v.raison, 'chiffre_modifie');
});

test('classerProposition — une négation retirée est rejetée', () => {
  const v = classerProposition('ne sera pas versé', 'sera versé', 'grammaire');
  assert.equal(v.verdict, 'rejet');
  assert.equal(v.raison, 'sens_modifie');
});

test('corriger range les propositions de style à part, jamais dans les fautes', async () => {
  const texte = 'Suite a votre demande, je vous fais parvenir le document.';
  const res = await corriger(texte, {
    appelModele: modeleQuiRend([
      { avant: 'Suite a', apres: 'Suite à', type: 'orthographe', explication: 'préposition à' },
      {
        avant: 'je vous fais parvenir', apres: 'j’ai l’honneur de vous transmettre',
        type: 'grammaire', explication: 'plus soutenu',
      },
    ]),
  });
  assert.deepEqual(idsDe(res), ['Suite a→Suite à']);
  assert.equal(res.suggestionsStyle.length, 1);
  assert.equal(res.suggestionsStyle[0].categorie, CATEGORIE_STYLE);
});

/* ── 5. Application une par une ──────────────────────────────────── */

test('appliquerCorrections n’applique QUE les corrections acceptées', () => {
  const texte = 'Nous avons malgrés tout reçu tout les dossiers.';
  const { corrections } = corrigerLocal(texte);
  const malgre = corrections.find((c) => c.avant === 'malgrés');
  const tous = corrections.find((c) => c.avant.toLowerCase() === 'tout les');
  assert.ok(malgre && tous);

  const r = appliquerCorrections(texte, corrections, [malgre.id]);
  assert.equal(r.texte, 'Nous avons malgré tout reçu tout les dossiers.');
  assert.deepEqual(r.appliquees, [malgre.id]);
});

test('appliquerCorrections applique plusieurs corrections sans décaler les positions', () => {
  const texte = 'Nous avons malgrés tout reçu tout les dossiers.';
  const { corrections } = corrigerLocal(texte);
  const r = appliquerCorrections(texte, corrections);
  assert.equal(r.texte, 'Nous avons malgré tout reçu tous les dossiers.');
  assert.equal(r.ignorees.length, 0);
});

test('appliquerCorrections ignore une correction devenue caduque', () => {
  const texte = 'Nous avons malgrés tout répondu.';
  const { corrections } = corrigerLocal(texte);
  const r = appliquerCorrections('Texte entièrement réécrit entre-temps par l’auteur.', corrections);
  assert.equal(r.appliquees.length, 0);
  assert.ok(r.ignorees.every((x) => x.raison === 'texte_modifie' || x.raison === 'position_invalide'));
});

/* ── 6. Divers ───────────────────────────────────────────────────── */

test('corriger sans modèle ne fait aucun appel et le déclare', async () => {
  const res = await corriger('Nous avons malgrés tout répondu.');
  assert.equal(res.source, 'local');
  assert.ok(res.corrections.length >= 1);
});

test('corriger sur un texte vide rend une liste vide, pas une erreur', async () => {
  const res = await corriger('   ');
  assert.equal(res.ok, true);
  assert.deepEqual(res.corrections, []);
});

test('le prompt interdit explicitement le style et cite les termes protégés', () => {
  const p = construirePromptCorrection('Texte.', { termesProteges: ['Orabank', 'XAF'] });
  assert.match(p, /STYLE/);
  assert.match(p, /Orabank, XAF/);
  assert.match(p, /ne change JAMAIS le sens/);
});

/* ── 7. Régressions constatées sur un vrai appel Mistral ─────────── */

test('lireJson accepte les trois formes d’injecteur, texte brut compris', () => {
  const attendu = { corrections: [{ avant: 'a', apres: 'à' }] };
  assert.deepEqual(lireJson(attendu), attendu);
  assert.deepEqual(lireJson({ provider: 'mistral', json: attendu }), attendu);
  assert.deepEqual(lireJson({ provider: 'mistral', text: JSON.stringify(attendu) }), attendu);
  assert.deepEqual(lireJson('```json\n' + JSON.stringify(attendu) + '\n```'), attendu);
});

test('lireJson LÈVE sur une forme inconnue au lieu de perdre les corrections en silence', () => {
  // Régression : `{provider, text}` non géré rendait 0 correction ET 0 rejet.
  assert.throws(() => lireJson({ provider: 'mistral', choices: [] }), /inattendue/);
});

test('corriger signale la panne quand la réponse est informe (jamais un silence)', async () => {
  const res = await corriger('Nous avons malgrés tout répondu.', {
    appelModele: async () => ({ provider: 'mistral', choices: [{ message: { content: '{}' } }] }),
  });
  assert.equal(res.degrade, true);
  assert.match(res.degradeMessage, /inattendue/);
});

test('corriger accepte un injecteur qui rend le texte brut du modèle', async () => {
  const res = await corriger('Suite a votre demande.', {
    appelModele: async () => ({
      provider: 'mistral-small-latest',
      text: '{"corrections":[{"avant":"Suite a","apres":"Suite à","type":"orthographe","explication":"préposition à"}]}',
    }),
  });
  assert.deepEqual(idsDe(res), ['Suite a→Suite à']);
  assert.equal(res.provider, 'mistral-small-latest');
});

test('la majuscule de début de phrase fusionne avec la correction qui occupe la place', () => {
  // Régression : « tout les » corrigé en « tous les » laissait la minuscule
  // après le point, parce que la règle de majuscule tombait en chevauchement.
  const texte = 'Les pièces sont jointes. tout les justificatifs suivent.';
  const { corrections } = corrigerLocal(texte);
  const c = corrections.find((x) => x.avant.toLowerCase() === 'tout les');
  assert.ok(c, 'la correction d’accord doit exister');
  assert.equal(c.apres, 'Tous les');
  assert.match(c.explication, /majuscule/);
  assert.equal(appliquerCorrections(texte, corrections).texte,
    'Les pièces sont jointes. Tous les justificatifs suivent.');
});

test('la majuscule reste une correction autonome quand rien d’autre n’occupe la place', () => {
  const texte = 'Le dossier est clos. nous restons disponibles.';
  const { corrections } = corrigerLocal(texte);
  assert.equal(appliquerCorrections(texte, corrections).texte,
    'Le dossier est clos. Nous restons disponibles.');
});

test('une correction du modèle déjà couverte localement est « doublon », pas « introuvable »', async () => {
  const res = await corriger('tout les dossiers sont là.', {
    appelModele: modeleQuiRend([
      { avant: 'tout les', apres: 'tous les', type: 'accord', explication: 'pluriel' },
    ]),
  });
  assert.equal(res.corrections.filter((c) => c.avant.toLowerCase() === 'tout les').length, 1);
  assert.deepEqual(raisons(res), ['doublon']);
});

test('une correction ancrée sur un contexte déjà pris n’est JAMAIS reposée ailleurs', async () => {
  // Régression mesurée avec mistral-large-latest : « tout » → « Tous », contexte
  // « tout les justificatifs », se retrouvait posé sur l’adverbe de « malgré tout ».
  const texte = 'Il a malgré tout signé. tout les justificatifs suivent.';
  const res = await corriger(texte, {
    appelModele: modeleQuiRend([
      {
        avant: 'tout', apres: 'Tous', type: 'accord',
        explication: 'accord avec justificatifs', contexte: 'tout les justificatifs',
      },
    ]),
  });
  assert.equal(res.corrections.some((c) => c.position.debut === texte.indexOf('malgré tout') + 7), false,
    'l’adverbe « malgré tout » doit rester intouché');
  assert.deepEqual(raisons(res), ['doublon']);
  assert.equal(appliquerCorrections(texte, res.corrections).texte,
    'Il a malgré tout signé. Tous les justificatifs suivent.');
});

test('distanceEdition mesure bien les petites différences', () => {
  assert.equal(distanceEdition('malgrés', 'malgré'), 1);
  assert.equal(distanceEdition('abc', 'abc'), 0);
});

test('resumerCorrections compte par type', async () => {
  const res = await corriger('tout les dossiers  sont là.');
  const r = resumerCorrections(res);
  assert.equal(r.fautes, res.corrections.length);
  assert.equal(r.parType.accord, res.corrections.filter((c) => c.type === 'accord').length);
});

/* ══════════════════════════════════════════════════════════════════
   DÉRIVE DE SCHÉMA DU MODÈLE — perte silencieuse mesurée en vrai
══════════════════════════════════════════════════════════════════ */

test('clé accentuée « après » : les corrections ne se perdent plus en silence', async () => {
  /* ⛔ MESURÉ SUR mistral-large-latest (3 appels sur 3, 2026-08-06) : le modèle
     respecte le schéma mais accentue la clé. Six corrections justes tombaient en
     « suggestion de style » à texte vide et l'écran annonçait zéro faute. */
  const texte = 'Les document sont pret a etre envoyer au client.';
  const res = await corriger(texte, {
    langue: 'fr',
    appelModele: async () => JSON.stringify({
      corrections: [
        { avant: 'document', 'après': 'documents', type: 'accord', explication: 'Pluriel.' },
        { avant: 'envoyer', 'après': 'envoyés', type: 'orthographe et accord', explication: 'Participe passé.' },
      ],
    }),
  });
  const paires = res.corrections.map((c) => `${c.avant}>${c.apres}`);
  assert.ok(paires.includes('document>documents'), `attendu la correction du pluriel, reçu ${paires.join(', ')}`);
  assert.ok(paires.includes('envoyer>envoyés'));
  assert.equal(res.suggestionsStyle.length, 0, 'aucune de ces fautes ne doit basculer en style');
  // Le type composé « orthographe et accord » retombe sur un type CONNU, pas sur le défaut.
  assert.equal(res.corrections.find((c) => c.avant === 'envoyer').type, 'orthographe');
});

test('clé de remplacement ABSENTE : rejet nommé, jamais une suppression inventée', async () => {
  const res = await corriger('Les document sont prêts.', {
    langue: 'fr',
    appelModele: async () => ({ corrections: [{ avant: 'document', type: 'accord' }] }),
  });
  assert.equal(res.corrections.length, 0);
  assert.equal(res.suggestionsStyle.length, 0, 'une clé absente n’est pas une suppression volontaire');
  assert.deepEqual(
    res.rejets.map((r) => r.raison),
    ['apres_absent'],
    'la dérive de schéma est DITE',
  );
});

test('lireProposition et typeConnu : lecture tolérante, sans deviner', () => {
  assert.deepEqual(lireProposition({ avant: ' a ', 'après': 'b', type: 'accord' }), {
    avant: 'a', apres: 'b', absent: false, type: 'accord', explication: '', contexte: '',
  });
  assert.equal(lireProposition({ avant: 'a', apres: '' }).absent, false, 'clé présente et vide = suppression assumée');
  assert.equal(lireProposition({ avant: 'a' }).absent, true);
  assert.equal(typeConnu('orthographe et accord'), 'orthographe');
  assert.equal(typeConnu('accord'), 'accord');
  assert.equal(typeConnu('Typographie'), 'typographie');
  assert.equal(typeConnu('style élégant'), null, 'un type inconnu reste inconnu — rien n’est inventé');
});
