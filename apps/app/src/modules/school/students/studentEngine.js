/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE LIRI SCHOOL - STUDENT ENGINE
 * Moteur de gestion des étudiants générique
 * ═══════════════════════════════════════════════════════════════
 */

import { supabase } from '../../../lib/customSupabaseClient';
import { StudentStatus, StudentRole } from './studentTypes.js';

class StudentEngine {
  constructor(tenantSlug) {
    this.tenantSlug = tenantSlug;
    this.supabase = this.createSupabaseClient();
  }

  createSupabaseClient() {
    return supabase;
  }

  async getStudents(filters = {}) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return [];
    }

    try {
      let query = this.supabase
        .from('profiles')
        .select('*')
        .in('role', ['student', 'proche']);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching students:', error);
        return [];
      }

      return data;
    } catch (error) {
      console.error('Error fetching students:', error);
      return [];
    }
  }

  async getStudentById(studentId) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', studentId)
        .maybeSingle();

      if (error || !data) {
        console.error('Error fetching student:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching student:', error);
      return null;
    }
  }

  async getStudentProgress(studentId) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('student_progress')
        .select('*')
        .eq('student_id', studentId);

      if (error) {
        console.error('Error fetching student progress:', error);
        return [];
      }

      return data;
    } catch (error) {
      console.error('Error fetching student progress:', error);
      return [];
    }
  }
}

export function createStudentEngine(tenantSlug) {
  return new StudentEngine(tenantSlug);
}

export default StudentEngine;
