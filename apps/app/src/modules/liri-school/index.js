/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE LIRI SCHOOL ENGINE - MOTEUR D'ÉCOLE GÉNÉRIQUE
 * Moteur technologique pour systèmes d'apprentissage en ligne
 * ═══════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export { default as CourseEngine } from './courses/courseEngine.js';
export { default as LessonEngine } from './lessons/lessonEngine.js';
export { default as StudentEngine } from './students/studentEngine.js';
export { default as TeacherEngine } from './teachers/teacherEngine.js';
export { default as LiveEngine } from './live/liveEngine.js';
export { default as SmartboardEngine } from './smartboard/smartboardEngine.js';
export { default as StudioEngine } from './studio/studioEngine.js';
export { default as ReplayEngine } from './replay/replayEngine.js';
export { default as NeuroRecallEngine } from './neuro-recall/neuroRecallEngine.js';
export { default as PaymentEngine } from './payments/paymentEngine.js';
export { default as AdminEngine } from './admin/adminEngine.js';
export { default as MarketingEngine } from './marketing/marketingEngine.js';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export * from './courses/courseTypes.js';
export * from './lessons/lessonTypes.js';
export * from './students/studentTypes.js';
export * from './teachers/teacherTypes.js';
export * from './live/liveTypes.js';
export * from './smartboard/smartboardTypes.js';
export * from './studio/studioTypes.js';
export * from './replay/replayTypes.js';
export * from './neuro-recall/neuroRecallTypes.js';
