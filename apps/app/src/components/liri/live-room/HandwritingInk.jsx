import React from 'react';
import { motion } from 'framer-motion';

/**
 * ÉCRITURE À LA MAIN — loi 3 du cahier des charges « Tableau Vivant » :
 * « Le texte ne "pop" pas : il s'écrit comme tracé par une main. »
 *
 * Ce module est l'extraction de l'implémentation éprouvée de
 * `components/school/course-builder/TableauVivant.jsx`, qui rendait déjà ce
 * geste pour le lecteur élève mais n'était importée par aucun écran du direct :
 * l'arène affichait donc du texte plein, exactement ce que la loi interdit.
 * On partage le composant au lieu de le dupliquer — deux écritures divergentes
 * donneraient deux produits différents pour la même promesse.
 *
 * Accessibilité : le texte complet est porté par `aria-label` et chaque
 * caractère animé est `aria-hidden`, donc un lecteur d'écran lit une phrase, pas
 * une pluie de lettres. Sous `prefers-reduced-motion` (`rm`), tout s'affiche
 * d'un coup, sans main ni cascade (garde-fou §7).
 */

/** La main qui tient le stylo, calée sur la pointe d'écriture. Échelle en `em` : suit la taille du texte. */
function WritingHand({ rm }) {
  return (
    <span
      aria-hidden
      style={{ position: 'relative', display: 'inline-block', width: 0, height: 0, verticalAlign: 'baseline' }}
    >
      <motion.svg
        viewBox="0 0 110 116"
        style={{
          position: 'absolute',
          left: '-0.32em',
          bottom: '-0.62em',
          width: '2.15em',
          height: '2.26em',
          overflow: 'visible',
          zIndex: 6,
          filter: 'drop-shadow(0 4px 5px rgba(0,0,0,0.22))',
        }}
        animate={rm ? undefined : { x: [0, 0.9, -0.6, 0.7, 0], y: [0, -0.7, 0.5, -0.4, 0], rotate: [0, 0.5, -0.4, 0.3, 0] }}
        transition={rm ? undefined : { duration: 0.42, repeat: Infinity, ease: 'easeInOut' }}
      >
        <g transform="rotate(29 18 90)">
          <rect x="10" y="2" width="16" height="88" rx="8" fill="#2f6df6" />
          <rect x="13.5" y="6" width="4" height="80" rx="2" fill="#ffffff" opacity="0.3" />
          <rect x="10" y="60" width="16" height="9" fill="#1e2e74" />
          <polygon points="10,90 26,90 18,104" fill="#15224a" />
          <circle cx="18" cy="101" r="2.3" fill="#0b1130" />
          <ellipse cx="54" cy="56" rx="26" ry="23" fill="#bd8150" />
          <rect x="2" y="37" width="44" height="12.5" rx="6.25" fill="#c4894f" />
          <rect x="0" y="50" width="46" height="12.5" rx="6.25" fill="#c0844c" />
          <rect x="2" y="63" width="43" height="12.5" rx="6.25" fill="#b87a48" />
          <ellipse cx="37" cy="76" rx="9.5" ry="15.5" fill="#b2774a" transform="rotate(17 37 76)" />
          <path d="M62 40 q22 -2 30 16 q7 16 -4 30 q-9 11 -24 8 q12 -6 14 -22 q2 -18 -16 -28 Z" fill="#b27746" />
        </g>
      </motion.svg>
    </span>
  );
}

/**
 * Texte qui s'écrit à l'encre, caractère par caractère, groupé par MOTS pour que
 * le retour à la ligne reste propre.
 */
export function HandwritingInk({ text, perCharMs = 24, writing = false, rm = false, className }) {
  const words = String(text || '').split(' ');
  let charIndex = 0;
  return (
    <span aria-label={text} className={className ? `relative ${className}` : 'relative'}>
      {words.map((word, wordIndex) => {
        const rendered = (
          <span className="inline-block">
            {[...word].map((char, ci) => {
              const delay = charIndex * (perCharMs / 1000);
              charIndex += 1;
              return rm ? (
                <span key={ci} aria-hidden>{char}</span>
              ) : (
                <motion.span
                  key={ci}
                  aria-hidden
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.12, ease: 'easeOut', delay }}
                >
                  {char}
                </motion.span>
              );
            })}
          </span>
        );
        charIndex += 1;
        return (
          <React.Fragment key={wordIndex}>
            {rendered}
            {wordIndex < words.length - 1 ? ' ' : null}
          </React.Fragment>
        );
      })}
      {writing && !rm ? <WritingHand rm={rm} /> : null}
    </span>
  );
}

/**
 * SURLIGNAGE DU PASSAGE LU — loi 4 : « le passage en cours de lecture est mis en
 * évidence (effet karaoké) pour ancrer l'attention là où la voix se trouve ».
 * Le trait se déploie sous le texte quand le bloc devient actif.
 */
export function InkHighlight({ active, rm = false, children, className }) {
  return (
    <span className={className ? `relative inline-block ${className}` : 'relative inline-block'}>
      <motion.span
        aria-hidden
        // Affordance de test : rend le surlignage observable sans dépendre des
        // classes utilitaires générées, qui changent au gré du design.
        data-ink-highlight={active ? 'on' : 'off'}
        className="absolute inset-x-0 bottom-0 -z-10 h-[0.62em] rounded-[2px] bg-[color:var(--school-accent,#D4AF37)]/35"
        initial={{ scaleX: 0, originX: 0 }}
        animate={{ scaleX: active ? 1 : 0, originX: 0 }}
        transition={rm ? { duration: 0 } : { duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: 'left center' }}
      />
      {children}
    </span>
  );
}

export default HandwritingInk;
