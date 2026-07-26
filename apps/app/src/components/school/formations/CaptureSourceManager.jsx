/**
 * CaptureSourceManager
 * Point d'entrée du choix de la source vidéo avant d'entrer dans le studio.
 * Sources : webcam, téléphone (QR), écran, caméra externe, import fichier, live.
 *
 * PALETTE — LIRI chaude uniquement (fond #262624, encre #f5f4ee, corail #d97757,
 * or #e6cc92). Les cartes de source étaient auparavant un arc-en-ciel FROID
 * (blue / purple / sky / emerald) : c'était le seul écran de la chaîne d'import
 * qui cassait la direction artistique du studio.
 * On garde la différenciation visuelle entre sources — elle est utile, on doit
 * reconnaître une carte d'un coup d'œil — mais on la joue désormais dans la
 * gamme chaude : corail → or → ocre → cuir → lin, plus une intensité
 * décroissante (opacité du fond + force de l'anneau) qui hiérarchise du plus
 * recommandé (webcam) au plus secondaire (import fichier).
 */
import React, { useState, useEffect } from 'react';
import {
  Video, Camera, Monitor, Smartphone, Upload,
  Radio, ExternalLink, Check, ChevronRight, Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const SOURCES = [
  {
    id: 'webcam',
    icon: Video,
    // `ton` remplace l'ancien `color` (noms Tailwind froids) : ce sont désormais
    // des clés de la gamme chaude, cf. TONS_CHAUDS plus bas.
    ton: 'corail',
    label: 'Webcam de cet ordinateur',
    sub: 'Caméra intégrée ou USB connectée au PC',
    badge: 'Recommandé',
    // Le corail #d97757 = couleur d'ACTION LIRI : on la réserve à la source
    // recommandée pour qu'elle attire l'œil en premier.
    badgeColor: 'bg-[rgba(217,119,87,0.18)] text-[#f0a98d]',
    available: () => !!navigator.mediaDevices?.getUserMedia,
  },
  {
    id: 'phone',
    icon: Smartphone,
    ton: 'or',
    label: 'Caméra du téléphone',
    sub: 'Scanne un QR code pour utiliser ton téléphone comme caméra',
    badge: 'QR Code',
    badgeColor: 'bg-[rgba(230,204,146,0.16)] text-[#efd9ad]',
    available: () => true,
  },
  {
    id: 'screen',
    icon: Monitor,
    ton: 'ocre',
    label: 'Capturer l\'écran',
    sub: 'Enregistre ton écran, une fenêtre ou un onglet',
    badge: 'Screencast',
    badgeColor: 'bg-[rgba(224,164,92,0.16)] text-[#eebe86]',
    available: () => !!navigator.mediaDevices?.getDisplayMedia,
  },
  {
    id: 'external',
    icon: Camera,
    ton: 'cuir',
    label: 'Caméra externe',
    sub: 'Caméra USB, HDMI ou périphérique de capture',
    badge: 'Professionnel',
    badgeColor: 'bg-[rgba(201,143,106,0.16)] text-[#e3b494]',
    available: () => !!navigator.mediaDevices?.getUserMedia,
  },
  {
    id: 'upload',
    icon: Upload,
    ton: 'lin',
    label: 'Importer une vidéo',
    sub: 'Téléverse un fichier déjà enregistré (MP4, MOV, WebM…)',
    badge: 'Fichier',
    badgeColor: 'bg-[rgba(216,196,168,0.14)] text-[#e7d7bd]',
    available: () => true,
  },
  {
    id: 'live',
    icon: Radio,
    // Ton « grès éteint » : volontairement désaturé — cumulé au `opacity-40` de
    // la carte désactivée, il signale « pas encore dispo » sans sortir du chaud.
    ton: 'eteint',
    label: 'Enregistrement live',
    sub: 'Capture depuis un flux live ou RTMP entrant',
    badge: 'Bientôt',
    badgeColor: 'bg-[rgba(143,131,119,0.16)] text-[#c2b6a8]',
    available: () => false,
    disabled: true,
  },
];

/**
 * TONS_CHAUDS — un ton = une teinte chaude + une intensité.
 * Toutes les couleurs de texte/icône passent 4.5:1 sur le fond #262624
 * (corail 4.9:1 · or 9.7:1 · ocre 7.0:1 · cuir 5.5:1 · lin 8.9:1), donc aucune
 * n'est un gris trop clair qui passerait sous la barre de contraste.
 * On écrit les alphas en rgba() explicite plutôt qu'en modificateur `/xx` :
 * ces chaînes sont composées dans du template literal, il faut que la classe
 * complète soit lisible telle quelle par le scanner Tailwind.
 */
const TONS_CHAUDS = {
  corail:  { ring: 'ring-[rgba(217,119,87,0.45)]',  bg: 'bg-[rgba(217,119,87,0.14)]',  text: 'text-[#d97757]', hover: 'hover:border-[rgba(217,119,87,0.42)] hover:bg-[rgba(217,119,87,0.06)]' },
  or:      { ring: 'ring-[rgba(230,204,146,0.38)]', bg: 'bg-[rgba(230,204,146,0.12)]', text: 'text-[#e6cc92]', hover: 'hover:border-[rgba(230,204,146,0.38)] hover:bg-[rgba(230,204,146,0.05)]' },
  ocre:    { ring: 'ring-[rgba(224,164,92,0.34)]',  bg: 'bg-[rgba(224,164,92,0.12)]',  text: 'text-[#e0a45c]', hover: 'hover:border-[rgba(224,164,92,0.36)] hover:bg-[rgba(224,164,92,0.05)]' },
  cuir:    { ring: 'ring-[rgba(201,143,106,0.32)]', bg: 'bg-[rgba(201,143,106,0.10)]', text: 'text-[#c98f6a]', hover: 'hover:border-[rgba(201,143,106,0.34)] hover:bg-[rgba(201,143,106,0.05)]' },
  lin:     { ring: 'ring-[rgba(216,196,168,0.28)]', bg: 'bg-[rgba(216,196,168,0.10)]', text: 'text-[#d8c4a8]', hover: 'hover:border-[rgba(216,196,168,0.30)] hover:bg-[rgba(216,196,168,0.05)]' },
  eteint:  { ring: 'ring-[rgba(143,131,119,0.28)]', bg: 'bg-[rgba(143,131,119,0.10)]', text: 'text-[#8f8377]', hover: '' },
};

export default function CaptureSourceManager({ onSelectSource }) {
  const [availabilityMap, setAvailabilityMap] = useState({});

  useEffect(() => {
    const map = {};
    SOURCES.forEach((s) => { map[s.id] = s.available(); });
    setAvailabilityMap(map);
  }, []);

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1 pb-2">
        <p className="text-sm font-semibold text-[#f5f4ee]">Comment veux-tu créer ta vidéo ?</p>
        {/* .62 d'encre sur #262624 ≈ 6.2:1 — l'ancien text-gray-500 (slate froid)
            ne tenait que 3.1:1, il tombait sous la barre d'accessibilité. */}
        <p className="text-xs text-[rgba(245,244,238,0.62)]">Choisis la source de captation — le montage et l'IA se font toujours dans ce studio</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SOURCES.map((source) => {
          const avail = availabilityMap[source.id] ?? true;
          const disabled = source.disabled || !avail;
          const col = TONS_CHAUDS[source.ton] || TONS_CHAUDS.lin;
          const Icon = source.icon;

          return (
            <button
              key={source.id}
              type="button"
              onClick={() => !disabled && onSelectSource?.(source.id)}
              disabled={disabled}
              className={`
                group relative flex flex-col gap-3 rounded-2xl border border-[rgba(245,244,238,0.09)] p-4 text-left transition-all
                ${disabled ? 'opacity-40 cursor-not-allowed' : `cursor-pointer ${col.hover} active:scale-[0.98]`}
              `}
            >
              {/* Icône */}
              <div className={`w-10 h-10 rounded-xl ring-1 flex items-center justify-center flex-shrink-0 ${col.ring} ${col.bg}`}>
                <Icon className={`w-5 h-5 ${col.text}`} />
              </div>

              {/* Texte */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-[#f5f4ee]">{source.label}</p>
                  {source.badge && (
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0 ${source.badgeColor}`}>
                      {source.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[rgba(245,244,238,0.62)] mt-0.5 leading-relaxed">{source.sub}</p>
              </div>

              {/* Flèche — élément purement graphique : .40 d'encre suffit (≥3:1). */}
              {!disabled && (
                <ChevronRight className="absolute top-4 right-4 w-4 h-4 text-[rgba(245,244,238,0.40)] group-hover:text-[#f5f4ee] transition-colors" />
              )}
            </button>
          );
        })}
      </div>

      {/* Note d'architecture */}
      <div className="rounded-xl border border-[rgba(245,244,238,0.07)] bg-[rgba(245,244,238,0.04)] px-4 py-3 flex items-start gap-3">
        <Wifi className="w-4 h-4 text-[var(--school-accent)] mt-0.5 flex-shrink-0" />
        <p className="text-xs text-[rgba(245,244,238,0.62)] leading-relaxed">
          <span className="text-[var(--school-accent)] font-medium">Capture Source Manager</span> — La vidéo peut venir de n'importe quelle source.
          Le montage, l'analyse IA et la génération SmartBoard se font toujours dans ce studio web.
        </p>
      </div>
    </div>
  );
}
