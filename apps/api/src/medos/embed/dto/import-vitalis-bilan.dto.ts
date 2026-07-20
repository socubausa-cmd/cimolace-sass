/**
 * DTO — POST /v1/medos/embed/import-vitalis-bilan
 *
 * Payload envoyé par le backend d'un tenant (ex: zahirwellness) pour importer
 * un bilan externe (Vitalis Détox) dans MEDOS :
 *   1. Find-or-create patient MEDOS pour ce tenant (par email)
 *   2. INSERT 12 rows dans `med_transformation_wheel` (Roue Détox 12 axes)
 *   3. Retourne le patient_id + deep-link vers le dossier MEDOS
 *
 * Les 12 axes canoniques attendus dans `wheel_scores` (source :
 * TwinService.WHEEL_DOMAINS) — les clés doivent être exactes.
 */
import {
  IsEmail,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const WHEEL_DOMAINS = [
  'digestion',
  'sleep',
  'stress',
  'energy',
  'inflammation',
  'immunity',
  'metabolism',
  'hormones',
  'physical_activity',
  'cognition',
  'environment',
  'emotions',
] as const;

export type WheelDomain = (typeof WHEEL_DOMAINS)[number];
export const IMPORT_VITALIS_WHEEL_DOMAINS: readonly WheelDomain[] = WHEEL_DOMAINS;

/**
 * Structure des scores — validation runtime avancée dans le service
 * (les clés dynamiques ne sont pas triviales à valider via class-validator).
 */
export class WheelScoresDto {
  [key: string]: unknown;
}

export class ImportVitalisBilanDto {
  @IsEmail()
  patient_email!: string;

  @IsString()
  @IsOptional()
  patient_first_name?: string;

  @IsString()
  @IsOptional()
  patient_last_name?: string;

  /**
   * Scores 0-100 par axe (12 axes attendus, complétés par défaut 60 si
   * manquants côté service pour tolérer un mapping incomplet).
   */
  @IsObject()
  wheel_scores!: Record<string, number>;

  /**
   * Identifiant côté tenant (ex: wellness_intake_submissions.id). Sert à
   * historiser l'origine du bilan dans med_transformation_wheel.source_ref.
   */
  @IsString()
  @IsOptional()
  source_id?: string;

  @IsString()
  @IsOptional()
  source_kind?: string;
}
