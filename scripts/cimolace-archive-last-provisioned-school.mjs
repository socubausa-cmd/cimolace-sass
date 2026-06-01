import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[match[1]] = value;
  }
  return out;
}

const root = process.cwd();
const env = {
  ...loadEnv(path.join(root, 'apps/app/.env')),
  ...loadEnv(path.join(root, 'apps/api/.env')),
};
const report = JSON.parse(
  fs.readFileSync('/private/tmp/cimolace-provision-school-e2e/report.json', 'utf8'),
);
const provisioned = report.provisioned;
const now = new Date().toISOString();
const metadataPatch = {
  archivedBy: 'cimolace-archive-last-provisioned-school',
  archivedAt: now,
  archiveReason: 'E2E PawaPay school checkout completed',
};
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const siteResult = await supabase
  .from('cimolace_sites')
  .update({
    status: 'archived',
    metadata: {
      ...(provisioned.site?.metadata ?? {}),
      ...metadataPatch,
      previousStatus: provisioned.site?.status ?? null,
    },
    updated_at: now,
  })
  .eq('id', provisioned.site.id);
if (siteResult.error) throw siteResult.error;

const tenantResult = await supabase
  .from('tenants')
  .update({
    status: 'archived',
    metadata: {
      ...(provisioned.tenant?.metadata ?? {}),
      ...metadataPatch,
      previousStatus: provisioned.tenant?.status ?? null,
    },
    updated_at: now,
  })
  .eq('id', provisioned.tenant.id);
if (tenantResult.error) throw tenantResult.error;

const clientResult = await supabase
  .from('cimolace_clients')
  .update({
    status: 'cancelled',
    metadata: {
      ...(provisioned.client?.metadata ?? {}),
      ...metadataPatch,
      previousStatus: provisioned.client?.status ?? null,
    },
    updated_at: now,
  })
  .eq('id', provisioned.client.id);
if (clientResult.error) throw clientResult.error;

console.log(
  JSON.stringify(
    {
      archived: true,
      archivedAt: now,
      tenantId: provisioned.tenant.id,
      clientId: provisioned.client.id,
      siteId: provisioned.site.id,
    },
    null,
    2,
  ),
);
