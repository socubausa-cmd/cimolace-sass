/**
 * Résolution du tenant à partir du DOMAINE (multi-tenant Cimolace).
 *
 * Cimolace héberge plusieurs tenants, chacun pouvant avoir son domaine perso
 * (ex. prorascience.org = tenant `isna`). La source de vérité est la table
 * `tenant_domains` (usage='custom_host'), exposée par l'API publique
 * `GET /tenants/by-host/:host/branding` → `{ slug }`.
 *
 * Ce module hydrate (au boot) un cache localStorage host→slug, lisible de façon
 * SYNCHRONE par la résolution de tenant (auth-store, routing). Objectif :
 * un NOUVEAU tenant à domaine perso fonctionne SANS modifier le code.
 *
 * Cf. docs/CIMOLACE_ARCHITECTURE.md §6/§7.
 */
import { getApiBaseUrl } from './apiBase';

const CACHE_PREFIX = 'cimolace:host-tenant:';

/** Hôtes de la PLATEFORME Cimolace (jamais un domaine custom de tenant) + dev local. */
export function isPlatformOrDevHost(host) {
  const h = String(host || '').toLowerCase();
  if (!h) return true;
  if (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) return true;
  if (h === 'cimolace.space' || h.endsWith('.cimolace.space')) return true;
  return false;
}

/** Slug en cache pour un hôte custom donné ('' si inconnu / non hydraté). SYNCHRONE. */
export function getCachedHostTenant(host) {
  if (typeof window === 'undefined') return '';
  const h = String(host ?? window.location.hostname ?? '').toLowerCase();
  if (isPlatformOrDevHost(h)) return '';
  try {
    return String(localStorage.getItem(CACHE_PREFIX + h) || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Réglages tenant en cache pour un hôte custom (objet, ou `null` si inconnu /
 * non hydraté / hôte neutre). SYNCHRONE — lisible par les gardes de routage
 * sans réseau. Hydraté par hydrateHostTenant() au boot.
 */
export function getCachedTenantSettings(host) {
  if (typeof window === 'undefined') return null;
  const h = String(host ?? window.location.hostname ?? '').toLowerCase();
  if (isPlatformOrDevHost(h)) return null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + h + ':settings');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Résout le tenant du domaine custom courant via l'API et le met en cache.
 * Non bloquant, idempotent, sans effet sur les hôtes plateforme/dev.
 * Retourne le slug résolu ('' sinon).
 */
export async function hydrateHostTenant() {
  if (typeof window === 'undefined') return '';
  const host = String(window.location.hostname || '').toLowerCase();
  if (isPlatformOrDevHost(host)) return '';
  // On fetch TOUJOURS (même slug déjà en cache) pour garder les réglages frais :
  // un owner qui (dés)active un réglage au back-office doit se propager. Coût =
  // 1 petite requête non bloquante par boot sur domaine custom.
  try {
    const res = await fetch(
      `${getApiBaseUrl()}/tenants/by-host/${encodeURIComponent(host)}/branding`,
    );
    if (!res.ok) return getCachedHostTenant(host);
    const body = await res.json().catch(() => null);
    const slug = String(body?.data?.slug ?? body?.slug ?? '').trim().toLowerCase();
    // Réglages tenant (ex: requiresStudentDossier). `null` = non défini côté DB
    // → le client retombe sur sa config résolue par l'hôte (founder ISNA = true).
    const requiresStudentDossier =
      body?.data?.requiresStudentDossier ?? body?.requiresStudentDossier ?? null;
    if (slug) {
      try { localStorage.setItem(CACHE_PREFIX + host, slug); } catch { /* quota / privé */ }
      try {
        localStorage.setItem(
          CACHE_PREFIX + host + ':settings',
          JSON.stringify({ requiresStudentDossier }),
        );
      } catch { /* quota / privé */ }
      return slug;
    }
  } catch {
    /* API indisponible / offline → on garde les fallbacks (cache existant) */
  }
  return getCachedHostTenant(host);
}
