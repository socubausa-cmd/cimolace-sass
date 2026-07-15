/**
 * Booking engine — Secretary Matching (scoring pondéré).
 * Porté fidèlement depuis ISNA v1 (netlify/functions/_lib/booking/secretaryMatching.js).
 *
 * Recommande le meilleur secrétariat pour un créneau :
 *   Même région que le visiteur   → +40
 *   En ligne (within SLA)          → +30
 *   Prime Hours au moment du slot  → +20
 *   Charge faible (queue)          → jusqu'à +15 (inverse)
 *   Capacité disponible (slots)    → jusqu'à +10
 * Fallback : local → autre zone ouverte → fermé.
 *
 * Fonctions pures (aucune dépendance DB).
 */
import {
  REGION_AF_EU,
  REGION_US,
  REGION_FRANCE,
  REGION_GABON,
  REGION_LABELS,
  detectRegionFromTimezone,
  isPrimeHour,
  openingHoursForRegion,
  regionToPool,
  timezoneHour,
} from './timezone-routing';

const W_SAME_REGION = 40;
const W_ONLINE = 30;
const W_PRIME_HOUR = 20;
const W_LOW_QUEUE = 15;
const W_CAPACITY = 10;

export interface SecretaryRow {
  id: string;
  name?: string | null;
  email?: string | null;
  timezone?: string | null;
  secretariat_region?: string | null;
  country_code?: string | null;
  availability_start_hour?: number | null;
  availability_end_hour?: number | null;
  is_secretariat_active?: boolean | null;
  is_secretariat_online?: boolean | null;
  secretariat_last_seen_at?: string | null;
  secretariat_sla_ms?: number | null;
}

export interface Secretary {
  id: string;
  name: string;
  timezone: string;
  region: string;
  country: string | null;
  startHour: number;
  endHour: number;
  active: boolean;
  online: boolean;
  lastSeenAt: string | null;
  slaMs: number;
}

export function normalizeSecretaryProfile(row: SecretaryRow): Secretary {
  const timezone = row?.timezone || 'Africa/Libreville';
  const region = row?.secretariat_region || detectRegionFromTimezone(timezone);
  const defaultHours = openingHoursForRegion(region);
  return {
    id: row.id,
    name: row.name || row.email || 'Secretariat',
    timezone,
    region,
    country: row.country_code || null,
    startHour: Number(row.availability_start_hour ?? defaultHours.startHour),
    endHour: Number(row.availability_end_hour ?? defaultHours.endHour),
    // Défaut ACTIF + EN LIGNE quand les champs secrétariat sont absents (schéma prod sans ces
    // colonnes) → tout membre staff est un secrétaire disponible par défaut (moteur v1 sans config).
    active: row?.is_secretariat_active == null ? true : Boolean(row.is_secretariat_active),
    online: row?.is_secretariat_online == null ? true : Boolean(row.is_secretariat_online),
    lastSeenAt: row.secretariat_last_seen_at || null,
    slaMs: Number(row.secretariat_sla_ms || 300_000),
  };
}

export function isSecretaryOnline(secretary: Secretary, nowMs: number = Date.now()): boolean {
  if (!secretary.online) return false;
  const lastSeenMs = secretary.lastSeenAt ? new Date(secretary.lastSeenAt).getTime() : 0;
  return nowMs - lastSeenMs <= secretary.slaMs;
}

export function isSecretaryOpenForSlot(secretary: Secretary, date: Date): boolean {
  const localHour = timezoneHour(date, secretary.timezone);
  return localHour >= secretary.startHour && localHour < secretary.endHour;
}

export function scoreSecretary({
  secretary,
  visitorRegion,
  slotDate,
  queueCount = 0,
  maxQueueSeen = 10,
  freeSlots = null,
  capacity = 5,
}: {
  secretary: Secretary;
  visitorRegion: string;
  slotDate: Date | string | number;
  queueCount?: number;
  maxQueueSeen?: number;
  freeSlots?: number | null;
  capacity?: number;
}): number {
  let score = 0;
  const date = slotDate instanceof Date ? slotDate : new Date(slotDate || Date.now());

  const visitorPool = regionToPool(visitorRegion);
  const secretaryPool = regionToPool(secretary.region);
  if (secretary.region === visitorRegion) score += W_SAME_REGION;
  else if (secretaryPool === visitorPool) score += W_SAME_REGION * 0.7; // partial match
  if (isSecretaryOnline(secretary)) score += W_ONLINE;

  const localHour = timezoneHour(date, secretary.timezone);
  if (isPrimeHour(secretary.region, localHour)) score += W_PRIME_HOUR;

  const normalizedQueue = Math.min(queueCount, maxQueueSeen);
  score += W_LOW_QUEUE * (1 - normalizedQueue / Math.max(maxQueueSeen, 1));

  if (freeSlots !== null && capacity > 0) {
    score += W_CAPACITY * Math.min(freeSlots / capacity, 1);
  }

  return Math.round(score * 10) / 10;
}

export interface RankedSecretary extends Secretary {
  score: number;
  queueCount: number;
  isOpenForSlot: boolean;
  isOnline: boolean;
}

export function rankSecretaries({
  secretaries,
  queueBySecretary = {},
  capacityBySecretary = {},
  visitorRegion,
  slotDate,
}: {
  secretaries: Secretary[];
  queueBySecretary?: Record<string, number>;
  capacityBySecretary?: Record<string, { free?: number; total?: number }>;
  visitorRegion: string;
  slotDate: Date | string | number;
}): RankedSecretary[] {
  const date = slotDate instanceof Date ? slotDate : new Date(slotDate || Date.now());
  const maxQueueSeen = Math.max(...Object.values(queueBySecretary).map(Number), 1);

  return secretaries
    .filter((s) => s.active)
    .map((secretary) => {
      const queueCount = Number(queueBySecretary[secretary.id] || 0);
      const capData = capacityBySecretary[secretary.id] || null;
      const freeSlots = capData?.free ?? null;
      const capacity = capData?.total ?? 5;
      const score = scoreSecretary({
        secretary,
        visitorRegion,
        slotDate: date,
        queueCount,
        maxQueueSeen,
        freeSlots,
        capacity,
      });
      return {
        ...secretary,
        score,
        queueCount,
        isOpenForSlot: isSecretaryOpenForSlot(secretary, date),
        isOnline: isSecretaryOnline(secretary),
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aReg = a.region === visitorRegion ? 1 : 0;
      const bReg = b.region === visitorRegion ? 1 : 0;
      if (bReg !== aReg) return bReg - aReg;
      return (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0);
    });
}

export interface RegionStatus {
  region: string;
  label: string;
  totalSecretariats: number;
  activeSecretariats: number;
  schoolOpen: boolean;
}

export function regionStatus(secretaries: Secretary[], now: Date = new Date()): RegionStatus[] {
  const nowMs = now.getTime();
  const allRegions = [
    ...new Set([
      REGION_AF_EU,
      REGION_US,
      REGION_FRANCE,
      REGION_GABON,
      ...secretaries.map((s) => s.region).filter(Boolean),
    ]),
  ];
  return allRegions.map((region) => {
    const regionRows = secretaries.filter((s) => s.region === region);
    const activeRows = regionRows.filter(
      (s) => isSecretaryOnline(s, nowMs) && isSecretaryOpenForSlot(s, now),
    );
    return {
      region,
      label: REGION_LABELS[region] || region,
      totalSecretariats: regionRows.length,
      activeSecretariats: activeRows.length,
      schoolOpen: activeRows.length > 0,
    };
  });
}

export function matchingStrategy({
  secretaries,
  visitorRegion,
  now = new Date(),
}: {
  secretaries: Secretary[];
  visitorRegion: string;
  now?: Date;
}): { strategy: 'local' | 'fallback' | 'closed'; openRegion: string | null } {
  const statuses = regionStatus(secretaries, now);
  const visitorPool = regionToPool(visitorRegion);

  const localStatuses = statuses.filter(
    (s) => s.region === visitorRegion || regionToPool(s.region) === visitorPool,
  );
  const local = localStatuses.find((s) => s.schoolOpen);
  if (local) return { strategy: 'local', openRegion: visitorRegion };

  const other = statuses.find((s) => s.schoolOpen && regionToPool(s.region) !== visitorPool);
  if (other) return { strategy: 'fallback', openRegion: other.region };

  return { strategy: 'closed', openRegion: null };
}
