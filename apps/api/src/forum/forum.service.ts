import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';
import type { CreatePostDto, CreateTopicDto } from './dto/forum.dto';

@Injectable()
export class ForumService {
  constructor(private readonly supabase: SupabaseService) {}

  async listCategories(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('forum_categories').select('*').eq('tenant_id', tenantId).order('name');
    return data ?? [];
  }

  async listTopics(tenantId: string, category?: string, page = 1, limit = 20) {
    let q = (this.supabase.client as any).from('forum_topics').select('*, author:user_id(id,email)').eq('tenant_id', tenantId).order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1);
    if (category) q = q.eq('category', category);
    const { data } = await q;
    return data ?? [];
  }

  async getTopic(tenantId: string, topicId: string) {
    const { data, error } = await (this.supabase.client as any).from('forum_topics').select('*').eq('id', topicId).eq('tenant_id', tenantId).single();
    if (error || !data) throw new NotFoundException('Discussion introuvable');
    return data;
  }

  async createTopic(tenant: TenantContext, userId: string, dto: CreateTopicDto) {
    const { data, error } = await (this.supabase.client as any).from('forum_topics').insert({
      tenant_id: tenant.id, author_id: userId, title: dto.title, content: dto.content, category: dto.category ?? 'general',
    }).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async listPosts(tenantId: string, topicId: string) {
    const { data } = await (this.supabase.client as any).from('forum_posts').select('*').eq('topic_id', topicId).eq('tenant_id', tenantId).order('created_at');
    return data ?? [];
  }

  async createPost(tenant: TenantContext, topicId: string, userId: string, dto: CreatePostDto) {
    const { data, error } = await (this.supabase.client as any).from('forum_posts').insert({
      tenant_id: tenant.id, topic_id: topicId, author_id: userId, content: dto.content, parent_id: dto.parentPostId ?? null,
    }).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteTopic(tenantId: string, topicId: string) {
    const { error } = await (this.supabase.client as any).from('forum_topics').delete().eq('id', topicId).eq('tenant_id', tenantId);
    if (error) throw new BadRequestException(error.message);
  }

  async deletePost(tenantId: string, postId: string) {
    const { error } = await (this.supabase.client as any).from('forum_posts').delete().eq('id', postId).eq('tenant_id', tenantId);
    if (error) throw new BadRequestException(error.message);
  }

  async searchTopics(tenantId: string, query: string) {
    const { data } = await (this.supabase.client as any).from('forum_topics').select('*').eq('tenant_id', tenantId).or(`title.ilike.%${query}%,content.ilike.%${query}%`).limit(20);
    return data ?? [];
  }
}
