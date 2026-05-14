/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE LIRI SCHOOL - COURSE ENGINE
 * Moteur de gestion des cours générique
 * ═══════════════════════════════════════════════════════════════
 */

import { createClient } from '@supabase/supabase-js';
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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Supabase URL or Anon Key not configured');
      return null;
    }

    return createClient(supabaseUrl, supabaseAnonKey);
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
        .from('formations')
        .select('*')
        .eq('metadata->>tenant', this.tenantSlug);

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
        .from('formations')
        .select('*')
        .eq('id', courseId)
        .eq('metadata->>tenant', this.tenantSlug)
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
        .from('formations')
        .insert({
          title: courseData.title,
          description: courseData.description,
          status: CourseStatus.DRAFT,
          cycle: courseData.cycle,
          duration_weeks: courseData.durationWeeks,
          price: courseData.price,
          image_url: courseData.imageUrl,
          metadata: {
            tenant: this.tenantSlug,
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
        .from('formations')
        .update({
          title: updates.title,
          description: updates.description,
          status: updates.status,
          cycle: updates.cycle,
          duration_weeks: updates.durationWeeks,
          price: updates.price,
          image_url: updates.imageUrl,
          metadata: updates.metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', courseId)
        .eq('metadata->>tenant', this.tenantSlug)
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
        .from('formations')
        .delete()
        .eq('id', courseId)
        .eq('metadata->>tenant', this.tenantSlug);

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
        .from('enrollments')
        .insert({
          student_id: studentId,
          formation_id: courseId,
          status: EnrollmentStatus.PENDING,
          service_type: serviceType,
          enrolled_at: new Date().toISOString(),
          metadata: {
            tenant: this.tenantSlug,
          },
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
        .from('enrollments')
        .select('*, formations(*)')
        .eq('student_id', studentId)
        .eq('formations.metadata->>tenant', this.tenantSlug);

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
        .from('enrollments')
        .select('*, profiles(*)')
        .eq('formation_id', courseId)
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
        .from('enrollments')
        .update({
          status,
          completed_at: status === EnrollmentStatus.COMPLETED ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
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
