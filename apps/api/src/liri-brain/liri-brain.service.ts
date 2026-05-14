import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';
import { LIRI_MODELS, type LiriConversation, type LiriMessage, type LiriModel } from './liri-brain.types';

type ConversationRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  model: string;
  title: string;
  messages_json: string;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class LiriBrainService {
  private readonly logger = new Logger(LiriBrainService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  // ── Model Catalog ────────────────────────────────────────────────────────

  getModels() {
    return LIRI_MODELS;
  }

  // ── Conversation Persistence ─────────────────────────────────────────────

  async getConversation(
    tenantId: string,
    conversationId: string,
  ): Promise<LiriConversation> {
    const { data, error } = await this.supabase.client
      .from('liri_conversations' as any)
      .select('*')
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Conversation introuvable');
    }

    const row = data as any as ConversationRow;
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      user_id: row.user_id,
      model: row.model as LiriModel,
      title: row.title,
      messages: JSON.parse(row.messages_json) as LiriMessage[],
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async listConversations(
    tenantId: string,
    userId: string,
  ): Promise<Pick<LiriConversation, 'id' | 'title' | 'model' | 'updated_at'>[]> {
    const { data } = await this.supabase.client
      .from('liri_conversations' as any)
      .select('id, title, model, updated_at')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50);

    return (data as any[] ?? []) as Pick<LiriConversation, 'id' | 'title' | 'model' | 'updated_at'>[];
  }

  async saveConversation(
    tenantId: string,
    userId: string,
    model: LiriModel,
    title: string,
    messages: LiriMessage[],
    conversationId?: string,
  ): Promise<LiriConversation> {
    const payload = {
      tenant_id: tenantId,
      user_id: userId,
      model,
      title: title || messages[0]?.content?.slice(0, 80) || 'Nouvelle conversation',
      messages_json: JSON.stringify(messages),
      updated_at: new Date().toISOString(),
    };

    if (conversationId) {
      const { data, error } = await this.supabase.client
        .from('liri_conversations' as any)
        .update(payload as any)
        .eq('id', conversationId)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();

      if (error || !data) throw new NotFoundException('Conversation introuvable');
      const row = data as any as ConversationRow;
      return {
        id: row.id,
        tenant_id: row.tenant_id,
        user_id: row.user_id,
        model: row.model as LiriModel,
        title: row.title,
        messages: JSON.parse(row.messages_json),
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    }

    const { data, error } = await this.supabase.client
      .from('liri_conversations' as any)
      .insert(payload as any)
      .select('*')
      .single();

    if (error || !data) throw new Error(error?.message ?? 'Échec création conversation');
    const row = data as any as ConversationRow;
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      user_id: row.user_id,
      model: row.model as LiriModel,
      title: row.title,
      messages: JSON.parse(row.messages_json),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // ── LLM Streaming ────────────────────────────────────────────────────────

  /**
   * Returns an async generator that yields SSE-compatible chunks.
   * This is the core of LIRI Brain — multi-model streaming with tenant isolation.
   */
  async *streamChat(
    model: LiriModel,
    messages: LiriMessage[],
    _tenant: TenantContext,
  ): AsyncGenerator<{ content: string; done: boolean }> {
    const info = LIRI_MODELS.find((m) => m.key === model);
    if (!info) throw new Error(`Modèle inconnu: ${model}`);

    switch (info.provider) {
      case 'deepseek':
        yield* this.streamDeepSeek(model, messages);
        break;
      case 'anthropic':
        yield* this.streamAnthropic(model, messages);
        break;
      case 'openai':
        yield* this.streamOpenAI(model, messages);
        break;
      default:
        yield { content: `Provider ${info.provider} non supporté.`, done: true };
    }
  }

  private async *streamDeepSeek(_model: LiriModel, messages: LiriMessage[]): AsyncGenerator<{ content: string; done: boolean }> {
    const apiKey = this.config.get<string>('DEEPSEEK_API_KEY');
    if (!apiKey || apiKey === 'replace_me') {
      yield { content: '⚠️ DEEPSEEK_API_KEY non configurée.', done: true };
      return;
    }

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: _model === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat',
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`DeepSeek API error: ${err}`);
      yield { content: `⚠️ Erreur DeepSeek: ${response.status}`, done: true };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { content: '⚠️ Pas de réponse streaming.', done: true };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          yield { content: '', done: true };
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield { content, done: false };
        } catch {
          // skip malformed chunk
        }
      }
    }
    yield { content: '', done: true };
  }

  private async *streamAnthropic(_model: LiriModel, messages: LiriMessage[]): AsyncGenerator<{ content: string; done: boolean }> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey || apiKey === 'replace_me') {
      yield { content: '⚠️ ANTHROPIC_API_KEY non configurée.', done: true };
      return;
    }

    const systemMsg = messages.find((m) => m.role === 'system');
    const chatMessages = messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: _model,
      max_tokens: 4096,
      messages: chatMessages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    };
    if (systemMsg) body['system'] = systemMsg.content;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`Anthropic API error: ${err}`);
      yield { content: `⚠️ Erreur Anthropic: ${response.status}`, done: true };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { content: '⚠️ Pas de réponse streaming.', done: true };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta') {
            const text = parsed.delta?.text;
            if (text) yield { content: text, done: false };
          } else if (parsed.type === 'message_stop') {
            yield { content: '', done: true };
            return;
          }
        } catch {
          // skip
        }
      }
    }
    yield { content: '', done: true };
  }

  private async *streamOpenAI(_model: LiriModel, messages: LiriMessage[]): AsyncGenerator<{ content: string; done: boolean }> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey || apiKey === 'replace_me') {
      yield { content: '⚠️ OPENAI_API_KEY non configurée.', done: true };
      return;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: _model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`OpenAI API error: ${err}`);
      yield { content: `⚠️ Erreur OpenAI: ${response.status}`, done: true };
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { content: '⚠️ Pas de réponse streaming.', done: true };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          yield { content: '', done: true };
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield { content, done: false };
        } catch {
          // skip
        }
      }
    }
    yield { content: '', done: true };
  }
}
