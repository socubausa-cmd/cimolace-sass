export interface SmartboardStepDefinition {
  key: string;
  label: string;
  visualWeights: {
    texte: number;
    image: number;
    graphique: number;
    infographie: number;
    interaction: number;
  };
}

export const SMARTBOARD_STEPS: SmartboardStepDefinition[] = [
  { key: 'titre_chapitre', label: 'Titre chapitre', visualWeights: { texte: 70, image: 20, graphique: 5, infographie: 5, interaction: 0 } },
  { key: 'objectif_competence_connaissance', label: 'Objectif · compétence · connaissance', visualWeights: { texte: 75, image: 10, graphique: 5, infographie: 10, interaction: 0 } },
  { key: 'mise_en_situation', label: 'Mise en situation', visualWeights: { texte: 40, image: 60, graphique: 0, infographie: 0, interaction: 0 } },
  { key: 'tension_pedagogique', label: 'Tension pédagogique', visualWeights: { texte: 60, image: 20, graphique: 20, infographie: 0, interaction: 0 } },
  { key: 'experience_pensee', label: 'Expérience de pensée', visualWeights: { texte: 45, image: 40, graphique: 10, infographie: 0, interaction: 5 } },
  { key: 'revelation', label: 'Révélation', visualWeights: { texte: 90, image: 10, graphique: 0, infographie: 0, interaction: 0 } },
  { key: 'lecon_simple', label: 'Leçon simple', visualWeights: { texte: 80, image: 10, graphique: 10, infographie: 0, interaction: 0 } },
  { key: 'lecon_developpee', label: 'Leçon développée', visualWeights: { texte: 50, image: 10, graphique: 40, infographie: 0, interaction: 0 } },
  { key: 'analogies', label: 'Analogies', visualWeights: { texte: 40, image: 50, graphique: 0, infographie: 10, interaction: 0 } },
  { key: 'exemples', label: 'Exemples', visualWeights: { texte: 55, image: 30, graphique: 10, infographie: 5, interaction: 0 } },
  { key: 'reformulation', label: 'Reformulation', visualWeights: { texte: 85, image: 10, graphique: 0, infographie: 5, interaction: 0 } },
  { key: 'atelier_application', label: 'Atelier / application', visualWeights: { texte: 35, image: 15, graphique: 10, infographie: 10, interaction: 30 } },
  { key: 'erreurs_attendues', label: 'Erreurs attendues', visualWeights: { texte: 70, image: 10, graphique: 20, infographie: 0, interaction: 0 } },
  { key: 'correction_pedagogique', label: 'Correction pédagogique', visualWeights: { texte: 75, image: 5, graphique: 20, infographie: 0, interaction: 0 } },
  { key: 'dictee_je_retiens', label: 'Dictée JE RETIENS', visualWeights: { texte: 100, image: 0, graphique: 0, infographie: 0, interaction: 0 } },
  { key: 'test_comprehension', label: 'Test compréhension', visualWeights: { texte: 45, image: 5, graphique: 15, infographie: 5, interaction: 30 } },
  { key: 'cas_reel', label: 'Cas réel', visualWeights: { texte: 45, image: 35, graphique: 10, infographie: 5, interaction: 5 } },
  { key: 'lien_avec_autres_concepts', label: 'Lien avec autres concepts', visualWeights: { texte: 45, image: 5, graphique: 35, infographie: 15, interaction: 0 } },
  { key: 'transition', label: 'Transition', visualWeights: { texte: 80, image: 15, graphique: 5, infographie: 0, interaction: 0 } },
];

