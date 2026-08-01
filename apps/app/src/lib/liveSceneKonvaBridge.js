/**
 * Pont de données scène live publiée ⇄ canevas SmartBoard (objets éditables).
 *
 * Sens 1 (`liveSceneToKonvaScene`) : une scène `live_scenes` produite par le Master
 * Factory (vocabulaire `content_payload_json.ia_data`) devient des objets de canevas
 * que l'enseignant peut déplacer / retoucher.
 * Sens 2 (`konvaSceneToLiveScenePatch`) : les objets retouchés redeviennent un PATCH
 * PARTIEL de la scène.
 *
 * ⛔ CONTRAINTE FONDATRICE : le sens 2 ne rend JAMAIS une ligne complète. Ce dépôt a
 * déjà perdu cinq fois des données parce qu'une écriture reconstruisait la ligne au
 * lieu de la préserver (narration effacée, chapitre effacé, tableau IA rétrogradé).
 * Le patch ne contient donc QUE ce que le canevas représente ; `audio_url`,
 * `chapter_id`, `render_mode`, `name`, `order_index` et les champs de `ia_data` non
 * représentés (sketch, slide_summary, student_prompt, theme, illustration…) sont
 * recopiés tels quels ou absents du patch.
 *
 * ⛔ SECONDE CONTRAINTE : la suppression d'un objet sur le canevas n'efface PAS la
 * donnée correspondante. Un bloc absent = « non modifié », jamais « vidé ». Sans
 * cette règle, ouvrir le designer puis enregistrer sans rien faire suffirait à vider
 * une scène si un bloc n'avait pas été régénéré (ex. rôle inconnu, filtre d'affichage).
 * Conséquence assumée : on ne peut pas SUPPRIMER un titre depuis le canevas, seulement
 * le réécrire. C'est le compromis choisi côté non-destruction.
 */

import {
  CANVAS_W,
  CANVAS_H,
  SB_CANVAS_GOLD,
  mkCanvasText,
  canvasObjectsToSlideElements,
  slideElementsToCanvasObjects,
} from '@/lib/smartboardCanvasModel';
import { parsePayload } from '@/lib/liveSceneNormalize';

/** Préfixe des rôles portés par `masterScriptRef` (champ libre déjà prévu par le modèle). */
export const LIRI_IA_ROLE_PREFIX = 'liri:ia/';

/**
 * Clé de sauvegarde de la mise en page manuelle. Le vocabulaire `ia_data` ne sait pas
 * décrire une position ; sans ce miroir, chaque ouverture du designer repartirait de la
 * mise en page automatique et jetterait le travail de l'enseignant.
 * Le rendu du direct ne lit pas cette clé (elle est inerte pour SlideParallaxStage).
 */
export const KONVA_LAYOUT_PAYLOAD_KEY = 'konva_canvas_objects';

/* ------------------------------------------------------------------ utilitaires */

const MARGIN = 64;
const CONTENT_W = CANVAS_W - MARGIN * 2;

function asText(v) {
  return typeof v === 'string' ? v : '';
}

function isFilled(v) {
  return typeof v === 'string' && v.trim() !== '';
}

/** Identifiant stable : rouvrir le designer ne doit pas renuméroter les blocs. */
function stableId(sceneId, role) {
  const base = String(sceneId ?? 'scene').replace(/[^a-zA-Z0-9]/g, '').slice(-10) || 'sc';
  return `sb_${base}_${role.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/**
 * Puce d'agrément saisie à la main : tolérée en lecture, jamais réécrite.
 *
 * ⛔ L'espace APRÈS la puce est obligatoire dans le motif. Sans lui, « -273,15 °C »
 * revenait « 273,15 °C » et « *étoile* » revenait « étoile* » : le signe moins d'un
 * cours de physique disparaissait silencieusement, sans rien pour le rattraper une
 * fois la scène enregistrée.
 */
function stripBullet(line) {
  return line.replace(/^\s*[-•▸*·]\s+/, '');
}

function linesToPoints(text) {
  return asText(text)
    .split('\n')
    .map((l) => stripBullet(l).trim())
    .filter((l) => l !== '');
}

function pointsToLines(points) {
  if (!Array.isArray(points)) return '';
  return points.map((p) => String(p ?? '').trim()).filter((p) => p !== '').join('\n');
}

/** `development` structuré ({label, points[]}) ≠ legacy (chaînes) : le rendu change de layout. */
export function isStructuredDevelopment(dev) {
  return Array.isArray(dev) && dev.length > 0 && typeof dev[0] === 'object' && dev[0] !== null && Array.isArray(dev[0].points);
}

/** `ia_data` vit soit sur la ligne (brouillon wizard) soit dans le payload (scène publiée). */
export function readSceneIaData(scene) {
  if (!scene) return null;
  if (scene.ia_data && typeof scene.ia_data === 'object') return scene.ia_data;
  const payload = parsePayload(scene.content_payload_json);
  if (payload.ia_data && typeof payload.ia_data === 'object') return payload.ia_data;
  return null;
}

/** 'ia' = scène Master Factory ; 'elements' = scène à éléments positionnels. */
export function detectSceneCanvasMode(scene) {
  const ia = readSceneIaData(scene);
  if (ia && (isFilled(ia.title) || isFilled(ia.subtitle) || isFilled(ia.core_idea) || (Array.isArray(ia.development) && ia.development.length))) {
    return 'ia';
  }
  const payload = parsePayload(scene?.content_payload_json);
  if (Array.isArray(scene?.elements) && scene.elements.length) return 'elements';
  if (Array.isArray(payload.elements) && payload.elements.length) return 'elements';
  return ia ? 'ia' : 'elements';
}

function parseRole(obj) {
  const ref = asText(obj?.masterScriptRef);
  if (!ref.startsWith(LIRI_IA_ROLE_PREFIX)) return null;
  const rest = ref.slice(LIRI_IA_ROLE_PREFIX.length);
  if (rest === 'title' || rest === 'subtitle' || rest === 'core_idea' || rest === 'development_legacy') {
    return { kind: rest };
  }
  const m = /^development\/(\d+)\/(label|points)$/.exec(rest);
  if (m) return { kind: 'development', index: Number(m[1]), part: m[2] };
  return null;
}

/* ---------------------------------------------------- sens 1 : scène → canevas */

function buildIaCanvasObjects(ia, sceneId) {
  const objects = [];
  let y = MARGIN - 34;

  if (isFilled(ia.subtitle)) {
    objects.push(mkCanvasText({
      id: stableId(sceneId, 'subtitle'),
      masterScriptRef: `${LIRI_IA_ROLE_PREFIX}subtitle`,
      x: MARGIN,
      y,
      width: CONTENT_W,
      height: 28,
      text: ia.subtitle,
      fontSize: 14,
      fontWeight: '600',
      color: '#777',
      textAlign: 'left',
    }));
  }
  y += 34;

  objects.push(mkCanvasText({
    id: stableId(sceneId, 'title'),
    masterScriptRef: `${LIRI_IA_ROLE_PREFIX}title`,
    x: MARGIN,
    y,
    width: CONTENT_W,
    height: 84,
    text: asText(ia.title),
    fontFamily: 'Georgia, serif',
    fontSize: 40,
    fontWeight: '700',
    color: SB_CANVAS_GOLD,
    textAlign: 'left',
  }));
  y += 100;

  if (isFilled(ia.core_idea)) {
    objects.push(mkCanvasText({
      id: stableId(sceneId, 'core_idea'),
      masterScriptRef: `${LIRI_IA_ROLE_PREFIX}core_idea`,
      x: MARGIN,
      y,
      width: CONTENT_W,
      height: 96,
      text: ia.core_idea,
      fontFamily: 'Georgia, serif',
      fontSize: 22,
      color: '#222',
      textAlign: 'left',
      italic: true,
      lineHeight: 1.4,
    }));
    y += 112;
  }

  const dev = ia.development;

  if (isStructuredDevelopment(dev)) {
    const twoCols = dev.length >= 3;
    const colW = twoCols ? Math.floor((CONTENT_W - 24) / 2) : CONTENT_W;
    const colX = [MARGIN, MARGIN + colW + 24];
    const colY = [y, y];
    let col = 0;

    dev.forEach((group, i) => {
      const points = Array.isArray(group?.points) ? group.points : [];
      const blockH = 30 + Math.max(1, points.length) * 26;
      // Débordement : on bascule sur la seconde colonne plutôt que d'empiler hors canevas.
      if (twoCols && col === 0 && colY[0] + blockH > CANVAS_H - MARGIN && colY[1] + blockH <= CANVAS_H - MARGIN) {
        col = 1;
      }
      objects.push(mkCanvasText({
        id: stableId(sceneId, `dev${i}_label`),
        masterScriptRef: `${LIRI_IA_ROLE_PREFIX}development/${i}/label`,
        x: colX[col],
        y: colY[col],
        width: colW,
        height: 28,
        text: asText(group?.label),
        fontSize: 16,
        fontWeight: '700',
        color: SB_CANVAS_GOLD,
        textAlign: 'left',
      }));
      objects.push(mkCanvasText({
        id: stableId(sceneId, `dev${i}_points`),
        masterScriptRef: `${LIRI_IA_ROLE_PREFIX}development/${i}/points`,
        x: colX[col],
        y: colY[col] + 30,
        width: colW,
        height: Math.max(1, points.length) * 26,
        text: pointsToLines(points),
        fontSize: 15,
        color: '#222',
        textAlign: 'left',
        lineHeight: 1.45,
      }));
      colY[col] += blockH + 18;
    });
  } else if (Array.isArray(dev) && dev.length > 0) {
    // Forme legacy (tableau de chaînes) : un SEUL bloc, sinon l'aller-retour la
    // convertirait en forme structurée et ferait basculer le layout du direct.
    objects.push(mkCanvasText({
      id: stableId(sceneId, 'dev_legacy'),
      masterScriptRef: `${LIRI_IA_ROLE_PREFIX}development_legacy`,
      x: MARGIN,
      y,
      width: CONTENT_W,
      height: Math.max(1, dev.length) * 28,
      text: pointsToLines(dev),
      fontSize: 16,
      color: '#222',
      textAlign: 'left',
      lineHeight: 1.5,
    }));
  }

  return objects;
}

/**
 * Scène live → scène de canevas éditable.
 * @param {object} scene ligne `live_scenes` (ou brouillon wizard)
 * @param {{ ignoreSavedLayout?: boolean }} [options]
 * @returns {{ id, name, mode: 'ia'|'elements', canvas: {width:number,height:number}, objects: object[], fromSavedLayout: boolean }|null}
 */
export function liveSceneToKonvaScene(scene, options = {}) {
  if (!scene) return null;
  const payload = parsePayload(scene.content_payload_json);
  const mode = detectSceneCanvasMode(scene);
  const base = {
    id: scene.id ?? scene.scene_id ?? null,
    name: scene.name ?? '',
    mode,
    canvas: { width: CANVAS_W, height: CANVAS_H },
  };

  const saved = payload[KONVA_LAYOUT_PAYLOAD_KEY];
  if (!options.ignoreSavedLayout && Array.isArray(saved) && saved.length > 0) {
    return { ...base, objects: saved.map((o) => ({ ...o })), fromSavedLayout: true };
  }

  if (mode === 'elements') {
    const els = (Array.isArray(scene.elements) && scene.elements.length)
      ? scene.elements
      : (Array.isArray(payload.elements) ? payload.elements : []);
    return { ...base, objects: slideElementsToCanvasObjects(els), fromSavedLayout: false };
  }

  const ia = readSceneIaData(scene) || {};
  return { ...base, objects: buildIaCanvasObjects(ia, base.id), fromSavedLayout: false };
}

/* ---------------------------------------------------- sens 2 : canevas → patch */

function resolveObjects(input) {
  if (Array.isArray(input)) return input;
  if (input && Array.isArray(input.objects)) return input.objects;
  return [];
}

/**
 * Fusionne les objets porteurs de rôle dans `ia_data` SANS rien reconstruire :
 * on part de l'ancien `ia_data` et on n'écrase que les champs effectivement présents.
 */
function mergeIaDataFromObjects(previousIa, objects) {
  const out = { ...(previousIa && typeof previousIa === 'object' ? previousIa : {}) };

  const devLabels = new Map();
  const devPoints = new Map();
  let legacyText = null;

  for (const obj of objects) {
    const role = parseRole(obj);
    if (!role) continue;
    const text = asText(obj.text);
    if (role.kind === 'development') {
      if (role.part === 'label') devLabels.set(role.index, text);
      else devPoints.set(role.index, text);
      continue;
    }
    if (role.kind === 'development_legacy') {
      legacyText = text;
      continue;
    }
    // Bloc vidé = non modifié (règle de non-destruction ci-dessus).
    // Texte identique à l'original = non touché : on ne le réécrit pas, sinon le
    // `.trim()` modifierait à lui seul une valeur que personne n'a éditée.
    if (isFilled(text) && text !== out[role.kind]) out[role.kind] = text.trim();
  }

  if (legacyText !== null && !isStructuredDevelopment(out.development)) {
    const prevPts = Array.isArray(out.development) ? out.development : null;
    // Bloc non touché : on garde le tableau d'origine plutôt que de le reconstruire
    // depuis son rendu texte. Un point contenant un retour à la ligne s'y scinderait
    // en deux points, et l'enseignant n'aurait rien fait pour mériter ça.
    if (!(prevPts && pointsToLines(prevPts) === legacyText)) {
      const pts = linesToPoints(legacyText);
      if (pts.length) out.development = pts;
    }
  }

  if (devLabels.size > 0 || devPoints.size > 0) {
    const prevDev = isStructuredDevelopment(out.development) ? out.development : [];
    const maxIndex = Math.max(
      prevDev.length - 1,
      ...[...devLabels.keys(), ...devPoints.keys()],
    );
    const next = [];
    for (let i = 0; i <= maxIndex; i += 1) {
      const prevGroup = prevDev[i] && typeof prevDev[i] === 'object' ? prevDev[i] : null;
      // On repart du groupe existant : ses champs hors label/points (couleur, icône…)
      // ne sont pas représentés sur le canevas et doivent survivre.
      const group = prevGroup ? { ...prevGroup } : { label: '', points: [] };
      if (devLabels.has(i)) {
        const l = devLabels.get(i).trim();
        if (l !== '' || !prevGroup) group.label = l;
      }
      if (devPoints.has(i)) {
        const raw = devPoints.get(i);
        const prevPts = Array.isArray(prevGroup?.points) ? prevGroup.points : null;
        // Idem : bloc non touché ⇒ tableau d'origine conservé tel quel.
        if (!(prevPts && pointsToLines(prevPts) === raw)) {
          const pts = linesToPoints(raw);
          if (pts.length || !prevGroup) group.points = pts;
        }
      }
      if (!Array.isArray(group.points)) group.points = [];
      next.push(group);
    }
    out.development = next;
  }

  return out;
}

/**
 * Objets de canevas → PATCH PARTIEL de la scène.
 *
 * @param {object[]|{objects:object[],mode?:string}} canvasInput
 * @param {object} previousScene ligne live_scenes actuelle — source de vérité à préserver
 * @param {{ keepCanvasLayout?: boolean, mode?: 'ia'|'elements' }} [options]
 * @returns {object} patch : uniquement `content_payload_json` (ou `ia_data` pour un
 *   brouillon wizard qui porte `ia_data` à la racine). Jamais de colonne système.
 */
export function konvaSceneToLiveScenePatch(canvasInput, previousScene, options = {}) {
  const objects = resolveObjects(canvasInput);
  const prev = previousScene && typeof previousScene === 'object' ? previousScene : {};
  const payload = parsePayload(prev.content_payload_json);
  const mode = options.mode
    || (canvasInput && !Array.isArray(canvasInput) && canvasInput.mode)
    || detectSceneCanvasMode(prev);
  const keepLayout = options.keepCanvasLayout !== false;

  if (mode === 'elements') {
    // Les éléments positionnels décrivent DÉJÀ la mise en page : pas de miroir
    // `konva_canvas_objects` à stocker, il ferait doublon.
    const elements = canvasObjectsToSlideElements(objects);
    if (elements.length === 0) return {};
    return { content_payload_json: { ...payload, elements } };
  }

  const previousIa = readSceneIaData(prev);
  const nextIa = mergeIaDataFromObjects(previousIa, objects);

  // `ia_data` à la racine = brouillon wizard (la table live_scenes n'a pas cette
  // colonne) : on patche là où la donnée vit réellement, sinon l'édition serait
  // invisible (normalizeLiveSceneToSlide donne la priorité à la racine).
  if (prev.ia_data && typeof prev.ia_data === 'object') {
    const patch = { ia_data: nextIa };
    if (keepLayout && objects.length > 0) {
      patch.content_payload_json = { ...payload, [KONVA_LAYOUT_PAYLOAD_KEY]: objects };
    }
    return patch;
  }

  const nextPayload = { ...payload, ia_data: nextIa };
  if (keepLayout && objects.length > 0) nextPayload[KONVA_LAYOUT_PAYLOAD_KEY] = objects;
  return { content_payload_json: nextPayload };
}

/**
 * Application locale d'un patch partiel (aperçu, tests). Le seul champ profond est
 * `content_payload_json`, déjà rendu complet par `konvaSceneToLiveScenePatch` : on
 * remplace donc au premier niveau, sans fusion récursive hasardeuse.
 */
export function applyLiveScenePatch(scene, patch) {
  return { ...(scene || {}), ...(patch || {}) };
}
