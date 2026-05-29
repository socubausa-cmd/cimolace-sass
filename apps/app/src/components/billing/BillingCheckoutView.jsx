import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { QRCodeCanvas } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Copy, ExternalLink, Loader2, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/customSupabaseClient';
import { getLoginEntryPath } from '@/lib/loginEntryPath';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { getPayerPath } from '@/lib/eleveBillingPath';
import { EV_MUTED } from '@/pages/eleve-mobile/eleveMobileScreensShared';
import { cn } from '@/lib/utils';
import {
  openPaymentCheckoutUrl,
  subscribeAppResumeForPayment,
  subscribePaymentBrowserFinished,
} from '@/lib/eleveMobilePaymentOpenUrl';

const statusTheme = (s, liri = false) => {
  const st = String(s || '').toLowerCase();
  if (st === 'confirmed') return { label: 'Confirmé', cls: 'bg-green-500/20 text-green-400 border-green-500/30' };
  if (st === 'confirming') {
    if (liri) {
      return { label: 'En confirmation', cls: 'bg-violet-500/15 text-violet-200 border-violet-500/30' };
    }
    return { label: 'En confirmation', cls: 'bg-slate-500/20 text-slate-200 border-slate-500/30' };
  }
  if (st === 'partially_paid') {
    if (liri) {
      return { label: 'Partiellement payé', cls: 'bg-fuchsia-500/12 text-fuchsia-200 border-fuchsia-500/25' };
    }
    return { label: 'Partiellement payé', cls: 'bg-cyan-500/15 text-cyan-200 border-cyan-500/25' };
  }
  if (st === 'expired') return { label: 'Expiré', cls: 'bg-gray-500/20 text-gray-300 border-gray-500/30' };
  if (st === 'failed') return { label: 'Échoué', cls: 'bg-red-500/20 text-red-300 border-red-500/30' };
  return { label: 'En attente', cls: 'bg-white/10 text-gray-300 border-white/10' };
};

/** Web dashboard — CTA sans or (aligné violets LIRI). */
const WEB_CTA = 'bg-violet-600 text-white shadow-lg shadow-violet-900/20 hover:bg-violet-500 font-bold';
/** CTA principal LIRI mobile. */
const ELEVE_PRIMARY_CTA =
  'bg-white text-[#5B3CC4] shadow-[0_8px_24px_-6px_rgba(255,255,255,0.25)] hover:bg-white/95 font-bold';
const PANEL = 'bg-[#192734] border-white/10';
/** Surfaces LIRI mobile (élève) — aligné `eleveMobileScreensShared` (EV_CARD, pas le slate web). */
const ELEVE_PANEL =
  'rounded-2xl border border-white/[0.08] bg-[#16161E]/95 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.4)] backdrop-blur-md';

/**
 * Contenu du checkout (partagé page web + shell `/m/eleve`).
 * @param {Object} p
 * @param {'web' | 'eleve'} p.variant
 */
export default function BillingCheckoutView({ variant = 'web' }) {
  const isEleve = variant === 'eleve';
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const nextPlan = String(searchParams.get('nextPlan') || '').trim();
  const nextInterval = String(searchParams.get('nextInterval') || 'monthly').trim();
  const nextPathParam = String(searchParams.get('next') || '').trim();
  const { toast } = useToast();
  const { session } = useAuth();

  const [payment, setPayment] = useState(null);
  const [paymentPlanSlug, setPaymentPlanSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const lastSilentRefreshAt = useRef(0);
  const isMonero = String(payment?.provider || '').toLowerCase() === 'nowpayments' || payment?.payment_method === 'monero';
  const isChariow =
    String(payment?.provider || '').toLowerCase() === 'chariow' ||
    payment?.payment_method === 'chariow' ||
    String(payment?.ipn_payload?.provider_alias || '').toLowerCase() === 'chariow';

  const theme = useMemo(() => statusTheme(payment?.payment_status), [payment?.payment_status]);
  const safeNextPath = useMemo(() => {
    return nextPathParam.startsWith('/') ? nextPathParam : '';
  }, [nextPathParam]);
  const ngowazuluLines = useMemo(() => {
    const raw = payment?.ipn_payload?.ngowazulu_invoice_lines;
    return Array.isArray(raw) ? raw : null;
  }, [payment?.ipn_payload]);
  const isNgowazuluOpeningPlan = paymentPlanSlug === 'ngowazulu-ouverture-recouvrement';
  const hasNgowazuluStep2 = Boolean(isNgowazuluOpeningPlan && nextPlan);

  const authHeader = useMemo(() => {
    const accessToken = session?.access_token;
    return accessToken ? { Authorization: `Bearer ${accessToken}` } : null;
  }, [session?.access_token]);

  const loginPath = isEleve ? getLoginEntryPath() : '/login';
  const loginState = isEleve ? { from: { pathname: location.pathname + location.search } } : undefined;
  const dashboardPath = isEleve ? ELEVE_MOBILE.home : '/dashboard';
  const qrSize = isEleve ? 200 : 220;

  const fetchStatus = async (opts = {}) => {
    if (!id) return;
    if (!authHeader) return;
    const silent = !!opts.silent;
    if (!silent) setRefreshing(true);
    setError('');
    try {
      const res = await fetch(`/.netlify/functions/billing-payment-status?id=${encodeURIComponent(id)}`, {
        headers: { ...authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur');
      setPayment(data.payment || null);
    } catch (e) {
      setError(e?.message || 'Erreur');
    } finally {
      setLoading(false);
      if (!silent) setRefreshing(false);
    }
  };

  const silentRefreshThrottled = () => {
    const now = Date.now();
    if (now - lastSilentRefreshAt.current < 900) return;
    lastSilentRefreshAt.current = now;
    fetchStatus({ silent: true });
  };

  useEffect(() => {
    if (!isEleve || !id) return undefined;
    const unsubsRef = { current: [] };
    let dead = false;
    (async () => {
      const a = await subscribePaymentBrowserFinished(silentRefreshThrottled);
      const b = await subscribeAppResumeForPayment(silentRefreshThrottled);
      if (dead) {
        try {
          a();
        } catch {
          /* ignore */
        }
        try {
          b();
        } catch {
          /* ignore */
        }
        return;
      }
      unsubsRef.current = [a, b];
    })();
    return () => {
      dead = true;
      for (const fn of unsubsRef.current) {
        try {
          fn();
        } catch {
          /* ignore */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchStatus stable enough for refresh-only
  }, [isEleve, id]);

  useEffect(() => {
    fetchStatus({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, authHeader?.Authorization]);

  useEffect(() => {
    if (!payment) return;
    const st = String(payment.payment_status || '').toLowerCase();
    if (['confirmed', 'failed', 'expired'].includes(st)) return;
    const t = window.setInterval(() => fetchStatus({ silent: true }), 5000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment?.id, payment?.payment_status, authHeader?.Authorization]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const planId = String(payment?.plan_id || '').trim();
      if (!planId) {
        if (alive) setPaymentPlanSlug('');
        return;
      }
      const { data } = await supabase.from('billing_plans').select('slug').eq('id', planId).maybeSingle();
      if (!alive) return;
      setPaymentPlanSlug(String(data?.slug || '').toLowerCase());
    };
    run();
    return () => {
      alive = false;
    };
  }, [payment?.plan_id]);

  useEffect(() => {
    const status = String(payment?.payment_status || '').toLowerCase();
    if (status !== 'confirmed' || !safeNextPath) return;
    const timer = window.setTimeout(() => {
      navigate(safeNextPath, { replace: true });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [navigate, payment?.payment_status, safeNextPath]);

  useEffect(() => {
    if (typeof document === 'undefined' || !isEleve) return;
    const prev = document.title;
    document.title = 'Paiement · LIRI';
    return () => {
      document.title = prev;
    };
  }, [isEleve]);

  const primaryCta = isEleve ? ELEVE_PRIMARY_CTA : WEB_CTA;

  const copy = async (label, value) => {
    try {
      await navigator.clipboard.writeText(String(value || ''));
      toast({ title: 'Copié', description: `${label} copié dans le presse‑papiers.` });
    } catch {
      toast({ title: 'Copie impossible', description: 'Ton navigateur a bloqué la copie.', variant: 'destructive' });
    }
  };

  const moneroUri = useMemo(() => {
    if (!payment?.pay_address || !payment?.pay_amount) return '';
    return `monero:${payment.pay_address}?tx_amount=${payment.pay_amount}`;
  }, [payment?.pay_address, payment?.pay_amount]);

  const titleCardClass = isEleve ? `${ELEVE_PANEL} p-4` : 'premium-panel rounded-2xl border border-white/10 p-4 md:p-5';

  const cardClass = isEleve ? ELEVE_PANEL : `premium-panel ${PANEL}`;

  return (
    <div className={isEleve ? 'space-y-3' : 'space-y-4 md:space-y-6'}>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={titleCardClass}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div>
            <h1
              className={
                isEleve
                  ? 'font-sans text-xl font-bold tracking-tight text-white sm:text-2xl'
                  : 'text-2xl font-serif font-bold md:text-3xl'
              }
            >
              {payment?.purchase_type === 'formation_one_time' ? 'Paiement du module' : "Paiement de l'abonnement"}
            </h1>
            <p className={`mt-1 text-sm ${isEleve ? '' : 'text-gray-400'}`} style={isEleve ? { color: EV_MUTED } : undefined}>
              {payment?.purchase_type === 'formation_one_time'
                ? "L'accès à la formation s'active automatiquement après confirmation backend."
                : "L'abonnement s'active automatiquement après confirmation backend."}
            </p>
            {hasNgowazuluStep2 ? (
              <p className="mt-2 text-xs text-emerald-300">
                Parcours mentorat en 2 étapes: étape 1 (frais d&apos;inscription/configuration), puis étape 2 (paiement du contrat
                mensuel).
              </p>
            ) : null}
          </div>
          {payment?.payment_status ? <Badge className={theme.cls}>{theme.label}</Badge> : null}
        </div>
      </motion.div>

      {!authHeader ? (
        <Card className={cardClass}>
          <CardContent className="p-4 sm:p-6">
            <div
              className={cn(
                'flex items-start gap-3',
                isEleve ? 'text-violet-200' : 'text-violet-200/95',
              )}
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" strokeWidth={2} />
              <div>
                <div className="font-semibold text-white">Connexion requise</div>
                <div className="mt-1 text-sm" style={isEleve ? { color: EV_MUTED } : { color: 'rgba(196, 181, 253, 0.85)' }}>
                  Connecte-toi pour suivre le statut du paiement.
                </div>
                <Button
                  asChild
                  className={cn('mt-4 h-12 rounded-[20px] font-bold', primaryCta)}
                >
                  <Link to={loginPath} state={loginState}>
                    Se connecter
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Card className={cardClass}>
          <CardContent
            className={`flex items-center gap-2 p-4 sm:p-6 ${isEleve ? 'text-[#8E8E93]' : 'text-gray-400'}`}
          >
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> Chargement…
          </CardContent>
        </Card>
      ) : null}

      {!loading && error ? (
        <Card className={`${cardClass} border-red-500/30`}>
          <CardContent className="p-4 sm:p-6">
            <div className="font-semibold text-red-200">{error}</div>
            <Button
              onClick={() => fetchStatus()}
              variant="outline"
              className="mt-4 border-white/10 text-white hover:bg-white/5"
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Réessayer
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!loading && payment ? (
        <Card className={cardClass}>
          <CardContent className="space-y-5 p-4 sm:p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-500">Montant (fiat)</div>
                <div className="text-lg font-bold">
                  {payment.price_amount} {payment.price_currency}
                </div>
                {ngowazuluLines?.length ? (
                  <div className="mt-3 space-y-2 rounded-lg border border-violet-500/25 bg-violet-500/10 p-3 text-xs text-gray-300">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-200/90">
                      Détail facture (1er mois)
                    </p>
                    <ul className="space-y-1.5">
                      {ngowazuluLines.map((line, idx) => (
                        <li key={idx} className="flex justify-between gap-2">
                          <span className="pr-2 text-gray-400">{line.label}</span>
                          <span className="shrink-0 font-medium text-white">
                            {line.amount} {line.currency || payment.price_currency}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {payment.plan_id ? (
                  <div className="mt-1 text-xs text-gray-500">Plan ID: {String(payment.plan_id).slice(0, 8)}…</div>
                ) : payment.formation_id ? (
                  <div className="mt-1 text-xs text-gray-500">Formation ID: {String(payment.formation_id).slice(0, 8)}…</div>
                ) : null}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-500">Méthode</div>
                <div className="text-lg font-bold">
                  {isMonero
                    ? 'Monero (XMR) via NOWPayments'
                    : isChariow
                      ? 'Checkout Chariow'
                      : 'Mobile Money via CinetPay'}
                </div>
                <div className="mt-1 text-xs text-gray-500">Order: {payment.order_id}</div>
              </div>
            </div>

            {hasNgowazuluStep2 ? (
              <div className="space-y-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                <p className="font-semibold text-emerald-50">Comprendre le parcours mentorat</p>
                <ol className="list-decimal space-y-1 pl-4">
                  <li>Cette page correspond au paiement des frais d&apos;inscription/configuration (unique).</li>
                  <li>Après confirmation, utilisez le bouton “Continuer — souscrire au contrat mentorat”.</li>
                  <li>Vous serez redirigé vers la page de paiement du mois, avec le contrat choisi.</li>
                </ol>
              </div>
            ) : null}

            {isMonero ? (
              <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="text-xs uppercase tracking-wider text-gray-500">Adresse Monero</div>
                  <div className="flex gap-2">
                    <div className="flex-1 break-all rounded-lg border border-white/10 bg-black/30 p-3 text-sm">
                      {payment.pay_address || '—'}
                    </div>
                    <Button
                      variant="outline"
                      className="shrink-0 border-white/10 text-white hover:bg-white/5"
                      onClick={() => copy('Adresse', payment.pay_address)}
                      disabled={!payment.pay_address}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="text-xs uppercase tracking-wider text-gray-500">Montant XMR</div>
                  <div className="flex gap-2">
                    <div className="flex-1 rounded-lg border border-white/10 bg-black/30 p-3 text-sm">
                      {payment.pay_amount ? `${payment.pay_amount} XMR` : '—'}
                    </div>
                    <Button
                      variant="outline"
                      className="shrink-0 border-white/10 text-white hover:bg-white/5"
                      onClick={() => copy('Montant', payment.pay_amount)}
                      disabled={!payment.pay_amount}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>

                  {payment.payment_url ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-white/10 text-white hover:bg-white/5"
                      onClick={() => openPaymentCheckoutUrl(payment.payment_url)}
                    >
                      Ouvrir le paiement <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  ) : null}
                </div>

                <div className="flex flex-col items-center rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-3 text-xs text-gray-400">QR Code</div>
                  <QRCodeCanvas value={moneroUri || payment.pay_address || ''} size={qrSize} includeMargin />
                  <div className="mt-3 text-center text-[11px] text-gray-500">
                    Scanner puis payer. Le statut se met à jour automatiquement.
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm text-gray-300">
                  {isChariow
                    ? 'Clique sur le bouton ci-dessous pour payer via Chariow.'
                    : 'Clique sur le bouton ci‑dessous pour payer via Mobile Money.'}
                </div>
                {isEleve ? (
                  <p className="text-[11px] leading-relaxed text-white/45">
                    Sur l&apos;application : la page Chariow s&apos;ouvre dans une vue navigateur intégrée (in-app). À la
                    fermeture, nous actualisons le statut ; tu peux aussi appuyer sur{' '}
                    <span className="text-white/60">Actualiser</span>.
                  </p>
                ) : null}
                {payment.payment_url ? (
                  <Button
                    type="button"
                    className={cn('h-12 w-full rounded-[20px] font-bold sm:h-12', primaryCta)}
                    onClick={() => openPaymentCheckoutUrl(payment.payment_url)}
                  >
                    {isChariow ? 'Payer via Chariow' : 'Payer via Mobile Money'}{' '}
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <div className="text-sm text-gray-500">Lien de paiement indisponible.</div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-white/10 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-gray-500">
                {payment.expires_at ? `Expire le ${new Date(payment.expires_at).toLocaleString()}` : null}
              </div>
              <Button
                onClick={() => fetchStatus()}
                variant="outline"
                className="w-full border-white/10 text-white hover:bg-white/5 sm:w-auto"
                disabled={refreshing}
              >
                {refreshing ? <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4 shrink-0" />}
                Actualiser
              </Button>
            </div>

            {String(payment.payment_status || '').toLowerCase() === 'confirmed' ? (
              <div className="flex items-start gap-3 rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
                <div>
                  <div className="font-semibold text-green-300">Paiement confirmé</div>
                  <div className="mt-1 text-sm text-green-200/70">
                    {payment?.purchase_type === 'formation_one_time'
                      ? "Ton accès au module est activé automatiquement. Tu peux retourner à l'accueil."
                      : "Ton abonnement est activé automatiquement. Tu peux retourner à l'accueil."}
                  </div>
                  <Button asChild className={cn('mt-3 w-full rounded-[20px] sm:w-auto', primaryCta)}>
                    <Link to={dashboardPath}>
                      {isEleve ? "Retour à l'app LIRI" : 'Aller au dashboard'}
                    </Link>
                  </Button>
                  {hasNgowazuluStep2 ? (
                    <Button asChild className="mt-2 w-full bg-emerald-600 font-bold text-white hover:bg-emerald-700 sm:w-auto">
                      <Link
                        to={getPayerPath(
                          `plan=${encodeURIComponent(nextPlan)}&interval=${encodeURIComponent(nextInterval)}`,
                        )}
                      >
                        Continuer — souscrire au contrat mentorat
                      </Link>
                    </Button>
                  ) : null}
                  {safeNextPath ? (
                    <Button asChild className={cn('mt-2 w-full rounded-[20px] sm:w-auto', primaryCta)}>
                      <Link to={safeNextPath}>Accéder au calendrier de consultation</Link>
                    </Button>
                  ) : null}
                  {isNgowazuluOpeningPlan ? (
                    <Button
                      asChild
                      variant="outline"
                      className="mt-2 w-full border-violet-500/35 text-violet-200 hover:border-violet-400/50 hover:bg-violet-500/10 sm:w-auto"
                    >
                      <a href="/ngowazulu/dossier">Compléter le dossier NGOWAZULU</a>
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
