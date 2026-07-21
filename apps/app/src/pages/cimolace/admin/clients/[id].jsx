import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { cimolaceBackofficeApi } from '@/lib/api-v2';
import { clientEngine, ClientStatus, ClientType } from '@/modules/cimolace';

const clientTypeOptions = Object.entries(ClientType).map(([k, v]) => ({
  label: k === 'OTHER' ? 'Autre' : k.charAt(0) + k.slice(1).toLowerCase(),
  value: v,
}));

const tabs = [
  { id: 'overview', label: 'Vue générale' },
  { id: 'school-model', label: 'Modèle école' },
  { id: 'diagnostic', label: 'Diagnostic' },
  { id: 'engines', label: 'Moteurs' },
  { id: 'data', label: 'Données tenant' },
  { id: 'api', label: 'API & secrets' },
  { id: 'billing', label: 'Facturation' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'history', label: 'Logs' },
];

const brandingZones = [
  { key: 'header', label: 'Header' },
  { key: 'footer', label: 'Footer' },
  { key: 'publicVitrine', label: 'Vitrine' },
  { key: 'memberApp', label: 'Espace membre' },
  { key: 'liveStudio', label: 'Live / Arena' },
  { key: 'adminBackoffice', label: 'Admin école' },
];

export default function CimolaceAdminClientDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [control, setControl] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [brandingForm, setBrandingForm] = useState(null);
  const [savingBranding, setSavingBranding] = useState(false);
  const [brandingError, setBrandingError] = useState(null);
  const [actionBusy, setActionBusy] = useState(null);
  const [actionError, setActionError] = useState(null);

  const client = control?.client ?? null;
  const sites = control?.sites ?? [];
  const summary = control?.summary ?? {};
  const schoolModel = control?.schoolModel ?? null;

  useEffect(() => {
    loadControlPlane();
  }, [id]);

  async function loadControlPlane() {
    try {
      setLoading(true);
      const [data, diagnosticData] = await Promise.all([
        cimolaceBackofficeApi.getClientControlPlane(id),
        cimolaceBackofficeApi.getClientDiagnostics(id),
      ]);
      setControl(data);
      setDiagnostics(diagnosticData);
      setEditForm(buildEditForm(data.client));
      setBrandingForm(buildBrandingForm(data));
    } catch (error) {
      console.error('Error loading tenant control plane:', error);
      setControl(null);
      setDiagnostics(null);
    } finally {
      setLoading(false);
    }
  }

  async function refreshDiagnostics() {
    try {
      setDiagnostics(await cimolaceBackofficeApi.getClientDiagnostics(id));
    } catch (error) {
      console.error('Error loading tenant diagnostics:', error);
    }
  }

  function buildEditForm(row) {
    return {
      name: row?.name || '',
      business_name: row?.business_name || '',
      email: row?.email || '',
      phone: row?.phone || '',
      country: row?.country || '',
      portal_slug: row?.portal_slug || '',
      client_type: row?.client_type || ClientType.SCHOOL,
      status: row?.status || ClientStatus.PROSPECT,
      internal_notes: row?.internal_notes || '',
    };
  }

  function buildBrandingForm(data) {
    const tenant = data?.tenants?.app?.[0] ?? {};
    const site = data?.sites?.[0] ?? {};
    const modelBranding = data?.schoolModel?.branding ?? {};
    const metadataBranding = modelBranding.metadata ?? tenant?.metadata?.branding ?? site?.metadata?.branding ?? {};
    const colors = modelBranding.branding_colors ?? modelBranding.brand_colors ?? tenant.brand_colors ?? {};
    const designSystem = metadataBranding.designSystem ?? {};
    return {
      name: metadataBranding.name || tenant.name || data?.client?.name || '',
      full_name: metadataBranding.fullName || metadataBranding.full_name || tenant.name || data?.client?.business_name || data?.client?.name || '',
      logo_url: modelBranding.logo_url || metadataBranding.logo || tenant.logo_url || '',
      favicon_url: metadataBranding.favicon || metadataBranding.favicon_url || '',
      primary_domain: modelBranding.primary_domain || metadataBranding.domain || tenant.primary_domain || site.domain || '',
      public_site_origin: metadataBranding.publicSiteOrigin || metadataBranding.public_site_origin || '',
      contact_email: metadataBranding.vitrineContactEmail || metadataBranding.contact_email || data?.client?.email || '',
      primary: colors.primary || '',
      secondary: colors.secondary || '',
      accent: colors.accent || '',
      background: colors.background || metadataBranding.backgroundColor || '',
      font_family: designSystem.fontFamily || designSystem.font_family || 'Inter, system-ui, sans-serif',
      radius: designSystem.radius || designSystem.borderRadius || designSystem.border_radius || '12px',
      zones: {
        header: true,
        footer: true,
        publicVitrine: true,
        memberApp: true,
        liveStudio: true,
        adminBackoffice: true,
        ...(metadataBranding.zones && typeof metadataBranding.zones === 'object' ? metadataBranding.zones : {}),
      },
      zones_json: JSON.stringify(metadataBranding.zones || {
        header: true,
        footer: true,
        publicVitrine: true,
        memberApp: true,
        liveStudio: true,
        adminBackoffice: true,
      }, null, 2),
    };
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (!editForm) return;
    setEditError(null);
    setSavingEdit(true);
    try {
      await clientEngine.updateClient(id, {
        name: editForm.name.trim(),
        business_name: editForm.business_name.trim() || null,
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || null,
        country: editForm.country.trim() || null,
        portal_slug: editForm.portal_slug.trim().toLowerCase() || null,
        client_type: editForm.client_type,
        status: editForm.status,
        internal_notes: editForm.internal_notes.trim() || null,
      });
      setEditing(false);
      await loadControlPlane();
    } catch (err) {
      setEditError(err.message || 'Mise à jour impossible');
    } finally {
      setSavingEdit(false);
    }
  }

  async function runControlAction(label, action) {
    setActionError(null);
    setActionBusy(label);
    try {
      const result = await action();
      if (result?.controlPlane) {
        setControl(result.controlPlane);
        setEditForm(buildEditForm(result.controlPlane.client));
        setBrandingForm(buildBrandingForm(result.controlPlane));
        await refreshDiagnostics();
      } else {
        await loadControlPlane();
      }
    } catch (err) {
      setActionError(err.message || 'Action impossible');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleSaveBranding(e) {
    e.preventDefault();
    if (!brandingForm) return;
    setBrandingError(null);
    setSavingBranding(true);
    try {
      let zones = {};
      if (brandingForm.zones_json.trim()) {
        zones = JSON.parse(brandingForm.zones_json);
      }
      const result = await cimolaceBackofficeApi.updateAppTenantBranding(id, {
        name: brandingForm.name.trim(),
        full_name: brandingForm.full_name.trim(),
        logo_url: brandingForm.logo_url.trim() || null,
        favicon_url: brandingForm.favicon_url.trim() || null,
        primary_domain: brandingForm.primary_domain.trim() || null,
        public_site_origin: brandingForm.public_site_origin.trim() || null,
        contact_email: brandingForm.contact_email.trim() || null,
        brand_colors: {
          primary: brandingForm.primary.trim() || null,
          secondary: brandingForm.secondary.trim() || null,
          accent: brandingForm.accent.trim() || null,
          background: brandingForm.background.trim() || null,
        },
        zones,
        design_system: {
          fontFamily: brandingForm.font_family.trim() || 'Inter, system-ui, sans-serif',
          radius: brandingForm.radius.trim() || '12px',
          zones: brandingForm.zones,
        },
        reason: 'Branding école mis à jour depuis le modèle tenant Cimolace',
      });
      if (result?.controlPlane) {
        setControl(result.controlPlane);
        setBrandingForm(buildBrandingForm(result.controlPlane));
      } else {
        await loadControlPlane();
      }
      await refreshDiagnostics();
    } catch (err) {
      setBrandingError(err.message || 'Mise à jour branding impossible');
    } finally {
      setSavingBranding(false);
    }
  }

  function setMaintenance(enabled) {
    return runControlAction(enabled ? 'maintenance-on' : 'maintenance-off', () =>
      cimolaceBackofficeApi.runTenantOperation(id, {
        maintenance: enabled,
        reason: enabled ? 'Maintenance déclenchée depuis Cimolace' : 'Retour opérationnel depuis Cimolace',
      }),
    );
  }

  function setClientStatus(status) {
    return runControlAction(`client-${status}`, () =>
      cimolaceBackofficeApi.runTenantOperation(id, {
        status,
        reason: `Statut client changé en ${status} depuis Cimolace`,
      }),
    );
  }

  function ensureOwnerMembership() {
    return runControlAction('owner-membership', () =>
      cimolaceBackofficeApi.runTenantOperation(id, {
        ensure_owner_membership: true,
        owner_email: control?.client?.email || undefined,
        reason: 'Préparation owner école depuis Cimolace',
      }),
    );
  }

  function recordReadinessCheck(key, label) {
    return runControlAction(`readiness-${key}`, () =>
      cimolaceBackofficeApi.runTenantOperation(id, {
        record_readiness_check: true,
        readiness_key: key,
        readiness_status: 'verified',
        readiness_note: `${label} vérifié depuis Cimolace`,
        readiness_evidence: {
          source: 'cimolace-client-detail',
          client_id: id,
          checked_at: new Date().toISOString(),
        },
        reason: `${label} vérifié depuis Cimolace`,
      }),
    );
  }

  function setServiceStatus(service, status) {
    return runControlAction(`service-${service.id}-${status}`, () =>
      cimolaceBackofficeApi.updateTenantService(id, service.id, {
        status,
        reason: `Moteur ${service.service_key} changé en ${status}`,
      }),
    );
  }

  /**
   * Marketplace tenant — toggle on/off du module 'twin' (Bio Digital Twin)
   * via /admin/tenants/:tenantId/services/twin/toggle. Cible le tenant
   * applicatif lié (appTenant), pas l'identifiant client Cimolace.
   */
  function toggleTwinService(active) {
    if (!appTenant?.id) return Promise.resolve();
    return runControlAction(`twin-toggle-${active ? 'on' : 'off'}`, () =>
      cimolaceBackofficeApi.toggleTenantService(appTenant.id, 'twin', active),
    );
  }

  /**
   * Active l'abonnement forfaitaire 150 €/mois (MEDOS + Mbolo) du tenant
   * applicatif : crée billing_subscriptions actif + arme le gating de la clé
   * (metadata.billing.api_gating). Cible appTenant.id (table `tenants`), pas
   * l'id client Cimolace.
   */
  function activateForfait() {
    if (!appTenant?.id) return Promise.resolve();
    return runControlAction('activate-forfait', () =>
      cimolaceBackofficeApi.activateTenantForfait(appTenant.id, 'zahir-forfait'),
    );
  }

  /**
   * Impersonation encadrée (§15) : « agir en tant que tenant » TRACÉ. Motif obligatoire,
   * session serveur bornée + journalisée, ouverture de l'espace tenant dans un NOUVEL onglet
   * (la session staff n'est pas touchée). L'onglet est ouvert DANS le geste (anti-popup-block).
   */
  async function startImpersonation() {
    if (!appTenant?.id) { window.alert("Ce client n'a pas de tenant applicatif à impersonater."); return; }
    const reason = window.prompt('Motif de l’impersonation (obligatoire, tracé, ≥ 5 caractères) :', '');
    if (reason == null) return; // annulé
    if (reason.trim().length < 5) { window.alert('Motif trop court (≥ 5 caractères).'); return; }
    const win = window.open('about:blank', '_blank');
    try {
      const res = await cimolaceBackofficeApi.startImpersonation(id, { reason: reason.trim(), durationMinutes: 30 });
      const ctx = {
        token: res.token, tenantSlug: res.tenantSlug, tenantName: res.tenantName ?? null,
        reason: res.reason, clientId: id, expiresAt: res.expiresAt, to: '/liri',
      };
      const hash = btoa(encodeURIComponent(JSON.stringify(ctx)));
      const url = `/impersonate#imp=${hash}`;
      if (win) win.location.href = url; else window.location.href = url; // popup bloqué → même onglet
    } catch (e) {
      if (win) win.close();
      window.alert(e?.response?.data?.error?.message || e?.message || 'Impersonation impossible.');
    }
  }

  function addCredentialReference(kind) {
    const presets = {
      supabase: {
        key_name: 'supabase_project_ref',
        key_type: 'infrastructure_ref',
        description: 'Projet Supabase utilisé par ISNA/Prorascience',
        reference: 'fwfupxvmwtxbtbjdeqvu',
      },
      google: {
        key_name: 'google_oauth_provider',
        key_type: 'oauth_provider',
        description: 'Provider Google Auth utilisé par le tenant',
        reference: 'google-oauth-provider',
      },
      live: {
        key_name: 'live_studio_provider',
        key_type: 'live_provider',
        description: 'Provider live/studio à raccorder au tenant',
        reference: 'pending-live-provider',
      },
    };
    return runControlAction(`credential-${kind}`, () =>
      cimolaceBackofficeApi.createCredentialReference(id, presets[kind]),
    );
  }

  function rotateCredential(credential) {
    return runControlAction(`rotate-${credential.id}`, () =>
      cimolaceBackofficeApi.rotateCredential(id, credential.id, {
        reason: `Rotation déclarée pour ${credential.key_name}`,
      }),
    );
  }

  function createOpsTicket() {
    return runControlAction('ticket', () =>
      cimolaceBackofficeApi.createTenantTicket(id, {
        subject: 'Audit tenant ISNA/Prorascience',
        description: 'Ticket créé depuis le control plane pour suivre les incohérences tenant, auth, moteurs et facturation.',
        category: 'tenant_audit',
        priority: 'high',
        assignee: 'Cimolace Ops',
      }),
    );
  }

  function createManualInvoice() {
    return runControlAction('invoice', () =>
      cimolaceBackofficeApi.createTenantInvoice(id, {
        invoice_number: `ISNA-MANUAL-${new Date().toISOString().slice(0, 10)}`,
        amount: 0,
        currency: 'XOF',
        type: 'manual',
        status: 'pending',
        metadata: { reason: 'Facture manuelle créée depuis le control plane' },
      }),
    );
  }

  function activateSchoolModelEngines() {
    return runControlAction('school-model-engines', () =>
      cimolaceBackofficeApi.activateSchoolModelEngines(id, {
        reason: 'Activation des moteurs recommandés du modèle école depuis Cimolace',
      }),
    );
  }

  function prepareSchoolModel() {
    return runControlAction('school-model-prepare', () =>
      cimolaceBackofficeApi.prepareSchoolModel(id, {
        reason: 'Préparation complète du tenant école modèle depuis Cimolace',
      }),
    );
  }

  function applySchoolModelQuotas() {
    return runControlAction('school-model-quotas', () =>
      cimolaceBackofficeApi.applySchoolModelQuotas(id, {
        reason: 'Application des quotas recommandés du modèle école depuis Cimolace',
      }),
    );
  }

  function prepareSchoolModelProviders() {
    return runControlAction('school-model-providers', () =>
      cimolaceBackofficeApi.prepareSchoolModelProviders(id, {
        reason: 'Préparation des références providers du modèle école depuis Cimolace',
      }),
    );
  }

  function syncSchoolModelProviders() {
    return runControlAction('school-model-providers-sync', () =>
      cimolaceBackofficeApi.prepareSchoolModelProviders(id, {
        include_configured: true,
        reason: 'Synchronisation complète des références providers du modèle école depuis Cimolace',
      }),
    );
  }

  const appTenant = control?.tenants?.app?.[0] ?? null;
  const missingSchoolQuotaCount = (schoolModel?.productEngines || []).filter(
    (engine) => engine.coverage?.checks?.quotas !== 'ready',
  ).length;
  const missingSchoolProviderCount = new Set(
    (schoolModel?.productEngines || []).flatMap((engine) =>
      (engine.coverage?.operations?.providers || [])
        .filter((provider) => !provider.configured)
        .map((provider) => provider.provider),
    ),
  ).size;
  const cimolaceTenant = control?.tenants?.cimolace?.[0] ?? null;
  const tenantOperations = appTenant?.metadata?.operations ?? summary.lastTenantOperation ?? null;
  const health = useMemo(() => buildHealth(control), [control]);
  const deliveryReadiness = useMemo(
    () => buildSchoolDeliveryReadiness(control, diagnostics),
    [control, diagnostics],
  );

  if (loading) {
    return <CenteredText>Chargement du tenant control plane...</CenteredText>;
  }

  if (!client) {
    return <CenteredText tone="error">Client non trouvé</CenteredText>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <button onClick={() => navigate('/cimolace/admin/clients')} className="mb-3 text-sm text-gray-500 hover:text-gray-700">
            Retour aux clients
          </button>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-950">{client.name}</h1>
                <StatusBadge status={client.status} />
                {appTenant ? <StatusPill status={appTenant.status} label={`Tenant ${appTenant.status || '-'}`} /> : null}
                {summary.maintenance ? <Badge tone="warning">Maintenance</Badge> : <Badge tone="success">Opérationnel</Badge>}
              </div>
              <p className="mt-1 text-sm text-gray-500">{client.business_name || client.email}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {client.portal_slug ? <span className="text-gray-600">Slug: <strong>{client.portal_slug}</strong></span> : null}
                {appTenant ? <span className="text-gray-600">Tenant app: <strong>{appTenant.slug}</strong></span> : null}
                {sites[0]?.domain ? <span className="text-gray-600">Domaine: <strong>{sites[0].domain}</strong></span> : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {client.portal_slug ? (
                <>
                  <Link to={`/cimolace/client/${encodeURIComponent(client.portal_slug)}`} className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Portail client
                  </Link>
                  <Link to={`/t/${encodeURIComponent(client.portal_slug)}/admin`} className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Admin métier
                  </Link>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setEditing((v) => !v);
                  setEditError(null);
                  setEditForm(buildEditForm(client));
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                {editing ? 'Annuler' : 'Modifier client'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard title="Sites" value={`${summary.activeSiteCount ?? 0}/${summary.siteCount ?? 0}`} helper="actifs / total" />
          <StatCard title="Moteurs" value={`${summary.activeEngineCount ?? 0}/${summary.engineCount ?? 0}`} helper="actifs / total" />
          <StatCard title="Secrets" value={summary.credentialCount ?? 0} helper="références configurées" />
          <StatCard title="Abonnements" value={summary.activeSubscriptionCount ?? 0} helper="actifs" />
          <StatCard title="Tickets" value={summary.openTicketCount ?? 0} helper="ouverts/en cours" tone={summary.openTicketCount ? 'warning' : 'default'} />
          <StatCard
            title="Tenant app"
            value={summary.appTenantStatus || appTenant?.status || 'manquant'}
            helper={tenantOperations?.updated_at ? `opéré ${formatDate(tenantOperations.updated_at)}` : 'statut applicatif'}
            tone={summary.appTenantStatus === 'maintenance' || summary.appTenantStatus === 'suspended' ? 'warning' : 'default'}
          />
        </section>

        {control?.warnings?.length ? (
          <section className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Incohérences détectées:</strong>
            <ul className="mt-2 list-disc pl-5">
              {control.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
            </ul>
          </section>
        ) : null}

        {actionError ? (
          <section className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {actionError}
          </section>
        ) : null}

        <section className="mb-6 rounded-lg border bg-white p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-950">Commandes opérateur</h2>
              <p className="text-sm text-gray-500">Actions Cimolace appliquées au tenant et journalisées dans l'historique.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton busy={actionBusy === 'maintenance-on'} onClick={() => setMaintenance(true)}>Maintenance ON</ActionButton>
              <ActionButton busy={actionBusy === 'maintenance-off'} onClick={() => setMaintenance(false)}>Maintenance OFF</ActionButton>
              <ActionButton busy={actionBusy === 'client-suspended'} onClick={() => setClientStatus('suspended')}>Suspendre</ActionButton>
              <ActionButton busy={actionBusy === 'client-active'} onClick={() => setClientStatus('active')}>Réactiver</ActionButton>
              <ActionButton busy={actionBusy === 'owner-membership'} onClick={ensureOwnerMembership}>Préparer owner</ActionButton>
              <ActionButton busy={actionBusy === 'ticket'} onClick={createOpsTicket}>Ticket audit</ActionButton>
              <ActionButton onClick={startImpersonation}>Impersonater (tracé)</ActionButton>
            </div>
          </div>
        </section>

        <div className="mb-6 overflow-x-auto rounded-lg border bg-white">
          <nav className="flex min-w-max gap-1 px-4" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`border-b-2 px-3 py-4 text-sm font-medium ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {editing && editForm ? (
          <EditClientForm
            editForm={editForm}
            setEditForm={setEditForm}
            editError={editError}
            savingEdit={savingEdit}
            onSubmit={handleSaveEdit}
          />
        ) : null}

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <Panel title="Identité tenant">
                <InfoGrid
                  rows={[
                    ['Client', client.name],
                    ['Raison sociale', client.business_name || '-'],
                    ['Email', client.email || '-'],
                    ['Type', client.client_type || '-'],
                    ['Source', client.source || '-'],
                    ['Responsable', client.commercial_responsible || '-'],
                    ['Créé le', formatDate(client.created_at)],
                    ['Mis à jour', formatDate(client.updated_at)],
                  ]}
                />
              </Panel>
              <Panel title="Tenants liés">
                <InfoGrid
                  rows={[
                    ['Supabase ref', 'fwfupxvmwtxbtbjdeqvu'],
                    ['Tenant app', appTenant ? `${appTenant.name} (${appTenant.slug})` : '-'],
                    ['Plan app', appTenant?.plan || '-'],
                    ['Statut app', appTenant?.status || '-'],
                    ['Infra', appTenant?.infrastructure_type || '-'],
                    ['Tenant Cimolace', cimolaceTenant ? cimolaceTenant.name : '-'],
                    ['ID app tenant', sites[0]?.app_tenant_id || '-'],
                    ['ID client', client.id],
                  ]}
                />
              </Panel>
              <Panel title="Santé opérationnelle">
                <HealthList items={health} />
              </Panel>
            </div>
            <Panel title="Dernière opération Cimolace">
              <InfoGrid
                rows={[
                  ['Statut tenant app', summary.appTenantStatus || appTenant?.status || '-'],
                  ['Statut Cimolace', tenantOperations?.cimolace_status || client.status || '-'],
                  ['Maintenance', tenantOperations?.maintenance ? 'oui' : 'non'],
                  ['Raison', tenantOperations?.reason || '-'],
                  ['Dernière mise à jour', formatDateTime(tenantOperations?.updated_at)],
                  ['Client Cimolace', tenantOperations?.cimolace_client_id || client.id],
                ]}
              />
            </Panel>
          </div>
        )}

        {activeTab === 'school-model' && (
          <div className="space-y-6">
            <Panel title="Infrastructure école modèle">
              {schoolModel ? (
                <div className="space-y-5">
                  <SchoolDeliveryReadinessPanel readiness={deliveryReadiness} />
                  <div className="flex flex-col gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950 md:flex-row md:items-center md:justify-between">
                    <div>
                      <strong>Préparation tenant modèle:</strong> applique le branding par défaut, synchronise le site et active les moteurs école recommandés.
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ActionButton busy={actionBusy === 'school-model-prepare'} onClick={prepareSchoolModel}>
                        Préparer tenant école
                      </ActionButton>
                      <ActionButton busy={actionBusy === 'school-model-quotas'} onClick={applySchoolModelQuotas}>
                        Appliquer quotas
                      </ActionButton>
                      <ActionButton busy={actionBusy === 'school-model-providers'} onClick={prepareSchoolModelProviders}>
                        Préparer providers
                      </ActionButton>
                      <ActionButton busy={actionBusy === 'school-model-providers-sync'} onClick={syncSchoolModelProviders}>
                        Synchroniser providers
                      </ActionButton>
                    </div>
                  </div>
                  {missingSchoolQuotaCount > 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                      {missingSchoolQuotaCount} moteur(s) n'ont pas encore de quota. Le bouton "Appliquer quotas" remplit les limites recommandées sans écraser les quotas déjà définis.
                    </div>
                  ) : null}
                  {missingSchoolProviderCount > 0 ? (
                    <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
                      {missingSchoolProviderCount} référence(s) provider restent à compléter. Le bouton "Préparer providers" crée les lignes credentials attendues dans Cimolace.
                    </div>
                  ) : (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                      Les providers requis sont détectés. "Synchroniser providers" permet de créer ou remettre à jour les références backoffice même quand les providers sont déjà configurés.
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <ModelStat
                      label="Base ISNA"
                      value={`${schoolModel.summary?.baseActiveCount ?? 0}/${schoolModel.summary?.baseCount ?? 0}`}
                      detail="moteurs actifs nécessaires au tenant actuel"
                    />
                    <ModelStat
                      label="Modèle clonable"
                      value={`${schoolModel.summary?.recommendedActiveCount ?? 0}/${schoolModel.summary?.recommendedCount ?? 0}`}
                      detail="moteurs recommandés pour une école complète"
                    />
                    <ModelStat
                      label="Capacités"
                      value={`${schoolModel.summary?.capabilityActiveCount ?? 0}/${schoolModel.summary?.capabilityCount ?? 0}`}
                      detail="domaines métier couverts"
                    />
                    <ModelStat
                      label="Branding"
                      value={`${schoolModel.summary?.brandingConfiguredCount ?? 0}/${schoolModel.summary?.brandingRequirementCount ?? 0}`}
                      detail="logo, domaine, couleurs et zones de marque"
                    />
                  </div>
                  {schoolModel.summary?.missingRecommendedEngines?.length ? (
                    <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 md:flex-row md:items-center md:justify-between">
                      <div>
                        <strong>À compléter avant clonage école:</strong>{' '}
                        {schoolModel.summary.missingRecommendedEngines.join(', ')}
                      </div>
                      <ActionButton busy={actionBusy === 'school-model-engines'} onClick={activateSchoolModelEngines}>
                        Activer modèle école
                      </ActionButton>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
                      Le modèle école recommandé est complet côté moteurs.
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Ce client n'est pas classé comme infrastructure école.</p>
              )}
            </Panel>

            {schoolModel ? (
              <>
                <Panel title="Moteurs produits du modèle école">
                  <DataTable
                    empty="Aucun moteur modèle."
                    columns={['Moteur', 'Pack', 'Couverture', 'Shell', 'Providers', 'Branding', 'Statut']}
                    rows={(schoolModel.productEngines || []).map((engine) => [
                      <div>
                        <strong>{engine.label || engine.key}</strong>
                        <div className="mt-1 text-xs text-gray-500">{engine.role || engine.key}</div>
                        {engine.routes?.length ? <div className="mt-1 text-xs text-gray-400">{engine.routes.slice(0, 2).join(' · ')}</div> : null}
                      </div>,
                      engine.requiredForBase ? 'Base ISNA' : 'Recommandé',
                      <EngineCoverageCell coverage={engine.coverage} />,
                      <div>
                        <div>{engine.shell?.layout || '-'}</div>
                        <div className="mt-1 text-xs text-gray-500">{engine.shell?.designSystem || '-'}</div>
                      </div>,
                      engine.requiredProviders?.length ? engine.requiredProviders.join(', ') : '-',
                      engine.brandingZones?.length ? engine.brandingZones.join(', ') : '-',
                      <div className="space-y-2">
                        <StatusPill status={engine.active ? 'active' : engine.status} label={engine.active ? 'actif' : engine.status === 'missing' ? 'manquant' : engine.status} />
                        {engine.readiness ? <div className="text-xs text-gray-500">{engine.readiness}: {engine.readinessNotes}</div> : null}
                        <div className="text-xs text-gray-400">Quota {formatQuota(engine.quota_used)} / {formatQuota(engine.quota_limit)}</div>
                      </div>,
                    ])}
                  />
                </Panel>

                <Panel title="Capacités métier école">
                  <DataTable
                    empty="Aucune capacité modèle."
                    columns={['Capacité', 'Catégorie', 'Couverture', 'Moteurs requis', 'Détail']}
                    rows={(schoolModel.capabilities || []).map((capability) => [
                      <strong>{capability.label}</strong>,
                      capability.category,
                      <StatusPill status={capability.status === 'active' ? 'active' : capability.status === 'partial' ? 'pending' : 'failed'} label={capability.status === 'active' ? 'couverte' : capability.status === 'partial' ? 'partielle' : 'manquante'} />,
                      capability.serviceKeys?.length ? capability.serviceKeys.join(', ') : 'noyau tenant',
                      capability.detail,
                    ])}
                  />
                </Panel>

                <Panel title="Branding configurable">
                  {brandingForm ? (
                    <TenantBrandingForm
                      form={brandingForm}
                      setForm={setBrandingForm}
                      error={brandingError}
                      saving={savingBranding}
                      onSubmit={handleSaveBranding}
                    />
                  ) : null}
                  <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <InfoGrid
                      rows={[
                        ['Logo', schoolModel.branding?.logo_url || '-'],
                        ['Domaine', schoolModel.branding?.primary_domain || '-'],
                        ['Couleur primaire', schoolModel.branding?.brand_colors?.primary || '-'],
                      ]}
                    />
                    <InfoGrid
                      rows={[
                        ['Couleur secondaire', schoolModel.branding?.brand_colors?.secondary || '-'],
                        ['Couleur accent', schoolModel.branding?.brand_colors?.accent || '-'],
                        ['Zones metadata', schoolModel.branding?.metadata ? 'configurées' : '-'],
                      ]}
                    />
                    <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-600">
                      Ce bloc vérifie si le tenant peut changer de logo, couleurs, domaine et zones de marque sans garder la charte ISNA codée en dur.
                    </div>
                  </div>
                  <DataTable
                    empty="Aucune exigence branding."
                    columns={['Élément', 'Statut', 'Valeur', 'Détail']}
                    rows={(schoolModel.brandingRequirements || []).map((item) => [
                      <strong>{item.label}</strong>,
                      <StatusPill status={item.configured ? 'active' : 'pending'} label={item.configured ? 'configuré' : 'à compléter'} />,
                      item.value || '-',
                      item.detail,
                    ])}
                  />
                </Panel>
              </>
            ) : null}
          </div>
        )}

        {activeTab === 'diagnostic' && (
          <Panel title="Diagnostic de cohérence">
            <div className="mb-5 space-y-4 border-b pb-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm text-gray-500">État tenant</div>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <div className="text-2xl font-bold text-gray-950">
                      {diagnostics?.readiness?.label || '-'}
                    </div>
                    {diagnostics ? (
                      <StatusPill
                        status={diagnostics.overall === 'pass' ? 'success' : diagnostics.overall === 'warn' ? 'pending' : 'failed'}
                        label={`${diagnostics.readiness?.percent ?? 0}% prêt`}
                      />
                    ) : null}
                  </div>
                  <div className="mt-1 text-sm text-gray-500">
                    {diagnostics ? `${diagnostics.score}/${diagnostics.maxScore} points · ${diagnostics.readiness?.blockingCount ?? 0} bloquant(s) · ${diagnostics.readiness?.warningCount ?? 0} à compléter` : 'Diagnostic non chargé'}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ActionButton busy={actionBusy === 'diagnostics'} onClick={() => runControlAction('diagnostics', async () => {
                    await refreshDiagnostics();
                    return null;
                  })}>
                    Recalculer
                  </ActionButton>
                </div>
              </div>
              <ReadinessSummary diagnostics={diagnostics} />
            </div>
            <ProviderStatusGrid providers={diagnostics?.providers} />
            <SchoolProviderMatrix
              providers={diagnostics?.schoolProviders || control.schoolProviders}
              actionBusy={actionBusy}
              onPrepare={prepareSchoolModelProviders}
              onSync={syncSchoolModelProviders}
              clientId={id}
            />
            <DiagnosticList
              diagnostics={diagnostics}
              actionBusy={actionBusy}
              onRecordReadiness={recordReadinessCheck}
            />
          </Panel>
        )}

        {activeTab === 'engines' && (
          <div className="space-y-6">
            <TwinModuleToggle
              appTenant={appTenant}
              services={control.services || []}
              actionBusy={actionBusy}
              onToggle={toggleTwinService}
            />
            <Panel title="Moteurs activés">
              <DataTable
                empty="Aucun moteur enregistré pour ce tenant."
                columns={['Moteur', 'Statut', 'Quota', 'Utilisation', 'Config', 'Activé le']}
                rows={(control.services || []).map((service) => [
                  <strong>{service.service_key}</strong>,
                  <StatusPill status={service.status} />,
                  formatQuota(service.quota_limit),
                  formatQuota(service.quota_used),
                  Object.keys(service.config || {}).length ? 'configuré' : 'par défaut',
                  <div className="space-y-2">
                    <div>{formatDate(service.activated_at || service.created_at)}</div>
                    <div className="flex flex-wrap gap-2">
                      <ActionButton compact busy={actionBusy === `service-${service.id}-active`} onClick={() => setServiceStatus(service, 'active')}>Activer</ActionButton>
                      <ActionButton compact busy={actionBusy === `service-${service.id}-suspended`} onClick={() => setServiceStatus(service, 'suspended')}>Couper</ActionButton>
                    </div>
                  </div>,
                ])}
              />
            </Panel>
          </div>
        )}

        {activeTab === 'data' && (
          <div className="space-y-6">
            <Panel title="Sites et environnements">
              <DataTable
                empty="Aucun site."
                columns={['Site', 'Domaine', 'Plan', 'Statut', 'Environnement', 'Tenant app']}
                rows={sites.map((site) => [
                  <strong>{site.name}</strong>,
                  site.domain || site.subdomain || '-',
                  site.plan || '-',
                  <StatusPill status={site.status} />,
                  site.environment || '-',
                  site.app_tenant_id || '-',
                ])}
              />
            </Panel>
            <Panel title="Usage récent">
              <DataTable
                empty="Aucun log d'usage."
                columns={['Service', 'Métrique', 'Quantité', 'Période', 'Date']}
                rows={(control.usageLogs || []).map((log) => [
                  log.service,
                  log.metric,
                  `${log.quantity ?? 0} ${log.unit || ''}`,
                  `${formatDate(log.period_start)} - ${formatDate(log.period_end)}`,
                  formatDate(log.created_at),
                ])}
              />
            </Panel>
          </div>
        )}

        {activeTab === 'api' && (
          <div className="space-y-6">
            <Panel title="Providers école">
              <SchoolProviderMatrix
                providers={control.schoolProviders}
                actionBusy={actionBusy}
                onPrepare={prepareSchoolModelProviders}
                onSync={syncSchoolModelProviders}
                clientId={id}
              />
            </Panel>
            <Panel title="Credentials et intégrations">
              <div className="mb-4 flex flex-wrap gap-2">
                <ActionButton busy={actionBusy === 'credential-supabase'} onClick={() => addCredentialReference('supabase')}>Réf. Supabase</ActionButton>
                <ActionButton busy={actionBusy === 'credential-google'} onClick={() => addCredentialReference('google')}>Réf. Google Auth</ActionButton>
                <ActionButton busy={actionBusy === 'credential-live'} onClick={() => addCredentialReference('live')}>Réf. Live Studio</ActionButton>
              </div>
              <DataTable
                empty="Aucun secret référencé. LiveKit/Stripe/CinetPay/etc. ne sont pas encore pilotés depuis Cimolace."
                columns={['Nom', 'Type', 'Description', 'Rotation', 'Expiration', 'Statut']}
                rows={(control.credentials || []).map((credential) => [
                  <strong>{credential.key_name}</strong>,
                  credential.key_type,
                  credential.description || '-',
                  formatDate(credential.last_rotated_at),
                  formatDate(credential.expires_at),
                  <div className="space-y-2">
                    <Badge tone="success">Configuré</Badge>
                    <ActionButton compact busy={actionBusy === `rotate-${credential.id}`} onClick={() => rotateCredential(credential)}>Rotation</ActionButton>
                  </div>,
                ])}
              />
            </Panel>
            <Panel title="Configuration">
              <DataTable
                empty="Aucune étape de configuration."
                columns={['#', 'Étape', 'Statut', 'Erreur', 'Terminé le']}
                rows={(control.configurationSteps || []).map((step) => [
                  step.step_number,
                  step.step_name,
                  <StatusPill status={step.status} />,
                  step.error_message || '-',
                  formatDate(step.completed_at),
                ])}
              />
            </Panel>
          </div>
        )}

        {activeTab === 'billing' && (
          <div className="space-y-6">
            <Panel title="Abonnements Cimolace">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <ActionButton busy={actionBusy === 'activate-forfait'} onClick={activateForfait}>
                  Activer le forfait 150 €/mois
                </ActionButton>
                <span className="text-xs text-gray-500">
                  Crée l'abonnement forfaitaire (MEDOS + Mbolo) et arme le gating de la clé tenant.
                  {appTenant?.id ? '' : ' — tenant applicatif requis.'}
                </span>
              </div>
              <DataTable
                empty="Aucun abonnement Cimolace."
                columns={['Plan', 'Statut', 'Montant', 'Période', 'Metadata']}
                rows={(control.subscriptions || []).map((sub) => [
                  sub.plan || '-',
                  <StatusPill status={sub.status} />,
                  formatMoney(sub.amount, sub.currency),
                  `${formatDate(sub.current_period_start)} - ${formatDate(sub.current_period_end)}`,
                  sub.metadata?.subscription_key || '-',
                ])}
              />
            </Panel>
            <Panel title="Factures et paiements">
              <div className="mb-4">
                <ActionButton busy={actionBusy === 'invoice'} onClick={createManualInvoice}>Créer facture manuelle</ActionButton>
              </div>
              <DataTable
                empty="Aucune facture Cimolace."
                columns={['Facture', 'Statut', 'Montant', 'Échéance', 'Payée le']}
                rows={[...(control.invoices || []), ...(control.appBilling?.invoices || [])].map((invoice) => [
                  invoice.invoice_number || invoice.provider_invoice_id || invoice.id,
                  <StatusPill status={invoice.status} />,
                  formatMoney(invoice.amount ?? (invoice.amount_cents != null ? invoice.amount_cents / 100 : 0), invoice.currency),
                  formatDate(invoice.due_date),
                  formatDate(invoice.paid_at),
                ])}
              />
            </Panel>
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="space-y-6">
            <Panel title="Déploiements">
              <DataTable
                empty="Aucun déploiement enregistré."
                columns={['Version', 'Environnement', 'Statut', 'Déployé le', 'Créé le']}
                rows={(control.deployments || []).map((deployment) => [
                  deployment.version || '-',
                  deployment.environment || '-',
                  <StatusPill status={deployment.status} />,
                  formatDate(deployment.deployed_at),
                  formatDate(deployment.created_at),
                ])}
              />
            </Panel>
            <Panel title="Tickets support">
              <div className="mb-4">
                <ActionButton busy={actionBusy === 'ticket'} onClick={createOpsTicket}>Créer ticket audit</ActionButton>
              </div>
              <DataTable
                empty="Aucun ticket."
                columns={['Ticket', 'Sujet', 'Priorité', 'Statut', 'Assigné', 'Créé le']}
                rows={(control.tickets || []).map((ticket) => [
                  ticket.ticket_number,
                  ticket.subject,
                  ticket.priority,
                  <StatusPill status={ticket.status} />,
                  ticket.assignee || '-',
                  formatDate(ticket.created_at),
                ])}
              />
            </Panel>
          </div>
        )}

        {activeTab === 'history' && (
          <Panel title="Historique des changements">
            <DataTable
              empty="Aucun historique. Les actions opérateur ne sont pas encore journalisées."
              columns={['Action', 'Entité', 'Description', 'Auteur', 'Date']}
              rows={(control.changeHistory || []).map((event) => [
                event.action,
                event.entity_type || '-',
                event.description || '-',
                event.changed_by || '-',
                formatDate(event.created_at),
              ])}
            />
          </Panel>
        )}
      </main>
    </div>
  );
}

function EditClientForm({ editForm, setEditForm, editError, savingEdit, onSubmit }) {
  return (
    <form onSubmit={onSubmit} className="mb-6 space-y-4 rounded-lg border bg-white p-6">
      <h2 className="text-lg font-semibold">Modifier le client</h2>
      {editError ? <p className="text-sm text-red-600">{editError}</p> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextInput label="Nom" required value={editForm.name} onChange={(name) => setEditForm((f) => ({ ...f, name }))} />
        <TextInput label="Raison sociale" value={editForm.business_name} onChange={(business_name) => setEditForm((f) => ({ ...f, business_name }))} />
        <TextInput label="Email" type="email" required value={editForm.email} onChange={(email) => setEditForm((f) => ({ ...f, email }))} />
        <TextInput label="Portal slug" value={editForm.portal_slug} onChange={(portal_slug) => setEditForm((f) => ({ ...f, portal_slug }))} />
        <TextInput label="Téléphone" value={editForm.phone} onChange={(phone) => setEditForm((f) => ({ ...f, phone }))} />
        <TextInput label="Pays" value={editForm.country} onChange={(country) => setEditForm((f) => ({ ...f, country }))} />
        <label className="block text-sm">
          <span className="text-gray-500">Type</span>
          <select className="mt-1 w-full rounded-lg border px-3 py-2" value={editForm.client_type} onChange={(ev) => setEditForm((f) => ({ ...f, client_type: ev.target.value }))}>
            {clientTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-gray-500">Statut</span>
          <select className="mt-1 w-full rounded-lg border px-3 py-2" value={editForm.status} onChange={(ev) => setEditForm((f) => ({ ...f, status: ev.target.value }))}>
            <option value={ClientStatus.PROSPECT}>Prospect</option>
            <option value={ClientStatus.CONFIGURING}>Configuration</option>
            <option value={ClientStatus.ACTIVE}>Actif</option>
            <option value={ClientStatus.SUSPENDED}>Suspendu</option>
            <option value={ClientStatus.CANCELLED}>Annulé</option>
          </select>
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-gray-500">Notes internes</span>
        <textarea className="mt-1 min-h-[80px] w-full rounded-lg border px-3 py-2" value={editForm.internal_notes} onChange={(ev) => setEditForm((f) => ({ ...f, internal_notes: ev.target.value }))} />
      </label>
      <button type="submit" disabled={savingEdit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
        {savingEdit ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </form>
  );
}

function TenantBrandingForm({ form, setForm, error, saving, onSubmit }) {
  function updateZone(key, value) {
    setForm((f) => {
      const zones = { ...(f.zones || {}), [key]: value };
      return { ...f, zones, zones_json: JSON.stringify(zones, null, 2) };
    });
  }

  return (
    <form onSubmit={onSubmit} className="mb-6 rounded-lg border border-blue-100 bg-blue-50/40 p-4">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="font-semibold text-gray-950">Identité configurable du tenant école</h3>
          <p className="text-sm text-gray-500">Ces champs alimentent le tenant applicatif, le site Cimolace lié et les diagnostics du modèle école.</p>
        </div>
        <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Enregistrement...' : 'Enregistrer branding'}
        </button>
      </div>
      {error ? <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TextInput label="Nom court" value={form.name} onChange={(name) => setForm((f) => ({ ...f, name }))} />
        <TextInput label="Nom complet" value={form.full_name} onChange={(full_name) => setForm((f) => ({ ...f, full_name }))} />
        <TextInput label="Logo URL" value={form.logo_url} onChange={(logo_url) => setForm((f) => ({ ...f, logo_url }))} />
        <TextInput label="Favicon URL" value={form.favicon_url} onChange={(favicon_url) => setForm((f) => ({ ...f, favicon_url }))} />
        <TextInput label="Domaine canonique" value={form.primary_domain} onChange={(primary_domain) => setForm((f) => ({ ...f, primary_domain }))} />
        <TextInput label="Origine site public" value={form.public_site_origin} onChange={(public_site_origin) => setForm((f) => ({ ...f, public_site_origin }))} />
        <TextInput label="Email vitrine" value={form.contact_email} onChange={(contact_email) => setForm((f) => ({ ...f, contact_email }))} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <ColorInput label="Couleur primaire" value={form.primary} onChange={(primary) => setForm((f) => ({ ...f, primary }))} />
        <ColorInput label="Couleur secondaire" value={form.secondary} onChange={(secondary) => setForm((f) => ({ ...f, secondary }))} />
        <ColorInput label="Couleur accent" value={form.accent} onChange={(accent) => setForm((f) => ({ ...f, accent }))} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <ColorInput label="Fond shell" value={form.background} onChange={(background) => setForm((f) => ({ ...f, background }))} />
        <TextInput label="Police UI" value={form.font_family} onChange={(font_family) => setForm((f) => ({ ...f, font_family }))} />
        <TextInput label="Rayon UI" value={form.radius} onChange={(radius) => setForm((f) => ({ ...f, radius }))} />
      </div>
      <div className="mt-4 rounded-xl border bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">Zones de marque actives</div>
            <div className="text-xs text-gray-500">Ces interrupteurs disent quels shells doivent consommer la charte du tenant.</div>
          </div>
          <div className="hidden h-10 w-32 rounded-lg border md:block" style={{
            background: `linear-gradient(90deg, ${form.primary || '#0F1117'}, ${form.secondary || '#162331'}, ${form.accent || '#d4af37'})`,
          }} />
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {brandingZones.map((zone) => (
            <label key={zone.key} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <span className="font-medium text-gray-700">{zone.label}</span>
              <input
                type="checkbox"
                checked={Boolean(form.zones?.[zone.key])}
                onChange={(ev) => updateZone(zone.key, ev.target.checked)}
              />
            </label>
          ))}
        </div>
      </div>
      <BrandingPreview form={form} />
      <label className="mt-4 block text-sm">
        <span className="text-gray-500">Zones configurables JSON</span>
        <textarea
          className="mt-1 min-h-[120px] w-full rounded-lg border bg-white px-3 py-2 font-mono text-xs text-gray-900 placeholder:text-gray-400"
          style={adminInputStyle}
          value={form.zones_json}
          onChange={(ev) => {
            const zones_json = ev.target.value;
            setForm((f) => {
              try {
                const zones = JSON.parse(zones_json);
                return { ...f, zones_json, zones };
              } catch {
                return { ...f, zones_json };
              }
            });
          }}
        />
      </label>
    </form>
  );
}

function BrandingPreview({ form }) {
  const primary = form.primary || '#0F1117';
  const secondary = form.secondary || '#162331';
  const accent = form.accent || '#d4af37';
  const background = form.background || '#0F1117';
  return (
    <div className="mt-4 overflow-hidden rounded-xl border bg-white">
      <div className="border-b px-4 py-3">
        <div className="text-sm font-semibold text-gray-900">Aperçu shell tenant</div>
        <div className="text-xs text-gray-500">Prévisualisation locale de la charte avant usage dans Studio, Live et Admin.</div>
      </div>
      <div
        className="p-4"
        style={{
          background,
          color: '#fff',
          fontFamily: form.font_family || 'Inter, system-ui, sans-serif',
        }}
      >
        <div className="flex items-center gap-3 rounded-xl border border-white/10 p-3" style={{ background: `linear-gradient(90deg, ${primary}dd, ${secondary}cc)` }}>
          {form.logo_url ? <img src={form.logo_url} alt="" className="h-10 w-10 rounded-lg object-contain" /> : <div className="h-10 w-10 rounded-lg" style={{ background: accent }} />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{form.name || 'Nom école'}</div>
            <div className="truncate text-xs text-white/55">{form.primary_domain || 'domaine-tenant.ecole'}</div>
          </div>
          <button type="button" className="rounded-lg px-3 py-2 text-xs font-semibold text-black" style={{ background: accent, borderRadius: form.radius || '12px' }}>
            Action
          </button>
        </div>
      </div>
    </div>
  );
}

function ColorInput({ label, value, onChange }) {
  return (
    <label className="block text-sm">
      <span className="text-gray-500">{label}</span>
      <div className="mt-1 flex overflow-hidden rounded-lg border bg-white">
        <input type="color" className="h-10 w-12 border-0 bg-transparent p-1" value={value || '#d4af37'} onChange={(ev) => onChange(ev.target.value)} />
        <input className="min-w-0 flex-1 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400" style={adminInputStyle} value={value} onChange={(ev) => onChange(ev.target.value)} placeholder="#d4af37" />
      </div>
    </label>
  );
}

function TextInput({ label, value, onChange, type = 'text', required = false }) {
  return (
    <label className="block text-sm">
      <span className="text-gray-500">{label}</span>
      <input type={type} required={required} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400" style={adminInputStyle} value={value} onChange={(ev) => onChange(ev.target.value)} />
    </label>
  );
}

const adminInputStyle = {
  backgroundColor: '#ffffff',
  color: '#111827',
  WebkitTextFillColor: '#111827',
};

function ActionButton({ children, onClick, busy, compact = false }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`rounded-lg border border-gray-300 bg-white font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60 ${
        compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'
      }`}
    >
      {busy ? '...' : children}
    </button>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-lg border bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-950">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Toggle marketplace "Module Twin" — pilote l'activation du Bio Digital
 * Twin pour ce tenant via /admin/tenants/:tenantId/services/twin/toggle.
 * Lit l'état courant depuis control.services (statut 'active' = ON).
 */
function TwinModuleToggle({ appTenant, services, actionBusy, onToggle }) {
  const twinService = (services || []).find((s) => s.service_key === 'twin');
  const enabled = twinService ? twinService.status === 'active' : true;
  const disabled = !appTenant?.id;
  const busyOn = actionBusy === 'twin-toggle-on';
  const busyOff = actionBusy === 'twin-toggle-off';
  return (
    <section className="rounded-lg border border-blue-100 bg-blue-50/40 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-950">Module Twin</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                enabled
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {enabled ? 'Actif' : 'Désactivé'}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Bio Digital Twin MedOS. Couper désactive immédiatement les routes
            /med/twin pour ce tenant (guard TwinEnabledGuard).
          </p>
          {disabled ? (
            <p className="mt-1 text-xs text-amber-700">
              Aucun tenant applicatif lié — toggle indisponible.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton
            busy={busyOn}
            onClick={() => onToggle(true)}
          >
            Activer Twin
          </ActionButton>
          <ActionButton
            busy={busyOff}
            onClick={() => onToggle(false)}
          >
            Couper Twin
          </ActionButton>
        </div>
      </div>
    </section>
  );
}

function InfoGrid({ rows }) {
  return (
    <div className="grid grid-cols-1 gap-4">
      {rows.map(([label, value]) => (
        <div key={label}>
          <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
          <div className="break-words text-sm font-medium text-gray-900">{value}</div>
        </div>
      ))}
    </div>
  );
}

function DataTable({ columns, rows, empty }) {
  if (!rows.length) return <p className="text-sm text-gray-500">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead>
          <tr>
            {columns.map((column) => <th key={column} className="px-3 py-2 text-left font-semibold text-gray-500">{column}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-3 align-top text-gray-800">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HealthList({ items }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-start justify-between gap-3 rounded-lg border p-3">
          <div>
            <div className="text-sm font-medium text-gray-900">{item.label}</div>
            <div className="text-xs text-gray-500">{item.detail}</div>
          </div>
          <Badge tone={item.tone}>{item.value}</Badge>
        </div>
      ))}
    </div>
  );
}

function ReadinessSummary({ diagnostics }) {
  if (!diagnostics?.readiness) {
    return <p className="text-sm text-gray-500">Aucune synthèse de préparation disponible.</p>;
  }
  const items = [
    { label: 'Validé', value: diagnostics.readiness.passCount, tone: 'success' },
    { label: 'À compléter', value: diagnostics.readiness.warningCount, tone: 'warning' },
    { label: 'Bloquant', value: diagnostics.readiness.blockingCount, tone: 'danger' },
  ];
  const next = diagnostics.readiness.blockers?.[0] || diagnostics.readiness.warnings?.[0] || null;
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border bg-gray-50 p-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">{item.label}</div>
          <div className="mt-1 text-xl font-bold text-gray-950">{item.value}</div>
        </div>
      ))}
      <div className="rounded-lg border bg-gray-50 p-3 lg:col-span-1">
        <div className="text-xs uppercase tracking-wide text-gray-500">Prochaine action</div>
        <div className="mt-1 text-sm font-medium text-gray-950">{next?.label || 'Aucune'}</div>
        <div className="mt-1 text-xs text-gray-500">{next?.remediation || next?.message || 'Le tenant est prêt côté Cimolace.'}</div>
      </div>
    </div>
  );
}

function ProviderStatusGrid({ providers }) {
  if (!providers) return null;
  const groups = [
    ['Supabase', providers.supabase],
    ['Google Auth', providers.googleOAuth],
    ['LiveKit', providers.livekit],
    ['Stripe', providers.stripe],
    ['CinetPay', providers.cinetpay],
    ['Chariow', providers.chariow],
    ['PawaPay', providers.pawapay],
    ['DeepSeek', providers.deepseek],
    ['OpenAI', providers.openai],
    ['Anthropic', providers.anthropic],
    ['Groq', providers.groq],
    ['Mux', providers.mux],
  ];
  return (
    <div className="mb-5">
      <h3 className="mb-3 text-sm font-semibold text-gray-950">Providers et API</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {groups.map(([label, provider]) => {
          const tone = provider?.configured ? 'success' : provider?.partial ? 'warning' : 'danger';
          const status = provider?.configured ? 'Configuré' : provider?.partial ? 'Partiel' : 'Absent';
          return (
            <div key={label} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-gray-950">{label}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    {(provider?.keys || []).filter((key) => key.configured).length}/{provider?.keys?.length || 0} variable(s)
                  </div>
                </div>
                <Badge tone={tone}>{status}</Badge>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SchoolProviderMatrix({ providers, actionBusy, onPrepare, onSync, clientId }) {
  const [selectedProvider, setSelectedProvider] = useState(null);

  if (!providers?.length) {
    return (
      <div className="mb-5 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
        Aucune matrice provider école disponible.
      </div>
    );
  }
  const statusLabel = { ready: 'Prêt', partial: 'Partiel', missing: 'Absent' };
  const statusTone = { ready: 'success', partial: 'warning', missing: 'danger' };
  const CRITICAL = new Set(['supabase', 'supabase_realtime', 'livekit', 'ai']);

  const readyCount = providers.filter((p) => p.status === 'ready').length;
  const partialCount = providers.filter((p) => p.status === 'partial').length;
  const missingCount = providers.filter((p) => p.status === 'missing').length;

  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-950">Matrice providers école</h3>
          <p className="mt-1 text-xs text-gray-500">
            {readyCount} prêt(s) · {partialCount} partiel(s) · {missingCount} absent(s) · cliquer une ligne pour le détail
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton compact busy={actionBusy === 'school-model-providers'} onClick={onPrepare}>
            Préparer manquants
          </ActionButton>
          <ActionButton compact busy={actionBusy === 'school-model-providers-sync'} onClick={onSync}>
            Synchroniser tout
          </ActionButton>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Provider</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Référence Cimolace</th>
              <th className="px-3 py-2">Preuve environnement</th>
              <th className="px-3 py-2">Moteurs</th>
              <th className="px-3 py-2">Blocages</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {providers.map((provider) => (
              <tr
                key={provider.provider}
                className="cursor-pointer transition-colors hover:bg-blue-50"
                onClick={() => setSelectedProvider(provider.provider)}
              >
                <td className="px-3 py-3 align-top">
                  <div className="flex items-center gap-1.5">
                    <div className="font-medium text-gray-950">{provider.provider}</div>
                    {CRITICAL.has(provider.provider) && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                        Critique
                      </span>
                    )}
                  </div>
                  <div className="mt-1 max-w-xs text-xs text-gray-500">{provider.label}</div>
                </td>
                <td className="px-3 py-3 align-top">
                  <Badge tone={statusTone[provider.status] || 'neutral'}>
                    {statusLabel[provider.status] || provider.status}
                  </Badge>
                </td>
                <td className="px-3 py-3 align-top text-xs text-gray-600">
                  <div className="font-medium text-gray-800">{provider.key_name}</div>
                  <div>{provider.key_type}</div>
                  {provider.credential ? (
                    <div className="mt-2 text-gray-500">
                      Rotation: {formatDate(provider.credential.last_rotated_at)}
                    </div>
                  ) : (
                    <div className="mt-2 text-amber-700">Référence absente</div>
                  )}
                </td>
                <td className="px-3 py-3 align-top text-xs text-gray-600">
                  <div>
                    {provider.evidence?.configuredKeys?.length || 0}/{provider.evidence?.expectedKeys?.length || 0} variable(s)
                  </div>
                  <div className="mt-1 max-w-xs break-words text-gray-400">
                    {(provider.evidence?.configuredKeys || []).join(', ') || 'Aucune preuve locale'}
                  </div>
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {(provider.engines || []).length ? (
                      provider.engines.map((engine) => (
                        <span key={engine} className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
                          {engine}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">Aucun moteur</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 align-top text-xs text-amber-700">
                  {(provider.blockers || []).length
                    ? provider.blockers.join(', ')
                    : <span className="text-gray-400">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedProvider && clientId && (
        <ProviderDetailDrawer
          clientId={clientId}
          providerKey={selectedProvider}
          onClose={() => setSelectedProvider(null)}
        />
      )}
    </div>
  );
}

// ── Drawer fiche détail provider ──────────────────────────────────────────────

function ProviderDetailDrawer({ clientId, providerKey, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    cimolaceBackofficeApi
      .getProviderDetail(clientId, providerKey)
      .then(setDetail)
      .catch((err) => setError(err?.message ?? 'Erreur lors du chargement'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [clientId, providerKey]);

  const handleHealthCheck = async () => {
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await cimolaceBackofficeApi.runProviderHealthCheck(clientId, providerKey);
      setCheckResult(res);
      reload();
    } catch (err) {
      setCheckResult({ status: 'fail', error_message: err?.message ?? 'Erreur health-check' });
    } finally {
      setChecking(false);
    }
  };

  const healthStatusTone = { ok: 'success', warn: 'warning', fail: 'danger', unknown: 'neutral' };
  const healthStatusLabel = { ok: 'OK', warn: 'Alerte', fail: 'Échec', unknown: 'Inconnu' };
  const severityTone = { critical: 'danger', high: 'danger', medium: 'warning', low: 'neutral' };

  return (
    // Overlay
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      {/* Drawer panel — stop propagation so clicks inside don't close */}
      <div
        className="relative z-50 flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-950">{providerKey}</h2>
            <p className="mt-0.5 text-xs text-gray-500">Fiche détail provider école</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleHealthCheck}
              disabled={checking}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {checking ? 'Test en cours…' : '⚡ Tester maintenant'}
            </button>
            <button
              onClick={onClose}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 p-5">
          {checkResult && (
            <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${
              checkResult.status === 'ok'
                ? 'border-green-200 bg-green-50 text-green-800'
                : checkResult.status === 'warn'
                ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}>
              <span className="font-bold mr-2">
                {checkResult.status === 'ok' ? '✅ Connexion OK' : checkResult.status === 'warn' ? '⚠️ Avertissement' : '❌ Connexion échouée'}
              </span>
              {checkResult.latency_ms != null && <span className="text-xs opacity-70">({checkResult.latency_ms} ms)</span>}
              {checkResult.error_message && <div className="mt-1 text-xs opacity-80">{checkResult.error_message}</div>}
            </div>
          )}
          {loading && <p className="text-sm text-gray-500">Chargement…</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {!loading && detail && (
            <>
              {/* Statut & criticité */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={{ ready: 'success', partial: 'warning', missing: 'danger' }[detail.provider?.status] || 'neutral'}
                >
                  {{ ready: 'Prêt', partial: 'Partiel', missing: 'Absent' }[detail.provider?.status] || detail.provider?.status}
                </Badge>
                {detail.isCritical && (
                  <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                    Provider critique
                  </span>
                )}
                <span className="text-xs text-gray-500">{detail.provider?.key_type}</span>
              </div>

              {/* Auto-ticket */}
              {detail.autoTicket && (
                <div className={`rounded-lg border p-3 text-xs ${detail.autoTicket.existing ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
                  <div className="font-semibold text-gray-900">
                    {detail.autoTicket.auto ? '🎫 Ticket créé automatiquement' : '🎫 Ticket ouvert existant'}
                  </div>
                  <div className="mt-1 text-gray-700">{detail.autoTicket.subject}</div>
                  <div className="mt-1 text-gray-500">
                    #{detail.autoTicket.ticket_number} · {formatDate(detail.autoTicket.created_at)}
                  </div>
                </div>
              )}

              {/* Health check */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Dernier health-check
                </h3>
                {detail.healthChecks?.latest ? (
                  <div className="rounded-lg border p-3 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge tone={healthStatusTone[detail.healthChecks.latest.status] || 'neutral'}>
                        {healthStatusLabel[detail.healthChecks.latest.status] || detail.healthChecks.latest.status}
                      </Badge>
                      {detail.healthChecks.synthetic && (
                        <span className="text-gray-400">(synthétique — basé sur variables env)</span>
                      )}
                    </div>
                    <div className="mt-2 text-gray-500">
                      {formatDate(detail.healthChecks.latest.checked_at)}
                      {detail.healthChecks.latest.latency_ms != null && (
                        <span className="ml-2">{detail.healthChecks.latest.latency_ms} ms</span>
                      )}
                    </div>
                    {detail.healthChecks.latest.error_message && (
                      <div className="mt-2 rounded bg-red-50 p-2 text-red-700">
                        {detail.healthChecks.latest.error_message}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Aucun check enregistré.</p>
                )}

                {detail.healthChecks?.history?.length > 1 && (
                  <div className="mt-2">
                    <p className="mb-1 text-xs text-gray-400">Historique récent</p>
                    <div className="flex flex-wrap gap-1">
                      {detail.healthChecks.history.slice(0, 20).map((hc, i) => (
                        <span
                          key={i}
                          title={`${formatDate(hc.checked_at)} — ${hc.status}`}
                          className={`h-3 w-3 rounded-sm ${
                            hc.status === 'ok' ? 'bg-green-400'
                            : hc.status === 'warn' ? 'bg-amber-400'
                            : hc.status === 'fail' ? 'bg-red-400'
                            : 'bg-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* Incidents */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Incidents
                  {detail.incidents?.openCount > 0 && (
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                      {detail.incidents.openCount} ouvert(s)
                    </span>
                  )}
                </h3>
                {detail.incidents?.recent?.length ? (
                  <div className="space-y-2">
                    {detail.incidents.recent.map((incident) => (
                      <div
                        key={incident.id}
                        className={`rounded-lg border p-3 text-xs ${incident.resolved ? 'border-gray-100 bg-gray-50' : 'border-amber-200 bg-amber-50'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium text-gray-900">{incident.title}</div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Badge tone={severityTone[incident.severity] || 'neutral'}>
                              {incident.severity}
                            </Badge>
                            {incident.resolved ? (
                              <span className="text-green-600">✓ Résolu</span>
                            ) : (
                              <span className="text-amber-700">En cours</span>
                            )}
                          </div>
                        </div>
                        {incident.description && (
                          <div className="mt-1 text-gray-600">{incident.description}</div>
                        )}
                        <div className="mt-1 text-gray-400">
                          Début : {formatDate(incident.started_at)}
                          {incident.resolved_at && ` · Résolu : ${formatDate(incident.resolved_at)}`}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Aucun incident enregistré.</p>
                )}
              </section>

              {/* Secrets manquants */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Variables d'environnement
                </h3>
                {detail.missingSecrets?.length ? (
                  <div className="space-y-2">
                    {detail.missingSecrets.map((secret) => (
                      <div key={secret.key} className="rounded-lg border border-red-100 bg-red-50 p-3 text-xs">
                        <div className="font-mono font-semibold text-red-800">{secret.key}</div>
                        <div className="mt-1 text-gray-600">{secret.hint}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-green-600">✓ Toutes les variables sont configurées.</p>
                )}
              </section>

              {/* Moteurs consommateurs */}
              {detail.provider?.engines?.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Moteurs utilisant ce provider
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.provider.engines.map((engine) => (
                      <span key={engine} className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">
                        {engine}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Référence Cimolace */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Référence Cimolace
                </h3>
                {detail.provider?.credential ? (
                  <div className="rounded-lg border p-3 text-xs">
                    <div className="font-medium text-gray-800">{detail.provider.credential.key_name}</div>
                    <div className="mt-1 text-gray-500">{detail.provider.credential.description}</div>
                    <div className="mt-1 text-gray-400">
                      Dernière rotation : {formatDate(detail.provider.credential.last_rotated_at)}
                      {detail.provider.credential.expires_at && (
                        <span> · Expire : {formatDate(detail.provider.credential.expires_at)}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">
                    Aucune référence enregistrée. Utilisez &quot;Préparer manquants&quot; pour créer la référence.
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DiagnosticList({ diagnostics, actionBusy, onRecordReadiness }) {
  if (!diagnostics) return <p className="text-sm text-gray-500">Diagnostic non disponible.</p>;
  const toneByStatus = {
    pass: 'success',
    warn: 'warning',
    fail: 'danger',
  };
  const readinessActions = {
    tenant_domain_prod: [
      ['domain_dns', 'DNS domaine'],
      ['domain_ssl', 'SSL domaine'],
    ],
    google_oauth_reference: [['google_oauth', 'OAuth Google']],
    school_checkout_multi_provider: [['checkout', 'Checkout école']],
    email_sms_delivery: [
      ['email_delivery', 'Email'],
      ['sms_delivery', 'SMS'],
    ],
  };
  return (
    <div className="space-y-3">
      {diagnostics.checks.map((check) => {
        const actions = readinessActions[check.key] || [];
        return (
          <div key={check.key} className="rounded-lg border p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="font-semibold text-gray-950">{check.label}</div>
                <div className="mt-1 text-sm text-gray-600">{check.message}</div>
                {check.remediation ? <div className="mt-2 text-xs text-amber-700">{check.remediation}</div> : null}
              </div>
              <Badge tone={toneByStatus[check.status] || 'neutral'}>{check.status}</Badge>
            </div>
            {actions.length && onRecordReadiness ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {actions.map(([key, label]) => (
                  <ActionButton
                    key={key}
                    compact
                    busy={actionBusy === `readiness-${key}`}
                    onClick={() => onRecordReadiness(key, label)}
                  >
                    Attester {label}
                  </ActionButton>
                ))}
              </div>
            ) : null}
            {check.evidence ? (
              <details className="mt-3 rounded bg-gray-50 p-3 text-xs text-gray-600">
                <summary className="cursor-pointer font-medium text-gray-700">Preuves techniques</summary>
                <pre className="mt-2 overflow-x-auto">
                  {JSON.stringify(check.evidence, null, 2)}
                </pre>
              </details>
            ) : null}
          </div>
        );
      })}
      <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
        Généré le {formatDateTime(diagnostics.generatedAt)} · Supabase: {diagnostics.proof?.supabaseRef || '-'}
      </div>
    </div>
  );
}

function StatCard({ title, value, helper, tone = 'default' }) {
  const color = tone === 'warning' ? 'text-amber-700' : 'text-gray-950';
  return (
    <div className="rounded-lg border bg-white p-5">
      <div className="text-sm text-gray-500">{title}</div>
      <div className={`mt-2 text-3xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-xs text-gray-400">{helper}</div>
    </div>
  );
}

function ModelStat({ label, value, detail }) {
  return (
    <div className="rounded-lg border bg-gray-50 p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-gray-950">{value}</div>
      <div className="mt-1 text-xs text-gray-500">{detail}</div>
    </div>
  );
}

function SchoolDeliveryReadinessPanel({ readiness }) {
  if (!readiness) return null;
  const tone = {
    ready: 'border-green-200 bg-green-50 text-green-900',
    warn: 'border-amber-200 bg-amber-50 text-amber-900',
    block: 'border-red-200 bg-red-50 text-red-900',
  }[readiness.status] || 'border-gray-200 bg-gray-50 text-gray-900';
  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide opacity-70">Livraison tenant école</div>
          <div className="mt-1 text-xl font-bold">{readiness.title}</div>
          <div className="mt-1 text-sm opacity-80">{readiness.detail}</div>
        </div>
        <div className="rounded-lg bg-white/70 px-4 py-3 text-right">
          <div className="text-xs uppercase tracking-wide opacity-60">Score</div>
          <div className="text-2xl font-bold">{readiness.score}%</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {readiness.items.map((item) => (
          <div key={item.key} className="rounded-lg border border-black/5 bg-white/75 p-3 text-gray-900">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">{item.label}</div>
                <div className="mt-1 text-xs text-gray-500">{item.detail}</div>
              </div>
              <Badge tone={item.status === 'ready' ? 'success' : item.status === 'block' ? 'danger' : 'warning'}>
                {item.value}
              </Badge>
            </div>
            {item.next ? <div className="mt-2 text-xs text-amber-700">{item.next}</div> : null}
          </div>
        ))}
      </div>
      {readiness.nextActions.length ? (
        <div className="mt-4 rounded-lg bg-white/70 p-3 text-sm text-gray-800">
          <strong>Suite recommandée:</strong> {readiness.nextActions.join(' · ')}
        </div>
      ) : null}
    </div>
  );
}

function EngineCoverageCell({ coverage }) {
  if (!coverage) {
    return <span className="text-xs text-gray-400">Non calculée</span>;
  }
  const status = coverage.status === 'ready' ? 'active' : coverage.status === 'partial' ? 'pending' : 'failed';
  const checks = coverage.checks || {};
  const operations = coverage.operations || {};
  const providerSummary = operations.providers?.length
    ? `${operations.providers.filter((provider) => provider.configured).length}/${operations.providers.length} API`
    : '0 API';
  const labels = {
    engine: 'Moteur',
    shell: 'Shell',
    providers: 'API',
    branding: 'Branding',
    quotas: 'Quotas',
    billing: 'Billing',
  };
  return (
    <div className="min-w-52 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <StatusPill status={status} label={`${coverage.score ?? 0}% prêt`} />
        <span className="text-[11px] text-gray-500">{providerSummary}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(labels).map(([key, label]) => (
          <MiniCheck key={key} label={label} status={checks[key]} />
        ))}
      </div>
      <div className="space-y-1 rounded-md bg-gray-50 p-2 text-[11px] text-gray-600">
        <div>
          Quota: {formatQuota(operations.quota?.limit)} / recommandé {formatQuota(operations.quota?.recommendedDefault)} {operations.quota?.unit || ''}
        </div>
        <div>Billing: {operations.billing?.meter || '-'}</div>
        {coverage.brandingZones?.total ? (
          <div>Zones branding: {coverage.brandingZones.configured}/{coverage.brandingZones.total}</div>
        ) : null}
      </div>
      {coverage.blockers?.length ? (
        <div className="text-[11px] leading-snug text-amber-700">
          {coverage.blockers.slice(0, 3).join(', ')}
        </div>
      ) : null}
    </div>
  );
}

function MiniCheck({ label, status }) {
  const normalized = String(status || 'missing');
  const classes = {
    ready: 'border-green-200 bg-green-50 text-green-700',
    partial: 'border-amber-200 bg-amber-50 text-amber-700',
    missing: 'border-red-200 bg-red-50 text-red-700',
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${classes[normalized] || classes.missing}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }) {
  const labels = {
    [ClientStatus.ACTIVE]: 'Actif',
    [ClientStatus.PROSPECT]: 'Prospect',
    [ClientStatus.CONFIGURING]: 'Configuration',
    [ClientStatus.SUSPENDED]: 'Suspendu',
    [ClientStatus.CANCELLED]: 'Annulé',
  };
  return <StatusPill status={status} label={labels[status]} />;
}

function StatusPill({ status, label }) {
  const normalized = String(status || '').toLowerCase();
  const tone =
    ['active', 'paid', 'success', 'completed', 'deployed'].includes(normalized) ? 'success'
      : ['pending', 'configuring', 'open', 'in_progress', 'past_due'].includes(normalized) ? 'warning'
        : ['suspended', 'cancelled', 'failed', 'error'].includes(normalized) ? 'danger'
          : 'neutral';
  return <Badge tone={tone}>{label || status || '-'}</Badge>;
}

function Badge({ tone = 'neutral', children }) {
  const classes = {
    success: 'bg-green-100 text-green-800',
    warning: 'bg-amber-100 text-amber-800',
    danger: 'bg-red-100 text-red-800',
    neutral: 'bg-gray-100 text-gray-800',
  };
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${classes[tone] || classes.neutral}`}>{children}</span>;
}

function CenteredText({ tone, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className={`text-xl ${tone === 'error' ? 'text-red-600' : 'text-gray-700'}`}>{children}</div>
    </div>
  );
}

function buildHealth(control) {
  if (!control) return [];
  const summary = control.summary || {};
  return [
    {
      label: 'Tenant applicatif',
      value: control.tenants?.app?.length ? 'lié' : 'manquant',
      tone: control.tenants?.app?.length ? 'success' : 'danger',
      detail: control.tenants?.app?.[0]?.slug || 'Aucun tenant app associé au site.',
    },
    {
      label: 'Moteurs actifs',
      value: `${summary.activeEngineCount || 0}/${summary.engineCount || 0}`,
      tone: summary.activeEngineCount ? 'success' : 'warning',
      detail: 'Services opérationnels déclarés dans cimolace_services.',
    },
    {
      label: 'Facturation',
      value: summary.activeSubscriptionCount ? 'active' : 'à compléter',
      tone: summary.activeSubscriptionCount ? 'success' : 'warning',
      detail: `${summary.unpaidInvoiceCount || 0} facture(s) à surveiller.`,
    },
    {
      label: 'Maintenance',
      value: summary.maintenance ? 'active' : 'inactive',
      tone: summary.maintenance ? 'warning' : 'success',
      detail: 'Basé sur le statut site et metadata.maintenance.',
    },
  ];
}

function buildSchoolDeliveryReadiness(control, diagnostics) {
  if (!control?.schoolModel) return null;
  const summary = control.summary || {};
  const modelSummary = control.schoolModel.summary || {};
  const productEngines = control.schoolModel.productEngines || [];
  const providers = control.schoolProviders || [];
  const activeSubscriptionCount = Number(summary.activeSubscriptionCount || 0);
  const missingQuotaCount = productEngines.filter(
    (engine) => engine.coverage?.checks?.quotas !== 'ready',
  ).length;
  const providerMissingCount = providers.filter((provider) => provider.status === 'missing').length;
  const providerPartialCount = providers.filter((provider) => provider.status === 'partial').length;
  const blockingCount = Number(diagnostics?.readiness?.blockingCount || 0);
  const warningCount = Number(diagnostics?.readiness?.warningCount || 0);

  const items = [
    {
      key: 'tenant',
      label: 'Tenant applicatif',
      status: control.tenants?.app?.length ? 'ready' : 'block',
      value: control.tenants?.app?.length ? 'lié' : 'manquant',
      detail: control.tenants?.app?.[0]?.slug || 'Aucun tenant app associé.',
      next: control.tenants?.app?.length ? null : 'Créer ou rattacher le tenant app.',
    },
    {
      key: 'engines',
      label: 'Moteurs école',
      status:
        (modelSummary.recommendedActiveCount || 0) >= (modelSummary.recommendedCount || 0)
          ? 'ready'
          : (modelSummary.baseActiveCount || 0) >= (modelSummary.baseCount || 0)
            ? 'warn'
            : 'block',
      value: `${modelSummary.recommendedActiveCount || 0}/${modelSummary.recommendedCount || 0}`,
      detail: 'Moteurs recommandés actifs pour cloner une école complète.',
      next: modelSummary.missingRecommendedEngines?.length
        ? `Activer: ${modelSummary.missingRecommendedEngines.join(', ')}`
        : null,
    },
    {
      key: 'branding',
      label: 'Branding',
      status:
        (modelSummary.brandingConfiguredCount || 0) >= (modelSummary.brandingRequirementCount || 0)
          ? 'ready'
          : (modelSummary.brandingConfiguredCount || 0) > 0
            ? 'warn'
            : 'block',
      value: `${modelSummary.brandingConfiguredCount || 0}/${modelSummary.brandingRequirementCount || 0}`,
      detail: 'Logo, domaine, couleurs et zones de marque.',
      next: modelSummary.missingBranding?.length
        ? `Compléter: ${modelSummary.missingBranding.join(', ')}`
        : null,
    },
    {
      key: 'providers',
      label: 'Providers/API',
      status: providerMissingCount ? 'block' : providerPartialCount ? 'warn' : 'ready',
      value: providerMissingCount ? `${providerMissingCount} absent` : providerPartialCount ? `${providerPartialCount} partiel` : 'prêt',
      detail: 'Supabase, LiveKit, IA, paiement, email/SMS et realtime.',
      next: providerMissingCount || providerPartialCount ? 'Préparer ou synchroniser les providers.' : null,
    },
    {
      key: 'quotas',
      label: 'Quotas moteurs',
      status: missingQuotaCount ? 'warn' : 'ready',
      value: missingQuotaCount ? `${missingQuotaCount} à poser` : 'prêt',
      detail: 'Limites opérationnelles par moteur école.',
      next: missingQuotaCount ? 'Appliquer les quotas recommandés.' : null,
    },
    {
      key: 'billing',
      label: 'Facturation',
      status: activeSubscriptionCount ? 'ready' : 'warn',
      value: activeSubscriptionCount ? 'active' : 'à compléter',
      detail: 'Abonnement Cimolace, factures et statut commercial.',
      next: activeSubscriptionCount ? null : 'Créer ou rattacher un abonnement tenant.',
    },
    {
      key: 'ops',
      label: 'Maintenance',
      status: summary.maintenance ? 'warn' : 'ready',
      value: summary.maintenance ? 'active' : 'off',
      detail: 'État opérationnel contrôlé depuis Cimolace.',
      next: summary.maintenance ? 'Désactiver la maintenance avant livraison.' : null,
    },
    {
      key: 'diagnostic',
      label: 'Diagnostic global',
      status: blockingCount ? 'block' : warningCount ? 'warn' : 'ready',
      value: diagnostics?.readiness?.percent != null ? `${diagnostics.readiness.percent}%` : 'non calculé',
      detail: `${blockingCount} bloquant(s), ${warningCount} point(s) à compléter.`,
      next: blockingCount || warningCount
        ? diagnostics?.readiness?.blockers?.[0]?.remediation || diagnostics?.readiness?.warnings?.[0]?.remediation || 'Revoir les contrôles en onglet Diagnostic.'
        : null,
    },
  ];

  const readyCount = items.filter((item) => item.status === 'ready').length;
  const blockCount = items.filter((item) => item.status === 'block').length;
  const warnCount = items.filter((item) => item.status === 'warn').length;
  const score = Math.round((readyCount / items.length) * 100);
  const status = blockCount ? 'block' : warnCount ? 'warn' : 'ready';
  const nextActions = items.filter((item) => item.next).map((item) => item.next);

  return {
    status,
    score,
    title:
      status === 'ready'
        ? 'Prêt à cloner comme modèle école'
        : status === 'warn'
          ? 'Modèle utilisable, finalisation requise'
          : 'Modèle non livrable en l\'état',
    detail:
      status === 'ready'
        ? 'Le tenant peut servir de base pour créer de nouvelles écoles.'
        : 'Cette synthèse montre ce qui manque avant de vendre ou cloner le modèle.',
    items,
    nextActions,
  };
}

function formatDate(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return String(value);
  }
}

function formatDateTime(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return String(value);
  }
}

function formatMoney(value, currency = 'XOF') {
  const amount = Number(value || 0);
  return `${amount.toLocaleString('fr-FR')} ${currency || ''}`.trim();
}

function formatQuota(value) {
  if (value === null || value === undefined || value === '') return '-';
  return Number(value).toLocaleString('fr-FR');
}
