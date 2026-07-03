import React from 'react';

/**
 * Étiquette PRODUIT LIRI — un petit chip ambre posé À CÔTÉ du logo/nom existant
 * (jamais à la place), pour qu'on sache toujours dans quel produit LIRI on est :
 *   academy = école/formation · care = santé/téléconsultation ·
 *   studio  = studio créateur · live = live générique/embed.
 *
 * WHITE-LABEL-SAFE PAR DÉFAUT : ce composant n'écrit JAMAIS le mot « LIRI ».
 * Il ne rend que le label fonctionnel du produit (« Academy », « Care »…), qui
 * est sûr à montrer même à un end-user tenant. C'est le wordmark VOISIN (déjà
 * gaté par l'hôte/tenant dans chaque coque) qui, lui, porte « LIRI ». Ainsi :
 *   - créateur/opérateur (app.cimolace.space, dev) → wordmark « LIRI » + chip « Academy »
 *   - end-user tenant (prorascience.org)           → marque tenant + chip « Academy » (jamais « LIRI »)
 *
 * Couleur = ambre de la charte live (#d4a36a). NE PAS utiliser accentColor (violet
 * en config LIRI) sous peine de jurer avec la charte.
 */
const PRODUCTS = {
  academy: 'Academy',
  care: 'Care',
  studio: 'Studio',
  live: 'Live',
};

const SIZES = {
  xs: { fontSize: 9, padding: '1px 6px' },
  sm: { fontSize: 10, padding: '2px 8px' },
};

export default function LiriProductBadge({ product, size = 'sm', className = '', style = {} }) {
  const label = PRODUCTS[product];
  if (!label) return null;
  const sz = SIZES[size] || SIZES.sm;
  return (
    <span
      className={className}
      title={`Produit LIRI ${label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 9999,
        border: '1px solid rgba(212,163,106,.35)',
        background: 'rgba(212,163,106,.14)',
        color: '#e3c79a',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '.06em',
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        fontSize: sz.fontSize,
        padding: sz.padding,
        ...style,
      }}
    >
      {label}
    </span>
  );
}
