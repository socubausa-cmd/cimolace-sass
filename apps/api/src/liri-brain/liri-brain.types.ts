// LIRI Brain — Types for multi-model AI conversations

export type LiriModel = 'deepseek-chat' | 'deepseek-reasoner' | 'claude-sonnet-4-20250514' | 'claude-opus-4-20250514' | 'gpt-4o' | 'gpt-4o-mini';

export type LiriMessageRole = 'user' | 'assistant' | 'system';

export type LiriMessage = {
  role: LiriMessageRole;
  content: string;
};

export type LiriConversation = {
  id: string;
  tenant_id: string;
  user_id: string;
  model: LiriModel;
  title: string;
  messages: LiriMessage[];
  created_at: string;
  updated_at: string;
};

export type LiriModelInfo = {
  key: LiriModel;
  name: string;
  provider: 'deepseek' | 'anthropic' | 'openai';
  description: string;
  maxTokens: number;
  streaming: boolean;
};

export const LIRI_MODELS: LiriModelInfo[] = [
  {
    key: 'deepseek-chat',
    name: 'DeepSeek V4',
    provider: 'deepseek',
    description: 'Modèle généraliste 1M tokens de contexte',
    maxTokens: 8192,
    streaming: true,
  },
  {
    key: 'deepseek-reasoner',
    name: 'DeepSeek Reasoner',
    provider: 'deepseek',
    description: 'Raisonnement profond',
    maxTokens: 8192,
    streaming: true,
  },
  {
    key: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    description: 'Équilibré, rapide et puissant',
    maxTokens: 4096,
    streaming: true,
  },
  {
    key: 'claude-opus-4-20250514',
    name: 'Claude Opus 4',
    provider: 'anthropic',
    description: 'Le plus puissant pour les tâches complexes',
    maxTokens: 4096,
    streaming: true,
  },
  {
    key: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Multimodal, rapide et polyvalent',
    maxTokens: 4096,
    streaming: true,
  },
  {
    key: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Léger et économique',
    maxTokens: 4096,
    streaming: true,
  },
];
