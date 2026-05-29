/**
 * AI Router — dispatches tasks to the right LLM provider.
 * All AI calls in the LIRI system go through this router.
 */
import type { AITaskType, AIProvider, AIJob } from '@/engines/types';

type RouterConfig = {
  defaultProvider: AIProvider;
  endpoints: Partial<Record<AIProvider, string>>;
};

type RoutePayload = {
  taskType: AITaskType;
  payload: unknown;
  provider?: AIProvider;
  onProgress?: (progress: number) => void;
};

// Task → provider routing table
const TASK_PROVIDER_MAP: Partial<Record<AITaskType, AIProvider>> = {
  build_course_blueprint: 'anthropic',
  generate_mindmap: 'anthropic',
  generate_master_script: 'anthropic',
  coach_slide: 'anthropic',
  architect_redesign: 'anthropic',
  detect_event_type: 'openai',
  suggest_shape_variants: 'openai',
  auto_text_design: 'openai',
  generate_visual_prompt: 'openai',
  analyze_slide_quality: 'liri-local',
  generate_progression: 'anthropic',
  suggest_analogies: 'anthropic',
};

// Task → system prompt builders
const SYSTEM_PROMPTS: Partial<Record<AITaskType, string>> = {
  build_course_blueprint: `Tu es LIRI, un architecte pedagogique expert. Tu construis des parcours de cours clairs, structures et adaptes au niveau de l'apprenant.`,
  generate_mindmap: `Tu es LIRI. Tu generes des mindmaps pedagogiques en JSON avec une structure racine -> branches -> feuilles.`,
  generate_master_script: `Tu es LIRI. Tu generes des scripts professeur complets : introduction, points cles, transitions, conclusion, notes prof.`,
  coach_slide: `Tu es LIRI Coach, un expert en design pedagogique de slides. Tu evalues la clarte, la densite, la lisibilite et l'alignement avec l'objectif pedagogique.`,
  architect_redesign: `Tu es LIRI Architect. Tu proposes des corrections concretes de layout, typographie et visuels pour ameliorer un slide.`,
  suggest_shape_variants: `Tu es LIRI. Tu suggeres 5 variantes de formes visuelles coherentes avec le contenu pedagogique.`,
  generate_progression: `Tu es LIRI. Tu definit l'ordre de revelation progressif des elements d'un slide pour une presentation dynamique.`,
  suggest_analogies: `Tu es LIRI. Tu proposes des analogies simples et memorables pour expliquer un concept complexe.`,
};

class AIRouter {
  private config: RouterConfig;

  constructor(config: RouterConfig) {
    this.config = config;
  }

  resolveProvider(taskType: AITaskType, override?: AIProvider): AIProvider {
    return override ?? TASK_PROVIDER_MAP[taskType] ?? this.config.defaultProvider;
  }

  buildSystemPrompt(taskType: AITaskType): string {
    return SYSTEM_PROMPTS[taskType] ?? 'Tu es LIRI, un assistant pedagogique intelligent.';
  }

  async route<T = unknown>({ taskType, payload, provider, onProgress }: RoutePayload): Promise<T> {
    const resolvedProvider = this.resolveProvider(taskType, provider);
    const systemPrompt = this.buildSystemPrompt(taskType);

    onProgress?.(10);

    try {
      switch (resolvedProvider) {
        case 'liri-local':
          return await this._routeLocal(taskType, payload, onProgress) as T;
        case 'anthropic':
          return await this._routeAnthropic(systemPrompt, payload, onProgress) as T;
        case 'openai':
        default:
          return await this._routeOpenAI(systemPrompt, payload, onProgress) as T;
      }
    } catch (err) {
      console.error(`[AIRouter] Task "${taskType}" via "${resolvedProvider}" failed:`, err);
      throw err;
    }
  }

  private async _routeLocal(taskType: AITaskType, payload: unknown, onProgress?: (n: number) => void): Promise<unknown> {
    // Local analysis — no network call needed
    onProgress?.(50);
    // Delegate to quality engine for slide analysis
    if (taskType === 'analyze_slide_quality') {
      const { computeSlideQuality } = await import('@/engines/quality-engine');
      const result = computeSlideQuality(payload as Parameters<typeof computeSlideQuality>[0]);
      onProgress?.(100);
      return result;
    }
    onProgress?.(100);
    return null;
  }

  private async _routeAnthropic(systemPrompt: string, payload: unknown, onProgress?: (n: number) => void): Promise<unknown> {
    const endpoint = this.config.endpoints.anthropic ?? '/api/liri/anthropic';
    onProgress?.(30);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt, payload }),
    });
    onProgress?.(80);
    if (!res.ok) throw new Error(`Anthropic endpoint error: ${res.status}`);
    const data = await res.json();
    onProgress?.(100);
    return data;
  }

  private async _routeOpenAI(systemPrompt: string, payload: unknown, onProgress?: (n: number) => void): Promise<unknown> {
    const endpoint = this.config.endpoints.openai ?? '/api/liri/openai';
    onProgress?.(30);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt, payload }),
    });
    onProgress?.(80);
    if (!res.ok) throw new Error(`OpenAI endpoint error: ${res.status}`);
    const data = await res.json();
    onProgress?.(100);
    return data;
  }
}

// Singleton
export const aiRouter = new AIRouter({
  defaultProvider: 'anthropic',
  endpoints: {
    anthropic: '/api/liri/anthropic',
    openai: '/api/liri/openai',
  },
});

export type { RoutePayload };
