import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class LongiaService {
  private readonly logger = new Logger(LongiaService.name);
  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  async *streamChat(
    messages: any[],
    _context?: any,
  ): AsyncGenerator<{ content: string; done: boolean }> {
    const apiKey = this.config.get<string>('DEEPSEEK_API_KEY');
    if (!apiKey || apiKey === 'replace_me') {
      yield { content: 'DEEPSEEK_API_KEY non configuree.', done: true };
      return;
    }
    const response = await fetch(
      'https://api.deepseek.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: messages.map((m: any) => ({
            role: m.role,
            content: m.content,
          })),
          stream: true,
          max_tokens: 4096,
        }),
      },
    );
    if (!response.ok) {
      yield { content: 'Erreur DeepSeek: ' + response.status, done: true };
      return;
    }
    const reader = response.body?.getReader();
    if (!reader) {
      yield { content: 'Pas de streaming disponible.', done: true };
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
          /* ignored */
        }
      }
    }
    yield { content: '', done: true };
  }

  async chatCompletion(
    messages: any[],
    systemPrompt?: string,
  ): Promise<string> {
    const apiKey = this.config.get<string>('DEEPSEEK_API_KEY');
    if (apiKey && apiKey !== 'replace_me') {
      try {
        const msgs = systemPrompt
          ? [{ role: 'system', content: systemPrompt }, ...messages]
          : messages;
        const res = await fetch(
          'https://api.deepseek.com/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + apiKey,
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: msgs.map((m: any) => ({
                role: m.role,
                content: m.content,
              })),
              max_tokens: 3000,
            }),
          },
        );
        if (res.ok) {
          const json = await res.json();
          return json.choices?.[0]?.message?.content?.trim() || '';
        }
      } catch (e) {
        this.logger.warn('DeepSeek error: ' + (e as Error).message);
      }
    }
    return '[Fallback] Service IA non disponible.';
  }

  async analyzeDocument(content: string, instruction?: string): Promise<any> {
    const response = await this.chatCompletion(
      [
        {
          role: 'user',
          content:
            (instruction || 'Analyse ce document en profondeur.') +
            '\n\n' +
            content.slice(0, 15000),
        },
      ],
      "Tu es un assistant d'analyse de documents. Reponds de maniere structuree.",
    );
    return { analysis: response };
  }

  async coverPromptAssistant(brief: string, style?: string): Promise<any> {
    const response = await this.chatCompletion(
      [
        {
          role: 'user',
          content: 'Brief: ' + brief + '\nStyle: ' + (style || 'moderne'),
        },
      ],
      'Genere 3 idees de couverture visuelle pour ce contenu. Format: titre, description visuelle, palette de couleurs suggeree.',
    );
    return { suggestions: response };
  }
}
