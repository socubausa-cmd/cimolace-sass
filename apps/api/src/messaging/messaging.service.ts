import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';
import type { CreateGroupDto, SendMessageDto } from './dto/messaging.dto';

@Injectable()
export class MessagingService {
  constructor(private readonly supabase: SupabaseService) {}

  async sendMessage(tenant: TenantContext, senderId: string, dto: SendMessageDto) {
    // Find or create conversation
    const { data: conv } = await (this.supabase.client as any).rpc('find_or_create_conversation', { p_tenant_id: tenant.id, p_user1: senderId, p_user2: dto.recipientId });
    const conversationId = conv?.conversation_id;

    const { data, error } = await (this.supabase.client as any).from('messages').insert({
      tenant_id: tenant.id, conversation_id: conversationId, sender_id: senderId,
      recipient_id: dto.recipientId, content: dto.content, subject: dto.subject ?? '',
    }).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async listConversations(tenantId: string, userId: string) {
    const { data } = await (this.supabase.client as any).from('conversation_participants').select('conversation_id').eq('user_id', userId).eq('tenant_id', tenantId);
    const convIds = (data ?? []).map((r: any) => r.conversation_id);
    if (!convIds.length) return [];
    const { data: convs } = await (this.supabase.client as any).from('conversations').select('*').in('id', convIds).order('updated_at', { ascending: false });
    return convs ?? [];
  }

  async getMessages(tenantId: string, conversationId: string, userId: string) {
    // Verify participation
    const { data: part } = await (this.supabase.client as any).from('conversation_participants').select('*').eq('conversation_id', conversationId).eq('user_id', userId).single();
    if (!part) throw new NotFoundException('Conversation introuvable');

    const { data } = await (this.supabase.client as any).from('messages').select('*').eq('conversation_id', conversationId).eq('tenant_id', tenantId).order('created_at');
    return data ?? [];
  }

  async createGroup(tenant: TenantContext, userId: string, dto: CreateGroupDto) {
    const { data: conv } = await (this.supabase.client as any).from('conversations').insert({
      tenant_id: tenant.id, name: dto.name, description: dto.description ?? '', type: 'group', created_by: userId,
    }).select('*').single();
    if (!conv) throw new BadRequestException('Échec création groupe');
    await (this.supabase.client as any).from('conversation_participants').insert({ tenant_id: tenant.id, conversation_id: conv.id, user_id: userId });
    return conv;
  }

  async addGroupMember(tenantId: string, conversationId: string, userId: string) {
    const { error } = await (this.supabase.client as any).from('conversation_participants').upsert({ tenant_id: tenantId, conversation_id: conversationId, user_id: userId }, { onConflict: 'conversation_id,user_id' });
    if (error) throw new BadRequestException(error.message);
  }

  /** Édite le contenu d'un message — réservé à l'auteur (sender_id), tenant-scopé. */
  async editMessage(tenantId: string, userId: string, messageId: string, content: string) {
    const { data, error } = await (this.supabase.client as any).from('messages')
      .update({ content })
      .eq('id', messageId).eq('sender_id', userId).eq('tenant_id', tenantId)
      .select('*').single();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Message introuvable');
    return data;
  }

  /** Supprime un message — réservé à l'auteur (sender_id), tenant-scopé. */
  async deleteMessage(tenantId: string, userId: string, messageId: string) {
    const { error } = await (this.supabase.client as any).from('messages')
      .delete()
      .eq('id', messageId).eq('sender_id', userId).eq('tenant_id', tenantId);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  /** Marque comme lus les messages REÇUS (recipient = userId) d'une conversation. */
  async markConversationRead(tenantId: string, userId: string, conversationId: string) {
    const { error } = await (this.supabase.client as any).from('messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId).eq('tenant_id', tenantId)
      .eq('recipient_id', userId).eq('is_read', false);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }
}
