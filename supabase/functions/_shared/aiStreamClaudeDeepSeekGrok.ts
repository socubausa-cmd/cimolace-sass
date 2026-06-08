/**
 * Streaming text — Claude (SSE) puis DeepSeek puis Grok (OpenAI-compatible SSE).
 * Aligné sur aiClaudeDeepSeekGrok.ts (même ordre de fallback).
 */

export type StreamChatMessage = { role: 'user' | 'assistant'; content: string };

async function* streamClaude(params: {
  apiKey: string;
  model: string;
  system?: string;
  messages: StreamChatMessage[];
  max_tokens: number;
  temperature: number;
}): AsyncGenerator<string, void, unknown> {
  const { apiKey, model, system, messages, max_tokens, temperature } = params;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens,
      temperature,
      stream: true,
      ...(system ? { system } : {}),
      messages,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t.slice(0, 400) || `Anthropic HTTP ${res.status}`);
  }
  if (!res.body) throw new Error('Anthropic: pas de corps');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;
      try {
        const evt = JSON.parse(jsonStr) as {
          type?: string;
          delta?: { type?: string; text?: string };
        };
        if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta' && evt.delta?.text) {
          yield evt.delta.text;
        }
      } catch {
        /* ligne incomplète */
      }
    }
  }
}

/** Streaming OpenAI-compatible (Groq, OpenAI, DeepSeek, xAI…). */
export async function* streamOpenAICompat(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  system?: string;
  messages: StreamChatMessage[];
  max_tokens: number;
  temperature: number;
}): AsyncGenerator<string, void, unknown> {
  const { baseUrl, apiKey, model, system, messages, max_tokens, temperature } = params;
  const fullMessages = [
    ...(system ? [{ role: 'system' as const, content: system }] : []),
    ...messages,
  ];
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: fullMessages,
      max_tokens,
      temperature,
      stream: true,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t.slice(0, 400) || `HTTP ${res.status}`);
  }
  if (!res.body) throw new Error('Pas de corps de réponse');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const json = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string | null } }>;
        };
        const piece = json?.choices?.[0]?.delta?.content;
        if (typeof piece === 'string' && piece.length > 0) yield piece;
      } catch {
        /* ignore */
      }
    }
  }
}

export async function* streamAiChatClaudeDeepSeekGrok(opts: {
  system?: string;
  messages: StreamChatMessage[];
  max_tokens?: number;
  temperature?: number;
  claudeModel?: string;
  deepseekModel?: string;
  grokModel?: string;
}): AsyncGenerator<string, void, unknown> {
  const max_tokens = opts.max_tokens ?? 4096;
  const temperature = opts.temperature ?? 0.55;
  // @ts-ignore Deno
  const env = (k: string) => String(Deno.env.get(k) || '').trim();
  const claudeModel =
    (opts.claudeModel != null && String(opts.claudeModel).trim()) ||
    env('SMARTBOARD_CLAUDE_MODEL') ||
    'claude-haiku-4-5';
  const deepseekModel =
    (opts.deepseekModel != null && String(opts.deepseekModel).trim()) ||
    env('SMARTBOARD_DEEPSEEK_MODEL') ||
    'deepseek-chat';
  const grokModel =
    (opts.grokModel != null && String(opts.grokModel).trim()) ||
    env('SMARTBOARD_GROK_MODEL') ||
    'grok-3-mini';

  const anthropicKey = env('ANTHROPIC_API_KEY');
  if (anthropicKey) {
    try {
      for await (const chunk of streamClaude({
        apiKey: anthropicKey,
        model: claudeModel,
        system: opts.system,
        messages: opts.messages,
        max_tokens,
        temperature,
      })) {
        yield chunk;
      }
      return;
    } catch (e) {
      console.warn('[streamAiChatClaudeDeepSeekGrok] Claude:', (e as Error)?.message);
    }
  }

  const deepseekKey = env('DEEPSEEK_API_KEY');
  if (deepseekKey) {
    try {
      for await (const chunk of streamOpenAICompat({
        baseUrl: 'https://api.deepseek.com',
        apiKey: deepseekKey,
        model: deepseekModel,
        system: opts.system,
        messages: opts.messages,
        max_tokens,
        temperature,
      })) {
        yield chunk;
      }
      return;
    } catch (e) {
      console.warn('[streamAiChatClaudeDeepSeekGrok] DeepSeek:', (e as Error)?.message);
    }
  }

  const xaiKey = env('XAI_API_KEY');
  if (xaiKey) {
    try {
      for await (const chunk of streamOpenAICompat({
        baseUrl: 'https://api.x.ai/v1',
        apiKey: xaiKey,
        model: grokModel,
        system: opts.system,
        messages: opts.messages,
        max_tokens,
        temperature,
      })) {
        yield chunk;
      }
      return;
    } catch (e) {
      console.warn('[streamAiChatClaudeDeepSeekGrok] Grok:', (e as Error)?.message);
    }
  }

  throw new Error('Aucun fournisseur IA configuré pour le streaming.');
}
