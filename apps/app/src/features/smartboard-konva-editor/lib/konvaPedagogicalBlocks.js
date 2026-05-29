/**
 * Blocs pédagogiques (Module 5) — insertion sur la scène Konva active.
 */
import { SMARTBOARD_DESIGN_HEIGHT, SMARTBOARD_DESIGN_WIDTH } from '@/lib/smartboardDesignCanvas';
import { mkRectObject, mkTextObject } from '../model/sceneModel';
import { useSmartboardKonvaStore } from '../store/useSmartboardKonvaStore';

/** @typedef {{ id: string; label: string; hint: string }} PedagogicalBlockDef */

/** @type {PedagogicalBlockDef[]} */
export const PEDAGOGICAL_BLOCK_CATALOG = [
  { id: 'sequence_title', label: 'Titre séquence', hint: 'Grand titre centré (or)' },
  { id: 'objective_box', label: 'Encadré objectif', hint: 'Cadre + texte objectif' },
  { id: 'bullet_skeleton', label: 'Liste à puces', hint: 'Structure 3 points' },
  { id: 'question_prompt', label: 'Question classe', hint: 'Amorce orale' },
  { id: 'synthesis_bar', label: 'Bandeau synthèse', hint: 'Bandeau « À retenir »' },
];

let insertCounter = 0;

function nextStackY() {
  insertCounter += 1;
  const row = (insertCounter % 5) * 88;
  return 56 + row;
}

/**
 * @param {string} blockId
 * @returns {{ error: string | null }}
 */
export function insertKonvaPedagogicalBlock(blockId) {
  const { addObject, addObjects } = useSmartboardKonvaStore.getState();

  const y0 = nextStackY();
  const margin = 48;
  const w = SMARTBOARD_DESIGN_WIDTH - margin * 2;

  switch (blockId) {
    case 'sequence_title':
      addObject(
        mkTextObject({
          x: margin,
          y: y0,
          width: w,
          height: 72,
          style: {
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 32,
            fontWeight: 700,
            fill: '#e9bf72',
            align: 'center',
          },
          content: { text: 'Titre de la séquence' },
        }),
      );
      break;

    case 'objective_box': {
      const h = 128;
      const rect = mkRectObject({
        x: margin,
        y: y0,
        width: w,
        height: h,
        style: {
          fill: 'rgba(212,175,55,0.12)',
          stroke: 'rgba(212,175,55,0.45)',
          strokeWidth: 1.5,
          cornerRadius: 12,
        },
      });
      const t1 = mkTextObject({
        x: margin + 20,
        y: y0 + 14,
        width: w - 40,
        height: 36,
        style: {
          fontSize: 13,
          fontWeight: 700,
          fill: 'rgba(245,221,138,0.95)',
          align: 'left',
        },
        content: { text: 'Objectif pédagogique' },
      });
      const t2 = mkTextObject({
        x: margin + 20,
        y: y0 + 48,
        width: w - 40,
        height: 68,
        style: {
          fontSize: 15,
          fontWeight: 400,
          fill: '#f7f2e8',
          align: 'left',
          lineHeight: 1.35,
        },
        content: {
          text: "À compléter : ce que l'élève doit savoir faire à la fin de la séance.",
        },
      });
      addObjects([rect, t1, t2]);
      break;
    }

    case 'bullet_skeleton':
      addObject(
        mkTextObject({
          x: margin,
          y: y0,
          width: w,
          height: 200,
          style: {
            fontSize: 18,
            fontWeight: 400,
            fill: '#f7f2e8',
            align: 'left',
            lineHeight: 1.45,
          },
          content: { text: '• Point clé 1\n• Point clé 2\n• Point clé 3' },
        }),
      );
      break;

    case 'question_prompt':
      addObject(
        mkTextObject({
          x: margin,
          y: y0,
          width: w,
          height: 96,
          style: {
            fontSize: 17,
            fontWeight: 500,
            fill: '#a5d8ff',
            align: 'left',
            lineHeight: 1.4,
          },
          content: {
            text: '❓ Question pour la classe :\n(formuler une question orale ouverte)',
          },
        }),
      );
      break;

    case 'synthesis_bar': {
      const barH = 52;
      const top = Math.min(y0, SMARTBOARD_DESIGN_HEIGHT - barH - margin);
      const bar = mkRectObject({
        x: margin,
        y: top,
        width: w,
        height: barH,
        style: {
          fill: 'rgba(56,189,248,0.18)',
          stroke: 'rgba(56,189,248,0.35)',
          strokeWidth: 1,
          cornerRadius: 8,
        },
      });
      const txt = mkTextObject({
        x: margin + 16,
        y: top + 10,
        width: w - 32,
        height: 36,
        style: {
          fontSize: 18,
          fontWeight: 700,
          fill: '#e0f2fe',
          align: 'left',
        },
        content: { text: 'Synthèse — À retenir' },
      });
      addObjects([bar, txt]);
      break;
    }

    default:
      return { error: 'Bloc inconnu.' };
  }

  return { error: null };
}
