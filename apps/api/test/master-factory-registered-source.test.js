const test = require('node:test');
const assert = require('node:assert/strict');
const { CourseJobService } = require('../dist/masterclass-factory/course-job.service.js');
const { SourceAdaptersService } = require('../dist/masterclass-factory/source-adapters.service.js');

test('ingest déduplique une source persistée par tenant, type et empreinte', async () => {
  let inserted;
  const query = {
    upsert(row, options) { inserted = { row, options }; return query; },
    select() { return query; },
    single() { return Promise.resolve({ data: { id: 'source-1', ...inserted.row, created_at: '2026-07-29T00:00:00Z' } }); },
  };
  const service = new SourceAdaptersService({ client: { from: (table) => {
    assert.equal(table, 'master_factory_sources');
    return query;
  } } });
  const result = await service.ingest('tenant-1', 'user-1', {
    sourceType: 'texte',
    title: 'La transmission',
    contentText: 'Une idée devient une compétence lorsqu’elle est expliquée, mise en situation et transférée. '.repeat(4),
  });
  assert.equal(inserted.options.onConflict, 'tenant_id,source_type,content_hash');
  assert.equal(inserted.row.tenant_id, 'tenant-1');
  assert.match(inserted.row.content_hash, /^[a-f0-9]{64}$/);
  assert.equal(result.ready, true);
});

test('le worker de cours accepte une source texte persistée et conserve sa traçabilité', async () => {
  let inserted;
  const db = {
    from(table) {
      const query = {
        select() { return query; },
        eq() { return query; },
        in() { return query; },
        maybeSingle() {
          if (table === 'master_factory_sources') {
            return Promise.resolve({ data: { id: 'source-1', content_text: 'Contenu extrait '.repeat(30), status: 'ready' } });
          }
          return Promise.resolve({ data: null });
        },
        insert(row) { inserted = row; return query; },
        single() { return Promise.resolve({ data: { id: 'job-1', ...inserted }, error: null }); },
      };
      return query;
    },
  };
  const service = new CourseJobService({ client: db });
  const result = await service.requestAny('tenant-1', 'user-1', 'texte', 'source-1');
  assert.equal(result.job.source_type, 'texte');
  assert.equal(result.job.source_id, 'source-1');
  assert.equal(result.job.video_id, null);
  assert.equal(result.reused, false);
});
