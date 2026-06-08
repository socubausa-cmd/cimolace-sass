import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LiriVisionService {
  private readonly logger = new Logger(LiriVisionService.name);
  constructor(private readonly config: ConfigService) {}

  private stripDataUrl(
    raw: string,
    mimeFallback: string,
  ): { b64: string; mime: string } {
    const s = String(raw || '').trim();
    const m = s.match(/^data:([^;]+);base64,(.+)$/is);
    if (m) return { mime: m[1] || mimeFallback, b64: m[2].replace(/\s/g, '') };
    return { mime: mimeFallback, b64: s.replace(/\s/g, '') };
  }

  async describeImage(opts: {
    imageBase64: string;
    mimeType?: string;
    lang?: string;
    centralIdea?: string;
  }) {
    const mimeFallback = opts.mimeType || 'image/jpeg';
    const { b64, mime } = this.stripDataUrl(opts.imageBase64, mimeFallback);
    if (b64.length < 80) throw new Error('Image trop petite ou invalide');
    if (b64.length > 6_200_000) throw new Error('Image trop volumineuse');
    const lang = opts.lang || 'fr';
    const userPrompt =
      lang === 'en'
        ? `You are the LIRI SmartBoard copilot. Describe what this image shows in 3-5 short sentences. Then suggest 2 concrete ways to use it on a teaching slide.${opts.centralIdea ? '\n\nCentral idea: ' + opts.centralIdea.slice(0, 800) : ''}`
        : `Tu es le Copilot SmartBoard LIRI. Decris ce que montre cette image en 3 a 5 phrases courtes. Puis propose 2 pistes concretes pour l'integrer dans une scene de cours.${opts.centralIdea ? '\n\nIdee centrale: ' + opts.centralIdea.slice(0, 800) : ''}`;
    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey && anthropicKey !== 'replace_me') {
      try {
        const model =
          this.config.get<string>('SMARTBOARD_VISION_CLAUDE_MODEL') ||
          'claude-haiku-4-5-20251001';
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: 1200,
            temperature: 0.4,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: { type: 'base64', media_type: mime, data: b64 },
                  },
                  { type: 'text', text: userPrompt },
                ],
              },
            ],
          }),
        });
        if (res.ok) {
          const payload = await res.json();
          const text = (payload.content || [])
            .map((b: any) => (b.type === 'text' ? b.text || '' : ''))
            .join('')
            .trim();
          if (text) return { description: text, provider: 'claude' };
        }
      } catch (e) {
        this.logger.warn('Claude vision: ' + (e as Error).message);
      }
    }
    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    if (openaiKey && openaiKey !== 'replace_me') {
      try {
        const model =
          this.config.get<string>('OPENAI_VISION_MODEL') || 'gpt-4o-mini';
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + openaiKey,
          },
          body: JSON.stringify({
            model,
            max_tokens: 1200,
            temperature: 0.4,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: userPrompt },
                  {
                    type: 'image_url',
                    image_url: { url: 'data:' + mime + ';base64,' + b64 },
                  },
                ],
              },
            ],
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data?.choices?.[0]?.message?.content?.trim();
          if (text) return { description: text, provider: 'openai' };
        }
      } catch (e) {
        this.logger.warn('OpenAI vision: ' + (e as Error).message);
      }
    }
    throw new Error('Aucun fournisseur vision disponible');
  }

  async generateVisualImage(opts: {
    prompt: string;
    style?: string;
    size?: string;
    provider?: string;
  }) {
    const prompt = opts.prompt?.trim();
    if (!prompt || prompt.length < 3) throw new Error('Prompt requis');
    const provider = opts.provider || 'openai';
    if (provider === 'openai') {
      const key = this.config.get<string>('OPENAI_API_KEY');
      if (!key || key === 'replace_me')
        throw new Error('OPENAI_API_KEY non configuree');
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + key,
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: prompt.slice(0, 4000),
          n: 1,
          size: opts.size || '1024x1024',
          quality: 'standard',
          response_format: 'b64_json',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || 'DALL-E error');
      }
      const data = await res.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (!b64) throw new Error('Pas d image generee');
      return {
        imageBase64: b64,
        format: 'png',
        provider: 'openai',
        revisedPrompt: data?.data?.[0]?.revised_prompt,
      };
    }
    if (provider === 'stability') {
      const key = this.config.get<string>('STABILITY_API_KEY');
      if (!key || key === 'replace_me')
        throw new Error('STABILITY_API_KEY non configuree');
      const fd = new FormData();
      fd.append('prompt', prompt.slice(0, 10000));
      fd.append('output_format', 'png');
      const res = await fetch(
        'https://api.stability.ai/v2beta/stable-image/generate/core',
        {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + key },
          body: fd,
        },
      );
      if (!res.ok) throw new Error('Stability HTTP ' + res.status);
      const buffer = Buffer.from(await res.arrayBuffer());
      return {
        imageBase64: buffer.toString('base64'),
        format: 'png',
        provider: 'stability',
      };
    }
    throw new Error('Provider inconnu: ' + provider);
  }

  async segmentVision(opts: {
    imageBase64: string;
    mimeType?: string;
    instruction?: string;
  }) {
    const mimeFallback = opts.mimeType || 'image/jpeg';
    const { b64, mime } = this.stripDataUrl(opts.imageBase64, mimeFallback);
    if (b64.length < 80) throw new Error('Image trop petite');
    if (b64.length > 6_200_000) throw new Error('Image trop volumineuse');
    const instruction =
      opts.instruction ||
      'Identifie les zones distinctes (textes, schemas, images, tableaux) dans cette slide.';
    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!openaiKey || openaiKey === 'replace_me')
      throw new Error('OPENAI_API_KEY requis');
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + openaiKey,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1500,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: instruction },
              {
                type: 'image_url',
                image_url: {
                  url: 'data:' + mime + ';base64,' + b64,
                  detail: 'high',
                },
              },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error('Segmentation HTTP ' + res.status);
    const data = await res.json();
    return {
      segments: data?.choices?.[0]?.message?.content?.trim() || '',
      provider: 'openai',
    };
  }
}
