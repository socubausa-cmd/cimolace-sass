/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE LIRI SCHOOL - COURSE TYPES
 * Types pour le moteur de cours
 * ═══════════════════════════════════════════════════════════════
 */

export const CourseStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
};

export const CourseType = {
  ONLINE: 'online',
  HYBRID: 'hybrid',
  IN_PERSON: 'in_person',
};

export const CourseLevel = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  EXPERT: 'expert',
};

export const EnrollmentStatus = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  DROPPED: 'dropped',
  PENDING: 'pending',
};

export const ServiceType = {
  ACADEMIQUE: 'academique',
  PRIVE: 'prive',
  PRIVILEGIE: 'privilegie',
  AUTONOME: 'autonome',
};

export default {
  CourseStatus,
  CourseType,
  CourseLevel,
  EnrollmentStatus,
  ServiceType,
};
