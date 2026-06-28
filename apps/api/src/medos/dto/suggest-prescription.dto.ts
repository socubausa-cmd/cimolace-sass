import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Corps de POST /med/charting/:jobId/suggest-prescription.
 *
 * Aucun champ obligatoire : la suggestion est dérivée du job SOAP (note +
 * diagnostics ICD-10) déjà persisté. `extra_context` permet au praticien
 * d'orienter la suggestion (ex : « patient allergique pénicilline »,
 * « privilégier générique »). AUCUNE donnée identifiante ne doit y figurer.
 */
export class SuggestPrescriptionDto {
  @ApiPropertyOptional({
    description:
      "Contexte clinique libre transmis à l'IA pour affiner la suggestion " +
      '(allergies connues, terrain, contraintes). Ne JAMAIS y mettre de ' +
      'données identifiantes (nom, contact).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  extra_context?: string;
}

// ─── Types de sortie (non persistés — simple suggestion) ────────────────────

/**
 * Une ligne d'ordonnance SUGGÉRÉE par l'IA. Le sous-ensemble {drug_name,
 * dosage, frequency, duration, quantity?, route?, notes?, is_substitutable?}
 * est aligné sur CreatePrescriptionItemDto pour que le front puisse poster
 * directement vers POST /med/prescriptions après édition par le praticien.
 *
 * `confidence` (0–1) et `reasoning` sont des méta d'aide à la décision : ils
 * NE sont PAS envoyés au create — ils s'affichent côté praticien pour relecture.
 */
export type SuggestedPrescriptionItem = {
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity?: string | null;
  route?: string | null;
  notes?: string | null;
  is_substitutable?: boolean;
  /** Niveau de confiance de l'IA pour CETTE ligne (0–1). */
  confidence: number;
  /** Justification clinique courte de la ligne (guideline / rationnel). */
  reasoning: string;
};

/**
 * Réponse de la route de suggestion. NON persistée : le praticien relit,
 * édite, puis crée l'ordonnance (brouillon) via l'endpoint existant.
 */
export type PrescriptionSuggestionResult = {
  items: SuggestedPrescriptionItem[];
  /** Conseils généraux au patient suggérés (posologie globale, hygiène…). */
  patient_instructions?: string | null;
  /** Avertissement / mise en garde globale rédigée par l'IA (optionnel). */
  warnings?: string | null;
  /** Fournisseur:modèle ayant produit la suggestion (ex: mistral:mistral-large-latest). */
  model_used: string;
  /** Jetons consommés (completion) — pour le suivi de coût. */
  tokens_used: number;
};
