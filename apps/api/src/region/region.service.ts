import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Connection config (Supabase project URL + service-role key) for one data
 * residency region.
 */
export type RegionConnection = {
  url: string;
  serviceKey: string;
};

/** Default data residency region — the shared, mutualised Supabase project. */
export const DEFAULT_REGION = 'global';

/**
 * Maps a data residency region → the ENV var names that hold its Supabase
 * connection. 'global' reuses the historical SUPABASE_* vars (the only base
 * provisioned today). 'eu-hds' points at a dedicated French HDS instance,
 * provisioned later via *_EU_HDS vars.
 *
 * Adding a region = add one entry here + set its two env vars. No code change
 * in the consumers.
 */
const REGION_ENV: Record<string, { urlKey: string; serviceKeyKey: string }> = {
  global: {
    urlKey: 'SUPABASE_URL',
    serviceKeyKey: 'SUPABASE_SERVICE_ROLE_KEY',
  },
  'eu-hds': {
    urlKey: 'SUPABASE_URL_EU_HDS',
    serviceKeyKey: 'SUPABASE_SERVICE_ROLE_KEY_EU_HDS',
  },
};

/**
 * RegionService — single source of truth for data residency routing.
 *
 * Resolves a region name to its Supabase connection config, read from the
 * environment. It does NOT create any Supabase client itself (that is
 * SupabaseService's job, which caches them) — it only answers "where does
 * region X live?".
 *
 * Foundation for multi-region (Option B): zero tenant is non-'global' today,
 * so this is wiring that stays inert until a French tenant is onboarded on
 * HDS. Requesting a region whose env vars are absent raises an explicit error
 * rather than silently falling back — so a misconfigured 'eu-hds' fails loud,
 * never leaking PHI into the mutualised base.
 */
@Injectable()
export class RegionService {
  constructor(private readonly config: ConfigService) {}

  /** The default region ('global') — the mutualised Supabase project. */
  get defaultRegion(): string {
    return DEFAULT_REGION;
  }

  /** List of region identifiers the platform knows how to route. */
  listKnownRegions(): string[] {
    return Object.keys(REGION_ENV);
  }

  /** True when `region` is a region the platform knows how to route. */
  isKnownRegion(region: string | null | undefined): boolean {
    return !!region && Object.prototype.hasOwnProperty.call(REGION_ENV, region);
  }

  /**
   * Normalise an arbitrary region value to a known region, defaulting to
   * 'global' for null / undefined / empty. Unknown non-empty values are
   * returned as-is so getConnection can raise a precise "not provisioned"
   * error rather than silently masking a typo.
   */
  normalizeRegion(region: string | null | undefined): string {
    const trimmed = (region ?? '').trim();
    return trimmed.length === 0 ? DEFAULT_REGION : trimmed;
  }

  /**
   * Returns the Supabase connection config for `region`, read from the
   * environment.
   *
   * Throws an explicit error when:
   *  - the region is unknown (not declared in REGION_ENV), or
   *  - the region is known but its env vars are not set (e.g. 'eu-hds' before
   *    the HDS instance is provisioned).
   *
   * 'global' is always available because its vars (SUPABASE_URL /
   * SUPABASE_SERVICE_ROLE_KEY) are required for the app to boot at all.
   */
  getConnection(region: string): RegionConnection {
    const mapping = REGION_ENV[region];
    if (!mapping) {
      throw new Error(
        `Région inconnue « ${region} » : aucune configuration de connexion déclarée. Régions connues : ${this.listKnownRegions().join(', ')}.`,
      );
    }
    const url = this.config.get<string>(mapping.urlKey);
    const serviceKey = this.config.get<string>(mapping.serviceKeyKey);
    if (!url || !serviceKey) {
      throw new Error(
        `Région « ${region} » non provisionnée : variables d'environnement ${mapping.urlKey} / ${mapping.serviceKeyKey} absentes. Provisionner l'instance (ex: HDS France pour eu-hds) et poser ces variables avant de router un tenant vers cette région.`,
      );
    }
    return { url, serviceKey };
  }
}
