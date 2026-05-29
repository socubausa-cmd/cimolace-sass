/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE LIRI SCHOOL - LESSON ENGINE
 * Moteur de gestion des leçons générique
 * ═══════════════════════════════════════════════════════════════
 */

import { supabase } from '../../../lib/customSupabaseClient';
import { LessonStatus, LessonType, ContentType } from './lessonTypes.js';

class LessonEngine {
  constructor(tenantSlug) {
    this.tenantSlug = tenantSlug;
    this.supabase = this.createSupabaseClient();
  }

  createSupabaseClient() {
    return supabase;
  }

  async getLessons(moduleId) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('lessons')
        .select('*')
        .eq('module_id', moduleId)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error fetching lessons:', error);
        return [];
      }

      return data;
    } catch (error) {
      console.error('Error fetching lessons:', error);
      return [];
    }
  }

  async getLessonById(lessonId) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .maybeSingle();

      if (error || !data) {
        console.error('Error fetching lesson:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching lesson:', error);
      return null;
    }
  }

  async createLesson(lessonData) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('lessons')
        .insert({
          module_id: lessonData.moduleId,
          title: lessonData.title,
          content: lessonData.content,
          video_url: lessonData.videoUrl,
          video_duration: lessonData.videoDuration,
          sort_order: lessonData.sortOrder || 0,
          metadata: {
            tenant: this.tenantSlug,
            type: lessonData.type || LessonType.VIDEO,
            ...lessonData.metadata,
          },
        })
        .select('*')
        .single();

      if (error) {
        console.error('Error creating lesson:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error creating lesson:', error);
      return null;
    }
  }

  async updateLesson(lessonId, updates) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('lessons')
        .update({
          title: updates.title,
          content: updates.content,
          video_url: updates.videoUrl,
          video_duration: updates.videoDuration,
          sort_order: updates.sortOrder,
          metadata: updates.metadata,
        })
        .eq('id', lessonId)
        .select('*')
        .single();

      if (error) {
        console.error('Error updating lesson:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error updating lesson:', error);
      return null;
    }
  }

  async deleteLesson(lessonId) {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return false;
    }

    try {
      const { error } = await this.supabase
        .from('lessons')
        .delete()
        .eq('id', lessonId);

      if (error) {
        console.error('Error deleting lesson:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error deleting lesson:', error);
      return false;
    }
  }
}

export function createLessonEngine(tenantSlug) {
  return new LessonEngine(tenantSlug);
}

export default LessonEngine;
