import { inngest } from '../inngest';

export type GenerateAiContentPayload = {
  prompt: string;
  tenantId: string;
};

export const generateAiContentJob = inngest.createFunction(
  { id: 'generate-ai-content', name: 'Generate AI Content' },
  { event: 'ai/generate-content' },
  async ({ event }: { event: { data: GenerateAiContentPayload } }) => {
    const { prompt, tenantId } = event.data;
    // TODO: implement AI content generation (Claude, OpenAI, etc.)
    void prompt; void tenantId;
  },
);
