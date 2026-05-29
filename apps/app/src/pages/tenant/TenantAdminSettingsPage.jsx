/**
 * TenantAdminSettingsPage — /t/:tenantSlug/admin/settings
 * Paramètres branding + infos de l'école.
 * Connecté à PATCH /tenants/current/branding et GET /tenants/current.
 */
import { useEffect, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { Settings, GraduationCap, Users, Save, Loader2, Check, AlertCircle, Globe, Palette, School, KeyRound, CreditCard } from 'lucide-react';
import { tenantsApi } from '@/lib/api-v2';
import TenantOAuthSettings from '@/components/admin/TenantOAuthSettings';
import TenantStripeSettings from '@/components/admin/TenantStripeSettings';
import TenantPayPalSettings from '@/components/admin/TenantPayPalSettings';

const INPUT = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400';
const BTN_PRIMARY = 'inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50';
const BTN_GHOST = 'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50';

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {children}
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-2 border-b pb-4">
        <Icon className="h-4 w-4 text-blue-600" />
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export default function TenantAdminSettingsPage() {
  const { tenantSlug } = useParams();
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const [branding, setBranding] = useState({
    name: '',
    description: '',
    website: '',
    accentColor: '#3B82F6',
    logoUrl: '',
  });

  useEffect(() => {
    tenantsApi.current()
      .then(t => {
        setTenant(t);
        setBranding({
          name: t.branding?.name ?? t.name ?? '',
          description: t.branding?.description ?? t.description ?? '',
          website: t.branding?.website ?? '',
          accentColor: t.branding?.accentColor ?? '#3B82F6',
          logoUrl: t.branding?.logoUrl ?? '',
        });
      })
      .catch(e => setError(e?.message ?? 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await tenantsApi.updateBranding(branding);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err?.message ?? 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <div className="border-b bg-white px-6 py-2">
        <div className="mx-auto flex max-w-3xl items-center gap-1">
          <span className="mr-2 text-xs font-semibold uppercase tracking-wider text-gray-400">{tenantSlug}</span>
          <NavLink
            to={`/t/${tenantSlug}/admin/courses`}
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`
            }
          >
            <span className="flex items-center gap-1.5"><GraduationCap className="h-3.5 w-3.5" /> Formations</span>
          </NavLink>
          <NavLink
            to={`/t/${tenantSlug}/admin/students`}
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`
            }
          >
            <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Étudiants</span>
          </NavLink>
          <NavLink
            to={`/t/${tenantSlug}/admin/members`}
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`
            }
          >
            <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Équipe</span>
          </NavLink>
          <NavLink
            to={`/t/${tenantSlug}/admin/settings`}
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`
            }
          >
            <span className="flex items-center gap-1.5"><Settings className="h-3.5 w-3.5" /> Paramètres</span>
          </NavLink>
        </div>
      </div>

      {/* Header */}
      <div className="border-b bg-white px-6 py-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-600" />
              <h1 className="text-lg font-bold text-gray-900">Paramètres de l'école</h1>
            </div>
            <p className="mt-0.5 text-sm text-gray-500">Branding, identité et configuration</p>
          </div>
          {tenant && (
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
              Plan : <strong>{tenant.plan ?? 'school'}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-3xl px-6 py-6">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}

        {!loading && (
          <form onSubmit={handleSave} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Identité */}
            <Section title="Identité de l'école" icon={School}>
              <Field label="Nom de l'école" hint="Affiché dans l'interface et les emails">
                <input
                  className={INPUT}
                  value={branding.name}
                  onChange={e => setBranding(b => ({ ...b, name: e.target.value }))}
                  placeholder="Ex : ISNA — Institut Supérieur du Numérique"
                />
              </Field>
              <Field label="Description" hint="Courte présentation affichée sur la vitrine">
                <textarea
                  className={INPUT}
                  rows={3}
                  value={branding.description}
                  onChange={e => setBranding(b => ({ ...b, description: e.target.value }))}
                  placeholder="Notre école forme les professionnels du numérique de demain…"
                />
              </Field>
              <Field label="Site web" hint="URL complète (optionnel)">
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    className={INPUT + ' pl-8'}
                    value={branding.website}
                    onChange={e => setBranding(b => ({ ...b, website: e.target.value }))}
                    placeholder="https://isna.school"
                    type="url"
                  />
                </div>
              </Field>
            </Section>

            {/* Branding visuel */}
            <Section title="Branding visuel" icon={Palette}>
              <Field label="Couleur d'accentuation" hint="Utilisée dans les boutons et badges">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={branding.accentColor}
                    onChange={e => setBranding(b => ({ ...b, accentColor: e.target.value }))}
                    className="h-9 w-16 cursor-pointer rounded border border-gray-200"
                  />
                  <input
                    className={INPUT + ' font-mono'}
                    value={branding.accentColor}
                    onChange={e => setBranding(b => ({ ...b, accentColor: e.target.value }))}
                    placeholder="#3B82F6"
                    maxLength={7}
                  />
                  <div
                    className="h-9 w-9 shrink-0 rounded-lg border"
                    style={{ backgroundColor: branding.accentColor }}
                  />
                </div>
              </Field>
              <Field label="URL du logo" hint="Lien vers une image hébergée (PNG/SVG recommandé)">
                <input
                  className={INPUT}
                  value={branding.logoUrl}
                  onChange={e => setBranding(b => ({ ...b, logoUrl: e.target.value }))}
                  placeholder="https://cdn.example.com/logo.svg"
                  type="url"
                />
              </Field>
              {branding.logoUrl && (
                <div className="rounded-lg border bg-gray-50 p-4">
                  <p className="mb-2 text-xs text-gray-500">Aperçu du logo :</p>
                  <img
                    src={branding.logoUrl}
                    alt="Logo école"
                    className="max-h-16 max-w-xs object-contain"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}
            </Section>

            {/* Connexion Google — branding custom */}
            {tenant && (
              <Section title="Connexion Google personnalisée" icon={KeyRound}>
                <TenantOAuthSettings
                  tenantId={tenant.id}
                  tenantSlug={tenantSlug}
                />
              </Section>
            )}

            {/* Stripe — paiements par tenant */}
            {tenant && (
              <Section title="Stripe — paiements personnalisés" icon={CreditCard}>
                <TenantStripeSettings tenantId={tenant.id} />
              </Section>
            )}

            {/* PayPal — paiements par tenant */}
            {tenant && (
              <Section title="PayPal — paiements personnalisés" icon={CreditCard}>
                <TenantPayPalSettings tenantId={tenant.id} />
              </Section>
            )}

            {/* Infos tenant (lecture seule) */}
            {tenant && (
              <Section title="Informations techniques" icon={Settings}>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Slug</p>
                    <code className="rounded bg-gray-100 px-2 py-1 text-xs font-mono text-gray-700">{tenant.slug}</code>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Tenant ID</p>
                    <code className="rounded bg-gray-100 px-2 py-1 text-xs font-mono text-gray-700">{tenant.id?.slice(0, 12)}…</code>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Statut</p>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      tenant.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {tenant.status ?? 'active'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Plan</p>
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {tenant.plan ?? 'school'}
                    </span>
                  </div>
                </div>
              </Section>
            )}

            {/* Boutons save */}
            <div className="flex items-center justify-end gap-3 pt-2">
              {saved && (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <Check className="h-4 w-4" /> Sauvegardé
                </span>
              )}
              <button type="button" className={BTN_GHOST} onClick={() => window.history.back()}>
                Annuler
              </button>
              <button type="submit" className={BTN_PRIMARY} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Sauvegarder
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
