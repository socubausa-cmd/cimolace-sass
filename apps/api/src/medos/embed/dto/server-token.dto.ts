import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

const EMBED_MODES = [
  'patient-portal',
  'appointment-booker',
  'consent-form',
  'intake-form',
  'health-tracker',
] as const;

/**
 * DTO pour POST /v1/medos/embed/server-token — Niveau 2 SSO.
 *
 * Appelé par le BACKEND d'un site tenant (ex: zahirwellness.com) authentifié
 * via sa clé API tenant. Permet de générer un JWT embed-token "identifié"
 * lié à un patient précis, qui sera ensuite injecté dans la page côté front
 * pour que le widget MEDOS affiche directement les données de ce patient
 * sans aucune étape de login supplémentaire.
 *
 * Comportement :
 *  - Si `patient_email` existe déjà dans auth.users de Cimolace → réutilise
 *  - Sinon, crée le user Supabase + membership 'patient' + record med_patients
 *  - Retourne un JWT (15 min) avec sub = patient_user_id
 */
export class ServerTokenDto {
  @ApiProperty({ description: "Email du patient côté site tenant (ex: client connecté Zahir)" })
  @IsEmail()
  patient_email!: string;

  @ApiProperty({ enum: EMBED_MODES })
  @IsEnum(EMBED_MODES)
  mode!: (typeof EMBED_MODES)[number];

  @ApiPropertyOptional({ description: "Prénom (pour création initiale du dossier patient)" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  patient_first_name?: string;

  @ApiPropertyOptional({ description: 'Nom de famille (pour création initiale)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  patient_last_name?: string;

  @ApiPropertyOptional({
    description: "ID externe du patient côté tenant (ex: ID user Zahir). Stocké pour mapping ultérieur.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  external_user_id?: string;
}
