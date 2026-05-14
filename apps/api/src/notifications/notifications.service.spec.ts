import { NotificationsService } from './notifications.service';

// Intercept fetch globalement
const mockFetch = jest.fn();
global.fetch = mockFetch;

type QueryResult = { data?: unknown; error?: { message: string } | null };

function chain(result: QueryResult) {
  const q: any = {
    select: jest.fn(() => q),
    eq: jest.fn(() => q),
    order: jest.fn(() => q),
    limit: jest.fn(() => q),
    insert: jest.fn(() => q),
    update: jest.fn(() => q),
    upsert: jest.fn(() => q),
    // thenable pour les appels sans .single()
    then: (resolve: (v: QueryResult) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
    single: jest.fn(async () => result),
    maybeSingle: jest.fn(async () => result),
  };
  return q;
}

function makeService(from: jest.Mock, resendKey = '') {
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        RESEND_API_KEY: resendKey,
        TWILIO_ACCOUNT_SID: 'replace_me',
        TWILIO_AUTH_TOKEN: 'replace_me',
      };
      return values[key] ?? '';
    }),
  };
  return new NotificationsService({ client: { from } } as never, config as never);
}

describe('NotificationsService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('send — in_app channel', () => {
    it('inserts notification in DB for in_app channel', async () => {
      const notif = { id: 'notif-1', title: 'Bienvenue', body: 'Hello' };
      const q = chain({ data: notif, error: null });
      const from = jest.fn().mockReturnValue(q);

      const result = await makeService(from).send('tenant-1', {
        userId: 'user-1',
        title: 'Bienvenue',
        body: 'Hello',
        channels: ['in_app'],
      });

      expect(from).toHaveBeenCalledWith('notifications');
      expect(result).toHaveProperty('in_app');
    });
  });

  describe('send — email channel disabled', () => {
    it('skips email when RESEND_API_KEY is empty', async () => {
      const q = chain({ data: null, error: null });
      const from = jest.fn().mockReturnValue(q);

      const result = await makeService(from, '').send('tenant-1', {
        userId: 'user-1@example.com',
        title: 'Test',
        body: 'Body',
        channels: ['email'],
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.email).toBeUndefined();
    });

    it('calls Resend API when key is configured', async () => {
      const q = chain({ data: null, error: null });
      const from = jest.fn().mockReturnValue(q);
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await makeService(from, 're_real_key').send('tenant-1', {
        userId: 'user@example.com',
        title: 'Welcome',
        body: 'Hello!',
        channels: ['email'],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result.email).toBe('sent');
    });
  });

  describe('getUserNotifications', () => {
    it('returns notifications for a user', async () => {
      const notifs = [{ id: 'n1', title: 'Test', is_read: false }];
      const q = chain({ data: notifs });
      const from = jest.fn().mockReturnValue(q);

      const result = await makeService(from).getUserNotifications('tenant-1', 'user-1');
      expect(result).toEqual(notifs);
    });

    it('returns [] when no notifications', async () => {
      const q = chain({ data: null });
      const from = jest.fn().mockReturnValue(q);
      const result = await makeService(from).getUserNotifications('tenant-1', 'user-1');
      expect(result).toEqual([]);
    });
  });

  describe('markRead', () => {
    it('calls update on notifications table', async () => {
      const q = chain({ data: null, error: null });
      const from = jest.fn().mockReturnValue(q);

      await makeService(from).markRead('tenant-1', 'notif-1');
      expect(from).toHaveBeenCalledWith('notifications');
      expect(q.update).toHaveBeenCalledWith(
        expect.objectContaining({ is_read: true }),
      );
    });
  });

  describe('getPreferences', () => {
    it('returns stored preferences', async () => {
      const prefs = { email_notifications: true, sms_notifications: false, push_notifications: true, in_app_notifications: true };
      const q = chain({ data: prefs });
      const from = jest.fn().mockReturnValue(q);

      const result = await makeService(from).getPreferences('tenant-1', 'user-1');
      expect(result).toEqual(prefs);
    });

    it('returns defaults when no preferences stored', async () => {
      const q = chain({ data: null });
      const from = jest.fn().mockReturnValue(q);

      const result = await makeService(from).getPreferences('tenant-1', 'user-1');
      expect(result).toMatchObject({
        email_notifications: true,
        in_app_notifications: true,
      });
    });
  });

  describe('updatePreferences', () => {
    it('upserts preferences and returns them', async () => {
      const updated = { email_notifications: false, sms_notifications: true };
      const q = chain({ data: updated });
      const from = jest.fn().mockReturnValue(q);

      const result = await makeService(from).updatePreferences('tenant-1', 'user-1', {
        emailNotifications: false,
        smsNotifications: true,
      });

      expect(from).toHaveBeenCalledWith('notification_preferences');
      expect(q.upsert).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });
  });
});
