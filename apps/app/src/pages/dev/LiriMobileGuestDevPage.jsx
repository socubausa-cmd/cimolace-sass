import React from 'react';
import LiriLiveMobileGuestView from '@/components/liri/live-room/LiriLiveMobileGuestView';

const DEMO_LESSON = {
  subject: 'Physique – Terminale S',
  chapter: 'Chapitre 3 : Ondes et lumière',
  currentSlide: 2,
  totalSlides: 8,
  title: 'La vitesse de la lumière',
  keyText: 'La lumière se déplace dans le vide à une vitesse constante notée c.',
  value: 'c = 299 792 458 m/s\n≈ 300 000 km/s',
  points: [
    'La vitesse de la lumière est la plus grande vitesse de l\'univers.',
    'Elle est la même dans le vide pour tous les observateurs.',
    'C\'est une constante fondamentale de la physique.',
  ],
};

/**
 * Aperçu du template mobile authority (hors session Live).
 * Ouvrir : /dev/liri-mobile-guest
 */
export default function LiriMobileGuestDevPage() {
  return <LiriLiveMobileGuestView lesson={DEMO_LESSON} />;
}
