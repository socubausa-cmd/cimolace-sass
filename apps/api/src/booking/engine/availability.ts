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
}: {
  secretaries: Secretary[];
  reservedRows: ReservedRow[];
  queueRows: QueueRow[];
  visitorRegion: string;
  visitorTimezone: string;
  windowStart: Date;
  windowEnd: Date;
}): AvailabilityResult {
  const reservedMap = new Map<string, boolean>();
  for (const row of reservedRows || []) {
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
