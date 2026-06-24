/**
 * TenantAdminSettingsPage — /t/:tenantSlug/admin/settings
 * Paramètres branding + infos de l'école.
 * Connecté à PATCH /tenants/current/branding et GET /tenants/current.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Settings, Save, Loader2, Check, AlertCircle, Globe, Palette, School, KeyRound, CreditCard, MessageCircle, Mail, Share2 } from 'lucide-react';
import { tenantsApi } from '@/lib/api-v2';
import TenantAdminShell from '@/components/admin/TenantAdminShell';
import { ADMIN_T as T } from '@/lib/tenantAdminTheme';
import TenantOAuthSettings from '@/components/admin/TenantOAuthSettings';
import TenantStripeSettings from '@/components/admin/TenantStripeSettings';
import TenantPayPalSettings from '@/components/admin/TenantPayPalSettings';
import TenantWhatsAppSettings from '@/components/admin/TenantWhatsAppSettings';
import TenantEmailSettings from '@/components/admin/TenantEmailSettings';
import TenantSocialSettings from '@/components/admin/TenantSocialSettings';

const inputStyle = {
  width: '100%', borderRadius: 8, border: `1px solid ${T.border}`,
  background: T.surface, color: T.t1, padding: '8px 12px', fontSize: 13, outline: 'none',
};
const onInputFocus = (e) => { e.target.style.borderColor = T.goldMid; };
const onInputBlur = (e) => { e.target.style.borderColor = T.border; };

const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8,
  background: T.gold, color: '#000', padding: '8px 16px', fontSize: 13, fontWeight: 600,
  border: 'none', cursor: 'pointer',
};
const btnGhost = {
  display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8,
  background: 'transparent', color: T.t2, padding: '8px 16px', fontSize: 13,
  border: `1px solid ${T.border}`, cursor: 'pointer',
};

function Field({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: T.t2 }}>{label}</label>
      {hint && <p style={{ fontSize: 11, color: T.t3, margin: 0 }}>{hint}</p>}
      {children}
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div style={{ borderRadius: 14, border: `1px solid ${T.border}`, background: T.surfaceCard, padding: 24 }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${T.border}`, paddingBottom: 16 }}>
        <Icon style={{ width: 16, height: 16, color: T.gold }} />
        <h2 style={{ fontSize: 13, fontWeight: 600, color: T.t1, margin: 0 }}>{title}</h2>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
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
    <TenantAdminShell>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings style={{ width: 20, height: 20, color: T.gold }} />
            <h1 style={{ fontSize: 19, fontWeight: 700, color: T.t1, margin: 0 }}>Paramètres de l'école</h1>
          </div>
          <p style={{ marginTop: 2, fontSize: 13, color: T.t2 }}>Branding, identité et configuration</p>
        </div>
        {tenant && (
          <span style={{
            borderRadius: 999, background: T.surface2, border: `1px solid ${T.border}`,
            padding: '4px 12px', fontSize: 12, fontWeight: 500, color: T.t2,
          }}>
            Plan : <strong style={{ color: T.t1 }}>{tenant.plan ?? 'school'}</strong>
          </span>
        )}
      </div>

      {/* Body */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0' }}>
          <Loader2 className="animate-spin" style={{ width: 24, height: 24, color: T.t3 }} />
        </div>
      )}

      {!loading && (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10,
              background: 'rgba(239,68,68,0.12)', border: `1px solid rgba(239,68,68,0.28)`,
              padding: 16, fontSize: 13, color: T.danger,
            }}>
              <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
              {error}
            </div>
          )}

          {/* Identité */}
          <Section title="Identité de l'école" icon={School}>
            <Field label="Nom de l'école" hint="Affiché dans l'interface et les emails">
              <input
                style={inputStyle}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
                value={branding.name}
                onChange={e => setBranding(b => ({ ...b, name: e.target.value }))}
                placeholder="Ex : ISNA — Institut Supérieur du Numérique"
              />
            </Field>
            <Field label="Description" hint="Courte présentation affichée sur la vitrine">
              <textarea
                style={inputStyle}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
                rows={3}
                value={branding.description}
                onChange={e => setBranding(b => ({ ...b, description: e.target.value }))}
                placeholder="Notre école forme les professionnels du numérique de demain…"
              />
            </Field>
            <Field label="Site web" hint="URL complète (optionnel)">
              <div style={{ position: 'relative' }}>
                <Globe style={{ position: 'absolute', left: 12, top: '50%', width: 14, height: 14, transform: 'translateY(-50%)', color: T.t3 }} />
                <input
                  style={{ ...inputStyle, paddingLeft: 32 }}
                  onFocus={onInputFocus}
                  onBlur={onInputBlur}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="color"
                  value={branding.accentColor}
                  onChange={e => setBranding(b => ({ ...b, accentColor: e.target.value }))}
                  style={{ height: 36, width: 64, cursor: 'pointer', borderRadius: 6, border: `1px solid ${T.border}`, background: T.surface }}
                />
                <input
                  style={{ ...inputStyle, fontFamily: T.mono }}
                  onFocus={onInputFocus}
                  onBlur={onInputBlur}
                  value={branding.accentColor}
                  onChange={e => setBranding(b => ({ ...b, accentColor: e.target.value }))}
                  placeholder="#3B82F6"
                  maxLength={7}
                />
                <div
                  style={{ height: 36, width: 36, flexShrink: 0, borderRadius: 8, border: `1px solid ${T.border}`, backgroundColor: branding.accentColor }}
                />
              </div>
            </Field>
            <Field label="URL du logo" hint="Lien vers une image hébergée (PNG/SVG recommandé)">
              <input
                style={inputStyle}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
                value={branding.logoUrl}
                onChange={e => setBranding(b => ({ ...b, logoUrl: e.target.value }))}
                placeholder="https://cdn.example.com/logo.svg"
                type="url"
              />
            </Field>
            {branding.logoUrl && (
              <div style={{ borderRadius: 10, border: `1px solid ${T.border}`, background: T.surface2, padding: 16 }}>
                <p style={{ marginBottom: 8, fontSize: 11, color: T.t3 }}>Aperçu du logo :</p>
                <img
                  src={branding.logoUrl}
                  alt="Logo école"
                  style={{ maxHeight: 64, maxWidth: 320, objectFit: 'contain' }}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              </div>
            )}
          </Section>

          {/* Connexion Google — branding custom */}
          {tenant && (
            <Section title="Connexion Google personnalisée" icon={KeyRound}>
              <TenantOAuthSettings />
            </Section>
          )}

          {/* Stripe — paiements par tenant */}
          {tenant && (
            <Section title="Stripe — paiements personnalisés" icon={CreditCard}>
              <TenantStripeSettings />
            </Section>
          )}

          {/* PayPal — paiements par tenant */}
          {tenant && (
            <Section title="PayPal — paiements personnalisés" icon={CreditCard}>
              <TenantPayPalSettings />
            </Section>
          )}

          {/* Chaîne WhatsApp — notifications de l'école (no-code) */}
          {tenant && (
            <Section title="Chaîne WhatsApp" icon={MessageCircle}>
              <TenantWhatsAppSettings />
            </Section>
          )}

          {/* Expéditeur email — domaine d'envoi de l'école (no-code, multi-tenant) */}
          {tenant && (
            <Section title="Expéditeur email" icon={Mail}>
              <TenantEmailSettings />
            </Section>
          )}

          {/* Réseaux sociaux — auto-promo des lives (config app + connexion OAuth) */}
          {tenant && (
            <Section title="Réseaux sociaux — auto-promo des lives" icon={Share2}>
              <TenantSocialSettings />
            </Section>
          )}

          {/* Infos tenant (lecture seule) */}
          {tenant && (
            <Section title="Informations techniques" icon={Settings}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 500, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Slug</p>
                  <code style={{ borderRadius: 4, background: T.surface2, padding: '4px 8px', fontSize: 11, fontFamily: T.mono, color: T.t2 }}>{tenant.slug}</code>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 500, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Tenant ID</p>
                  <code style={{ borderRadius: 4, background: T.surface2, padding: '4px 8px', fontSize: 11, fontFamily: T.mono, color: T.t2 }}>{tenant.id?.slice(0, 12)}…</code>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 500, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Statut</p>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 500,
                    ...(tenant.status === 'active'
                      ? { background: 'rgba(34,197,94,0.14)', color: T.success }
                      : { background: 'rgba(245,158,11,0.14)', color: T.warning }),
                  }}>
                    {tenant.status ?? 'active'}
                  </span>
                </div>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 500, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Plan</p>
                  <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 999, background: T.goldDim, border: `1px solid ${T.goldMid}`, padding: '2px 8px', fontSize: 11, fontWeight: 500, color: T.gold }}>
                    {tenant.plan ?? 'school'}
                  </span>
                </div>
              </div>
            </Section>
          )}

          {/* Boutons save */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, paddingTop: 8 }}>
            {saved && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: T.success }}>
                <Check style={{ width: 16, height: 16 }} /> Sauvegardé
              </span>
            )}
            <button type="button" style={btnGhost} onClick={() => window.history.back()}>
              Annuler
            </button>
            <button type="submit" style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} /> : <Save style={{ width: 16, height: 16 }} />}
              Sauvegarder
            </button>
          </div>
        </form>
      )}
    </TenantAdminShell>
  );
}
