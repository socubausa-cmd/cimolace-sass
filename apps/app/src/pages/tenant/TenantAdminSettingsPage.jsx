/**
 * TenantAdminSettingsPage — RÉGLAGES · INTÉGRATIONS & CANAUX du tenant, monté à
 * `/liri/reglages` DANS la coque du portail LIRI (même montage que /liri/compte,
 * /liri/ecole, /liri/services : `<ProtectedLiriRoute>` en garde + `<LiriPortalShell>`
 * posé PAR LA PAGE — jamais deux coques, jamais deux bandeaux).
 *
 * POURQUOI cette page existe : elle est le SEUL chemin d'écriture des identifiants
 * d'applications tierces du tenant — Google, Stripe, PayPal, WhatsApp, e-mail, et
 * surtout les RÉSEAUX SOCIAUX, dont les clés OAuth sont lues exclusivement dans
 * `tenants.metadata.social_apps[platform]` (aucun repli sur l'environnement).
 * Elle a longtemps été importée sans jamais être routée : le portail affichait un
 * publieur social opérationnel côté API, sans aucun écran pour lui donner ses clés.
 *
 * ACCÈS : owner/admin uniquement — cet écran porte des SECRETS d'application.
 *
 * ORDRE DES SECTIONS : « Réseaux sociaux » en premier (c'est l'entrée manquante du
 * parcours de publication) ; l'identité/marque reste en bas, /liri/compte › Marque
 * couvrant déjà le même terrain.
 *
 * Connecté à PATCH /tenants/current/branding et GET /tenants/current.
 */
import { useEffect, useState } from 'react';
import { Settings, Save, Loader2, Check, AlertCircle, Globe, Palette, School, KeyRound, CreditCard, MessageCircle, Mail, Share2, Store, FileText, SpellCheck } from 'lucide-react';
import { tenantsApi } from '@/lib/api-v2';
import { useStudentDossierSetting } from '@/hooks/useStudentDossierSetting';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import { usePortalCrumb } from '@/components/liri/portalHeader';
import TenantOAuthSettings from '@/components/admin/TenantOAuthSettings';
import TenantStripeSettings from '@/components/admin/TenantStripeSettings';
import TenantPayPalSettings from '@/components/admin/TenantPayPalSettings';
import TenantWhatsAppSettings from '@/components/admin/TenantWhatsAppSettings';
import TenantEmailSettings from '@/components/admin/TenantEmailSettings';
import TenantSocialSettings from '@/components/admin/TenantSocialSettings';
import TenantVocabulaireSettings from '@/components/admin/TenantVocabulaireSettings';
import BoutiqueManager from '@/components/admin/BoutiqueManager';

/**
 * Tokens de la page — CHARTE LIRI (fond #262624 · panneau #30302e · champ #2b2a27 ·
 * encre #f5f4ee · corail = actions · or #d99a4e · lignes rgba(245,244,238,.09)).
 * On garde EXACTEMENT les noms de clés de l'ancien `ADMIN_T` (navy + #D4AF37, bannis
 * par la charte) : le corps de la page n'a pas à changer, seules les valeurs changent.
 */
const T = {
  bg:          '#262624',
  surface:     '#2b2a27',
  surface2:    '#34332f',
  surfaceCard: '#30302e',
  surfaceSoft: 'rgba(245,244,238,0.04)',
  border:      'rgba(245,244,238,0.09)',
  borderMid:   'rgba(245,244,238,0.15)',
  gold:        '#d99a4e',
  goldDim:     'rgba(217,154,78,0.12)',
  goldMid:     'rgba(217,154,78,0.30)',
  coral:       '#d97757',
  coralInk:    '#1f1e1c', // encre SOMBRE sur aplat corail (5,34:1)
  success:     '#9fbf8f',
  warning:     '#d99a4e',
  danger:      '#e2553f',
  t1: '#f5f4ee',
  t2: '#b0ada3',
  t3: '#82807a',
  t4: 'rgba(245,244,238,0.16)',
  mono: "'JetBrains Mono','Fira Code',ui-monospace,monospace",
};

/**
 * Remise au chaud des composants ENFANTS (TenantOAuth/Stripe/PayPal/WhatsApp/Email,
 * BoutiqueManager) : ils portent en dur `bg-[#0F1419]`, un navy banni par la charte.
 * On ne les modifie pas (hors périmètre) — on neutralise la couleur dans le scope de
 * cette page, comme le fait déjà `/liri/ecole` avec `.ecole-warm-scope`.
 * Leur accent passe par `var(--school-accent, #D4AF37)` : la coque du portail règle
 * déjà `--school-accent: #d97757`, l'or froid n'est donc jamais atteint ici.
 */
const REGLAGES_WARM_CSS = `
.liri-reglages-scope [class*="bg-[#0F1419]"] { background-color: #2b2a27 !important; }
.liri-reglages-scope input, .liri-reglages-scope textarea, .liri-reglages-scope select { color: #f5f4ee; }
.liri-reglages-scope input::placeholder, .liri-reglages-scope textarea::placeholder { color: #82807a; }
`;

const inputStyle = {
  width: '100%', borderRadius: 8, border: `1px solid ${T.border}`,
  background: T.surface, color: T.t1, padding: '8px 12px', fontSize: 13, outline: 'none',
};
const onInputFocus = (e) => { e.target.style.borderColor = T.goldMid; };
const onInputBlur = (e) => { e.target.style.borderColor = T.border; };

// CORAIL = LES ACTIONS (charte LIRI), avec une encre SOMBRE : sur l'aplat corail le
// blanc tombe à 2,83:1 alors que #1f1e1c tient 5,34:1.
const btnPrimary = {
  display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8,
  background: T.coral, color: T.coralInk, padding: '8px 16px', fontSize: 13, fontWeight: 600,
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
  // Fil d'Ariane poussé dans l'EN-TÊTE du portail (règle d'organisation des menus :
  // pas de barre de titre concurrente dans le corps de la page).
  usePortalCrumb(['Réglages', 'Intégrations & canaux']);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const [branding, setBranding] = useState({
    name: '',
    description: '',
    slogan: '',
    vision: '',
    website: '',
    accentColor: '#d97757',
    logoUrl: '',
  });

  // Réglage « dossier élève » (KYC) — logique partagée avec SettingsPage (portail LIRI).
  const dossier = useStudentDossierSetting();

  useEffect(() => {
    tenantsApi.current()
      .then(brut => {
        /**
         * ⚠️ DOUBLE ENVELOPPE — piège récurrent du projet, et ici il ne se voyait pas.
         * `GET /tenants/current` renvoie `{ data: req.tenant }` PUIS le ResponseInterceptor
         * global enveloppe une seconde fois → le corps HTTP est `{ data: { data: tenant } }`
         * (c'est écrit noir sur blanc dans tenant.controller.ts). Or `unwrap` d'api-v2 ne
         * retire QU'UNE couche : cette promesse résout `{ data: tenant }`, pas le tenant.
         * Conséquence silencieuse : `t.name`, `t.slug`, `t.metadata.site` étaient tous
         * `undefined` — le formulaire d'identité s'affichait VIDE, et « Sauvegarder »
         * envoyait alors `name: ''`, effaçant le nom de l'école en base.
         * Les autres appelants (useStudentDossierSetting, VideothequePage) déballent déjà
         * défensivement ; celui-ci ne le faisait pas. On teste une clé QUI EXISTE TOUJOURS
         * sur un tenant (`slug`) plutôt que l'absence de `data` : un tenant n'a pas de
         * champ `data`, mais l'enveloppe, elle, n'a pas de `slug`.
         */
        const t = (brut?.slug || brut?.id) ? brut : (brut?.data ?? brut);
        setTenant(t);
        const site = t?.metadata?.site ?? {};
        setBranding({
          name: t.name ?? t.branding?.name ?? '',
          description: site.description ?? t.branding?.description ?? t.description ?? '',
          slogan: site.slogan ?? '',
          vision: site.vision ?? '',
          website: site.website ?? t.branding?.website ?? '',
          accentColor: t.brand_colors?.accent ?? t.branding?.accentColor ?? '#d97757',
          logoUrl: t.logo_url ?? t.branding?.logoUrl ?? '',
        });
      })
      .catch(e => setError(e?.message ?? 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, []);

  /**
   * Sauvegarde de la MARQUE (PATCH /tenants/current/branding) — et RIEN d'autre.
   *
   * ⚠️ N'est plus déclenchée par un `onSubmit` de formulaire, mais par le `onClick`
   * du bouton « Sauvegarder ». POURQUOI : cette page monte des composants qui rendent
   * CHACUN leur propre `<form onSubmit>` avec un bouton `type="submit"`
   * (TenantSocialSettings, TenantOAuthSettings, TenantStripeSettings,
   * TenantPayPalSettings). Tant que le corps de page était lui-même un `<form>`, ces
   * formulaires étaient IMBRIQUÉS : l'événement `submit` de l'enfant remonte l'arbre
   * React jusqu'au parent (le `e.preventDefault()` de l'enfant bloque la soumission
   * NATIVE, pas la propagation), et enregistrer une clé TikTok déclenchait EN PLUS un
   * PATCH branding avec l'état chargé au montage — écrasant toute modification de
   * marque faite entre-temps sur /liri/compte, et affichant une erreur de branding
   * alors que la clé, elle, était bien passée. Le conteneur est donc un `<div>`.
   * `e` peut être absent : on ne suppose pas d'événement.
   */
  async function handleSave(e) {
    e?.preventDefault?.();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      // Payload CANONIQUE attendu par UpdateBrandingDto (le camelCase brut était
      // silencieusement jeté par la whitelist ValidationPipe → rien ne persistait).
      await tenantsApi.updateBranding({
        // Ceinture ET bretelles sur le NOM : c'est le seul champ d'ici dont l'effacement
        // est irréversible et visible partout (interface, e-mails, vitrine). Un état
        // vide — chargement échoué, réponse inattendue — ne doit jamais pouvoir
        // l'écraser ; on omet la clé plutôt que d'envoyer une chaîne vide (le service
        // n'écrit que les champs présents dans le DTO).
        ...(branding.name?.trim() ? { name: branding.name } : {}),
        logo_url: branding.logoUrl,
        brand_colors: { accent: branding.accentColor },
        site: {
          description: branding.description,
          slogan: branding.slogan,
          vision: branding.vision,
          website: branding.website,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err?.message ?? 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  // Clé de rail `integrations`, PAS `reglages` : `reglages` est déjà revendiquée par
  // /liri/compte (LiriAccountPage) et par LiriUpgradeWall. Réutiliser la même clé
  // allumerait la même entrée pour deux surfaces différentes. `integrations` était
  // déjà déclarée dans le type RailKey, orpheline — elle trouve ici son écran.
  return (
    <LiriPortalShell active="integrations" rail>
      <style>{REGLAGES_WARM_CSS}</style>
      <div
        className="lp-scroll liri-reglages-scope relative min-h-0 overflow-y-auto"
        style={{ background: T.bg, color: T.t1 }}
      >
        <div style={{ margin: '0 auto', width: '100%', maxWidth: 880, padding: '24px 16px 48px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings style={{ width: 20, height: 20, color: T.coral }} />
            <h1 style={{ fontSize: 19, fontWeight: 700, color: T.t1, margin: 0 }}>Réglages · Intégrations & canaux</h1>
          </div>
          <p style={{ marginTop: 2, fontSize: 13, color: T.t2 }}>
            Les services extérieurs que ton organisation branche à son portail : réseaux sociaux,
            connexion Google, encaissement, messages, boutique.
          </p>
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
        /* ⛔ PAS de <form> ici : voir handleSave. Un formulaire à cet endroit
           englobait les formulaires des sections (réseaux sociaux, Google, Stripe,
           PayPal) et faisait partir un PATCH branding parasite à chaque
           enregistrement de clés. La sauvegarde de la marque part du bouton. */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10,
              background: 'rgba(226,85,63,0.10)', border: `1px solid rgba(226,85,63,0.30)`,
              padding: 16, fontSize: 13, color: T.danger,
            }}>
              <AlertCircle style={{ width: 16, height: 16, flexShrink: 0 }} />
              {error}
            </div>
          )}

          {/* RÉSEAUX SOCIAUX EN PREMIER : c'est le maillon qui manquait au parcours de
              publication (l'API sait publier, mais personne ne pouvait lui donner de clés).
              Ancre `#reseaux-sociaux` pour un lien direct depuis le rail ou une notice. */}
          {tenant && (
            <div id="reseaux-sociaux" style={{ scrollMarginTop: 24 }}>
              <Section title="Réseaux sociaux — publication des shorts" icon={Share2}>
                <TenantSocialSettings />
              </Section>
            </div>
          )}

          {/* VOCABULAIRE juste APRÈS les réseaux sociaux : les deux servent la même
              chaîne (fabriquer un extrait, puis le publier), et c'est dans cet ordre
              qu'on la parcourt. Un créateur qui vient brancher TikTok découvre du même
              coup pourquoi ses sous-titres écrivaient « Shao ».
              Ancre `#vocabulaire` pour un lien direct depuis une notice ou le journal
              de fabrication d'un extrait. */}
          {tenant && (
            <div id="vocabulaire" style={{ scrollMarginTop: 24 }}>
              <Section title="Vocabulaire de l'école — noms propres" icon={SpellCheck}>
                <TenantVocabulaireSettings />
              </Section>
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
            <Field label="Slogan" hint="Phrase d'accroche affichée sous le nom (vitrine, emails)">
              <input
                style={inputStyle}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
                value={branding.slogan}
                onChange={e => setBranding(b => ({ ...b, slogan: e.target.value }))}
                placeholder="Ex : La connaissance n'est pas un privilège, c'est une responsabilité"
                maxLength={160}
              />
            </Field>
            <Field label="Vision" hint="Votre mission long terme — affichée sur la page « À propos » de la vitrine">
              <textarea
                style={inputStyle}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
                rows={3}
                value={branding.vision}
                onChange={e => setBranding(b => ({ ...b, vision: e.target.value }))}
                placeholder="Former une génération capable de…"
                maxLength={1200}
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

          {/* Inscription des élèves — gating dossier KYC (activable par tenant) */}
          {tenant && (
            <Section title="Inscription des élèves" icon={FileText}>
              <Field
                label="Exiger un dossier élève (KYC certificats)"
                hint="Activé : après paiement, l'élève téléverse pièce d'identité, preuve de résidence, demi-carte photo et signe le consentement avant d'accéder à son espace (requis pour l'édition des certificats). Désactivé : accès direct au tableau de bord."
              >
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!dossier.value}
                    disabled={dossier.value === null || dossier.saving}
                    onChange={(e) => dossier.save(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: T.gold }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 500, color: dossier.value ? T.t1 : T.t2 }}>
                    {dossier.value === null ? 'Chargement…' : (dossier.value ? 'Dossier exigé' : 'Dossier non requis')}
                  </span>
                  {dossier.saving && <Loader2 className="animate-spin" style={{ width: 14, height: 14, color: T.t3 }} />}
                  {dossier.saved && <Check style={{ width: 14, height: 14, color: T.success }} />}
                </label>
              </Field>
            </Section>
          )}

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
                  placeholder="#d97757"
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

          {/* Boutique en ligne — moteur mbolo (produits + codes promo) */}
          {tenant && (
            <Section title="Boutique en ligne" icon={Store}>
              <BoutiqueManager />
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
                      ? { background: 'rgba(159,191,143,0.15)', color: T.success }
                      : { background: 'rgba(217,154,78,0.15)', color: T.warning }),
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
            {/* type="button" + onClick : le conteneur n'est plus un <form>, un
                type="submit" ne déclencherait plus rien (et, dans l'ancien montage,
                aurait continué d'attraper les submit des sections enfants). */}
            <button type="button" onClick={handleSave} style={{ ...btnPrimary, opacity: saving ? 0.5 : 1 }} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} /> : <Save style={{ width: 16, height: 16 }} />}
              Sauvegarder
            </button>
          </div>
        </div>
      )}
        </div>
      </div>
    </LiriPortalShell>
  );
}
