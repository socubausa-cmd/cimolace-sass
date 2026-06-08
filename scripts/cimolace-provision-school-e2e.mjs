import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const OUT_DIR = '/private/tmp/cimolace-provision-school-e2e';
const EMAIL = 'cimolace-admin@prorascience.local';
const PASSWORD = 'CimolaceDev2026';

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[match[1]] = value;
  }
  return out;
}

const env = {
  ...loadEnv(path.join(ROOT, 'apps/app/.env')),
  ...loadEnv(path.join(ROOT, 'apps/app/.env.local')),
  ...loadEnv(path.join(ROOT, 'apps/api/.env')),
};

const API = env.VITE_API_URL || env.VITE_API_V2_URL || 'http://localhost:4002';
const args = new Set(process.argv.slice(2));
const archiveAfterRun = !args.has('--keep');

async function apiFetch(pathname, token, init = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${init.method || 'GET'} ${pathname} -> ${res.status}: ${text}`);
  }
  return body?.data ?? body;
}

function timestampSlug() {
  return new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) throw new Error('No Cimolace admin access token');

  const suffix = timestampSlug();
  const slug = `ecole-recette-cimolace-${suffix}`;
  const payload = {
    name: 'École Recette Cimolace',
    slug,
    owner_email: `owner-${slug}@example.test`,
    business_name: 'École Recette Cimolace SARL',
    domain: `${slug}.prorascience.org`,
    plan: 'school',
    logo_url: `https://${slug}.prorascience.org/logos/isna-logo.png`,
    favicon_url: `https://${slug}.prorascience.org/favicons/isna-favicon.ico`,
    contact_email: `contact-${slug}@example.test`,
    brand_colors: {
      primary: '#0b1115',
      secondary: '#162331',
      accent: '#d4af37',
    },
    font_family: 'Inter, system-ui, sans-serif',
    radius: '12px',
    branding_zones: {
      header: true,
      footer: true,
      publicVitrine: true,
      memberApp: true,
      liveStudio: true,
      adminBackoffice: true,
    },
    reason: 'Recette E2E provisioning école Cimolace depuis modèle ISNA Prorascience',
  };

  const serviceSupabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let provisioned = null;
  let report = null;

  try {
    const preview = await apiFetch('/cimolace-backoffice/provision-school/preview', token, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const blockingWarning = preview?.warnings?.find((warning) =>
      String(warning).toLowerCase().includes('déjà pris'),
    );
    if (blockingWarning) throw new Error(blockingWarning);

    provisioned = await apiFetch('/cimolace-backoffice/provision-school', token, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const clientId = provisioned?.client?.id;
    if (!clientId) throw new Error('Provisioning did not return a client id');

    const [controlPlane, provisionings] = await Promise.all([
      apiFetch(`/cimolace-backoffice/clients/${clientId}/control-plane`, token),
      apiFetch('/cimolace-backoffice/provision-school', token),
    ]);
    const { count: tenantServicesCount, error: tenantServicesError } = await serviceSupabase
      .from('tenant_services')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', provisioned.tenant.id);
    if (tenantServicesError) throw tenantServicesError;

    report = {
      payload,
      preview: {
        warnings: preview?.warnings ?? [],
        engines: preview?.plan?.engines ?? null,
        owner: preview?.plan?.owner ?? null,
        branding: preview?.plan?.tenant
          ? {
              design: preview.plan.tenant.design,
              zones: preview.plan.tenant.zones,
              brand_colors: preview.plan.tenant.brand_colors,
            }
          : null,
      },
      provisioned: {
        tenant: provisioned.tenant,
        client: provisioned.client,
        site: provisioned.site,
        servicesCount: provisioned.services?.length ?? 0,
        owner: provisioned.owner,
        provisioning: provisioned.provisioning,
      },
      verified: {
        controlPlaneClientId: controlPlane?.client?.id,
        servicesCount: controlPlane?.services?.length ?? 0,
        tenantServicesCount,
        latestProvisioning: provisionings?.find((row) => row.new_tenant_slug === slug) ?? null,
      },
      cleanup: {
        requested: archiveAfterRun,
        archived: false,
      },
    };
  } finally {
    if (archiveAfterRun && provisioned?.client?.id && provisioned?.site?.id && provisioned?.tenant?.id) {
      const cleanup = await archiveProvisionedTenant(serviceSupabase, provisioned);
      report = {
        ...(report ?? { payload, provisioned }),
        cleanup,
      };
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

async function archiveProvisionedTenant(serviceSupabase, provisioned) {
  const now = new Date().toISOString();
  const metadataPatch = {
    archivedBy: 'cimolace-provision-school-e2e',
    archivedAt: now,
    archiveReason: 'E2E provisioning completed',
  };

  const siteResult = await serviceSupabase
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

  const tenantResult = await serviceSupabase
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

  const clientResult = await serviceSupabase
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

  return {
    requested: true,
    archived: true,
    archivedAt: now,
    tenantId: provisioned.tenant.id,
    clientId: provisioned.client.id,
    siteId: provisioned.site.id,
    keepHint: 'Relancer avec --keep pour garder le tenant actif après recette.',
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
