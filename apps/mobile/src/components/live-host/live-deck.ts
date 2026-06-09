import { type SmartboardBlock, type SmartboardSlide } from '@/components/live-host/immersive-smartboard';
import { supabase } from '@/lib/supabase';

/**
 * Deck de slides smartboard partagé entre la régie HÔTE (host-shell) et la
 * salle ÉLÈVE (eleve-live-shell). La synchro temps réel (data channel LiveKit)
 * transmet l'INDEX de slide ; les deux côtés lisent le même deck → contenu
 * identique. À terme, ce deck vient du constructeur (Architect / Masterclass)
 * par session ; ici un deck d'exemple.
 */
export const LIVE_DECK: SmartboardSlide[] = [
  {
    chapter: 'CHAPITRE 3',
    title: 'La vitesse de la lumière',
    cameraZone: 'top-right',
    blocks: [
      { type: 'key-idea', text: 'La lumière se déplace dans le vide à une vitesse constante notée c.' },
      { type: 'formula', label: 'VALEUR OFFICIELLE', text: 'c = 299 792 458 m/s' },
      { type: 'retain', items: ["La vitesse de la lumière est la plus grande vitesse de l'univers.", 'Elle est la même dans le vide pour tous les observateurs.'] },
    ],
  },
  {
    chapter: 'CHAPITRE 3',
    title: 'Propagation',
    cameraZone: 'top-right',
    blocks: [
      { type: 'key-idea', text: 'En milieu homogène, la lumière se propage en ligne droite.' },
      { type: 'formula', label: 'RELATION', text: 'v = d / t' },
      { type: 'retain', items: ['Le rayon lumineux modélise le trajet de la lumière.'] },
    ],
  },
  {
    chapter: 'CHAPITRE 3',
    title: 'Soleil → Terre',
    cameraZone: 'top-right',
    blocks: [
      { type: 'key-idea', text: 'La distance Terre–Soleil est d ≈ 150 millions de km.' },
      { type: 'formula', label: 'TEMPS DE TRAJET', text: 't ≈ 8 min 20 s' },
      { type: 'retain', items: ['La lumière du Soleil met environ 8 min 20 s à nous parvenir.'] },
    ],
  },
];

export const DECK_SIZE = LIVE_DECK.length;
/** Slide pour une position 1-based (boucle sur le deck). */
export const slideAt = (i: number): SmartboardSlide => LIVE_DECK[(Math.max(1, i) - 1) % LIVE_DECK.length];

/** Slide 1-based dans un deck arbitraire (boucle). Renvoie undefined si vide. */
export function slideAtIn(deck: SmartboardSlide[], i: number): SmartboardSlide | undefined {
  if (!deck.length) return undefined;
  return deck[(Math.max(1, i) - 1) % deck.length];
}

/* ─────────────── Deck dynamique (généré par Architect / Masterclass) ─────────────── */

/** Forme brute d'une slide générée (table `smartboard_slides`). */
interface SmartboardSlideRow {
  slide_index?: number | null;
  step?: string | null;
  title?: string | null;
  subtitle?: string | null;
  core_idea?: string | null;
  content?: { main_text?: string; support_text?: string } | null;
  graphic?: { formula?: string; equation?: string; center?: string } | null;
  master_script?: { key_points?: string[]; message_central?: string } | null;
}

/**
 * Convertit une slide générée → gabarit mobile `SmartboardSlide` (blocs + zone
 * caméra). C'est le pont entre le constructeur (Architect/Masterclass) et le
 * rendu live immersif : idée clé ← core_idea, formule ← graphic, à retenir ←
 * master_script.key_points, etc.
 */
export function rowToSmartboardSlide(row: SmartboardSlideRow): SmartboardSlide {
  const blocks: SmartboardBlock[] = [];
  const keyIdea = row.core_idea || row.content?.main_text;
  if (keyIdea) blocks.push({ type: 'key-idea', text: keyIdea });
  const formula = row.graphic?.formula || row.graphic?.equation;
  if (formula) blocks.push({ type: 'formula', label: 'VALEUR OFFICIELLE', text: formula });
  const support = row.content?.support_text;
  if (support) blocks.push({ type: 'paragraph', text: support });
  const points = row.master_script?.key_points?.filter(Boolean);
  if (points?.length) blocks.push({ type: 'retain', items: points });
  if (!blocks.length) blocks.push({ type: 'paragraph', text: row.subtitle || row.title || 'Slide' });
  return {
    chapter: row.step ? row.step.replace(/_/g, ' ').toUpperCase() : undefined,
    title: row.title || 'Slide',
    cameraZone: 'top-right',
    blocks,
  };
}

/**
 * Charge le deck d'une session (slides générées) depuis Supabase et le mappe en
 * gabarits mobiles. Renvoie [] si pas de deck / inaccessible → l'appelant
 * retombe sur LIVE_DECK (exemple). Aucun throw.
 */
export async function fetchLiveDeck(deckId?: string | null): Promise<SmartboardSlide[]> {
  if (!deckId) return [];
  try {
    const { data, error } = await supabase
      .from('smartboard_slides')
      .select('slide_index, step, title, subtitle, core_idea, content, graphic, master_script')
      .eq('deck_id', deckId)
      .order('slide_index', { ascending: true });
    if (error || !data?.length) return [];
    return (data as SmartboardSlideRow[]).map(rowToSmartboardSlide);
  } catch {
    return [];
  }
}
