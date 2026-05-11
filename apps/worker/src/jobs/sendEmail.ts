import { inngest } from '../inngest';

export type SendEmailPayload = {
  to: string;
  subject: string;
  body: string;
};

export const sendEmailJob = inngest.createFunction(
  { id: 'send-email', name: 'Send Email' },
  { event: 'email/send' },
  async ({ event }: { event: { data: SendEmailPayload } }) => {
    const { to, subject, body } = event.data;
    // TODO: implement email sending (Resend, SendGrid, etc.)
    void to; void subject; void body;
  },
);
