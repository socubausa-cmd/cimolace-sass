import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';
import { LIRI_MODELS, type LiriConversation, type LiriMessage, type LiriModel } from './liri-brain.types';
import { BrainToolsService, type BrainToolContext } from './brain-tools.service';
import { AiBillingService } from '../ai-billing/ai-billing.service';

/** Borne du contexte : nb max de messages d'historique réinjectés au LLM (coût/contexte). */
const MAX_HISTORY_MESSAGES = 20;

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
    private readonly billing: AiBillingService,
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

  /** Supprime une conversation de l'utilisateur courant (scopée tenant + user). */
  async deleteConversation(
    tenantId: string,
    userId: string,
    conversationId: string,
  ): Promise<{ deleted: boolean }> {
    const { error } = await this.supabase.client
      .from('liri_conversations' as any)
      .delete()
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return { deleted: true };
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
   * Point d'entrée du chat SSE : charge l'historique de la conversation (si
   * `conversationId`) pour donner sa mémoire au LLM, puis diffuse la réponse —
   * avec outils (`useTools`) ou en streaming simple. La persistance du tour est
   * déclenchée côté front via POST /liri/brain/conversations.
   */
  async *streamConversation(
    model: LiriModel,
    message: string,
    ctx: BrainToolContext,
    opts: { conversationId?: string; useTools: boolean },
  ): AsyncGenerator<{ content: string; done: boolean }> {
    // Garde-quota IA (fail-open : si la facturation est indisponible, on n'empêche pas l'usage).
    try {
      const bal: any = await this.billing.getBalance(ctx.tenant.id);
      if (bal?.is_blocked || (bal?.balance_credits ?? 1) <= 0) {
        yield {
          content:
            "⚠️ Les crédits IA de l'école sont épuisés. Contactez l'administration pour recharger.",
          done: true,
        };
        return;
      }
    } catch {
      // facturation indisponible → on continue
    }

    const history: LiriMessage[] = [];
    if (opts.conversationId) {
      try {
        const conv = await this.getConversation(ctx.tenant.id, opts.conversationId);
        if (Array.isArray(conv.messages)) history.push(...conv.messages);
      } catch {
        // conversation introuvable / autre tenant → on continue sans historique
      }
    }
    const messages: LiriMessage[] = [
      { role: 'system', content: this.buildSystemPrompt(ctx) },
      // borne le contexte : seuls les N derniers messages d'historique (coût + dépassement de contexte).
      ...history.slice(-MAX_HISTORY_MESSAGES),
      { role: 'user', content: message },
    ];
    if (opts.useTools) {
      yield* this.streamChatWithTools(model, messages, ctx);
    } else {
      yield* this.streamChat(model, messages, ctx.tenant);
    }
  }

  /** Prompt système : donne à LIRI son identité, sa langue et son cadre (outils, confirmation). */
  private buildSystemPrompt(ctx: BrainToolContext): string {
    const school = ctx.tenant?.name || 'votre école';
    const role = ctx.role || 'membre';
    return [
      `Tu es LIRI, l'assistant IA de l'école « ${school} » sur la plateforme Cimolace.`,
      'Réponds en français, de façon claire, concise et bienveillante.',
      "Tu disposes d'outils pour consulter les données réelles de l'école (cours, forum, inscriptions) : utilise-les plutôt que de deviner, et n'invente jamais d'identifiants ni de chiffres.",
      "Pour une action d'écriture (créer un live, publier au forum, réserver un créneau…), APPELLE directement l'outil correspondant : le système affichera alors une carte de confirmation à l'utilisateur avant toute exécution. Ne te contente pas de décrire l'action en texte — c'est l'appel d'outil qui déclenche la confirmation.",
      `L'utilisateur courant a le rôle « ${role} ».`,
    ].join('\n');
  }

  /**
   * Comptabilise l'usage LLM d'un appel sur les crédits IA du tenant (best-effort).
   * Gère les deux formats : OpenAI/DeepSeek (prompt/completion_tokens) et Anthropic
   * (input/output_tokens). N'interrompt jamais le flux si la facturation échoue.
   */
  private async chargeLlm(
    ctx: BrainToolContext,
    provider: string,
    model: string,
    usage: any,
  ): Promise<void> {
    if (!usage) return;
    const tokensIn = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
    const tokensOut = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
    try {
      if (tokensIn > 0) {
        await this.billing.chargeUsage(ctx.tenant.id, {
          function_name: 'liri-brain.chat',
          provider,
          model,
          unit_type: 'tokens_in',
          unit_amount: tokensIn,
          user_id: ctx.userId,
        });
      }
      if (tokensOut > 0) {
        await this.billing.chargeUsage(ctx.tenant.id, {
          function_name: 'liri-brain.chat',
          provider,
          model,
          unit_type: 'tokens_out',
          unit_amount: tokensOut,
          user_id: ctx.userId,
        });
      }
    } catch (e) {
      this.logger.warn(`facturation liri-brain ignorée: ${(e as Error).message}`);
    }
  }

  /** Lit un flux SSE et émet le contenu de chaque ligne `data:` (préfixe retiré). */
  private async *readSseData(resp: Response): AsyncGenerator<string> {
    const reader = resp.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const t = line.trim();
        if (t.startsWith('data:')) yield t.slice(5).trim();
      }
    }
  }

  /**
   * Variante function-calling (chemin OpenAI-compatible : DeepSeek + GPT).
   * Boucle EN STREAMING : le texte de la réponse est émis token par token ; le
   * modèle peut appeler des outils LECTURE (exécutés automatiquement via
   * BrainToolsService) ; un outil ÉCRITURE stoppe la boucle et émet une demande
   * de confirmation (human-in-the-loop) au lieu d'agir. Anthropic → anthropicWithTools.
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
          stream: true,
          stream_options: { include_usage: true },
        }),
      });
      if (!resp.ok) {
        this.logger.error(`${info.provider} tools error: ${await resp.text()}`);
        yield { content: `⚠️ Erreur ${info.provider}: ${resp.status}`, done: true };
        return;
      }

      // Flux : on émet le texte au fil de l'eau ; on accumule les tool_calls (deltas par index).
      let assistantText = '';
      const toolAcc: Record<number, { id: string; name: string; arguments: string }> = {};
      let usage: any = null;
      for await (const dataStr of this.readSseData(resp)) {
        if (dataStr === '[DONE]') break;
        let parsed: any;
        try {
          parsed = JSON.parse(dataStr);
        } catch {
          continue;
        }
        if (parsed.usage) usage = parsed.usage;
        const delta = parsed.choices?.[0]?.delta;
        if (!delta) continue;
        if (delta.content) {
          assistantText += delta.content;
          yield { content: delta.content, done: false };
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const i: number = tc.index ?? 0;
            const acc = (toolAcc[i] ??= { id: '', name: '', arguments: '' });
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name = tc.function.name;
            if (tc.function?.arguments) acc.arguments += tc.function.arguments;
          }
        }
      }
      await this.chargeLlm(ctx, info.provider, apiModel, usage);

      const toolCalls = Object.values(toolAcc);
      if (!toolCalls.length) {
        // réponse finale : déjà streamée token par token
        yield { content: '', done: true };
        return;
      }

      convo.push({
        role: 'assistant',
        content: assistantText || null,
        tool_calls: toolCalls.map((t) => ({
          id: t.id,
          type: 'function',
          function: { name: t.name, arguments: t.arguments },
        })),
      });
      for (const tc of toolCalls) {
        let args: Record<string, any> = {};
        try {
          args = JSON.parse(tc.arguments || '{}');
        } catch {
          args = {};
        }
        if (this.tools.requiresConfirmation(tc.name)) {
          // Action d'écriture → on N'EXÉCUTE PAS : on demande confirmation à l'utilisateur.
          yield { content: JSON.stringify({ type: 'tool_confirm', tool: tc.name, args }), done: true };
          return;
        }
        try {
          const result = await this.tools.execute(tc.name, args, ctx);
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
   * écriture=confirmation. EN STREAMING (text_delta émis au fil de l'eau).
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
        stream: true,
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

      // Flux Anthropic : text_delta émis au fil de l'eau ; blocs tool_use accumulés
      // depuis input_json_delta ; usage agrégé (input au message_start, output au message_delta).
      const blocks: any[] = [];
      let cur: any = null;
      let curJson = '';
      let usage: any = null;
      for await (const dataStr of this.readSseData(resp)) {
        let ev: any;
        try {
          ev = JSON.parse(dataStr);
        } catch {
          continue;
        }
        switch (ev.type) {
          case 'message_start':
            if (ev.message?.usage) usage = { ...(usage ?? {}), ...ev.message.usage };
            break;
          case 'content_block_start':
            cur = ev.content_block;
            curJson = '';
            break;
          case 'content_block_delta':
            if (ev.delta?.type === 'text_delta' && ev.delta.text) {
              if (cur?.type === 'text') cur.text = (cur.text ?? '') + ev.delta.text;
              yield { content: ev.delta.text, done: false };
            } else if (ev.delta?.type === 'input_json_delta') {
              curJson += ev.delta.partial_json ?? '';
            }
            break;
          case 'content_block_stop':
            if (cur) {
              if (cur.type === 'tool_use') {
                try {
                  cur.input = JSON.parse(curJson || '{}');
                } catch {
                  cur.input = {};
                }
              }
              blocks.push(cur);
              cur = null;
            }
            break;
          case 'message_delta':
            if (ev.usage) usage = { ...(usage ?? {}), ...ev.usage };
            break;
        }
      }
      await this.chargeLlm(ctx, 'anthropic', model, usage);

      const toolUses = blocks.filter((b) => b?.type === 'tool_use');
      if (!toolUses.length) {
        // réponse finale : déjà streamée token par token
        yield { content: '', done: true };
        return;
      }

      convo.push({ role: 'assistant', content: blocks });
      const toolResults: any[] = [];
      for (const tu of toolUses) {
        if (this.tools.requiresConfirmation(tu.name)) {
          yield { content: JSON.stringify({ type: 'tool_confirm', tool: tu.name, args: tu.input ?? {} }), done: true };
          return;
        }
        try {
          const result = await this.tools.execute(tu.name, tu.input ?? {}, ctx);
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
