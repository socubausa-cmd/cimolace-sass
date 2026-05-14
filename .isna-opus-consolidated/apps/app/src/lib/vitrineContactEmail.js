import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

/**
 * E-mail vitrine : priorité build (multi-déploiement) puis défaut fichier tenant.
 * La valeur runtime Supabase (`app_settings.contact_email`) est appliquée via
 * `VitrineContactEmailProvider` + `useVitrineContactEmail()`.
 */
export function resolveVitrineContactEmailSync() {
  const raw = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_VITRINE_CONTACT_EMAIL : undefined;
  const fromEnv = typeof raw === 'string' ? raw.trim() : '';
  if (fromEnv) return fromEnv;
  return isnaTenantConfig.branding.vitrineContactEmail;
}
