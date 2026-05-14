/**
 * Modèles de vacances scolaires par pays (ordre de grandeur officiel, calendrier local à valider).
 * Sert au formulaire « Programme annuel » et à l’API de génération.
 */

/** @typedef {{ name: string; start: string; end: string }} SchoolHoliday */

/** @type {{ code: string; label: string; hint?: string }[]} */
export const SCHOOL_HOLIDAY_COUNTRY_OPTIONS = [
  { code: 'FR', label: 'France (métropole)', hint: 'Calendrier type zone A/B/C — dates indicatives' },
  { code: 'LU', label: 'Luxembourg', hint: 'Proche du calendrier français' },
  { code: 'BE', label: 'Belgique (francophone)', hint: 'Toussaint, Noël, Carnaval, Pâques (autour de Pâques)' },
  { code: 'CH', label: 'Suisse (schéma général)', hint: 'Varie par canton — blocs indicatifs' },
  { code: 'GA', label: 'Gabon', hint: 'Vacances indicatives (calendrier national à confirmer)' },
  { code: 'CM', label: 'Cameroun', hint: 'Vacances indicatives (zones A/B à confirmer)' },
  { code: 'SN', label: 'Sénégal', hint: 'Pauses indicatives (Toussaint, Noël, printemps, été)' },
  { code: 'CI', label: "Côte d'Ivoire", hint: 'Pauses indicatives' },
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Dimanche de Pâques (calendrier grégorien occidental), année civile `year`. */
export function easterSundayUtc(year) {
  const y = year | 0;
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, month - 1, day));
}

function addDaysUtc(date, days) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function fmt(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** France / Luxembourg — même squelette que l’existant `useAnnualProgram`. */
function holidaysFranceLike(y0, y1) {
  return [
    { name: 'Toussaint', start: `${y0}-10-19`, end: `${y0}-11-03` },
    { name: 'Noël', start: `${y0}-12-21`, end: `${y1}-01-06` },
    { name: 'Hiver', start: `${y1}-02-15`, end: `${y1}-03-02` },
    { name: 'Printemps', start: `${y1}-04-12`, end: `${y1}-04-27` },
  ];
}

/** Belgique francophone — carnaval (fenêtre indicative), printemps lié à Pâques. */
function holidaysBelgium(y0, y1) {
  const easterY1 = easterSundayUtc(y1);
  const springStart = addDaysUtc(easterY1, -7);
  const springEnd = addDaysUtc(easterY1, 7);
  return [
    { name: 'Automne', start: `${y0}-10-27`, end: `${y0}-11-02` },
    { name: 'Noël', start: `${y0}-12-22`, end: `${y1}-01-05` },
    { name: 'Carnaval', start: `${y1}-02-16`, end: `${y1}-02-20` },
    { name: 'Printemps / Pâques', start: fmt(springStart), end: fmt(springEnd) },
  ];
}

/** Suisse — blocs indicatifs (fusion hiver / sport + resserrement printemps). */
function holidaysSwitzerland(y0, y1) {
  const easterY1 = easterSundayUtc(y1);
  const springStart = addDaysUtc(easterY1, -10);
  const springEnd = addDaysUtc(easterY1, 5);
  return [
    { name: 'Automne', start: `${y0}-10-05`, end: `${y0}-10-19` },
    { name: 'Noël', start: `${y0}-12-23`, end: `${y1}-01-06` },
    { name: 'Hiver / Sport', start: `${y1}-02-01`, end: `${y1}-02-14` },
    { name: 'Printemps', start: fmt(springStart), end: fmt(springEnd) },
  ];
}

function holidaysGabon(y0, y1) {
  return [
    { name: 'Toussaint', start: `${y0}-11-01`, end: `${y0}-11-08` },
    { name: 'Noël', start: `${y0}-12-20`, end: `${y1}-01-07` },
    { name: 'Hiver', start: `${y1}-02-10`, end: `${y1}-02-24` },
    { name: 'Printemps', start: `${y1}-04-05`, end: `${y1}-04-19` },
  ];
}

function holidaysCameroon(y0, y1) {
  return [
    { name: 'Noël', start: `${y0}-12-15`, end: `${y1}-01-07` },
    { name: 'Carnaval', start: `${y1}-02-01`, end: `${y1}-02-15` },
    { name: 'Printemps', start: `${y1}-04-01`, end: `${y1}-04-21` },
    { name: 'Été (court)', start: `${y1}-06-20`, end: `${y1}-06-28` },
  ];
}

function holidaysSenegal(y0, y1) {
  return [
    { name: 'Toussaint', start: `${y0}-11-02`, end: `${y0}-11-09` },
    { name: 'Noël', start: `${y0}-12-20`, end: `${y1}-01-03` },
    { name: 'Hiver', start: `${y1}-02-17`, end: `${y1}-03-01` },
    { name: 'Printemps', start: `${y1}-04-07`, end: `${y1}-04-20` },
  ];
}

function holidaysIvoryCoast(y0, y1) {
  return [
    { name: 'Noël', start: `${y0}-12-18`, end: `${y1}-01-03` },
    { name: 'Mi-hiver', start: `${y1}-02-01`, end: `${y1}-02-14` },
    { name: 'Printemps', start: `${y1}-04-02`, end: `${y1}-04-16` },
    { name: 'Fin année', start: `${y1}-06-15`, end: `${y1}-06-30` },
  ];
}

/**
 * @param {string} schoolYear ex. `2026-2027`
 * @param {string} [countryCode] ISO2 majuscules, défaut FR
 * @returns {SchoolHoliday[]}
 */
export function holidaysForSchoolYearAndCountry(schoolYear, countryCode = 'FR') {
  const y0 = parseInt(String(schoolYear).split('-')[0], 10);
  if (Number.isNaN(y0)) {
    return [
      { name: 'Toussaint', start: '2025-10-18', end: '2025-11-03' },
      { name: 'Noël', start: '2025-12-20', end: '2026-01-05' },
      { name: 'Hiver', start: '2026-02-14', end: '2026-03-01' },
      { name: 'Printemps', start: '2026-04-11', end: '2026-04-27' },
    ];
  }
  const y1 = y0 + 1;
  const c = String(countryCode || 'FR').toUpperCase();
  switch (c) {
    case 'LU':
    case 'FR':
      return holidaysFranceLike(y0, y1);
    case 'BE':
      return holidaysBelgium(y0, y1);
    case 'CH':
      return holidaysSwitzerland(y0, y1);
    case 'GA':
      return holidaysGabon(y0, y1);
    case 'CM':
      return holidaysCameroon(y0, y1);
    case 'SN':
      return holidaysSenegal(y0, y1);
    case 'CI':
      return holidaysIvoryCoast(y0, y1);
    default:
      return holidaysFranceLike(y0, y1);
  }
}
