/**
 * Déclarations ambiantes du worker — purement additif, zéro incidence runtime.
 *
 * `pdfkit` n'embarque pas de types (et @types/pdfkit n'est pas installé) ; on
 * le déclare en `any` pour l'import dynamique de gdpr-export.ts. Les pollers
 * historiques en .js pur sont résolus via `allowJs` (cf. tsconfig.json).
 */
declare module 'pdfkit';
