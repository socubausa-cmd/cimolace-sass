/**
 * Booking engine — routage par fuseau / région.
 * Porté fidèlement depuis ISNA v1 (netlify/functions/_lib/booking/timezoneRouting.js).
 * Fonctions pures (aucune dépendance DB) — réutilisable par le secretaryMatching.
 */

export const REGION_AF_EU = 'AF_EU';
export const REGION_US = 'US';
export const REGION_FRANCE = 'FRANCE';
export const REGION_GABON = 'GABON';

export type Region = 'AF_EU' | 'US' | 'FRANCE' | 'GABON';

export const REGION_LABELS: Record<string, string> = {
  AF_EU: 'Afrique / Europe',
  US: 'Amériques',
  FRANCE: '🇫🇷 France',
  GABON: '🇬🇦 Gabon',
};

export const REGION_FLAG: Record<string, string> = {
  AF_EU: '🌍',
  US: '🌎',
  FRANCE: '🇫🇷',
  GABON: '🇬🇦',
};

export function detectRegionFromTimezone(timezone?: string): Region {
  const tz = String(timezone || '');
  if (tz.startsWith('America/')) return REGION_US;
  if (tz === 'Europe/Paris' || tz.startsWith('Europe/')) return REGION_FRANCE;
  if (tz === 'Africa/Libreville' || tz.startsWith('Africa/')) return REGION_GABON;
  return REGION_AF_EU;
}

/** France et Gabon appartiennent tous deux au pool AF_EU pour les disponibilités. */
export function regionToPool(region: string): Region {
  if (region === REGION_US) return REGION_US;
  return REGION_AF_EU;
}

export function openingHoursForRegion(region: string): { startHour: number; endHour: number } {
  if (region === REGION_US) return { startHour: 9, endHour: 18 };
  if (region === REGION_FRANCE) return { startHour: 9, endHour: 19 };
  // GABON + AF_EU
  return { startHour: 8, endHour: 20 };
}

export function isPrimeHour(region: string, localHour: number): boolean {
  if (region === REGION_US) return localHour >= 9 && localHour < 14;
  if (region === REGION_FRANCE) return localHour >= 14 && localHour < 19;
  return localHour >= 15 && localHour < 20;
}

/** Heure locale décimale (h + min/60) dans un fuseau donné. */
export function timezoneHour(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  return hour + minute / 60;
}

export interface VisitorContext {
  timezone: string;
  country: string | null;
  region: Region;
}

export function detectVisitorContext({
  timezone,
  country,
}: {
  timezone?: string;
  country?: string;
}): VisitorContext {
  const tz = String(timezone || 'Africa/Libreville');
  return {
    timezone: tz,
    country: String(country || '').toUpperCase() || null,
    region: detectRegionFromTimezone(tz),
  };
}
