/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE LIRI SCHOOL - COURSE ENGINE
 * Moteur de gestion des cours générique
 * ═══════════════════════════════════════════════════════════════
 */

import { supabase } from '../../../lib/customSupabaseClient';
import { CourseStatus, CourseType, CourseLevel, EnrollmentStatus, ServiceType } from './courseTypes.js';

// ═══════════════════════════════════════════════════════════════
// CLASS COURSE ENGINE
// ═══════════════════════════════════════════════════════════════

class CourseEngine {
  constructor(tenantSlug) {
    this.tenantSlug = tenantSlug;
    this.supabase = this.createSupabaseClient();
  }

  createSupabaseClient() {
    return supabase;
  }

  /**
   * Récupère tous les cours du tenant
   */
  async getCourses(filters = {}) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return [];
    }

    try {
      let query = this.supabase
        .from('courses')
        .select('*')
        .eq('tenant_id', this.tenantSlug);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.cycle) {
        query = query.eq('cycle', filters.cycle);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching courses:', error);
        return [];
      }

      return data;
    } catch (error) {
      console.error('Error fetching courses:', error);
      return [];
    }
  }

  /**
   * Récupère un cours par son ID
   */
  async getCourseById(courseId) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .eq('tenant_id', this.tenantSlug)
        .maybeSingle();

      if (error || !data) {
        console.error('Error fetching course:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching course:', error);
      return null;
    }
  }

  /**
   * Crée un nouveau cours
   */
  async createCourse(courseData) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('courses')
        .insert({
          title: courseData.title,
          description: courseData.description,
          status: CourseStatus.DRAFT,
          cycle: courseData.cycle,
          duration_weeks: courseData.durationWeeks,
          price_cents: courseData.price_cents ?? courseData.price,
          image_url: courseData.imageUrl,
          meta: {
            type: courseData.type || CourseType.ONLINE,
            level: courseData.level || CourseLevel.BEGINNER,
            ...courseData.metadata,
          },
        })
        .select('*')
        .single();

      if (error) {
        console.error('Error creating course:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error creating course:', error);
      return null;
    }
  }

  /**
   * Met à jour un cours
   */
  async updateCourse(courseId, updates) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('courses')
        .update({
          title: updates.title,
          description: updates.description,
          status: updates.status,
          cycle: updates.cycle,
          duration_weeks: updates.durationWeeks,
          price_cents: updates.price_cents ?? updates.price,
          image_url: updates.imageUrl,
          meta: updates.meta ?? updates.metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', courseId)
        .eq('tenant_id', this.tenantSlug)
        .select('*')
        .single();

      if (error) {
        console.error('Error updating course:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error updating course:', error);
      return null;
    }
  }

  /**
   * Supprime un cours
   */
  async deleteCourse(courseId) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return false;
    }

    try {
      const { error } = await this.supabase
        .from('courses')
        .delete()
        .eq('id', courseId)
        .eq('tenant_id', this.tenantSlug);

      if (error) {
        console.error('Error deleting course:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error deleting course:', error);
      return false;
    }
  }

  /**
   * Inscrit un étudiant à un cours
   */
  async enrollStudent(studentId, courseId, serviceType = ServiceType.ACADEMIQUE) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('student_progress')
        .insert({
          user_id: studentId,
          course_id: courseId,
          status: EnrollmentStatus.PENDING,
        })
        .select('*')
        .single();

      if (error) {
        console.error('Error enrolling student:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error enrolling student:', error);
      return null;
    }
  }

  /**
   * Récupère les inscriptions d'un étudiant
   */
  async getStudentEnrollments(studentId) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('student_progress')
        .select('*, courses(*)')
        .eq('user_id', studentId);

      if (error) {
        console.error('Error fetching enrollments:', error);
        return [];
      }

      return data;
    } catch (error) {
      console.error('Error fetching enrollments:', error);
      return [];
    }
  }

  /**
   * Récupère les étudiants d'un cours
   */
  async getCourseStudents(courseId) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('student_progress')
        .select('*, profiles(*)')
        .eq('course_id', courseId)
        .eq('status', EnrollmentStatus.ACTIVE);

      if (error) {
        console.error('Error fetching course students:', error);
        return [];
      }

      return data;
    } catch (error) {
      console.error('Error fetching course students:', error);
      return [];
    }
  }

  /**
   * Met à jour le statut d'une inscription
   */
  async updateEnrollmentStatus(enrollmentId, status) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('student_progress')
        .update({
          status,
          completed_at: status === EnrollmentStatus.COMPLETED ? new Date().toISOString() : null,
        })
        .eq('id', enrollmentId)
        .select('*')
        .single();

      if (error) {
        console.error('Error updating enrollment status:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error updating enrollment status:', error);
      return null;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════

export function createCourseEngine(tenantSlug) {
  return new CourseEngine(tenantSlug);
}

export default CourseEngine;
