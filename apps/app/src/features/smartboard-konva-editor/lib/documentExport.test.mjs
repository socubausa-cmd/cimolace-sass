/**
 * Tests de `documentExport.js` — les quatre défauts mesurés au navigateur.
 *
 * ⛔ POURQUOI UN `critiquer` INJECTÉ : `documentDesignCritique.js` tire des imports
 *    JSON et `?raw` propres à Vite, intestables sous `node --test`. Le module
 *    accepte donc `options.critiquer` : on lui passe une critique factice dont on
 *    connaît la sortie, et on vérifie ce qui appartient VRAIMENT à ce fichier —
 *    le cadre passé à la critique, la fusion des constats, le rebasage des `y`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';

import {
  resoudreFormat,
  paginerObjets,
  critiquerDocument,
  construirePdf,
  preparerExport,
  resoudreImages,
  constatImagesNonIntegrees,
  viderCacheImages,
  PX_PAR_MM,
} from './documentExport.js';

/* ═══════════════════════════════════════════════════════════════════
   Marges : inset d'impression ≠ marges de contenu
═══════════════════════════════════════════════════════════════════ */

test('sans marges déclarées, le contenu n’a PAS de marges à zéro', () => {
  const f = resoudreFormat({ width: 794, height: 1123 });
  assert.deepEqual(f.marges, { top: 0, right: 0, bottom: 0, left: 0 }, 'impression 1:1');
  /* null = « non déclarées » : c'est la critique qui pose son défaut A4. Un zéro
     ici court-circuitait ce défaut et rendait « marges déclarées 0/0/0/0 px ». */
  assert.equal(f.margesContenu, null);
});

test('le page_setup d’un modèle nourrit les marges de CONTENU, pas l’inset d’impression', () => {
  const f = resoudreFormat({
    width: 794,
    height: 1123,
    page_setup: { unit: 'mm', margins: { top: 20, right: 15, bottom: 20, left: 15 } },
  });
  assert.deepEqual(f.marges, { top: 0, right: 0, bottom: 0, left: 0 });
  assert.ok(Math.abs(f.margesContenu.top - 20 * PX_PAR_MM) < 1e-6);
  assert.ok(Math.abs(f.margesContenu.left - 15 * PX_PAR_MM) < 1e-6);
});

test('un inset d’impression explicite reste un inset', () => {
  const f = resoudreFormat('a4', { top: 10, right: 10, bottom: 10, left: 10 });
  assert.deepEqual(f.marges, { top: 10, right: 10, bottom: 10, left: 10 });
  assert.equal(f.margesContenu, null);
});

/* ═══════════════════════════════════════════════════════════════════
   Pagination : une page déclarée ne veut pas dire un y déjà local
═══════════════════════════════════════════════════════════════════ */

test('une bande d’en-tête à y ABSOLU avec meta.page revient dans sa page', () => {
  const objets = [
    { id: 'h0', type: 'text', x: 52, y: 72, width: 690, height: 17, meta: { doc: 'entete-pied', page: 0 }, content: { text: 'En-tête' } },
    { id: 'h1', type: 'text', x: 52, y: 1123 + 72, width: 690, height: 17, meta: { doc: 'entete-pied', page: 1 }, content: { text: 'En-tête' } },
    { id: 'p1', type: 'text', x: 52, y: 1123 + 200, width: 690, height: 40, content: { text: 'Corps page 2' } },
  ];
  const r = paginerObjets(objets, { hauteurPage: 1123 });
  assert.equal(r.nbPages, 2);
  const h1 = r.pages[1].objets.find((o) => o.id === 'h1');
  assert.equal(h1.y, 72, 'la bande de la page 2 est tracée à 72 px du haut de SA page');
  assert.equal(r.coupes.length, 0, 'aucune bande ne « dépasse le bas de sa page »');
});

test('un y DÉJÀ local avec page déclarée n’est pas rebasé une seconde fois', () => {
  const objets = [{ id: 'a', type: 'text', x: 52, y: 72, width: 200, height: 20, page: 2, content: { text: 'x' } }];
  const r = paginerObjets(objets, { hauteurPage: 1123 });
  assert.equal(r.pages[2].objets[0].y, 72);
});

/* ═══════════════════════════════════════════════════════════════════
   critiquerDocument — source de vérité unique
═══════════════════════════════════════════════════════════════════ */

/** Critique factice : rend un constat de cadre par objet qui dépasse `height`. */
function critiqueFactice(objets, format) {
  const constats = [];
  for (const o of objets) {
    if ((Number(o.y) || 0) + (Number(o.height) || 0) > format.height) {
      constats.push({
        id: `deb_${o.id}`,
        regle: 'debordement',
        gravite: 'bloquant',
        titre: '1 bloc(s) sortent de la page',
        mesure: `hauteur jugée ${format.height} px`,
        objetIds: [o.id],
        correction: { label: 'Ramener', patches: [{ id: o.id, partial: { y: 10 } }] },
      });
    }
  }
  constats.push({
    id: 'corps_1', regle: 'corps', gravite: 'mineur', titre: 'corps', mesure: `marges ${Math.round(format.margesPx?.top ?? -1)}`, objetIds: [], correction: null,
  });
  return { format: { ...format, marges: format.margesPx ?? null }, constats, compte: {}, verdict: 'a_corriger', resume: {} };
}

test('le contenu de la page 2 n’est plus déclaré « hors de la page »', async () => {
  const objets = [
    { id: 'a', type: 'text', x: 52, y: 100, width: 690, height: 40, content: { text: 'page 1' } },
    { id: 'b', type: 'text', x: 52, y: 1123 + 100, width: 690, height: 40, content: { text: 'page 2' } },
  ];
  const r = await critiquerDocument(objets, {
    format: { width: 794, height: 1123 },
    critiquer: critiqueFactice,
  });
  assert.equal(r.pagination.nbPages, 2);
  const debordements = r.diagnostic.constats.filter((c) => c.regle === 'debordement');
  assert.equal(debordements.length, 0, 'aucun faux débordement sur un canevas empilé');
  assert.equal(r.diagnostic.compte.bloquant, 0);
});

test('un vrai débordement de page est vu, et sa correction est en y ABSOLU', async () => {
  const objets = [
    { id: 'a', type: 'text', x: 52, y: 100, width: 690, height: 40, content: { text: 'page 1' } },
    { id: 'b', type: 'text', x: 52, y: 1123 + 1000, width: 690, height: 300, content: { text: 'page 2 trop bas' } },
  ];
  const r = await critiquerDocument(objets, {
    format: { width: 794, height: 1123 },
    critiquer: critiqueFactice,
  });
  const deb = r.diagnostic.constats.filter((c) => c.regle === 'debordement');
  assert.equal(deb.length, 1);
  assert.equal(deb[0].page, 1);
  assert.match(deb[0].titre, /^Page 2 — /);
  /* 10 (repère de la page 2) + 1123 (origine de la page 2) = 1133. */
  assert.equal(deb[0].correction.patches[0].partial.y, 1133);
});

test('les marges de contenu ne sont pas inventées : rien n’est passé en margesPx', async () => {
  const r = await critiquerDocument(
    [{ id: 'a', type: 'text', x: 52, y: 100, width: 690, height: 40, content: { text: 'x' } }],
    { format: { width: 794, height: 1123 }, critiquer: critiqueFactice },
  );
  const corps = r.diagnostic.constats.find((c) => c.regle === 'corps');
  assert.equal(corps.mesure, 'marges -1', 'aucun margesPx transmis → la critique applique SON défaut');
});

/* ═══════════════════════════════════════════════════════════════════
   PDF — le devis doit sortir avec sa devise
═══════════════════════════════════════════════════════════════════ */

const mkTexte = (id, y, texte) => ({
  id, type: 'text', x: 52, y, width: 690, height: 20, visible: true,
  content: { text: texte },
  style: { fontSize: 12, fontFamily: 'Georgia, serif', fill: '#1e293b' },
});

test('€, tiret cadratin et accents sont écrits dans le flux PDF', async () => {
  const r = await construirePdf(
    [
      mkTexte('t1', 100, 'SARL Boisclair — Devis'),
      mkTexte('t2', 140, '582,00 €'),
      mkTexte('t3', 180, 'Pose parquet chêne · Ponçage'),
    ],
    { format: { width: 794, height: 1123 }, compresser: false, telecharger: false },
  );
  const brut = Buffer.from(r.doc.output('arraybuffer')).toString('latin1');
  const tj = [...brut.matchAll(/\(((?:\\.|[^()\\])*)\)\s*Tj/g)].map((m) => m[1]).join('\n');

  /* ⛔ Les polices standard du PDF sont en WinAnsi (cp1252), PAS en Latin-1 :
     le € y vaut 0x80 et le tiret cadratin 0x97. Lire ce flux en Latin-1 fait
     « disparaître » les deux (ce sont des codes de contrôle C1) alors qu'ils
     sont bien là — c'est ce faux négatif qui avait fait conclure à leur absence. */
  assert.ok(/WinAnsiEncoding/.test(brut), 'les polices déclarent WinAnsiEncoding');
  assert.ok(tj.includes('\x80'), '€ (0x80) présent');
  assert.ok(tj.includes('\x97'), 'tiret cadratin (0x97) présent');
  assert.ok(tj.includes('\xea'), 'ê (0xEA) présent');
  assert.ok(tj.includes('\xe7'), 'ç (0xE7) présent');
  assert.equal(r.texteSelectionnable, true);
});

/* ═══════════════════════════════════════════════════════════════════
   Images — le défaut [IMG-PDF] : 3 images sur la page, 0 dans le PDF

   ⛔ CE QUE CES TESTS PROUVENT ET CE QU'ILS NE PROUVENT PAS. Sous `node --test`
      il n'y a ni DOM ni Konva : la reprise du bitmap DÉJÀ DÉCODÉ dans le canevas
      et le re-signeur de bucket privé ne sont PAS couverts ici (ils demandent un
      navigateur). Ce qui est couvert est le reste de la chaîne, et c'est là que
      se jouait la perte : le bitmap arrive-t-il dans le flux PDF (/XObject), le
      fichier grossit-il, et l'absence est-elle DITE avant l'export.
═══════════════════════════════════════════════════════════════════ */

/** PNG RVB non compressible en une ligne : le poids embarqué doit se MESURER. */
function pngDataUrl(w, h) {
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // 8 bits par canal
  ihdr[9] = 2;   // couleur vraie RVB
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y += 1) {
    const off = y * (1 + w * 3);
    for (let x = 0; x < w; x += 1) {
      raw[off + 1 + x * 3] = (x * 7 + y * 3) % 256;
      raw[off + 2 + x * 3] = (x * 13 + y * 29) % 256;
      raw[off + 3 + x * 3] = (x * 91 + y * 5) % 256;
    }
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
}

const mkImage = (id, y, src, taille = {}) => ({
  id, type: 'image', x: 52, y, width: taille.w ?? 300, height: taille.h ?? 200,
  visible: true, content: { src, ...(taille.crop ? { crop: taille.crop } : {}) },
});

const octets = (r) => Buffer.from(r.doc.output('arraybuffer')).length;

test('les images partent dans le PDF : /XObject peuplé et fichier plus lourd', async () => {
  viderCacheImages();
  const src = pngDataUrl(80, 60);
  const texte = mkTexte('t1', 60, 'Affiche Orabank');
  const trois = [
    mkImage('i1', 120, src),
    mkImage('i2', 340, src, { w: 240, h: 160 }),
    mkImage('i3', 540, pngDataUrl(64, 64), { w: 200, h: 200 }),
  ];

  const opts = { format: { width: 794, height: 1123 }, compresser: false, telecharger: false };
  const sans = await construirePdf([texte], opts);
  const avec = await construirePdf([texte, ...trois], opts);

  assert.equal(avec.images.total, 3, '3 images sur la page');
  assert.equal(avec.images.dessinees, 3, '3 images passées à addImage');
  assert.deepEqual(avec.images.echecs, []);

  const brut = Buffer.from(avec.doc.output('arraybuffer')).toString('latin1');
  const xobjets = brut.match(/\/XObject\s*<<([\s\S]*?)>>/);
  assert.ok(xobjets, '/XObject déclaré');
  assert.ok(/\/I\d+\s+\d+\s+0\s+R/.test(xobjets[1]), `/XObject non vide — lu : ${xobjets[1].trim()}`);
  /* i1 et i2 partagent la MÊME source : l'alias jsPDF évite d'embarquer deux fois. */
  assert.equal((brut.match(/\/Subtype\s*\/Image/g) || []).length, 2, '2 bitmaps distincts embarqués');

  const gain = octets(avec) - octets(sans);
  assert.ok(gain > 5000, `le PDF doit grossir avec les images (mesuré : +${gain} octets)`);
});

test('le texte reste sélectionnable quand le PDF porte des images', async () => {
  viderCacheImages();
  const r = await construirePdf(
    [mkTexte('t1', 60, 'Orabank — Prêt immobilier'), mkImage('i1', 200, pngDataUrl(40, 40))],
    { format: { width: 794, height: 1123 }, compresser: false, telecharger: false },
  );
  assert.equal(r.texteSelectionnable, true);
  const brut = Buffer.from(r.doc.output('arraybuffer')).toString('latin1');
  const tj = [...brut.matchAll(/\(((?:\\.|[^()\\])*)\)\s*Tj/g)].map((m) => m[1]).join('\n');
  assert.ok(tj.includes('Orabank'), 'le texte est écrit en objets texte, pas aplati en image');
  assert.equal(r.images.dessinees, 1);
});

test('une image introuvable est NOMMÉE, jamais perdue en silence', async () => {
  viderCacheImages();
  const r = await construirePdf(
    [
      mkTexte('t1', 60, 'Titre'),
      mkImage('i1', 200, 'https://exemple.test/object/public/smartboard-canvas/u/photo.jpg'),
    ],
    { format: { width: 794, height: 1123 }, compresser: false, telecharger: false },
  );
  assert.equal(r.images.total, 1);
  assert.equal(r.images.dessinees, 0);
  assert.equal(r.images.echecs.length, 1);
  assert.match(r.avertissements.join(' '), /Image PERDUE dans le PDF/);
});

test('resoudreImages accepte des bitmaps injectés et rend les mesures natives', async () => {
  viderCacheImages();
  const faux = new Map([['sup://photo', { naturalWidth: 602, naturalHeight: 900 }]]);
  const r = await resoudreImages([mkImage('i1', 100, 'sup://photo', { w: 560, h: 320 })], { bitmaps: faux });
  assert.equal(r.integrees, 1);
  assert.deepEqual(r.natives.get('i1'), { largeurNative: 602, hauteurNative: 900 });
  assert.equal(constatImagesNonIntegrees(r), null, 'aucun constat quand tout est embarqué');
});

test('la perte d’images est un constat BLOQUANT rendu AVANT l’export', async () => {
  viderCacheImages();
  const r = await preparerExport(
    [
      mkTexte('t1', 60, 'Titre'),
      mkImage('i1', 200, 'https://exemple.test/object/public/smartboard-canvas/u/a.jpg'),
      mkImage('i2', 500, 'https://exemple.test/object/public/smartboard-canvas/u/b.jpg'),
    ],
    { format: { width: 794, height: 1123 }, critiquer: critiqueFactice },
  );
  const c = r.diagnostic.constats.find((x) => x.regle === 'image_non_integree');
  assert.ok(c, 'le constat existe');
  assert.equal(c.gravite, 'bloquant');
  assert.equal(r.verdict, 'bloquant');
  assert.ok(r.bloquants >= 1);
  assert.equal(r.images.total, 2);
  assert.equal(r.images.integrees, 0);
  assert.match(r.avertissements.join(' '), /ne peuvent pas être embarquées/);
});

test('sans image, la préparation ne parle pas d’images', async () => {
  viderCacheImages();
  const r = await preparerExport([mkTexte('t1', 60, 'Titre')], {
    format: { width: 794, height: 1123 }, critiquer: critiqueFactice,
  });
  assert.equal(r.images.total, 0);
  assert.equal(r.diagnostic.constats.some((c) => c.regle === 'image_non_integree'), false);
});
