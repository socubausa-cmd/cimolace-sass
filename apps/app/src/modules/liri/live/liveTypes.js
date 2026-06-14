/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE LIRI SCHOOL - LIVE TYPES
 * Types pour le moteur de live
 * ═══════════════════════════════════════════════════════════════
 */

export const LiveStatus = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  ENDED: 'ended',
  CANCELLED: 'cancelled',
};

export const LiveType = {
  COURSE: 'course',
  WEBINAR: 'webinar',
  MEETING: 'meeting',
  OFFICE_HOURS: 'office_hours',
};

export default {
  LiveStatus,
  LiveType,
};
