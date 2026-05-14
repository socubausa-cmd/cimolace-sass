/**
 * Appels OpenAI Chat Completions — streaming & synchrone (fallback).
 * ⚠️ À n’utiliser que côté serveur (clé API non exposée au navigateur).
 */

export type OpenAiChatRole = 'system' | 'user' | 'assistant';

export interface OpenAiChatMessage {
  role: OpenAiChatRole;
  content: string;
}

export interface OpenAiStreamParams {
  apiKey: string;
  model: string;
  messages: OpenAiChatMessage[];
  temperature: number;
  max_tokens: number;
  signal?: AbortSignal;
}

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

/** Stream brut SSE OpenAI (bytes). */
export async function openaiChatCompletionStream(params: OpenAiStreamParams): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      temperature: params.temperature,
      max_tokens: params.max_tokens,
      stream: true,
    }),
    signal: params.signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI stream ${res.status}: ${errText.slice(0, 240)}`);
  }

  if (!res.body) throw new Error('OpenAI: corps de réponse vide');

  return res.body;
}

export async function openaiChatCompletionSync(params: OpenAiStreamParams): Promise<string> {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      temperature: params.temperature,
      max_tokens: params.max_tokens,
      stream: false,
    }),
    signal: params.signal,
  });

  const json = (await res.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(json?.error?.message || `OpenAI sync ${res.status}`);
  }

  const text = json?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') throw new Error('OpenAI: réponse vide');
  return text.trim();
}

/** Extrait les deltas texte depuis une ligne SSE `data: {...}`. */
export function parseOpenAiSseDataLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return null;
  const payload = trimmed.slice(5).trim();
  if (payload === '[DONE]') return null;
  try {
    const obj = JSON.parse(payload) as {
      choices?: Array<{ delta?: { content?: string } }>;
    };
    const piece = obj?.choices?.[0]?.delta?.content;
    return typeof piece === 'string' ? piece : null;
  } catch {
    return null;
  }
}
