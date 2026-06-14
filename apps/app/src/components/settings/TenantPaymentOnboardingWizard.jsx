import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  Circle,
} from 'lucide-react';

const STORAGE_PREFIX = 'payment_onboarding_v1';

const LINKS = {
  stripeSignup: 'https://dashboard.stripe.com/register',
  stripeApiKeys: 'https://dashboard.stripe.com/apikeys',
  stripeWebhooks: 'https://dashboard.stripe.com/webhooks',
  paypalBusiness: 'https://www.paypal.com/businessmanage/account/onboarding',
  paypalDeveloper: 'https://developer.paypal.com/dashboard/',
  paypalWebhooksDoc: 'https://developer.paypal.com/api/rest/webhooks/',
};

const FN_ASSISTANT = '/.netlify/functions/billing-payment-setup-assistant';
const FN_PREFS = '/.netlify/functions/billing-save-tenant-billing-preferences';

function storageKey(tenantSlug) {
  return `${STORAGE_PREFIX}:${String(tenantSlug || '').trim().toLowerCase()}`;
}

function loadProgress(tenantSlug) {
  try {
    const raw = localStorage.getItem(storageKey(tenantSlug));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveProgress(tenantSlug, data) {
  try {
    localStorage.setItem(storageKey(tenantSlug), JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function buildStepIds(selection) {
  const ids = ['welcome', 'platform', 'pick'];
  if (selection.chariow) {
    ids.push('chariow_account');
    ids.push('chariow_setup');
  }
  if (selection.stripe) {
    ids.push('stripe_account');
    ids.push('stripe_setup');
  }
  if (selection.paypal) {
    ids.push('paypal_account');
    ids.push('paypal_setup');
  }
  ids.push('webhooks', 'policy', 'done');
  return ids;
}

async function authFetchAssistant(body) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Session expirée : reconnectez-vous.');
  const res = await fetch(FN_ASSISTANT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error || json?.hint || res.statusText;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return json;
}

async function authFetchPrefs(body) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Session expirée : reconnectez-vous.');
  const res = await fetch(FN_PREFS, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error || json?.hint || res.statusText;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return json;
}

export default function TenantPaymentOnboardingWizard({
  tenantSlug,
  billingCtx,
  ctxLoading,
  onRefreshContext,
}) {
  const { toast } = useToast();
  const slug = String(tenantSlug || '').trim().toLowerCase();

  const [collapsed, setCollapsed] = useState(false);
  const [selection, setSelection] = useState({ chariow: true, stripe: false, paypal: false });
  const [chariowHasAccount, setChariowHasAccount] = useState(null);
  const [stripeHasAccount, setStripeHasAccount] = useState(null);
  const [paypalHasAccount, setPaypalHasAccount] = useState(null);

  const [stepIndex, setStepIndex] = useState(0);

  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content:
        'Bonjour. Posez votre question sur la configuration des paiements (Stripe, PayPal, Chariow, webhooks). Ne collez pas de clés secrètes ici.',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);

  const serverOnboardingSig = useRef('');
  const remoteTimerRef = useRef(null);

  const providersConfigured = billingCtx?.providersConfigured;

  useEffect(() => {
    const saved = loadProgress(slug);
    if (saved?.selection && typeof saved.selection === 'object') {
      setSelection((prev) => ({ ...prev, ...saved.selection }));
    }
    if (typeof saved?.stepIndex === 'number' && saved.stepIndex >= 0) setStepIndex(saved.stepIndex);
    if (saved?.chariowHasAccount === true || saved?.chariowHasAccount === false) setChariowHasAccount(saved.chariowHasAccount);
    if (saved?.stripeHasAccount === true || saved?.stripeHasAccount === false) setStripeHasAccount(saved.stripeHasAccount);
    if (saved?.paypalHasAccount === true || saved?.paypalHasAccount === false) setPaypalHasAccount(saved.paypalHasAccount);
    if (saved?.collapsed === true) setCollapsed(true);
  }, [slug]);

  useEffect(() => {
    const po = billingCtx?.billing?.payment_onboarding;
    if (!po || typeof po !== 'object') return;
    const sig = JSON.stringify(po);
    if (sig === serverOnboardingSig.current) return;
    serverOnboardingSig.current = sig;
    if (typeof po.stepIndex === 'number' && po.stepIndex >= 0) setStepIndex(po.stepIndex);
    if (po.selection && typeof po.selection === 'object') {
      setSelection((prev) => ({
        ...prev,
        chariow: Boolean(po.selection.chariow),
        stripe: Boolean(po.selection.stripe),
        paypal: Boolean(po.selection.paypal),
      }));
    }
    if (po.chariowHasAccount === true || po.chariowHasAccount === false || po.chariowHasAccount === null) {
      setChariowHasAccount(po.chariowHasAccount);
    }
    if (po.stripeHasAccount === true || po.stripeHasAccount === false || po.stripeHasAccount === null) {
      setStripeHasAccount(po.stripeHasAccount);
    }
    if (po.paypalHasAccount === true || po.paypalHasAccount === false || po.paypalHasAccount === null) {
      setPaypalHasAccount(po.paypalHasAccount);
    }
    if (po.collapsed === true || po.collapsed === false) setCollapsed(po.collapsed);
  }, [billingCtx?.billing?.payment_onboarding]);

  const billingReady = Boolean(billingCtx);

  useEffect(() => {
    if (!slug || !billingReady) return;
    if (remoteTimerRef.current) clearTimeout(remoteTimerRef.current);
    remoteTimerRef.current = setTimeout(() => {
      authFetchPrefs({
        tenantSlug: slug,
        billing: {
          payment_onboarding: {
            stepIndex,
            selection,
            chariowHasAccount,
            stripeHasAccount,
            paypalHasAccount,
            collapsed,
          },
        },
      }).catch(() => {});
    }, 1000);
    return () => {
      if (remoteTimerRef.current) clearTimeout(remoteTimerRef.current);
    };
  }, [
    slug,
    billingReady,
    stepIndex,
    selection,
    chariowHasAccount,
    stripeHasAccount,
    paypalHasAccount,
    collapsed,
  ]);

  const stepIds = useMemo(() => buildStepIds(selection), [selection]);
  const currentId = stepIds[Math.min(stepIndex, stepIds.length - 1)] || 'welcome';

  const persist = useCallback(() => {
    saveProgress(slug, {
      selection,
      stepIndex,
      chariowHasAccount,
      stripeHasAccount,
      paypalHasAccount,
      collapsed,
    });
  }, [slug, selection, stepIndex, chariowHasAccount, stripeHasAccount, paypalHasAccount, collapsed]);

  useEffect(() => {
    persist();
  }, [persist]);

  useEffect(() => {
    if (stepIndex >= stepIds.length) setStepIndex(Math.max(0, stepIds.length - 1));
  }, [stepIds.length, stepIndex]);

  const platform = billingCtx?.platform;
  const secretsOk = Boolean(platform?.billingSecretsKeyConfigured);
  const pct = Math.round(((stepIndex + 1) / stepIds.length) * 100);

  const scrollToCard = (id) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const goNext = () => {
    if (currentId === 'pick' && !selection.chariow && !selection.stripe && !selection.paypal) {
      toast({
        title: 'Choisissez au moins un fournisseur',
        description: 'Cochez Chariow, Stripe ou PayPal pour continuer.',
        variant: 'destructive',
      });
      return;
    }
    if (currentId === 'chariow_account' && chariowHasAccount === null) {
      toast({ title: 'Réponse requise', description: 'Indiquez si vous avez déjà un compte Chariow.', variant: 'destructive' });
      return;
    }
    if (currentId === 'stripe_account' && stripeHasAccount === null) {
      toast({ title: 'Réponse requise', description: 'Indiquez si vous avez déjà un compte Stripe.', variant: 'destructive' });
      return;
    }
    if (currentId === 'paypal_account' && paypalHasAccount === null) {
      toast({ title: 'Réponse requise', description: 'Indiquez si vous avez déjà une app PayPal Developer.', variant: 'destructive' });
      return;
    }
    setStepIndex((i) => Math.min(i + 1, stepIds.length - 1));
  };

  const goPrev = () => setStepIndex((i) => Math.max(0, i - 1));

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatBusy) return;
    const nextUser = { role: 'user', content: text };
    setChatInput('');
    setChatMessages((m) => [...m, nextUser]);
    setChatBusy(true);
    try {
      const hist = [...chatMessages, nextUser].filter((x) => x.role === 'user' || x.role === 'assistant').slice(-8);
      const data = await authFetchAssistant({
        tenantSlug: slug,
        message: text,
        stepId: currentId,
        history: hist.map(({ role, content }) => ({ role, content })),
      });
      const reply = String(data?.reply || '').trim() || 'Réponse vide, réessayez.';
      setChatMessages((m) => [...m, { role: 'assistant', content: reply }]);
      if (data?.hint) {
        toast({ title: 'Mode guide limité', description: data.hint, className: 'border-amber-500/40 bg-amber-950/40 text-amber-100' });
      }
    } catch (e) {
      setChatMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: `Erreur : ${e?.message || 'réseau'}. Réessayez ou utilisez les liens documentation.`,
        },
      ]);
    } finally {
      setChatBusy(false);
    }
  };

  const renderStepBody = () => {
    switch (currentId) {
      case 'welcome':
        return (
          <div className="space-y-3 text-gray-300 text-sm leading-relaxed">
            <p>
              Ce parcours vous oriente <strong className="text-white">étape par étape</strong> pour brancher vos encaissements
              (Chariow, Stripe, PayPal), sans modifier le code.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-gray-400">
              <li>Vous choisissez les fournisseurs à activer.</li>
              <li>Liens officiels pour créer un compte ou retrouver les clés.</li>
              <li>À la fin : copier les URLs webhook et, si besoin, activer le mode strict tenant.</li>
            </ul>
            <p className="text-xs text-gray-500">
              L'assistant à droite répond à vos questions ; ne collez jamais de secrets dans le chat.
            </p>
            {providersConfigured ? (
              <p className="text-xs text-gray-500 pt-2 border-t border-white/10">
                Détection serveur (secrets enregistrés) : Chariow {providersConfigured.chariow ? '✓' : '—'} · Stripe{' '}
                {providersConfigured.stripe ? '✓' : '—'} · PayPal {providersConfigured.paypal ? '✓' : '—'}
              </p>
            ) : null}
          </div>
        );
      case 'platform':
        return (
          <div className="space-y-3 text-sm">
            <p className="text-gray-300">
              Avant d'enregistrer des clés, le serveur doit avoir la variable{' '}
              <code className="text-amber-200/90">BILLING_SECRETS_KEY</code> sur Netlify (configurée par l'hébergeur).
            </p>
            {ctxLoading ? (
              <p className="text-gray-500">Vérification du contexte…</p>
            ) : (
              <div className="rounded-lg border border-white/10 bg-[#0F1419] p-3 font-mono text-xs space-y-2">
                <div className="flex items-center gap-2">
                  {secretsOk ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <span className={secretsOk ? 'text-emerald-300' : 'text-red-300'}>
                    BILLING_SECRETS_KEY : {secretsOk ? 'détectée (OK)' : 'manquante — contactez l\'hébergeur'}
                  </span>
                </div>
                <p className="text-gray-500">
                  PayPal webhook Netlify :{' '}
                  {platform?.paypalWebhookGloballyEnabled ? (
                    <span className="text-emerald-400">activé</span>
                  ) : (
                    <span className="text-amber-400">BILLING_ENABLE_PAYPAL_WEBHOOK=1 attendu</span>
                  )}
                </p>
                <p className="text-gray-500">
                  Stripe webhook Netlify :{' '}
                  {platform?.stripeWebhookGloballyEnabled ? (
                    <span className="text-emerald-400">activé</span>
                  ) : (
                    <span className="text-amber-400">BILLING_ENABLE_STRIPE_WEBHOOK=1 attendu</span>
                  )}
                </p>
              </div>
            )}
            <Button type="button" variant="outline" size="sm" className="border-white/20 text-gray-200" onClick={onRefreshContext}>
              Rafraîchir le diagnostic
            </Button>
          </div>
        );
      case 'pick':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Cochez les moyens que vous souhaitez configurer pour ce tenant.</p>
            <div className="grid gap-3 max-w-md">
              {[
                { key: 'chariow', label: 'Chariow', desc: 'Paiement mobile / boutique (Gabon & zone).' },
                { key: 'stripe', label: 'Stripe', desc: 'Cartes, idéal international.' },
                { key: 'paypal', label: 'PayPal', desc: 'Compte PayPal / carte via PayPal.' },
              ].map((row) => (
                <label
                  key={row.key}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-[#0F1419] p-3 hover:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)]"
                >
                  <input
                    type="checkbox"
                    className="mt-1 accent-[var(--school-accent)]"
                    checked={Boolean(selection[row.key])}
                    onChange={(e) => setSelection((s) => ({ ...s, [row.key]: e.target.checked }))}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="text-white font-medium flex flex-wrap items-center gap-2">
                      {row.label}
                      {providersConfigured?.[row.key] ? (
                        <span className="text-[10px] font-normal uppercase tracking-wide text-emerald-400/90 border border-emerald-500/30 rounded px-1.5 py-0">
                          Clés sauvegardées
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-gray-500">{row.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      case 'chariow_account':
        return (
          <div className="space-y-4 text-sm text-gray-300">
            <p>Avez-vous déjà un <strong className="text-white">compte marchand Chariow</strong> (boutique / API) ?</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={chariowHasAccount === true ? 'default' : 'outline'}
                className={chariowHasAccount === true ? 'bg-emerald-700 text-white' : 'border-white/20 text-gray-200'}
                onClick={() => setChariowHasAccount(true)}
              >
                Oui
              </Button>
              <Button
                type="button"
                variant={chariowHasAccount === false ? 'default' : 'outline'}
                className={chariowHasAccount === false ? 'bg-amber-700 text-white' : 'border-white/20 text-gray-200'}
                onClick={() => setChariowHasAccount(false)}
              >
                Pas encore
              </Button>
            </div>
            {chariowHasAccount === false ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-amber-100/90 text-xs leading-relaxed">
                Créez votre espace marchand via votre <strong>contact commercial Chariow</strong> ou le portail d'inscription
                qu'ils vous ont communiqué. Une fois le compte validé, passez à l\'étape suivante pour récupérer la clé API.
              </div>
            ) : null}
            {chariowHasAccount === true ? (
              <p className="text-gray-400 text-xs">
                Étape suivante : localisez la clé API boutique et le secret webhook dans votre tableau de bord Chariow.
              </p>
            ) : null}
          </div>
        );
      case 'chariow_setup':
        return (
          <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
            {providersConfigured?.chariow ? (
              <p className="text-xs text-emerald-400/95 bg-emerald-950/25 border border-emerald-500/25 rounded-lg px-3 py-2">
                Une configuration Chariow chiffrée est déjà enregistrée pour ce tenant. Vous pouvez la mettre à jour dans le
                formulaire ci-dessous.
              </p>
            ) : null}
            <ol className="list-decimal pl-5 space-y-2">
              <li>Connectez-vous à votre espace marchand Chariow.</li>
              <li>Ouvrez la section API / boutique et copiez la <strong className="text-white">clé API</strong>.</li>
              <li>
                Configurez le webhook : utilisez l'URL « Webhook Chariow » affichée plus bas sur cette page (même origine que
                votre site).
              </li>
              <li>Optionnel : secret de signature si Chariow le propose — champ « Webhook secret ».</li>
            </ol>
            <Button
              type="button"
              className="bg-[var(--school-accent)] text-black hover:bg-[#c29e30]"
              onClick={() => scrollToCard('payment-card-chariow')}
            >
              Aller au formulaire Chariow
            </Button>
          </div>
        );
      case 'stripe_account':
        return (
          <div className="space-y-4 text-sm text-gray-300">
            <p>Avez-vous déjà un compte <strong className="text-white">Stripe</strong> ?</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={stripeHasAccount === true ? 'default' : 'outline'}
                className={stripeHasAccount === true ? 'bg-emerald-700 text-white' : 'border-white/20 text-gray-200'}
                onClick={() => setStripeHasAccount(true)}
              >
                Oui
              </Button>
              <Button
                type="button"
                variant={stripeHasAccount === false ? 'default' : 'outline'}
                className={stripeHasAccount === false ? 'bg-[#635BFF] text-white' : 'border-white/20 text-gray-200'}
                onClick={() => setStripeHasAccount(false)}
              >
                Non, je crée un compte
              </Button>
            </div>
            {stripeHasAccount === false ? (
              <a
                href={LINKS.stripeSignup}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[#a78bfa] hover:underline text-xs"
              >
                Ouvrir l'inscription Stripe <ExternalLink className="w-3 h-3" />
              </a>
            ) : null}
          </div>
        );
      case 'stripe_setup':
        return (
          <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
            {providersConfigured?.stripe ? (
              <p className="text-xs text-emerald-400/95 bg-emerald-950/25 border border-emerald-500/25 rounded-lg px-3 py-2">
                Une configuration Stripe chiffrée est déjà enregistrée pour ce tenant.
              </p>
            ) : null}
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                <a href={LINKS.stripeApiKeys} target="_blank" rel="noreferrer" className="text-[#a78bfa] hover:underline inline-flex items-center gap-1">
                  Clés API Stripe <ExternalLink className="w-3 h-3" />
                </a>{' '}
                — copiez la secret key (sk_live… ou sk_test…).
              </li>
              <li>
                <a href={LINKS.stripeWebhooks} target="_blank" rel="noreferrer" className="text-[#a78bfa] hover:underline inline-flex items-center gap-1">
                  Webhooks <ExternalLink className="w-3 h-3" />
                </a>{' '}
                — ajoutez l'URL Stripe indiquée sur cette page ; récupérez le signing secret.
              </li>
            </ol>
            <Button type="button" className="bg-[#635BFF] text-white hover:bg-[#4b45c6]" onClick={() => scrollToCard('payment-card-stripe')}>
              Aller au formulaire Stripe
            </Button>
          </div>
        );
      case 'paypal_account':
        return (
          <div className="space-y-4 text-sm text-gray-300">
            <p>Avez-vous déjà une <strong className="text-white">application REST</strong> PayPal (Developer Dashboard) ?</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={paypalHasAccount === true ? 'default' : 'outline'}
                className={paypalHasAccount === true ? 'bg-emerald-700 text-white' : 'border-white/20 text-gray-200'}
                onClick={() => setPaypalHasAccount(true)}
              >
                Oui
              </Button>
              <Button
                type="button"
                variant={paypalHasAccount === false ? 'default' : 'outline'}
                className={paypalHasAccount === false ? 'bg-[#0070ba] text-white' : 'border-white/20 text-gray-200'}
                onClick={() => setPaypalHasAccount(false)}
              >
                Non
              </Button>
            </div>
            <div className="flex flex-col gap-2 text-xs">
              <a href={LINKS.paypalDeveloper} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline inline-flex items-center gap-1">
                PayPal Developer Dashboard <ExternalLink className="w-3 h-3" />
              </a>
              <a href={LINKS.paypalBusiness} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline inline-flex items-center gap-1">
                Compte business PayPal <ExternalLink className="w-3 h-3" />
              </a>
              <a href={LINKS.paypalWebhooksDoc} target="_blank" rel="noreferrer" className="text-gray-500 hover:underline inline-flex items-center gap-1">
                Doc webhooks PayPal <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        );
      case 'paypal_setup':
        return (
          <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
            {providersConfigured?.paypal ? (
              <p className="text-xs text-emerald-400/95 bg-emerald-950/25 border border-emerald-500/25 rounded-lg px-3 py-2">
                Une configuration PayPal chiffrée est déjà enregistrée pour ce tenant.
              </p>
            ) : null}
            <ol className="list-decimal pl-5 space-y-2">
              <li>Developer Dashboard → Apps & credentials → créer / ouvrir une app (sandbox ou live).</li>
              <li>Copier Client ID et Secret dans la carte PayPal ci-dessous.</li>
              <li>Webhooks : URL PayPal de cette page → récupérer le Webhook ID.</li>
              <li>Vérifier que Netlify a activé la fonction webhook PayPal si votre hébergeur utilise le flag dédié.</li>
            </ol>
            <Button type="button" className="bg-[#0070ba] text-white hover:bg-[#005ea6]" onClick={() => scrollToCard('payment-card-paypal')}>
              Aller au formulaire PayPal
            </Button>
          </div>
        );
      case 'webhooks':
        return (
          <div className="space-y-3 text-sm text-gray-300">
            <p>
              Dans la section <strong className="text-white">URLs webhooks</strong> plus bas, copiez chaque URL vers le dashboard du
              fournisseur. Les trois sont distinctes (slug tenant inclus dans la requête).
            </p>
            <Button type="button" variant="outline" className="border-white/20 text-gray-200" onClick={() => scrollToCard('payment-card-webhooks')}>
              Voir les URLs webhooks
            </Button>
          </div>
        );
      case 'policy':
        return (
          <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
            <p>
              Les interrupteurs <strong className="text-white">strict Chariow</strong> et{' '}
              <strong className="text-white">strict PayPal</strong> forcent l'usage des clés de ce tenant uniquement (pas de repli
              sur les clés plateforme).
            </p>
            <Button type="button" variant="outline" className="border-white/20 text-gray-200" onClick={() => scrollToCard('payment-card-policy')}>
              Ouvrir la politique d'isolement
            </Button>
          </div>
        );
      case 'done':
        return (
          <div className="space-y-3 text-sm text-gray-300">
            <p className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="w-5 h-5" /> Parcours terminé. Vous pouvez refermer ce tutoriel ; les formulaires restent
              disponibles ci-dessous.
            </p>
            <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" checked={collapsed} onChange={(e) => setCollapsed(e.target.checked)} className="accent-[var(--school-accent)]" />
              Réduire le tutoriel par défaut à la prochaine visite
            </label>
          </div>
        );
      default:
        return null;
    }
  };

  if (collapsed && currentId === 'done') {
    return (
      <Card className="bg-[#192734] border-emerald-500/30 mb-6">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <p className="text-sm text-gray-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--school-accent)]" /> Tutoriel paiements terminé.
          </p>
          <Button type="button" variant="outline" size="sm" className="border-white/20" onClick={() => setCollapsed(false)}>
            Rouvrir le guide
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (collapsed && currentId !== 'done') {
    return (
      <Card className="bg-[#192734] border-white/10 mb-6">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <p className="text-sm text-gray-400">Tutoriel paiements réduit.</p>
          <Button type="button" variant="outline" size="sm" className="border-white/20" onClick={() => setCollapsed(false)}>
            Afficher le tutoriel
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-[#1a2332] to-[#152232] border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] mb-8 shadow-lg shadow-black/20">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="text-white flex items-center gap-2 text-xl">
              <HelpCircle className="w-6 h-6 text-[var(--school-accent)]" />
              Tutoriel — Configuration des paiements
            </CardTitle>
            <CardDescription className="text-gray-400 mt-2 max-w-2xl">
              Progression {stepIndex + 1} / {stepIds.length} — suivez les étapes dans l'ordre. Assistant IA à droite (questions
              générales, sans secrets).
              {providersConfigured ? (
                <span className="block mt-2 text-[11px] text-gray-500 font-normal">
                  État enregistré : Chariow {providersConfigured.chariow ? '✓' : '—'} · Stripe {providersConfigured.stripe ? '✓' : '—'}{' '}
                  · PayPal {providersConfigured.paypal ? '✓' : '—'} · progression sauvegardée sur le tenant (sync navigateurs).
                </span>
              ) : null}
            </CardDescription>
          </div>
          <Button type="button" variant="ghost" size="sm" className="text-gray-400 hover:text-white" onClick={() => setCollapsed(true)}>
            Réduire
          </Button>
        </div>
        <div className="mt-4 h-2 rounded-full bg-[#0F1419] overflow-hidden border border-white/5">
          <div className="h-full bg-gradient-to-r from-[var(--school-accent)] to-amber-600 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-xl border border-white/10 bg-[#0F1419]/80 p-4 min-h-[220px]">{renderStepBody()}</div>
            <div className="flex flex-wrap gap-2 justify-between">
              <Button type="button" variant="outline" className="border-white/20 text-gray-200" disabled={stepIndex === 0} onClick={goPrev}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Précédent
              </Button>
              <Button
                type="button"
                className="bg-[var(--school-accent)] text-black hover:bg-[#c29e30]"
                disabled={stepIndex >= stepIds.length - 1}
                onClick={goNext}
              >
                Suivant <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
          <div className="lg:col-span-2 rounded-xl border border-violet-500/20 bg-[#0c1220] flex flex-col min-h-[280px]">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
              <Bot className="w-4 h-4 text-violet-400" />
              <span className="text-sm font-medium text-white">Guide IA</span>
              <span className="text-[10px] uppercase tracking-wide text-gray-500 ml-auto">contexte : {currentId}</span>
            </div>
            <ScrollArea className="flex-1 px-3 py-2 max-h-[200px]">
              <div className="space-y-2 text-xs">
                {chatMessages.map((m, i) => (
                  <div
                    key={i}
                    className={`rounded-lg px-2 py-1.5 ${m.role === 'user' ? 'bg-violet-950/50 text-gray-200 ml-4' : 'bg-white/5 text-gray-300 mr-4'}`}
                  >
                    {m.content}
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="p-2 border-t border-white/10 space-y-2">
              <Label className="text-[10px] text-gray-500">Votre question</Label>
              <Textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ex. : où trouver le webhook ID PayPal ?"
                className="min-h-[72px] bg-[#0F1419] border-white/10 text-white text-xs resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChat();
                  }
                }}
              />
              <Button type="button" size="sm" className="w-full bg-violet-600 hover:bg-violet-500 text-white" disabled={chatBusy} onClick={sendChat}>
                {chatBusy ? '…' : 'Envoyer'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
