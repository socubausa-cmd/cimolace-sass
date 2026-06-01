import { inngest } from '../inngest';

export type SendEmailPayload = {
  to: string;
  subject: string;
  body: string;
  html?: string;
};

export const sendEmailJob = inngest.createFunction(
  { id: 'send-email', name: 'Send Email via Resend' },
  { event: 'email/send' },
  async ({ event, step }: { event: { data: SendEmailPayload }; step: any }) => {
    const { to, subject, body, html } = event.data;
    const apiKey = process.env.RESEND_API_KEY ?? '';

    if (!apiKey || apiKey === 'replace_me') {
      return { success: false, reason: 'RESEND_API_KEY not configured' };
    }

    const result = await step.run('send-via-resend', async () => {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.RESEND_FROM ?? 'noreply@cimolace.com',
          to: [to],
          subject,
          ...(html ? { html } : { text: body }),
        }),
      });
      return { ok: response.ok, status: response.status };
    });

    return { success: result.ok, to, subject };
  },
);
