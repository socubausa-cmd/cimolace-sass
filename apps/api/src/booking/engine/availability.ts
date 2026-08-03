/**
 * Booking engine — calcul de disponibilité (slot grid + créneaux recommandés).
 * Porté fidèlement depuis ISNA v1 (netlify/functions/_lib/booking/availabilityEngine.js).
 * Fonction pure (s'appuie sur timezone-routing + secretary-matching).
 */
import { isPrimeHour, timezoneHour, regionToPool } from './timezone-routing';
import {
  isSecretaryOpenForSlot,
  rankSecretaries,
  regionStatus,
  type Secretary,
} from './secretary-matching';

function minuteKey(value: string | number | Date): string {
  const d = new Date(value);
  d.setSeconds(0, 0);
  return d.toISOString();
}

function slotLabel(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: timezone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Règles de disponibilité par propriétaire/tenant (source : tenants.metadata.booking_availability).
 * Quand fournies, elles PILOTENT la grille (au lieu des heures région par défaut) :
 *  - `weekly` : par jour de semaine (0=dimanche..6=samedi) → fenêtres [début,fin] en minutes locales.
 *  - créneaux espacés de `slotMinutes + bufferMinutes` (ex. RDV 30 min + 30 min de battement = 1/h).
 *  - `blackoutDates` : dates 'YYYY-MM-DD' (fuseau `timezone`) totalement fermées.
 */
export interface ScheduleRules {
  timezone: string;
  weekly: Record<string, Array<[number, number]>>;
  slotMinutes: number;
  bufferMinutes?: number;
  blackoutDates?: string[];
}

/** Jour de semaine (0=dim..6=sam), minutes locales (0..1439) et date 'YYYY-MM-DD' dans un fuseau. */
function zonedDayInfo(date: Date, timezone: string): { dow: number; minutes: number; ymd: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = DOW[get('weekday')] ?? 0;
  let hour = Number(get('hour') || 0);
  if (hour === 24) hour = 0; // en-US rend parfois '24' à minuit
  const minute = Number(get('minute') || 0);
  return { dow, minutes: hour * 60 + minute, ymd: `${get('year')}-${get('month')}-${get('day')}` };
}

/** Un créneau (Date) est-il conforme aux règles de dispo (bon jour, dans une plage, aligné, non blackout) ? */
export function isSlotWithinRules(date: Date, rules: ScheduleRules): boolean {
  if (!rules?.weekly) return true;
  const zi = zonedDayInfo(date, rules.timezone);
  if (rules.blackoutDates?.includes(zi.ymd)) return false;
  const slotMin = Number(rules.slotMinutes) || 30;
  const step = slotMin + (Number(rules.bufferMinutes) || 0);
  const windows = rules.weekly?.[String(zi.dow)] || [];
  return windows.some((w) => {
    const ws = Number(w?.[0]);
    const we = Number(w?.[1]);
    return zi.minutes >= ws && zi.minutes + slotMin <= we && (zi.minutes - ws) % step === 0;
  });
}

export interface ReservedRow {
  assigned_teacher_id?: string | null;
  scheduled_at?: string | null;
  status?: string | null;
}
export interface QueueRow {
  assigned_teacher_id?: string | null;
}

export interface SlotRec {
  slotUtc: string;
  slotLabel: string;
  secretariatId: string;
  secretariatName: string;
  secretariatTimezone: string;
  secretariatRegion: string;
  queueEstimate: number;
  isPrimeHour: boolean;
}

export interface AvailabilityResult {
  slots: SlotRec[];
  fallbackSlots: SlotRec[];
  regionStatuses: ReturnType<typeof regionStatus>;
  slotGrid: Array<{ slotUtc: string; slotLabel: string; state: string }>;
}

export function buildAvailability({
  secretaries,
  reservedRows,
  queueRows,
  visitorRegion,
  visitorTimezone,
  windowStart,
  windowEnd,
  scheduleRules,
}: {
  secretaries: Secretary[];
  reservedRows: ReservedRow[];
  queueRows: QueueRow[];
  visitorRegion: string;
  visitorTimezone: string;
  windowStart: Date;
  windowEnd: Date;
  scheduleRules?: ScheduleRules | null;
}): AvailabilityResult {
  const reservedMap = new Map<string, boolean>();
  const reservedMinuteSet = new Set<string>();
  for (const row of reservedRows || []) {
    if (row?.scheduled_at) reservedMinuteSet.add(minuteKey(row.scheduled_at));
    if (!row?.assigned_teacher_id || !row?.scheduled_at) continue;
    reservedMap.set(`${row.assigned_teacher_id}:${minuteKey(row.scheduled_at)}`, true);
  }
  const queueBySecretary: Record<string, number> = {};
  for (const row of queueRows || []) {
    const id = row?.assigned_teacher_id;
    if (!id) continue;
    queueBySecretary[id] = (queueBySecretary[id] || 0) + 1;
  }

  const statuses = regionStatus(secretaries, new Date());
  const visitorPool = regionToPool(visitorRegion);
  const primaryPool = secretaries.filter(
    (s) => s.region === visitorRegion || regionToPool(s.region) === visitorPool,
  );
  const fallbackPool = secretaries.filter((s) => regionToPool(s.region) !== visitorPool);
  const slots: SlotRec[] = [];
  const fallbackSlots: SlotRec[] = [];

  const nowMs = Date.now();
  const slotGrid: Array<{ slotUtc: string; slotLabel: string; state: string }> = [];
  const cursor = new Date(windowStart);
  cursor.setSeconds(0, 0);
  while (cursor < windowEnd) {
    const slotUtc = new Date(cursor);

    if (slotUtc.getTime() < nowMs - 5 * 60 * 1000) {
      slotGrid.push({ slotUtc: slotUtc.toISOString(), slotLabel: slotLabel(slotUtc, visitorTimezone), state: 'past' });
      cursor.setMinutes(cursor.getMinutes() + 30);
      continue;
    }

    // ── Règles de dispo par tenant : la config PILOTE la grille (jours/heures/durée+battement). ──
    if (scheduleRules) {
      const zi = zonedDayInfo(slotUtc, scheduleRules.timezone);
      const slotMin = Number(scheduleRules.slotMinutes) || 30;
      const step = slotMin + (Number(scheduleRules.bufferMinutes) || 0);
      const windows = scheduleRules.weekly?.[String(zi.dow)] || [];
      const blackout = !!scheduleRules.blackoutDates?.includes(zi.ymd);
      let inWindow = false;
      if (!blackout) {
        for (const w of windows) {
          const ws = Number(w?.[0]);
          const we = Number(w?.[1]);
          if (zi.minutes >= ws && zi.minutes + slotMin <= we && (zi.minutes - ws) % step === 0) {
            inWindow = true;
            break;
          }
        }
      }
      if (!inWindow) {
        slotGrid.push({ slotUtc: slotUtc.toISOString(), slotLabel: slotLabel(slotUtc, visitorTimezone), state: 'outside_hours' });
        cursor.setMinutes(cursor.getMinutes() + 30);
        continue;
      }
      const taken = reservedMinuteSet.has(minuteKey(slotUtc));
      slotGrid.push({ slotUtc: slotUtc.toISOString(), slotLabel: slotLabel(slotUtc, visitorTimezone), state: taken ? 'taken' : 'available' });
      if (!taken && secretaries.length) {
        const sec = secretaries[0];
        slots.push({
          slotUtc: slotUtc.toISOString(),
          slotLabel: slotLabel(slotUtc, visitorTimezone),
          secretariatId: sec.id,
          secretariatName: sec.name,
          secretariatTimezone: sec.timezone,
          secretariatRegion: sec.region,
          queueEstimate: queueBySecretary[sec.id] || 0,
          isPrimeHour: false,
        });
      }
      cursor.setMinutes(cursor.getMinutes() + 30);
      continue;
    }

    const slotKey = minuteKey(slotUtc);
    const allOpen = secretaries.filter((s) => isSecretaryOpenForSlot(s, slotUtc));
    const freeList = allOpen.filter((s) => !reservedMap.has(`${s.id}:${slotKey}`));
    let gridState = 'outside_hours';
    if (allOpen.length) gridState = freeList.length ? 'available' : 'taken';
    slotGrid.push({ slotUtc: slotUtc.toISOString(), slotLabel: slotLabel(slotUtc, visitorTimezone), state: gridState });

    const selectForPool = (pool: Secretary[]) =>
      rankSecretaries({
        secretaries: pool.filter(
          (s) => isSecretaryOpenForSlot(s, slotUtc) && !reservedMap.has(`${s.id}:${slotKey}`),
        ),
        queueBySecretary,
        visitorRegion,
        slotDate: slotUtc,
      })[0];

    const primary = selectForPool(primaryPool);
    if (primary) {
      const localHour = timezoneHour(slotUtc, primary.timezone);
      slots.push({
        slotUtc: slotUtc.toISOString(),
        slotLabel: slotLabel(slotUtc, visitorTimezone),
        secretariatId: primary.id,
        secretariatName: primary.name,
        secretariatTimezone: primary.timezone,
        secretariatRegion: primary.region,
        queueEstimate: queueBySecretary[primary.id] || 0,
        isPrimeHour: isPrimeHour(primary.region, localHour),
      });
    } else {
      const fb = selectForPool(fallbackPool);
      if (fb) {
        const localHour = timezoneHour(slotUtc, fb.timezone);
        fallbackSlots.push({
          slotUtc: slotUtc.toISOString(),
          slotLabel: slotLabel(slotUtc, visitorTimezone),
          secretariatId: fb.id,
          secretariatName: fb.name,
          secretariatTimezone: fb.timezone,
          secretariatRegion: fb.region,
          queueEstimate: queueBySecretary[fb.id] || 0,
          isPrimeHour: isPrimeHour(fb.region, localHour),
        });
      }
    }
    cursor.setMinutes(cursor.getMinutes() + 30);
  }

  const byPrime = (a: SlotRec, b: SlotRec) => {
    if (a.isPrimeHour !== b.isPrimeHour) return Number(b.isPrimeHour) - Number(a.isPrimeHour);
    return a.queueEstimate - b.queueEstimate;
  };

  return {
    slots: slots.sort(byPrime),
    fallbackSlots: fallbackSlots.sort(byPrime),
    regionStatuses: statuses,
    slotGrid,
  };
}
