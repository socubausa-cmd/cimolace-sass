import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ChatEngineService {
  constructor(private readonly supabase: SupabaseService) {}

  async createRoom(tenantId: string, name: string, type: string = 'group') {
    const { data } = await (this.supabase.client as any).from('chat_rooms').insert({ tenant_id: tenantId, name, type }).select('*').single();
    return data;
  }

  async listRooms(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('chat_rooms').select('*').eq('tenant_id', tenantId);
    return data ?? [];
  }

  async joinRoom(tenantId: string, roomId: string, userId: string) {
    await (this.supabase.client as any).from('chat_room_members').upsert({ tenant_id: tenantId, room_id: roomId, user_id: userId }, { onConflict: 'room_id,user_id' });
  }

  async sendMessage(tenantId: string, roomId: string, userId: string, content: string) {
    // Rooms 'live:<sessionId>' = chat du live → table live_session_chat (partagée
    // par toutes les surfaces live + realtime). MÊME moteur (chatApi), backing différent.
    if (roomId.startsWith('live:')) {
      const liveSessionId = roomId.slice(5);
      const { data } = await (this.supabase.client as any)
        .from('live_session_chat')
        .insert({ live_session_id: liveSessionId, user_id: userId, message: content })
        .select('id, user_id, message, created_at')
        .single();
      return data ? { id: data.id, sender_id: data.user_id, content: data.message, created_at: data.created_at } : null;
    }
    const { data } = await (this.supabase.client as any).from('chat_messages').insert({ tenant_id: tenantId, room_id: roomId, sender_id: userId, content }).select('*').single();
    return data;
  }

  async getMessages(tenantId: string, roomId: string, limit = 50) {
    if (roomId.startsWith('live:')) {
      const liveSessionId = roomId.slice(5);
      const { data } = await (this.supabase.client as any)
        .from('live_session_chat')
        .select('id, user_id, message, created_at')
        .eq('live_session_id', liveSessionId)
        .order('created_at')
        .limit(limit);
      return (data ?? []).map((m: any) => ({ id: m.id, sender_id: m.user_id, content: m.message, created_at: m.created_at }));
    }
    const { data } = await (this.supabase.client as any).from('chat_messages').select('*').eq('room_id', roomId).eq('tenant_id', tenantId).order('created_at').limit(limit);
    return data ?? [];
  }

  async subscribeToRoom(tenantId: string, roomId: string) {
    const channel = this.supabase.client.channel(`room:${roomId}`, {
      config: { broadcast: { self: true } },
    });
    return { channel: `room:${roomId}`, status: 'subscribed' };
  }

  async getOnlineUsers(tenantId: string, roomId: string) {
    const { data } = await (this.supabase.client as any).from('chat_room_members').select('user_id').eq('room_id', roomId).eq('tenant_id', tenantId);
    return data ?? [];
  }

  /**
   * DM 1-à-1 : ouvre (ou réutilise) la room privée entre deux membres.
   * Dédup par clé déterministe (`dm:<a>:<b>`, ids triés). MÊME moteur que le
   * chat de groupe / live — un DM n'est qu'une room de type 'dm' à 2 membres.
   */
  async openDirectRoom(tenantId: string, userA: string, userB: string) {
    const [a, b] = [userA, userB].sort();
    const key = `dm:${a}:${b}`;
    const { data: existing } = await (this.supabase.client as any)
      .from('chat_rooms')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('type', 'dm')
      .eq('name', key)
      .maybeSingle();
    let room = existing;
    if (!room) {
      room = await this.createRoom(tenantId, key, 'dm');
    }
    if (room?.id) {
      await this.joinRoom(tenantId, room.id, a);
      await this.joinRoom(tenantId, room.id, b);
    }
    return room;
  }

  /**
   * Chat du live : room logique 'live:<sessionId>'. Le chat du live est servi par
   * le MÊME moteur (chatApi.messages/send + UnifiedChatPanel) que les DM/groupes,
   * mais stocké dans live_session_chat (réutilisé par le realtime des salles live).
   * Pas de ligne chat_rooms → pas de split-brain avec les surfaces live existantes.
   */
  async openLiveRoom(tenantId: string, liveSessionId: string) {
    return { id: `live:${liveSessionId}`, type: 'live', name: `live:${liveSessionId}`, liveSessionId };
  }
}
