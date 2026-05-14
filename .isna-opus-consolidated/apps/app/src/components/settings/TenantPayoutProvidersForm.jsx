import React, { useState, useEffect, useCallback } from 'react';
import TenantPaymentOnboardingWizard from '@/components/settings/TenantPaymentOnboardingWizard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';
import { Copy } from 'lucide-react';

const FN_ACCOUNTS = '/.netlify/functions/billing-save-tenant-payment-accounts';
const FN_CONTEXT = '/.netlify/functions/billing-get-tenant-billing-context';
const FN_PREFS = '/.netlify/functions/billing-save-tenant-billing-preferences';

async function authFetch(url, options = {}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Session expirée : reconnectez-vous.');
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error || json?.hint || res.statusText;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return json;
}

async function postProvider({ tenantSlug, provider, credentials, publicConfig }) {
  return authFetch(FN_ACCOUNTS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantSlug,
      provider,
      status: 'active',
      credentials,
      publicConfig: publicConfig || undefined,
    }),
  });
}

export default function TenantPayoutProvidersForm({ initialTenantSlug, lockTenantSlug = false } = {}) {
  const { toast } = useToast();
  const resolvedInitial =
    (typeof initialTenantSlug === 'string' && initialTenantSlug.trim()) || isnaTenantConfig.slug || 'isna';
  const [tenantSlug, setTenantSlug] = useState(resolvedInitial);
  const [busy, setBusy] = useState(null);
  const [busyPrefs, setBusyPrefs] = useState(false);
  const [ctxLoading, setCtxLoading] = useState(false);

  const [billingCtx, setBillingCtx] = useState(null);

  const [strictChariow, setStrictChariow] = useState(false);
  const [strictPaypal, setStrictPaypal] = useState(false);

  const [chariowKey, setChariowKey] = useState('');
  const [chariowWh, setChariowWh] = useState('');

  const [stripeSk, setStripeSk] = useState('');
  const [stripeWh, setStripeWh] = useState('');

  const [ppId, setPpId] = useState('');
  const [ppSecret, setPpSecret] = useState('');
  const [ppWhId, setPpWhId] = useState('');
  const [ppBase, setPpBase] = useState('https://api-m.sandbox.paypal.com');
  const [ppEnv, setPpEnv] = useState('sandbox');

  const slugNorm = tenantSlug.trim().toLowerCase();

  const loadContext = useCallback(async () => {
    if (!slugNorm) return;
    setCtxLoading(true);
    try {
      const q = new URLSearchParams({ tenantSlug: slugNorm });
      const data = await authFetch(`${FN_CONTEXT}?${q.toString()}`, { method: 'GET' });
      setBillingCtx(data);
      setStrictChariow(Boolean(data?.billing?.strict_chariow));
      setStrictPaypal(Boolean(data?.billing?.strict_paypal));
    } catch (e) {
      setBillingCtx(null);
      toast({
        title: 'Impossible de charger le contexte',
        description: e?.message || 'Erreur',
        variant: 'destructive',
      });
    } finally {
      setCtxLoading(false);
    }
  }, [slugNorm, toast]);

  useEffect(() => {
    const s = typeof initialTenantSlug === 'string' ? initialTenantSlug.trim().toLowerCase() : '';
    if (s) setTenantSlug(s);
  }, [initialTenantSlug]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  const copyText = async (label, text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copié', description: label, className: 'bg-emerald-700 text-white border-none' });
    } catch {
      toast({ title: 'Copie impossible', description: 'Autorise le presse-papiers ou copie manuelle.', variant: 'destructive' });
    }
  };

  const saveBillingPrefs = async () => {
    setBusyPrefs(true);
    try {
      await authFetch(FN_PREFS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: slugNorm,
          billing: { strict_chariow: strictChariow, strict_paypal: strictPaypal },
        }),
      });
      toast({
        title: 'Politique enregistrée',
        description: 'Les options strict tenant s’appliquent sans redéploiement.',
        className: 'bg-emerald-700 text-white border-none',
      });
      await loadContext();
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Échec', variant: 'destructive' });
    } finally {
      setBusyPrefs(false);
    }
  };

  const onSave = async (provider, credentials, publicConfig) => {
    setBusy(provider);
    try {
      await postProvider({ tenantSlug: slugNorm, provider, credentials, publicConfig });
      toast({
        title: 'Enregistré',
        description: `Compte ${provider} mis à jour pour « ${slugNorm} ».`,
        className: 'bg-emerald-700 text-white border-none',
      });
      await loadContext();
    } catch (e) {
      toast({
        title: 'Erreur',
        description: e?.message || 'Échec',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  const webhookRows = billingCtx?.webhookUrls
    ? [
        { key: 'paypal', label: 'Webhook PayPal', url: billingCtx.webhookUrls.paypal },
        { key: 'chariow', label: 'Webhook Chariow', url: billingCtx.webhookUrls.chariow },
        { key: 'stripe', label: 'Webhook Stripe', url: billingCtx.webhookUrls.stripe },
      ]
    : [];

  return (
    <div className="space-y-6">
      <TenantPaymentOnboardingWizard
        tenantSlug={tenantSlug}
        billingCtx={billingCtx}
        ctxLoading={ctxLoading}
        onRefreshContext={loadContext}
      />

      <Card className="bg-[#192734] border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Encaissement (sans toucher au code)</CardTitle>
          <CardDescription className="text-gray-400 space-y-2">
            <span className="block">
              Le contact du tenant (email enregistré sur le tenant Cimolace) ou un admin peut tout configurer ici : clés,
              URLs à coller chez les fournisseurs, et politique « pas de repli sur les clés plateforme ».
            </span>
            <span className="block text-amber-200/90">
              Seule exception côté hébergeur : une fois pour toute, définir <code className="text-amber-100">BILLING_SECRETS_KEY</code>{' '}
              sur Netlify pour chiffrer les secrets — ce n’est pas exposé dans l’interface (sécurité).
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 max-w-xl">
          <div className="grid gap-2">
            <Label className="text-gray-300">Slug tenant</Label>
            {lockTenantSlug ? (
              <p className="rounded-md border border-white/10 bg-[#0F1419] px-3 py-2 font-mono text-sm text-white">{slugNorm}</p>
            ) : (
              <Input
                value={tenantSlug}
                onChange={(e) => setTenantSlug(e.target.value)}
                className="bg-[#0F1419] border-white/10 text-white font-mono"
              />
            )}
          </div>
          <Button type="button" variant="outline" className="border-white/20 text-gray-200" onClick={loadContext} disabled={ctxLoading}>
            {ctxLoading ? 'Chargement…' : 'Rafraîchir'}
          </Button>
        </CardContent>
      </Card>

      {billingCtx?.platform && (
        <Card id="payment-card-platform" className="bg-[#192734] border-white/10 border-amber-500/20 scroll-mt-24">
          <CardHeader>
            <CardTitle className="text-white text-lg">État plateforme (information)</CardTitle>
            <CardDescription className="text-gray-400">
              Réglages encore gérés par l’hébergeur Netlify ; l’interface les affiche pour éviter les erreurs de diagnostic.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-gray-300 space-y-1 font-mono">
            <p>
              Chiffrement secrets :{' '}
              {billingCtx.platform.billingSecretsKeyConfigured ? (
                <span className="text-emerald-400">BILLING_SECRETS_KEY OK</span>
              ) : (
                <span className="text-red-400">BILLING_SECRETS_KEY manquant — enregistrement des clés impossible</span>
              )}
            </p>
            <p>
              Webhook PayPal actif (Netlify) :{' '}
              {billingCtx.platform.paypalWebhookGloballyEnabled ? (
                <span className="text-emerald-400">oui</span>
              ) : (
                <span className="text-amber-400">non — définir BILLING_ENABLE_PAYPAL_WEBHOOK=1</span>
              )}
            </p>
            <p>
              Webhook Stripe actif (Netlify) :{' '}
              {billingCtx.platform.stripeWebhookGloballyEnabled ? (
                <span className="text-emerald-400">oui</span>
              ) : (
                <span className="text-amber-400">non — définir BILLING_ENABLE_STRIPE_WEBHOOK=1</span>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      <Card id="payment-card-webhooks" className="bg-[#192734] border-white/10 scroll-mt-24">
        <CardHeader>
          <CardTitle className="text-white">URLs webhooks (copier-coller)</CardTitle>
          <CardDescription>
            À coller tel quel dans PayPal Developer → Webhooks, et équivalent Chariow / Stripe si demandé.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-3xl">
          {webhookRows.map(({ key, label, url }) => (
            <div key={key} className="grid gap-2">
              <Label className="text-gray-300">{label}</Label>
              <div className="flex gap-2">
                <Input readOnly value={url || ''} className="bg-[#0F1419] border-white/10 text-white font-mono text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="border-white/20 shrink-0"
                  onClick={() => copyText(label, url)}
                  disabled={!url}
                  aria-label={`Copier ${label}`}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {!billingCtx?.webhookUrls && !ctxLoading ? (
            <p className="text-sm text-gray-500">Charge le contexte après connexion pour voir les URLs.</p>
          ) : null}
        </CardContent>
      </Card>

      {billingCtx?.readiness ? (
        <Card id="payment-card-readiness" className="bg-[#192734] border-white/10 border-emerald-500/15 scroll-mt-24">
          <CardHeader>
            <CardTitle className="text-white">Checklist webhooks (Stripe / PayPal)</CardTitle>
            <CardDescription className="text-gray-400">
              Généré côté serveur à partir de votre compte tenant et des variables Netlify — rien de secret n’est affiché.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 max-w-3xl text-sm text-gray-300">
            <div className="rounded-lg border border-white/10 bg-[#0F1419] p-4 space-y-2">
              <p className="text-white font-medium">PayPal</p>
              <p className="text-xs text-gray-500">
                Compte enregistré :{' '}
                <span className={billingCtx.readiness.paypal?.tenantAccountSaved ? 'text-emerald-400' : 'text-amber-400'}>
                  {billingCtx.readiness.paypal?.tenantAccountSaved ? 'oui' : 'non'}
                </span>
                {' · '}
                Webhook traité sur Netlify :{' '}
                <span
                  className={
                    billingCtx.readiness.paypal?.webhookListenerEnabledOnNetlify ? 'text-emerald-400' : 'text-amber-400'
                  }
                >
                  {billingCtx.readiness.paypal?.webhookListenerEnabledOnNetlify ? 'oui' : 'non'}
                </span>
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs text-gray-400">
                {(billingCtx.readiness.paypal?.nextSteps || []).map((t, i) => (
                  <li key={`pp-step-${i}`}>{t}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#0F1419] p-4 space-y-2">
              <p className="text-white font-medium">Stripe</p>
              <p className="text-xs text-gray-500">
                Compte enregistré :{' '}
                <span className={billingCtx.readiness.stripe?.tenantAccountSaved ? 'text-emerald-400' : 'text-amber-400'}>
                  {billingCtx.readiness.stripe?.tenantAccountSaved ? 'oui' : 'non'}
                </span>
                {' · '}
                Webhook traité sur Netlify :{' '}
                <span
                  className={
                    billingCtx.readiness.stripe?.webhookListenerEnabledOnNetlify ? 'text-emerald-400' : 'text-amber-400'
                  }
                >
                  {billingCtx.readiness.stripe?.webhookListenerEnabledOnNetlify ? 'oui' : 'non'}
                </span>
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs text-gray-400">
                {(billingCtx.readiness.stripe?.nextSteps || []).map((t, i) => (
                  <li key={`st-step-${i}`}>{t}</li>
                ))}
              </ul>
            </div>
            {billingCtx.readiness.dlqAdminUrl ? (
              <div className="grid gap-2">
                <Label className="text-gray-300">Admin DLQ (staff Netlify)</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={billingCtx.readiness.dlqAdminUrl}
                    className="bg-[#0F1419] border-white/10 text-white font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="border-white/20 shrink-0"
                    onClick={() => copyText('URL admin DLQ', billingCtx.readiness.dlqAdminUrl)}
                    aria-label="Copier URL admin DLQ"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                {billingCtx.readiness.dlqAdminHint ? (
                  <p className="text-xs text-gray-500">{billingCtx.readiness.dlqAdminHint}</p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card id="payment-card-policy" className="bg-[#192734] border-white/10 scroll-mt-24">
        <CardHeader>
          <CardTitle className="text-white">Politique d’isolement</CardTitle>
          <CardDescription>
            Si activé : pour les ventes de ce tenant, plus de repli automatique sur les clés globales Cimolace (Chariow /
            PayPal). Équivalent aux variables <code className="text-amber-200/90">BILLING_STRICT_TENANT_*</code>, mais piloté
            par vous depuis cette page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-xl">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-[#0F1419] p-4">
            <div>
              <p className="text-white text-sm font-medium">Chariow strict (tenant uniquement)</p>
              <p className="text-xs text-gray-500 mt-1">Les élèves paient via la boutique du tenant, pas la clé plateforme.</p>
            </div>
            <Switch checked={strictChariow} onCheckedChange={setStrictChariow} />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-[#0F1419] p-4">
            <div>
              <p className="text-white text-sm font-medium">PayPal strict (tenant uniquement)</p>
              <p className="text-xs text-gray-500 mt-1">Pas de repli sur PAYPAL_CLIENT_* globaux pour ce tenant.</p>
            </div>
            <Switch checked={strictPaypal} onCheckedChange={setStrictPaypal} />
          </div>
          <Button
            type="button"
            onClick={saveBillingPrefs}
            disabled={busyPrefs}
            className="bg-[#D4AF37] text-black hover:bg-[#c29e30]"
          >
            {busyPrefs ? '…' : 'Enregistrer la politique'}
          </Button>
        </CardContent>
      </Card>

      <Card id="payment-card-chariow" className="bg-[#192734] border-white/10 scroll-mt-24">
        <CardHeader>
          <CardTitle className="text-white">Chariow</CardTitle>
          <CardDescription>Clé API boutique + secret webhook (URL ci-dessus avec ce slug).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 max-w-xl">
          <div className="grid gap-2">
            <Label className="text-gray-300">chariow_api_key</Label>
            <Input
              type="password"
              autoComplete="off"
              value={chariowKey}
              onChange={(e) => setChariowKey(e.target.value)}
              placeholder="sk_…"
              className="bg-[#0F1419] border-white/10 text-white font-mono text-sm"
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-gray-300">Webhook secret (optionnel)</Label>
            <Input
              type="password"
              value={chariowWh}
              onChange={(e) => setChariowWh(e.target.value)}
              className="bg-[#0F1419] border-white/10 text-white font-mono text-sm"
            />
          </div>
          <Button
            disabled={busy === 'chariow' || !chariowKey.trim() || !billingCtx?.platform?.billingSecretsKeyConfigured}
            onClick={() =>
              onSave('chariow', {
                chariow_api_key: chariowKey.trim(),
                ...(chariowWh.trim() ? { chariow_webhook_secret: chariowWh.trim() } : {}),
              })
            }
            className="bg-[#D4AF37] text-black hover:bg-[#c29e30]"
          >
            {busy === 'chariow' ? '…' : 'Enregistrer Chariow'}
          </Button>
          {!billingCtx?.platform?.billingSecretsKeyConfigured ? (
            <p className="text-xs text-amber-400">Le serveur doit avoir BILLING_SECRETS_KEY pour accepter les secrets.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card id="payment-card-stripe" className="bg-[#192734] border-white/10 scroll-mt-24">
        <CardHeader>
          <CardTitle className="text-white">Stripe</CardTitle>
          <CardDescription>Secret key + signing secret webhook.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 max-w-xl">
          <div className="grid gap-2">
            <Label className="text-gray-300">stripe_secret_key</Label>
            <Input
              type="password"
              value={stripeSk}
              onChange={(e) => setStripeSk(e.target.value)}
              className="bg-[#0F1419] border-white/10 text-white font-mono text-sm"
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-gray-300">stripe_webhook_secret</Label>
            <Input
              type="password"
              value={stripeWh}
              onChange={(e) => setStripeWh(e.target.value)}
              className="bg-[#0F1419] border-white/10 text-white font-mono text-sm"
            />
          </div>
          <Button
            disabled={busy === 'stripe' || !stripeSk.trim() || !billingCtx?.platform?.billingSecretsKeyConfigured}
            onClick={() =>
              onSave('stripe', {
                stripe_secret_key: stripeSk.trim(),
                ...(stripeWh.trim() ? { stripe_webhook_secret: stripeWh.trim() } : {}),
              })
            }
            className="bg-[#635BFF] text-white hover:bg-[#4b45c6]"
          >
            {busy === 'stripe' ? '…' : 'Enregistrer Stripe'}
          </Button>
        </CardContent>
      </Card>

      <Card id="payment-card-paypal" className="bg-[#192734] border-white/10 scroll-mt-24">
        <CardHeader>
          <CardTitle className="text-white">PayPal</CardTitle>
          <CardDescription>
            REST app + Webhook ID. Utilise l’URL PayPal affichée plus haut. Le checkout enregistre déjà{' '}
            <code className="text-amber-200/90">custom_id</code> = identifiant paiement pour le webhook.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 max-w-xl">
          <div className="grid gap-2">
            <Label className="text-gray-300">Client ID</Label>
            <Input value={ppId} onChange={(e) => setPpId(e.target.value)} className="bg-[#0F1419] border-white/10 text-white font-mono text-sm" />
          </div>
          <div className="grid gap-2">
            <Label className="text-gray-300">Client secret</Label>
            <Input
              type="password"
              value={ppSecret}
              onChange={(e) => setPpSecret(e.target.value)}
              className="bg-[#0F1419] border-white/10 text-white font-mono text-sm"
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-gray-300">Webhook ID (dashboard PayPal)</Label>
            <Input value={ppWhId} onChange={(e) => setPpWhId(e.target.value)} className="bg-[#0F1419] border-white/10 text-white font-mono text-sm" />
          </div>
          <div className="grid gap-2">
            <Label className="text-gray-300">API base URL</Label>
            <Input value={ppBase} onChange={(e) => setPpBase(e.target.value)} className="bg-[#0F1419] border-white/10 text-white font-mono text-sm" />
          </div>
          <div className="grid gap-2">
            <Label className="text-gray-300">Environnement</Label>
            <select
              value={ppEnv}
              onChange={(e) => setPpEnv(e.target.value)}
              className="bg-[#0F1419] border border-white/10 text-white rounded-md p-2 text-sm"
            >
              <option value="sandbox">sandbox</option>
              <option value="live">live</option>
            </select>
          </div>
          <Button
            disabled={busy === 'paypal' || !ppId.trim() || !ppSecret.trim() || !ppWhId.trim() || !billingCtx?.platform?.billingSecretsKeyConfigured}
            onClick={() =>
              onSave(
                'paypal',
                {
                  paypal_client_id: ppId.trim(),
                  paypal_client_secret: ppSecret.trim(),
                  paypal_webhook_id: ppWhId.trim(),
                },
                { paypal_base_url: ppBase.trim(), paypal_environment: ppEnv }
              )
            }
            className="bg-[#0070ba] text-white hover:bg-[#005ea6]"
          >
            {busy === 'paypal' ? '…' : 'Enregistrer PayPal'}
          </Button>
        </CardContent>
      </Card>

      <p className="text-xs text-gray-500 max-w-2xl">
        Facturation purement plateforme : le front peut envoyer <code className="text-gray-400">billingContext: &quot;platform&quot;</code>{' '}
        au checkout pour utiliser les clés globales Cimolace (variables Netlify).
      </p>
    </div>
  );
}
