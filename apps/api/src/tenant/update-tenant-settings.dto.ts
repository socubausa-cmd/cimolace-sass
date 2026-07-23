import { IsBoolean, IsObject, IsOptional } from 'class-validator';

/**
 * Réglages tenant (no-code, self-serve owner/admin) — distincts du branding.
 * Stockés dans `tenants.metadata.settings`. Gating du dossier élève (KYC) +
 * réductions boutique par palier de forfait (Studio monétisation). Réservé
 * owner/admin → garde RolesGuard côté contrôleur.
 */
export class UpdateTenantSettingsDto {
  @IsOptional()
  @IsBoolean()
  requiresStudentDossier?: boolean;

  /** % de réduction boutique/événements par palier : { autonome, academique, prive, privilegie }.
   *  Sanitisé côté service (clés connues, entiers 0-90). */
  @IsOptional()
  @IsObject()
  memberDiscounts?: Record<string, number>;
}
