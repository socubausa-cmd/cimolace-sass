/**
 * CIMOLACE BACK-OFFICE - PROVISIONING ÉCOLE
 *
 * Crée un nouveau tenant école depuis le modèle ISNA Prorascience.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CimolaceHeader from '@/components/cimolace/Header';
import CimolaceSidebar from '@/components/cimolace/Sidebar';
import { cimolaceBackofficeApi } from '@/lib/api-v2';

const DEFAULT_FORM = {
  name: '',
  slug: '',
  owner_email: '',
  business_name: '',
  domain: '',
  plan: 'school',
  logo_url: '',
  favicon_url: '',
  contact_email: '',
  primary: '#0b1115',
  secondary: '#162331',
  accent: '#d4af37',
  font_family: 'Inter, system-ui, sans-serif',
  radius: '12px',
  zones: {
    header: true,
    footer: true,
    publicVitrine: true,
    memberApp: true,
    liveStudio: true,
    adminBackoffice: true,
  },
  reason: '',
};

const brandingZones = [
  { key: 'header', label: 'Header' },
  { key: 'footer', label: 'Footer' },
  { key: 'publicVitrine', label: 'Vitrine' },
  { key: 'memberApp', label: 'Espace membre' },
  { key: 'liveStudio', label: 'Live / Arena' },
  { key: 'adminBackoffice', label: 'Admin école' },
];

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 64);
}

function compactPayload(form) {
  const payload = {
    name: form.name.trim(),
    slug: form.slug.trim(),
    owner_email: form.owner_email.trim(),
    business_name: form.business_name.trim() || undefined,
    domain: form.domain.trim() || undefined,
    plan: form.plan,
    logo_url: form.logo_url.trim() || undefined,
    favicon_url: form.favicon_url.trim() || undefined,
    contact_email: form.contact_email.trim() || undefined,
    brand_colors: {
      primary: form.primary.trim(),
      secondary: form.secondary.trim(),
      accent: form.accent.trim(),
    },
    font_family: form.font_family.trim() || undefined,
    radius: form.radius.trim() || undefined,
    branding_zones: form.zones,
    reason: form.reason.trim() || undefined,
  };
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== ''),
  );
}

export default function CimolaceAdminSchoolProvisioning() {
  const navigate = useNavigate();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [confirmation, setConfirmation] = useState('');
  const [provisionings, setProvisionings] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyWarning, setHistoryWarning] = useState(null);

  const payload = useMemo(() => compactPayload(form), [form]);
  const canPreview = form.name.trim() && form.slug.trim() && form.owner_email.trim();
  const hasBlockingPreviewWarning = preview?.warnings?.some((warning) =>
    String(warning).toLowerCase().includes('déjà pris'),
  );
  const confirmationTarget = preview?.plan?.tenant?.slug ?? form.slug;
  const createConfirmed = confirmation.trim() === confirmationTarget;

  async function refreshProvisionings() {
    setHistoryLoading(true);
    try {
      const rows = await cimolaceBackofficeApi.listSchoolProvisionings();
      const nextRows = Array.isArray(rows) ? rows : [];
      const warnings = nextRows
        .map((row) => row?.__warning)
        .filter(Boolean);
      setHistoryWarning(warnings[0] ?? null);
      setProvisionings(nextRows.filter((row) => !row?.__warning && hasProvisioningIdentity(row)));
    } catch {
      setHistoryWarning("Historique provisioning école indisponible pour l'instant.");
      setProvisionings([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    refreshProvisionings();
  }, []);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
    setResult(null);
  }

  function updateZone(key, value) {
    setForm((current) => ({
      ...current,
      zones: { ...(current.zones || {}), [key]: value },
    }));
    setError(null);
    setResult(null);
  }

  function updateName(value) {
    setForm((current) => ({
      ...current,
      name: value,
      slug: current.slug ? current.slug : slugify(value),
    }));
    setError(null);
    setResult(null);
  }

  async function handlePreview(e) {
    e.preventDefault();
    setBusy('preview');
    setError(null);
    setResult(null);
    try {
      const data = await cimolaceBackofficeApi.previewProvisionSchool(payload);
      setPreview(data);
      setConfirmation('');
    } catch (err) {
      setPreview(null);
      setError(err.message || 'Prévisualisation impossible');
    } finally {
      setBusy(null);
    }
  }

  async function handleProvision() {
    if (!createConfirmed) {
      setError(`Confirme le slug "${confirmationTarget}" avant de créer le tenant.`);
      return;
    }
    setBusy('provision');
    setError(null);
    setResult(null);
    try {
      const data = await cimolaceBackofficeApi.provisionSchoolFromTemplate(payload);
      setResult(data);
      setPreview(null);
      await refreshProvisionings();
      if (data?.client?.id) {
        navigate(`/cimolace/admin/clients/${data.client.id}`);
      }
    } catch (err) {
      setError(err.message || 'Création du tenant école impossible');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', display: 'flex', flexDirection: 'column' }}>
      <CimolaceHeader />
      <div style={{ display: 'flex', flex: 1 }}>
        <CimolaceSidebar />
        <main style={{ padding: '20px', flex: 1, maxWidth: '1180px' }}>
          <div style={headerRowStyle}>
            <div>
              <p style={eyebrowStyle}>Modèle ISNA Prorascience</p>
              <h1 style={titleStyle}>Créer un tenant école</h1>
              <p style={subtitleStyle}>
                Prévisualise le tenant, le owner, le branding et les moteurs avant création dans Cimolace.
              </p>
            </div>
            <Link to="/cimolace/admin/clients" style={secondaryLinkStyle}>
              Voir les clients
            </Link>
          </div>

          <div style={gridStyle}>
            <form onSubmit={handlePreview} style={panelStyle}>
              <h2 style={panelTitleStyle}>Informations école</h2>
              {error ? <div style={errorStyle}>{error}</div> : null}

              <label style={labelStyle}>
                Nom école *
                <input
                  required
                  value={form.name}
                  onChange={(event) => updateName(event.target.value)}
                  placeholder="École Fatima"
                  style={inputStyle}
                />
              </label>

              <div style={twoColumnStyle}>
                <label style={labelStyle}>
                  Slug tenant *
                  <input
                    required
                    value={form.slug}
                    onChange={(event) => updateField('slug', slugify(event.target.value))}
                    placeholder="ecole-fatima"
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  Plan
                  <select value={form.plan} onChange={(event) => updateField('plan', event.target.value)} style={inputStyle}>
                    <option value="school">school</option>
                    <option value="starter">starter</option>
                    <option value="platform">platform</option>
                    <option value="enterprise">enterprise</option>
                  </select>
                </label>
              </div>

              <label style={labelStyle}>
                Email owner *
                <input
                  required
                  type="email"
                  value={form.owner_email}
                  onChange={(event) => updateField('owner_email', event.target.value)}
                  placeholder="admin@ecole.org"
                  style={inputStyle}
                />
              </label>

              <div style={twoColumnStyle}>
                <label style={labelStyle}>
                  Raison sociale
                  <input
                    value={form.business_name}
                    onChange={(event) => updateField('business_name', event.target.value)}
                    placeholder="École Fatima SARL"
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  Domaine
                  <input
                    value={form.domain}
                    onChange={(event) => updateField('domain', event.target.value)}
                    placeholder={`${form.slug || 'ecole'}.prorascience.org`}
                    style={inputStyle}
                  />
                </label>
              </div>

              <h2 style={panelTitleStyle}>Branding</h2>
              <div style={twoColumnStyle}>
                <label style={labelStyle}>
                  Logo URL
                  <input
                    value={form.logo_url}
                    onChange={(event) => updateField('logo_url', event.target.value)}
                    placeholder="/logos/isna-logo.png"
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  Favicon URL
                  <input
                    value={form.favicon_url}
                    onChange={(event) => updateField('favicon_url', event.target.value)}
                    placeholder="/favicons/isna-favicon.ico"
                    style={inputStyle}
                  />
                </label>
              </div>

              <label style={labelStyle}>
                Email public
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={(event) => updateField('contact_email', event.target.value)}
                  placeholder="contact@ecole.org"
                  style={inputStyle}
                />
              </label>

              <div style={threeColumnStyle}>
                <ColorField label="Primary" value={form.primary} onChange={(value) => updateField('primary', value)} />
                <ColorField label="Secondary" value={form.secondary} onChange={(value) => updateField('secondary', value)} />
                <ColorField label="Accent" value={form.accent} onChange={(value) => updateField('accent', value)} />
              </div>

              <div style={twoColumnStyle}>
                <label style={labelStyle}>
                  Police UI
                  <input
                    value={form.font_family}
                    onChange={(event) => updateField('font_family', event.target.value)}
                    placeholder="Inter, system-ui, sans-serif"
                    style={inputStyle}
                  />
                </label>
                <label style={labelStyle}>
                  Rayon UI
                  <input
                    value={form.radius}
                    onChange={(event) => updateField('radius', event.target.value)}
                    placeholder="12px"
                    style={inputStyle}
                  />
                </label>
              </div>

              <div style={subPanelStyle}>
                <h3 style={subTitleStyle}>Zones de marque du template</h3>
                <div style={zoneGridStyle}>
                  {brandingZones.map((zone) => (
                    <label key={zone.key} style={zoneToggleStyle}>
                      <span>{zone.label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(form.zones?.[zone.key])}
                        onChange={(event) => updateZone(zone.key, event.target.checked)}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <label style={labelStyle}>
                Note opérateur
                <textarea
                  value={form.reason}
                  onChange={(event) => updateField('reason', event.target.value)}
                  placeholder="Création depuis le modèle ISNA Prorascience"
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </label>

              <div style={actionRowStyle}>
                <button type="submit" disabled={!canPreview || busy === 'preview'} style={primaryButtonStyle(!canPreview || busy === 'preview')}>
                  {busy === 'preview' ? 'Prévisualisation...' : 'Prévisualiser'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm(DEFAULT_FORM);
                    setPreview(null);
                    setResult(null);
                    setError(null);
                    setConfirmation('');
                  }}
                  style={ghostButtonStyle}
                >
                  Réinitialiser
                </button>
              </div>
            </form>

            <section style={panelStyle}>
              <h2 style={panelTitleStyle}>Prévisualisation</h2>
              {!preview ? (
                <EmptyPreview />
              ) : (
                <PreviewPanel
                  preview={preview}
                  busy={busy}
                  confirmation={confirmation}
                  confirmationTarget={confirmationTarget}
                  setConfirmation={setConfirmation}
                  disabled={busy === 'provision' || hasBlockingPreviewWarning || !createConfirmed}
                  onProvision={handleProvision}
                />
              )}
              {result?.client?.id ? (
                <div style={successStyle}>
                  Tenant créé. Client Cimolace: {result.client.name}
                </div>
              ) : null}
            </section>
          </div>

          <section style={{ ...panelStyle, marginTop: '18px' }}>
            <div style={historyHeaderStyle}>
              <div>
                <h2 style={panelTitleStyle}>Écoles créées depuis le modèle</h2>
                <p style={historySubtitleStyle}>
                  Historique opérationnel des tenants école provisionnés depuis ISNA Prorascience.
                </p>
              </div>
              <button type="button" onClick={refreshProvisionings} style={ghostButtonStyle}>
                Actualiser
              </button>
            </div>
            <ProvisioningHistory rows={provisionings} loading={historyLoading} warning={historyWarning} />
          </section>
        </main>
      </div>
    </div>
  );
}

function ProvisioningHistory({ rows, loading, warning }) {
  if (loading) {
    return <div style={emptyStyle}>Chargement de l'historique...</div>;
  }
  if (warning) {
    return (
      <div style={emptyStyle}>
        <strong>Historique pas encore disponible.</strong>
        <span>{warning}</span>
      </div>
    );
  }
  if (!rows.length) {
    return (
      <div style={emptyStyle}>
        <strong>Aucune école provisionnée pour le moment.</strong>
        <span>Les créations validées apparaîtront ici avec leur owner, domaine et nombre de moteurs.</span>
      </div>
    );
  }

  return (
    <div style={historyTableWrapStyle}>
      <table style={historyTableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>École</th>
            <th style={thStyle}>Slug</th>
            <th style={thStyle}>Owner</th>
            <th style={thStyle}>Domaine</th>
            <th style={thStyle}>Moteurs</th>
            <th style={thStyle}>Créée le</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={provisioningRowKey(row, index)}>
              <td style={tdStyle}>{row.school_name ?? row.name ?? '-'}</td>
              <td style={tdStyle}>{row.new_tenant_slug ?? '-'}</td>
              <td style={tdStyle}>{row.owner_email ?? '-'}</td>
              <td style={tdStyle}>{row.domain ?? '-'}</td>
              <td style={tdStyle}>{row.engine_count ?? row.engines_activated?.length ?? '-'}</td>
              <td style={tdStyle}>{formatDate(row.provisioned_at ?? row.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function hasProvisioningIdentity(row) {
  return Boolean(row?.id || row?.new_tenant_id || row?.new_client_id || row?.new_tenant_slug);
}

function provisioningRowKey(row, index) {
  return [
    row.id,
    row.new_tenant_id,
    row.new_client_id,
    row.new_tenant_slug,
    row.owner_email,
    row.provisioned_at ?? row.created_at,
    index,
  ]
    .filter(Boolean)
    .join(':');
}

function formatDate(value) {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function ColorField({ label, value, onChange }) {
  return (
    <label style={labelStyle}>
      {label}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} style={swatchStyle} />
        <input value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle} />
      </div>
    </label>
  );
}

function EmptyPreview() {
  return (
    <div style={emptyStyle}>
      <strong>Prêt pour contrôle.</strong>
      <span>Remplis les champs requis puis lance une prévisualisation avant de créer le tenant.</span>
    </div>
  );
}

function PreviewPanel({
  preview,
  busy,
  confirmation,
  confirmationTarget,
  setConfirmation,
  disabled,
  onProvision,
}) {
  const plan = preview.plan ?? {};
  const tenant = plan.tenant ?? {};
  const owner = plan.owner ?? {};
  const engines = plan.engines ?? {};
  const warnings = preview.warnings ?? [];

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      {warnings.length ? (
        <div style={warningStyle}>
          {warnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </div>
      ) : (
        <div style={successStyle}>Aucun blocage détecté sur la prévisualisation.</div>
      )}

      <div style={summaryGridStyle}>
        <Metric label="Slug" value={tenant.slug ?? '-'} />
        <Metric label="Domaine" value={tenant.primary_domain ?? '-'} />
        <Metric label="Owner" value={owner.method ?? '-'} />
        <Metric label="Moteurs" value={`${engines.totalToActivate ?? 0}`} />
      </div>

      <section style={subPanelStyle}>
        <h3 style={subTitleStyle}>Charte appliquée au tenant</h3>
        <div style={summaryGridStyle}>
          <Metric label="Police" value={tenant.design?.fontFamily ?? '-'} />
          <Metric label="Rayon" value={tenant.design?.radius ?? '-'} />
          <Metric label="Zones actives" value={`${Object.values(tenant.zones ?? {}).filter(Boolean).length}/${Object.keys(tenant.zones ?? {}).length}`} />
          <Metric label="Accent" value={tenant.brand_colors?.accent ?? '-'} />
        </div>
      </section>

      <section style={subPanelStyle}>
        <h3 style={subTitleStyle}>Moteurs activés</h3>
        <div style={pillWrapStyle}>
          {(engines.recommended ?? []).map((engine) => (
            <span key={engine} style={pillStyle}>{engine}</span>
          ))}
        </div>
      </section>

      <section style={subPanelStyle}>
        <h3 style={subTitleStyle}>Étapes prévues</h3>
        <ol style={stepsStyle}>
          {(plan.provisioningSteps ?? []).map((step) => (
            <li key={step}>{step.replace(/^\d+\.\s*/, '')}</li>
          ))}
        </ol>
      </section>

      <label style={labelStyle}>
        Confirmer le slug avant création
        <input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder={confirmationTarget}
          style={inputStyle}
        />
      </label>

      <button type="button" disabled={disabled} onClick={onProvision} style={dangerButtonStyle(disabled)}>
        {busy === 'provision' ? 'Création en cours...' : 'Créer le tenant école'}
      </button>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div style={metricStyle}>
      <span style={metricLabelStyle}>{label}</span>
      <strong style={metricValueStyle}>{value}</strong>
    </div>
  );
}

const headerRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '16px',
  marginBottom: '20px',
  flexWrap: 'wrap',
};

const eyebrowStyle = {
  margin: '0 0 6px',
  color: '#2563eb',
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

const titleStyle = {
  margin: 0,
  color: '#111827',
  fontSize: '26px',
  lineHeight: 1.2,
};

const subtitleStyle = {
  margin: '8px 0 0',
  color: '#6b7280',
  fontSize: '14px',
  maxWidth: '620px',
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
  gap: '18px',
  alignItems: 'start',
};

const panelStyle = {
  backgroundColor: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '20px',
  display: 'grid',
  gap: '14px',
};

const subPanelStyle = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '14px',
};

const panelTitleStyle = {
  color: '#111827',
  fontSize: '16px',
  fontWeight: 700,
  margin: '4px 0',
};

const subTitleStyle = {
  color: '#111827',
  fontSize: '14px',
  fontWeight: 700,
  margin: '0 0 10px',
};

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  color: '#374151',
  fontSize: '13px',
  fontWeight: 600,
};

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 11px',
  borderRadius: '7px',
  border: '1px solid #d1d5db',
  backgroundColor: '#ffffff',
  color: '#111827',
  fontSize: '14px',
  outline: 'none',
};

const swatchStyle = {
  width: '42px',
  height: '38px',
  padding: '3px',
  borderRadius: '7px',
  border: '1px solid #d1d5db',
  backgroundColor: '#ffffff',
};

const twoColumnStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '12px',
};

const threeColumnStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: '12px',
};

const zoneGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '8px',
};

const zoneToggleStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  border: '1px solid #e5e7eb',
  borderRadius: '7px',
  backgroundColor: '#ffffff',
  padding: '9px 10px',
  color: '#374151',
  fontSize: '13px',
  fontWeight: 600,
};

const actionRowStyle = {
  display: 'flex',
  gap: '10px',
  alignItems: 'center',
  flexWrap: 'wrap',
};

const historyHeaderStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap',
};

const historySubtitleStyle = {
  margin: '4px 0 0',
  color: '#6b7280',
  fontSize: '13px',
};

const historyTableWrapStyle = {
  overflowX: 'auto',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
};

const historyTableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '13px',
};

const thStyle = {
  textAlign: 'left',
  color: '#374151',
  backgroundColor: '#f9fafb',
  borderBottom: '1px solid #e5e7eb',
  padding: '10px 12px',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  color: '#111827',
  borderBottom: '1px solid #f3f4f6',
  padding: '10px 12px',
  verticalAlign: 'top',
  overflowWrap: 'anywhere',
};

const secondaryLinkStyle = {
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  backgroundColor: '#ffffff',
  color: '#374151',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 700,
};

const primaryButtonStyle = (disabled) => ({
  padding: '10px 16px',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: disabled ? '#93c5fd' : '#2563eb',
  color: '#ffffff',
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
});

const dangerButtonStyle = (disabled) => ({
  padding: '11px 16px',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: disabled ? '#fca5a5' : '#dc2626',
  color: '#ffffff',
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
});

const ghostButtonStyle = {
  padding: '10px 16px',
  borderRadius: '8px',
  border: '1px solid #d1d5db',
  backgroundColor: '#ffffff',
  color: '#374151',
  fontWeight: 700,
  cursor: 'pointer',
};

const errorStyle = {
  color: '#991b1b',
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '13px',
};

const warningStyle = {
  color: '#92400e',
  backgroundColor: '#fffbeb',
  border: '1px solid #fde68a',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '13px',
  display: 'grid',
  gap: '6px',
};

const successStyle = {
  color: '#166534',
  backgroundColor: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '13px',
};

const emptyStyle = {
  minHeight: '180px',
  display: 'grid',
  alignContent: 'center',
  gap: '8px',
  color: '#6b7280',
  backgroundColor: '#f9fafb',
  border: '1px dashed #d1d5db',
  borderRadius: '8px',
  padding: '18px',
  fontSize: '14px',
};

const summaryGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '10px',
};

const metricStyle = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '12px',
  minWidth: 0,
};

const metricLabelStyle = {
  display: 'block',
  color: '#6b7280',
  fontSize: '12px',
  marginBottom: '4px',
};

const metricValueStyle = {
  display: 'block',
  color: '#111827',
  fontSize: '14px',
  overflowWrap: 'anywhere',
};

const pillWrapStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
};

const pillStyle = {
  display: 'inline-flex',
  borderRadius: '999px',
  backgroundColor: '#eef2ff',
  color: '#3730a3',
  padding: '5px 9px',
  fontSize: '12px',
  fontWeight: 700,
};

const stepsStyle = {
  margin: 0,
  paddingLeft: '18px',
  color: '#4b5563',
  fontSize: '13px',
  display: 'grid',
  gap: '6px',
};
