import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ForumService } from './forum.service';

type QueryResult = { data?: unknown; error?: { message: string } | null };

function chain(result: QueryResult) {
  const q: any = {
    select: jest.fn(() => q),
    eq: jest.fn(() => q),
    neq: jest.fn(() => q),
    or: jest.fn(() => q),
    order: jest.fn(() => q),
    range: jest.fn(() => q),
    limit: jest.fn(() => q),
    insert: jest.fn(() => q),
    delete: jest.fn(() => q),
    update: jest.fn(() => q),
    // thenable: permet d'écrire `const { data } = await from(...).select().eq().order()`
    then: (resolve: (v: QueryResult) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
    // méthodes terminales explicites
    single: jest.fn(async () => result),
    maybeSingle: jest.fn(async () => result),
  };
  return q;
}

function makeService(from: jest.Mock) {
  return new ForumService({ client: { from } } as never);
}

const TENANT: any = { id: 'tenant-1', slug: 't1', plan: 'free', status: 'active' };

describe('ForumService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('listCategories', () => {
    it('returns categories for a tenant', async () => {
      const cats = [{ id: 'cat-1', name: 'Général', slug: 'general' }];
      const q = chain({ data: cats });
      const from = jest.fn().mockReturnValue(q);

      const result = await makeService(from).listCategories('tenant-1');

      expect(from).toHaveBeenCalledWith('forum_categories');
      expect(result).toEqual(cats);
    });

    it('returns [] if no data', async () => {
      const q = chain({ data: null });
      const from = jest.fn().mockReturnValue(q);
      const result = await makeService(from).listCategories('tenant-1');
      expect(result).toEqual([]);
    });
  });

  describe('listTopics', () => {
    it('returns topics with pagination', async () => {
      const topics = [{ id: 'topic-1', title: 'Hello World' }];
      const q = chain({ data: topics });
      const from = jest.fn().mockReturnValue(q);

      const result = await makeService(from).listTopics('tenant-1', undefined, 1);
      expect(result).toEqual(topics);
    });

    it('filters by category when provided', async () => {
      const q = chain({ data: [] });
      const from = jest.fn().mockReturnValue(q);

      await makeService(from).listTopics('tenant-1', 'support', 1);

      // eq called at least twice: tenant_id + category
      const eqCalls = q.eq.mock.calls;
      expect(eqCalls.some((c: any[]) => c[0] === 'category' && c[1] === 'support')).toBe(true);
    });
  });

  describe('getTopic', () => {
    it('returns topic when found', async () => {
      const topic = { id: 'topic-1', title: 'Test', tenant_id: 'tenant-1' };
      const q = chain({ data: topic, error: null });
      const from = jest.fn().mockReturnValue(q);

      const result = await makeService(from).getTopic('tenant-1', 'topic-1');
      expect(result).toEqual(topic);
    });

    it('throws NotFoundException when topic not found', async () => {
      const q = chain({ data: null, error: { message: 'not found' } });
      const from = jest.fn().mockReturnValue(q);

      await expect(makeService(from).getTopic('tenant-1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('createTopic', () => {
    it('creates a topic and returns it', async () => {
      const created = { id: 'topic-new', title: 'New Topic', content: 'Body', category: 'general' };
      const q = chain({ data: created, error: null });
      const from = jest.fn().mockReturnValue(q);

      const result = await makeService(from).createTopic(TENANT, 'user-1', {
        title: 'New Topic',
        content: 'Body',
        category: 'general',
      });

      expect(from).toHaveBeenCalledWith('forum_topics');
      expect(result).toEqual(created);
    });

    it('throws BadRequestException on DB error', async () => {
      const q = chain({ data: null, error: { message: 'db error' } });
      const from = jest.fn().mockReturnValue(q);

      await expect(
        makeService(from).createTopic(TENANT, 'user-1', { title: 'T', content: 'C' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('createPost', () => {
    it('creates a reply and returns it', async () => {
      const post = { id: 'post-1', content: 'Reply content', topic_id: 'topic-1' };
      const q = chain({ data: post, error: null });
      const from = jest.fn().mockReturnValue(q);

      const result = await makeService(from).createPost(TENANT, 'topic-1', 'user-1', { content: 'Reply content' });

      expect(from).toHaveBeenCalledWith('forum_posts');
      expect(result).toEqual(post);
    });
  });

  describe('deleteTopic', () => {
    it('deletes a topic without error', async () => {
      const q = chain({ error: null });
      const from = jest.fn().mockReturnValue(q);

      await expect(makeService(from).deleteTopic('tenant-1', 'topic-1')).resolves.toBeUndefined();
    });

    it('throws BadRequestException on DB error', async () => {
      const q = chain({ error: { message: 'cannot delete' } });
      const from = jest.fn().mockReturnValue(q);

      await expect(makeService(from).deleteTopic('tenant-1', 'topic-1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('searchTopics', () => {
    it('returns matching topics', async () => {
      const topics = [{ id: 'topic-1', title: 'How to use Zoom?' }];
      const q = chain({ data: topics });
      const from = jest.fn().mockReturnValue(q);

      const result = await makeService(from).searchTopics('tenant-1', 'zoom');
      expect(result).toEqual(topics);
    });
  });
});
