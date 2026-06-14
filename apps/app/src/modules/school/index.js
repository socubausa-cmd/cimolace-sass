/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE — MOTEUR ÉCOLE (ISNA)
 * Vertical pédagogique : cours, leçons, élèves, profs, admin,
 * marketing, paiements.
 * CONSOMME le moteur LIRI (modules/liri) pour le live, le smartboard,
 * le studio, le replay et le neuro-recall.
 * Règle d'architecture : École peut dépendre de LIRI, JAMAIS l'inverse.
 * ═══════════════════════════════════════════════════════════════
 */

// ── Moteurs École ─────────────────────────────────────────────
export { default as CourseEngine } from './courses/courseEngine.js';
export { default as LessonEngine } from './lessons/lessonEngine.js';
export { default as StudentEngine } from './students/studentEngine.js';
export { default as TeacherEngine } from './teachers/teacherEngine.js';
export { default as AdminEngine } from './admin/adminEngine.js';
export { default as MarketingEngine } from './marketing/marketingEngine.js';
export { default as PaymentEngine } from './payments/paymentEngine.js';

// ── Types ─────────────────────────────────────────────────────
export * from './courses/courseTypes.js';
export * from './lessons/lessonTypes.js';
export * from './students/studentTypes.js';
export * from './teachers/teacherTypes.js';
