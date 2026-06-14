/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE LIRI SCHOOL - TEACHER ENGINE
 * Moteur de gestion des enseignants générique
 * ═══════════════════════════════════════════════════════════════
 */

import { supabase } from '../../../lib/customSupabaseClient';
import { TeacherStatus, TeacherSpecialty } from './teacherTypes.js';

class TeacherEngine {
  constructor(tenantSlug) {
    this.tenantSlug = tenantSlug;
    this.supabase = this.createSupabaseClient();
  }

  createSupabaseClient() {
    return supabase;
  }

  async getTeachers(filters = {}) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return [];
    }

    try {
      let query = this.supabase
        .from('profiles')
        .select('*')
        .eq('role', 'teacher');

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching teachers:', error);
        return [];
      }

      return data;
    } catch (error) {
      console.error('Error fetching teachers:', error);
      return [];
    }
  }

  async getTeacherById(teacherId) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', teacherId)
        .eq('role', 'teacher')
        .maybeSingle();

      if (error || !data) {
        console.error('Error fetching teacher:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching teacher:', error);
      return null;
    }
  }
}

export function createTeacherEngine(tenantSlug) {
  return new TeacherEngine(tenantSlug);
}

export default TeacherEngine;
