import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Réglages tenant (no-code, self-serve owner/admin) — distincts du branding.
 * Stockés dans `tenants.metadata.settings`. Pour l'instant : gating du dossier
 * élève (KYC certificats). Réservé owner/admin (un élève ne doit pas pouvoir
 * désactiver son propre KYC) → garde RolesGuard côté contrôleur.
 */
export class UpdateTenantSettingsDto {
  @IsOptional()
  @IsBoolean()
  requiresStudentDossier?: boolean;
}
