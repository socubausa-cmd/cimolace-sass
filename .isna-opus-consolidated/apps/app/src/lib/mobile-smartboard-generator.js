/**
 * LIRI — Mobile Smartboard Authority Template
 * Générateur de slide Smartboard 9:16 + métadonnées (zone vidéo prof verrouillée).
 * Canevas : aligné sur `smartboardDesignCanvas` (Architect unifié).
 */
import {
  MOBILE_LIVE_AUTHORITY_WIDTH,
  MOBILE_LIVE_AUTHORITY_HEIGHT,
  MOBILE_LIVE_AUTHORITY_SAFE_PADDING,
  MOBILE_LIVE_AUTHORITY_TEACHER_ZONE,
} from '@/lib/smartboardDesignCanvas';

export const MOBILE_SMARTBOARD = {
  width: MOBILE_LIVE_AUTHORITY_WIDTH,
  height: MOBILE_LIVE_AUTHORITY_HEIGHT,
  safePadding: MOBILE_LIVE_AUTHORITY_SAFE_PADDING,

  lockedZones: {
    teacherVideo: { ...MOBILE_LIVE_AUTHORITY_TEACHER_ZONE },
  },
};

/**
 * @param {Record<string, unknown>} [input]
 */
export function generateMobileSmartboardSlide(input = {}) {
  return {
    meta: {
      template: 'MobileSmartboardAuthorityTemplate',
      format: 'mobile-9-16',
      width: MOBILE_SMARTBOARD.width,
      height: MOBILE_SMARTBOARD.height,
      safePadding: MOBILE_SMARTBOARD.safePadding,
      lockedZones: MOBILE_SMARTBOARD.lockedZones,
    },

    header: {
      live: true,
      subject: input.subject || 'Physique – Terminale S',
      chapter: input.chapter || 'Chapitre 3 : Ondes et lumière',
      currentSlide: input.currentSlide || 2,
      totalSlides: input.totalSlides || 8,
    },

    title: {
      badge: input.badge || 'CHAPITRE 3',
      text: input.title || 'La vitesse de la lumière',
    },

    keyIdea: {
      icon: input.keyIcon || '💡',
      title: input.keyTitle || 'IDÉE CLÉ',
      text:
        input.keyText ||
        'La lumière se déplace dans le vide à une vitesse constante notée c.',
    },

    valueBlock: {
      title: input.valueTitle || 'VALEUR OFFICIELLE',
      value: input.value || 'c = 299 792 458 m/s\n≈ 300 000 km/s',
    },

    rememberBlock: {
      title: input.rememberTitle || 'À RETENIR',
      points:
        input.points || [
          'La vitesse de la lumière est la plus grande vitesse de l’univers.',
          'Elle est la même dans le vide pour tous les observateurs.',
          'C’est une constante fondamentale de la physique.',
        ],
      diagram: input.diagram || {
        left: '☀️',
        arrow: '→',
        right: '🌍',
        caption: 'Lumière du soleil → Terre\n8 min 20 s',
      },
    },
  };
}
