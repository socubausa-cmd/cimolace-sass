import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MultilangService {
  private readonly logger = new Logger(MultilangService.name);
  constructor(private readonly config: ConfigService) {}

  async translateContent(
    content: string,
    targetLang: string,
    sourceLang?: string,
  ): Promise<{ translation: string; targetLang: string }> {
    const apiKey = this.config.get<string>('DEEPSEEK_API_KEY');
    if (apiKey && apiKey !== 'replace_me') {
      try {
        const prompt = sourceLang
          ? 'Translate from ' +
            sourceLang +
            ' to ' +
            targetLang +
            ': ' +
            content.slice(0, 8000)
          : 'Translate to ' + targetLang + ': ' + content.slice(0, 8000);
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
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 4000,
            }),
          },
        );
        if (res.ok) {
          const json = await res.json();
          return {
            translation: json.choices?.[0]?.message?.content?.trim() || '',
            targetLang,
          };
        }
      } catch (e) {
        this.logger.warn('Translate error: ' + (e as Error).message);
      }
    }
    return {
      translation: '[Service de traduction non disponible]',
      targetLang,
    };
  }

  async multilangLive(
    transcript: string,
    targetLangs: string[],
  ): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    for (const lang of targetLangs) {
      const r = await this.translateContent(transcript.slice(0, 4000), lang);
      results[lang] = r.translation;
    }
    return results;
  }

  async multilangVideo(
    content: string,
    targetLangs: string[],
    title?: string,
  ): Promise<any> {
    const translations: Record<string, string> = {};
    for (const lang of targetLangs) {
      const r = await this.translateContent(content.slice(0, 5000), lang);
      translations[lang] = r.translation;
    }
    return { title: title || '', translations };
  }
}
