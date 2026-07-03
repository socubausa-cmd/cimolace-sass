import { SetMetadata } from '@nestjs/common';

/**
 * Familles de moteurs Cimolace. La valeur sert de clé dans la carte
 * ENGINE_SERVICE_PREFIXES (engine-enabled.guard.ts) qui la relie aux
 * `tenant_services.service_key` correspondants.
 */
export type EngineFamily =
  | 'liri'
  | 'medos'
  | 'mbolo'
  | 'booking'
  | 'school'
  | 'marketing';

export const REQUIRE_ENGINE_KEY = 'cimolace:require_engine';

/**
 * Marque un contrôleur/handler comme nécessitant qu'un moteur soit ACTIVÉ pour
 * le tenant courant (via `EngineEnabledGuard`). Ex : `@RequireEngine('mbolo')`.
 *
 * L'enforcement est OPT-IN par tenant (`tenants.metadata.gating.runtime === true`)
 * afin de n'impacter aucun tenant existant tant qu'il n'est pas explicitement
 * basculé sur le modèle « à la carte » — même convention que le gating de clé API
 * (`metadata.billing.api_gating`).
 */
export const RequireEngine = (engine: EngineFamily) =>
  SetMetadata(REQUIRE_ENGINE_KEY, engine);
