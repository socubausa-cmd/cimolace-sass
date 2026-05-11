import { inngest } from '../inngest';

export type ProcessVideoPayload = {
  inputUrl: string;
  outputPath: string;
};

export const processVideoJob = inngest.createFunction(
  { id: 'process-video', name: 'Process Video (FFmpeg)' },
  { event: 'video/process' },
  async ({ event }: { event: { data: ProcessVideoPayload } }) => {
    const { inputUrl, outputPath } = event.data;
    // TODO: implement FFmpeg processing
    void inputUrl; void outputPath;
  },
);
