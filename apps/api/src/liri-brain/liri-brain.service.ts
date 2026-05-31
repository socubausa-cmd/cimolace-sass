import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';
import { LIRI_MODELS, type LiriConversation, type LiriMessage, type LiriModel } from './liri-brain.types';
import { BrainToolsService, type BrainToolContext } from './brain-tools.service';

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
    private readonly tools: BrainToolsService,
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

  /**
   * Variante function-calling (chemin OpenAI-compatible : DeepSeek + GPT).
   * Boucle NON-streaming : le modèle peut appeler des outils LECTURE (exécutés
   * automatiquement via BrainToolsService) ; un outil ÉCRITURE stoppe la boucle et
   * émet une demande de confirmation (human-in-the-loop) au lieu d'agir. Réponse
   * finale renvoyée en un bloc. Anthropic : outils pas encore branchés → repli streamChat.
   * ⚠️ Type-checké ; à VALIDER en exécution (API lancée + clés LLM).
   */
  async *streamChatWithTools(
    model: LiriModel,
    messages: LiriMessage[],
    ctx: BrainToolContext,
  ): AsyncGenerator<{ content: string; done: boolean }> {
    const info = LIRI_MODELS.find((m) => m.key === model);
    if (!info) {
      yield { content: `Modèle inconnu: ${model}`, done: true };
      return;
    }
    if (info.provider === 'anthropic') {
      yield* this.anthropicWithTools(model, messages, ctx);
      return;
    }

    let url: string;
    let apiModel: string;
    let key: string | undefined;
    if (info.provider === 'deepseek') {
      url = 'https://api.deepseek.com/v1/chat/completions';
      key = this.config.get<string>('DEEPSEEK_API_KEY');
      apiModel = model === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat';
    } else {
      url = 'https://api.openai.com/v1/chat/completions';
      key = this.config.get<string>('OPENAI_API_KEY');
      apiModel = model;
    }
    if (!key || key === 'replace_me') {
      yield { content: `⚠️ Clé ${info.provider} non configurée.`, done: true };
      return;
    }

    const tools = this.tools.getToolSpecs(ctx.role).map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    const convo: any[] = messages.map((m) => ({ role: m.role, content: m.content }));
    const MAX_STEPS = 5;

    for (let step = 0; step < MAX_STEPS; step++) {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: apiModel,
          messages: convo,
          ...(tools.length ? { tools, tool_choice: 'auto' } : {}),
          max_tokens: 4096,
        }),
      });
      if (!resp.ok) {
        this.logger.error(`${info.provider} tools error: ${await resp.text()}`);
        yield { content: `⚠️ Erreur ${info.provider}: ${resp.status}`, done: true };
        return;
      }
      const data: any = await resp.json();
      const msg = data?.choices?.[0]?.message;
      const toolCalls: any[] | undefined = msg?.tool_calls;

      if (!toolCalls?.length) {
        yield { content: String(msg?.content ?? ''), done: true };
        return;
      }

      convo.push(msg);
      for (const tc of toolCalls) {
        const name: string = tc?.function?.name;
        let args: Record<string, any> = {};
        try {
          args = JSON.parse(tc?.function?.arguments || '{}');
        } catch {
          args = {};
        }

        if (this.tools.requiresConfirmation(name)) {
          // Action d'écriture → on N'EXÉCUTE PAS : on demande confirmation à l'utilisateur.
          yield { content: JSON.stringify({ type: 'tool_confirm', tool: name, args }), done: true };
          return;
        }
        try {
          const result = await this.tools.execute(name, args, ctx);
          convo.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result ?? null) });
        } catch (e) {
          convo.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: String(e) }) });
        }
      }
      // on reboucle : le modèle reçoit les résultats d'outils et continue
    }

    yield { content: '⚠️ Trop d’étapes d’outils, arrêt.', done: true };
  }

  /**
   * Boucle function-calling pour Anthropic (format Claude : blocs `tool_use` /
   * `tool_result`). Même logique que la voie OpenAI-compatible : lecture=auto,
   * écriture=confirmation. Non-streaming, réponse finale en un bloc.
   */
  private async *anthropicWithTools(
    model: LiriModel,
    messages: LiriMessage[],
    ctx: BrainToolContext,
  ): AsyncGenerator<{ content: string; done: boolean }> {
    const key = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!key || key === 'replace_me') {
      yield { content: '⚠️ ANTHROPIC_API_KEY non configurée.', done: true };
      return;
    }
    const systemMsg = messages.find((m) => m.role === 'system');
    const convo: any[] = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));
    const tools = this.tools.getToolSpecs(ctx.role).map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
    const MAX_STEPS = 5;

    for (let step = 0; step < MAX_STEPS; step++) {
      const body: Record<string, unknown> = {
        model,
        max_tokens: 4096,
        messages: convo,
        ...(tools.length ? { tools } : {}),
      };
      if (systemMsg) body['system'] = systemMsg.content;

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        this.logger.error(`Anthropic tools error: ${await resp.text()}`);
        yield { content: `⚠️ Erreur Anthropic: ${resp.status}`, done: true };
        return;
      }
      const data: any = await resp.json();
      const blocks: any[] = Array.isArray(data?.content) ? data.content : [];
      const toolUses = blocks.filter((b) => b?.type === 'tool_use');

      if (!toolUses.length) {
        const text = blocks.filter((b) => b?.type === 'text').map((b) => b.text).join('');
        yield { content: text, done: true };
        return;
      }

      convo.push({ role: 'assistant', content: blocks });
      const toolResults: any[] = [];
      for (const tu of toolUses) {
        const name: string = tu.name;
        const args: Record<string, any> = (tu.input ?? {}) as Record<string, any>;
        if (this.tools.requiresConfirmation(name)) {
          yield { content: JSON.stringify({ type: 'tool_confirm', tool: name, args }), done: true };
          return;
        }
        try {
          const result = await this.tools.execute(name, args, ctx);
          toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result ?? null) });
        } catch (e) {
          toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify({ error: String(e) }), is_error: true });
        }
      }
      convo.push({ role: 'user', content: toolResults });
    }
    yield { content: '⚠️ Trop d’étapes d’outils, arrêt.', done: true };
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
