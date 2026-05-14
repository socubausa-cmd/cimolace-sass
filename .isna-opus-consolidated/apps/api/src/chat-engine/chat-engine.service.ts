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
    const { data } = await (this.supabase.client as any).from('chat_messages').insert({ tenant_id: tenantId, room_id: roomId, sender_id: userId, content }).select('*').single();
    return data;
  }

  async getMessages(tenantId: string, roomId: string, limit = 50) {
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
}
