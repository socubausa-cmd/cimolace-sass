const test = require('node:test');
const assert = require('node:assert/strict');
const { StudioService } = require('../dist/studio/studio.service.js');

test('Studio workspace autorise la persistance du tableau versions', async () => {
  let updated = null;
  const row = { id: 'workspace-1', tenant_id: 'tenant-1' };
  const single = async () => ({ data: row, error: null });
  const select = () => ({ single });
  const secondEq = () => ({ select });
  const firstEq = () => ({ eq: secondEq });
  const update = (payload) => { updated = payload; return { eq: firstEq }; };
  const service = new StudioService({ client: { from: () => ({ update }) } });

  const versions = [{ version: 1, saved_at: '2026-07-29T00:00:00.000Z' }];
  await service.updateWorkspace('tenant-1', 'workspace-1', { versions, owner_id: 'interdit' });

  assert.deepEqual(updated, { versions });
});
