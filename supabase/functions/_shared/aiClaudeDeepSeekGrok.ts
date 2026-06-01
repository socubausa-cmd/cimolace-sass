/**
 * Chaîne Claude → DeepSeek → Grok (xAI), alignée sur netlify/functions/_lib/aiWithFallback.js
 * (aiChatClaudeDeepSeekGrok).
 */

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type AiUsageInfo = {
  provider: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
};

export type AiChainResult = {
  text: string | null;
  provider: 'claude' | 'deepseek' | 'grok' | null;
  usage?: AiUsageInfo;
};

async function callClaude(params: {
  apiKey: string;
  model: string;
  system?: string;
  messages: ChatMessage[];
  max_tokens: number;
  temperature: number;
}): Promise<{ text: string; tokens_in: number; tokens_out: number }> {
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
      ...(system ? { system } : {}),
      messages,
    }),
  });
  const payload = (await res.json().catch(() => ({}))) as {
    content?: Array<{ type?: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(payload?.error?.message || `Anthropic HTTP ${res.status}`);
  }
  const text = (payload.content || [])
    .map((b) => (b.type === 'text' ? b.text || '' : ''))
    .join('')
    .trim();
  if (!text) throw new Error('Claude returned empty content');
  return {
    text,
    tokens_in: payload?.usage?.input_tokens ?? 0,
    tokens_out: payload?.usage?.output_tokens ?? 0,
  };
}

async function callOpenAICompat(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  system?: string;
  messages: ChatMessage[];
  max_tokens: number;
  temperature: number;
}): Promise<{ text: string; tokens_in: number; tokens_out: number }> {
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
    body: JSON.stringify({ model, messages: fullMessages, max_tokens, temperature }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => String(res.status));
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || text.trim() === '') {
    throw new Error('Empty response from provider');
  }
  return {
    text: text.trim(),
    tokens_in: data?.usage?.prompt_tokens ?? 0,
    tokens_out: data?.usage?.completion_tokens ?? 0,
  };
}

export async function aiChatClaudeDeepSeekGrok(opts: {
  system?: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  claudeModel?: string;
  deepseekModel?: string;
  grokModel?: string;
  /** Coach live : ordre DeepSeek → Claude → Grok (réponses courtes, latence souvent meilleure). */
  preferDeepseekFirst?: boolean;
}): Promise<AiChainResult> {
  const max_tokens = opts.max_tokens ?? 800;
  const temperature = opts.temperature ?? 0.5;
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

  // @ts-ignore Deno
  const anthropicKey = String(Deno.env.get('ANTHROPIC_API_KEY') || '').trim();
  // @ts-ignore Deno
  const deepseekKey = String(Deno.env.get('DEEPSEEK_API_KEY') || '').trim();
  // @ts-ignore Deno
  const xaiKey = String(Deno.env.get('XAI_API_KEY') || '').trim();

  const tryDeepseek = async (): Promise<AiChainResult | null> => {
    if (!deepseekKey) return null;
    try {
      const r = await callOpenAICompat({
        baseUrl: 'https://api.deepseek.com',
        apiKey: deepseekKey,
        model: deepseekModel,
        system: opts.system,
        messages: opts.messages,
        max_tokens,
        temperature,
      });
      return {
        text: r.text,
        provider: 'deepseek',
        usage: { provider: 'deepseek', model: deepseekModel, tokens_in: r.tokens_in, tokens_out: r.tokens_out },
      };
    } catch (e) {
      console.warn('[aiChatClaudeDeepSeekGrok] DeepSeek failed:', (e as Error)?.message);
      return null;
    }
  };

  const tryClaude = async (): Promise<AiChainResult | null> => {
    if (!anthropicKey) return null;
    try {
      const r = await callClaude({
        apiKey: anthropicKey,
        model: claudeModel,
        system: opts.system,
        messages: opts.messages,
        max_tokens,
        temperature,
      });
      return {
        text: r.text,
        provider: 'claude',
        usage: { provider: 'anthropic', model: claudeModel, tokens_in: r.tokens_in, tokens_out: r.tokens_out },
      };
    } catch (e) {
      console.warn('[aiChatClaudeDeepSeekGrok] Claude failed:', (e as Error)?.message);
      return null;
    }
  };

  const tryGrok = async (): Promise<AiChainResult | null> => {
    if (!xaiKey) return null;
    try {
      const r = await callOpenAICompat({
        baseUrl: 'https://api.x.ai/v1',
        apiKey: xaiKey,
        model: grokModel,
        system: opts.system,
        messages: opts.messages,
        max_tokens,
        temperature,
      });
      return {
        text: r.text,
        provider: 'grok',
        usage: { provider: 'grok', model: grokModel, tokens_in: r.tokens_in, tokens_out: r.tokens_out },
      };
    } catch (e) {
      console.warn('[aiChatClaudeDeepSeekGrok] Grok failed:', (e as Error)?.message);
      return null;
    }
  };

  const order = opts.preferDeepseekFirst
    ? [tryDeepseek, tryClaude, tryGrok]
    : [tryClaude, tryDeepseek, tryGrok];

  for (const fn of order) {
    const r = await fn();
    if (r?.text) return r;
  }

  return { text: null, provider: null };
}

/** Résultat chaîne Claude → OpenAI → Groq → DeepSeek (liri-summary, liri-mindmap). */
export type AiMultiProviderResult = {
  text: string | null;
  provider: 'claude' | 'openai' | 'groq' | 'deepseek' | null;
  usage?: AiUsageInfo;
};

/**
 * Aligné sur netlify `aiChat` : Claude → OpenAI → Groq → DeepSeek.
 */
export async function aiChat(opts: {
  system?: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  claudeModel?: string;
  groqModel?: string;
  deepseekModel?: string;
}): Promise<AiMultiProviderResult> {
  const max_tokens = opts.max_tokens ?? 800;
  const temperature = opts.temperature ?? 0.5;
  // @ts-ignore Deno
  const env = (k: string) => String(Deno.env.get(k) || '').trim();
  const claudeModel =
    (opts.claudeModel != null && String(opts.claudeModel).trim()) || 'claude-haiku-4-5';
  const openaiModel = env('OPENAI_MODEL') || 'gpt-4o-mini';
  const groqModel =
    (opts.groqModel != null && String(opts.groqModel).trim()) || 'llama-3.3-70b-versatile';
  const deepseekModel =
    (opts.deepseekModel != null && String(opts.deepseekModel).trim()) || 'deepseek-chat';

  const anthropicKey = env('ANTHROPIC_API_KEY');
  if (anthropicKey) {
    try {
      const r = await callClaude({
        apiKey: anthropicKey,
        model: claudeModel,
        system: opts.system,
        messages: opts.messages,
        max_tokens,
        temperature,
      });
      return {
        text: r.text,
        provider: 'claude',
        usage: { provider: 'anthropic', model: claudeModel, tokens_in: r.tokens_in, tokens_out: r.tokens_out },
      };
    } catch (e) {
      console.warn('[aiChat] Claude failed:', (e as Error)?.message);
    }
  }

  const openaiKey = env('OPENAI_API_KEY');
  if (openaiKey) {
    try {
      const r = await callOpenAICompat({
        baseUrl: 'https://api.openai.com/v1',
        apiKey: openaiKey,
        model: openaiModel,
        system: opts.system,
        messages: opts.messages,
        max_tokens,
        temperature,
      });
      return {
        text: r.text,
        provider: 'openai',
        usage: { provider: 'openai', model: openaiModel, tokens_in: r.tokens_in, tokens_out: r.tokens_out },
      };
    } catch (e) {
      console.warn('[aiChat] OpenAI failed:', (e as Error)?.message);
    }
  }

  const groqKey = env('GROQ_API_KEY');
  if (groqKey) {
    try {
      const r = await callOpenAICompat({
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: groqKey,
        model: groqModel,
        system: opts.system,
        messages: opts.messages,
        max_tokens,
        temperature,
      });
      return {
        text: r.text,
        provider: 'groq',
        usage: { provider: 'groq', model: groqModel, tokens_in: r.tokens_in, tokens_out: r.tokens_out },
      };
    } catch (e) {
      console.warn('[aiChat] Groq failed:', (e as Error)?.message);
    }
  }

  const deepseekKey = env('DEEPSEEK_API_KEY');
  if (deepseekKey) {
    try {
      const r = await callOpenAICompat({
        baseUrl: 'https://api.deepseek.com',
        apiKey: deepseekKey,
        model: deepseekModel,
        system: opts.system,
        messages: opts.messages,
        max_tokens,
        temperature,
      });
      return {
        text: r.text,
        provider: 'deepseek',
        usage: { provider: 'deepseek', model: deepseekModel, tokens_in: r.tokens_in, tokens_out: r.tokens_out },
      };
    } catch (e) {
      console.warn('[aiChat] DeepSeek failed:', (e as Error)?.message);
    }
  }

  return { text: null, provider: null };
}
