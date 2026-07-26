import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock3, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * TABLE D'ACCENTS — un accent par studio. C'est ce qui permet de reconnaître d'un
 * coup d'œil dans quel constructeur on se trouve. La couleur PORTE UNE INFORMATION :
 * si deux studios tombent sur la même teinte, cette information est perdue.
 *
 * Les CLÉS sont le CONTRAT avec les appelants : elles arrivent en prop depuis les
 * builders (`<StudioGenericPreview accent="terre" />`). On ne les renomme pas — ce
 * serait un changement d'API déguisé en travail de couleur. Seules les VALEURS
 * basculent sur la rampe chaude.
 *
 * ÉTAT RÉEL DES APPELANTS (vérifié dans builders/, et non supposé) :
 *   FormationStudioBuilder   → accent="amber"    (ambre)
 *   CoachingStudioBuilder    → accent="terre"    (terre)
 *   AppointmentStudioBuilder → accent="emerald"  (olive)
 *   EventStudioBuilder       → accent="rose"     (brasier)
 *
 * RÉGRESSION RÉPARÉE ICI. La clé `terre`, demandée par CoachingStudioBuilder, n'avait
 * jamais été ajoutée à la table : le lookup échouait, Coaching retombait sur le repli
 * `amber`… c'est-à-dire exactement l'accent de Formation. Deux constructeurs rendaient
 * le même badge et ne se distinguaient plus. `terre` est donc rétablie.
 *
 * `cyan` et `violet` ne sont plus demandées par aucun builder mais restent publiées :
 * ce sont des clés du contrat, et un appelant hors de ce dossier pourrait les passer.
 * Elles reçoivent deux teintes chaudes qui leur sont propres (sable, cuivre).
 *
 * SÉPARATION DES SIX TEINTES — chacune est prise sur une marche différente de la rampe
 * chaude, et les quatre VIVANTES sont volontairement les plus éloignées les unes des
 * autres (jaune-orangé / tan / vert / rouge-orangé) :
 *   amber → ambre #d4924a · terre → terre #d8916a · emerald → olive #5a8f52
 *   rose  → brasier #e0705a · cyan → sable #c9a25e · violet → cuivre #c96544
 * `emerald` garde une teinte VERTE (l'olive « succès/validé » de la charte) : le vert
 * y était sémantique — un rendez-vous confirmé — et l'aplatir en orange aurait effacé
 * ce sens en plus de le rapprocher dangereusement de `terre`.
 *
 * Chaque valeur associe l'ENCRE de la marche (le texte, qui doit rester lisible) à
 * l'ACCENT (bordure + aplat à 10 %). Ratios de l'encre sur le fond composé
 * accent-à-10-% (mesurés sur les deux coques possibles, page #262624 et #0a0908) :
 *   ambre 5,89 / 8,12 · terre 5,42 / 7,49 · olive 6,29 / 8,63
 *   brasier 5,34 / 7,29 · sable 7,69 / 10,63 · cuivre 5,32 / 7,19  → tous ≥ 4,5:1.
 *
 * Table hissée hors du composant : elle est constante, inutile de la reconstruire à
 * chaque rendu, et Tailwind la scanne aussi bien ici (classes statiques littérales).
 */
const STUDIO_ACCENTS = {
  amber: 'text-[#e0a458] border-[#d4924a]/35 bg-[#d4924a]/10',
  terre: 'text-[#dc9a72] border-[#d8916a]/35 bg-[#d8916a]/10',
  emerald: 'text-[#8fbf7a] border-[#5a8f52]/45 bg-[#5a8f52]/10',
  rose: 'text-[#ec8a72] border-[#e0705a]/35 bg-[#e0705a]/10',
  cyan: 'text-[#e6c48f] border-[#c9a25e]/35 bg-[#c9a25e]/10',
  violet: 'text-[#dd8f6e] border-[#c96544]/40 bg-[#c96544]/10',
};

/** Repli : chaud, lisible, jamais vide — voir `resolveStudioAccent`. */
const STUDIO_ACCENT_FALLBACK = STUDIO_ACCENTS.amber;

/**
 * Résolution défensive de l'accent.
 * `STUDIO_ACCENTS[accent] || fallback` ne suffit PAS : un objet littéral hérite de
 * `Object.prototype`, donc une clé comme "constructor" ou "toString" renverrait une
 * FONCTION — truthy — que `cn()` sérialiserait en classe absurde. On teste donc la
 * propriété PROPRE. Un appelant futur qui passerait une clé inconnue (ou `null`,
 * ou une valeur venue d'une API) obtient l'ambre, jamais une classe vide ni un
 * badge sans bordure.
 */
function resolveStudioAccent(accent) {
  return Object.prototype.hasOwnProperty.call(STUDIO_ACCENTS, accent)
    ? STUDIO_ACCENTS[accent]
    : STUDIO_ACCENT_FALLBACK;
}

export function StudioGenericPreview({ draft, studioLabel, accent = 'amber' }) {
  const accentClass = resolveStudioAccent(accent);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      className="space-y-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        // L'ardoise bleutée 121A25 (bannie) → #30302e, la couleur de panneau de la charte
        className="rounded-2xl border border-white/10 bg-[#30302e]/70 backdrop-blur-xl p-4"
      >
        {/* Les text-gray-* de Tailwind sont teintés bleu (gray-500 = #6b7280) et
            tombaient à ~2,6:1 sur ce panneau. On repasse sur l'encre de la charte. */}
        <p className="text-xs uppercase tracking-wider text-[#f5f4ee]/65 mb-2">Aperçu</p>
        <h4 className="text-[#f5f4ee] font-semibold text-lg line-clamp-2">
          {draft?.title?.trim() || `Nouveau ${studioLabel}`}
        </h4>
        {draft?.description ? (
          <p className="text-sm text-[#f5f4ee]/75 mt-2 line-clamp-3">{draft.description}</p>
        ) : (
          <p className="text-sm text-[#f5f4ee]/65 mt-2">Ajoutez une description pour enrichir votre aperçu.</p>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 }}
        className="grid grid-cols-2 gap-2"
      >
        <motion.div whileHover={{ y: -2 }} className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] text-[#f5f4ee]/65">Date</p>
          <p className="text-sm text-[#f5f4ee] mt-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#f5f4ee]/55" />
            {draft?.date || draft?.scheduled_at || 'À planifier'}
          </p>
        </motion.div>
        <motion.div whileHover={{ y: -2 }} className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] text-[#f5f4ee]/65">Durée</p>
          <p className="text-sm text-[#f5f4ee] mt-1 flex items-center gap-1.5">
            <Clock3 className="w-3.5 h-3.5 text-[#f5f4ee]/55" />
            {draft?.duration_minutes ? `${draft.duration_minutes} min` : 'Flexible'}
          </p>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06 }}
        className={cn('rounded-xl border p-3 flex items-start gap-2', accentClass)}
      >
        <Sparkles className="w-4 h-4 mt-0.5" />
        <p className="text-xs">
          Le studio {studioLabel.toLowerCase()} utilise le même moteur premium (autosave, étapes, transitions, preview).
        </p>
      </motion.div>
    </motion.div>
  );
}
