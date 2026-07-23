import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { getApiBaseUrl } from '@/lib/apiBase';
import { authRefreshIsBlocked, getFreshAccessToken } from '@/lib/authToken';

const BillingContext = createContext(null);

export const useBilling = () => {
  const ctx = useContext(BillingContext);
  if (!ctx) throw new Error('useBilling must be used within BillingProvider');
  return ctx;
};

const GRACE_DAYS_DEFAULT = 3;


function computeStatus(sub, graceDays) {
  if (!sub) return { status: 'none', inGrace: false };
  const rawStatus = String(sub.status || '').toLowerCase();
  const expiresAt = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null;
  const now = Date.now();

  if (rawStatus === 'canceled') return { status: 'expired', inGrace: false };
  if (!expiresAt) {
    // If missing current_period_end, fallback to status field.
    if (rawStatus === 'active') return { status: 'active', inGrace: false };
    if (rawStatus === 'past_due') return { status: 'past_due', inGrace: true };
    return { status: rawStatus || 'none', inGrace: false };
  }

  if (expiresAt > now) return { status: 'active', inGrace: false };

  const graceMs = Math.max(0, Number(graceDays || 0)) * 24 * 60 * 60 * 1000;
  if (now <= expiresAt + graceMs) return { status: 'past_due', inGrace: true };
  return { status: 'expired', inGrace: false };
}

export const BillingProvider = ({ children, graceDays = GRACE_DAYS_DEFAULT }) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [subscriptionComputed, setSubscriptionComputed] = useState(null);
  const [activeRenewalLink, setActiveRenewalLink] = useState(null);
  const [recentPayments, setRecentPayments] = useState([]);
  const [licenseActivation, setLicenseActivation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Evite les boucles de 401 Invalid token sur endpoint Netlify.
  const endpointBlockedUntilRef = useRef(0);
  const last401WarnAtRef = useRef(0);
  const last5xxWarnAtRef = useRef(0);
  const refreshInFlightRef = useRef(null);
  // Throttle des refresh SILENCIEUX (focus/visibility/interval) : ces refetch d'arrière-plan se
  // succédaient EN SÉRIE (chaque appel ~2s de latence Railway → jamais concurrents → le garde
  // refreshInFlightRef ne les collapse pas) → 3 appels /billing/subscriptions/status par navigation.
  // On coalesce les refresh silencieux non forcés dans une fenêtre de 15s. Les refresh EXPLICITES
  // (montage, post-paiement) et les events realtime billing (force:true) ignorent ce throttle.
  const lastSilentAtRef = useRef(0);
  const SILENT_TTL_MS = 15000;

  const refresh = async ({ silent = false, force = false } = {}) => {
    if (!user?.id) {
      setSubscription(null);
      setSubscriptionComputed(null);
      setActiveRenewalLink(null);
      setRecentPayments([]);
      setLicenseActivation(null);
      setLoading(false);
      return;
    }
    if (silent && refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }
    // Coalescence temporelle des refresh silencieux d'arrière-plan (sauf force / event billing).
    if (silent && !force && Date.now() - lastSilentAtRef.current < SILENT_TTL_MS) {
      return refreshInFlightRef.current || undefined;
    }
    if (silent && authRefreshIsBlocked()) {
      return;
    }
    if (!silent) setLoading(true);
    if (!silent) setError(null);

    const promise = (async () => {
    try {
      const apiBase = getApiBaseUrl();
      const token = await getFreshAccessToken();
      // Always try the NestJS billing endpoint (it's available in all environments).
      const tryNetlifyBilling =
        token &&
        Date.now() >= endpointBlockedUntilRef.current;

      if (tryNetlifyBilling) {
        const readSubscriptionStatus = async (accessToken, { hasRetried401 = false } = {}) => {
          let res;
          try {
            res = await fetch(`${apiBase}/billing/subscriptions/status`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
          } catch {
            // Proxy/functions local indisponible (ex: ECONNREFUSED) : évite le spam d'appels/erreurs.
            endpointBlockedUntilRef.current = Date.now() + 3 * 60 * 1000;
            return null;
          }
          if (res.status === 401) {
            // Si le token local est stale, force un refresh et retente une fois.
            if (!hasRetried401) {
              const refreshedToken = await getFreshAccessToken({ forceRefresh: true });
              if (refreshedToken) {
                return readSubscriptionStatus(refreshedToken, { hasRetried401: true });
              }
            }
            // Bloque temporairement l'endpoint et passe en fallback Supabase direct.
            endpointBlockedUntilRef.current = Date.now() + 3 * 60 * 1000;
            const now = Date.now();
            if (now - last401WarnAtRef.current > 30_000) {
              last401WarnAtRef.current = now;
              console.warn('[billing] /billing/subscriptions/status returned 401, switching to DB fallback for 3 min');
            }
            return null;
          }
          // 5xx : erreur NestJS ou serveur indisponible — repli Supabase pour 3 min.
          if (res.status >= 500) {
            endpointBlockedUntilRef.current = Date.now() + 3 * 60 * 1000;
            const now = Date.now();
            if (now - last5xxWarnAtRef.current > 45_000) {
              last5xxWarnAtRef.current = now;
              console.warn(
                '[billing] /billing/subscriptions/status HTTP',
                res.status,
                '— repli Supabase côté client pour 3 min. Vérifier que VITE_API_URL pointe vers le NestJS (apps/api).',
              );
            }
            return null;
          }
          if (!res.ok) return null;
          const body = await res.json().catch(() => null);
          // L'API NestJS emballe la réponse dans { data: ... } (intercepteur de
          // réponse global). L'ancien code lisait `payload.subscription` au TOP
          // niveau → toujours `undefined` → abonnement vu comme null → tenant
          // PAYANT traité en GRATUIT (live/téléconsult coupé à 3 min). On déballe
          // l'enveloppe { data } si elle est présente.
          if (
            body &&
            body.data &&
            typeof body.data === 'object' &&
            ('subscription' in body.data ||
              'computed' in body.data ||
              'recentPayments' in body.data)
          ) {
            return body.data;
          }
          return body;
        };

        let payload = await readSubscriptionStatus(token);
        if (payload) {
          const pendingPayment = (Array.isArray(payload?.recentPayments) ? payload.recentPayments : []).find((p) => {
            const st = String(p?.payment_status || '').toLowerCase();
            return ['pending', 'confirming', 'partially_paid'].includes(st);
          });
          if (pendingPayment?.id) {
            const paymentToken = await getFreshAccessToken();
            await fetch(`${apiBase}/billing/payments/status?id=${encodeURIComponent(pendingPayment.id)}`, {
              headers: paymentToken ? { Authorization: `Bearer ${paymentToken}` } : undefined,
            }).catch(() => null);
            const tokenAfterPaymentCheck = await getFreshAccessToken();
            const refreshedPayload = tokenAfterPaymentCheck
              ? await readSubscriptionStatus(tokenAfterPaymentCheck)
              : null;
            if (refreshedPayload) payload = refreshedPayload;
          }

          setSubscription(payload?.subscription || null);
          setSubscriptionComputed(payload?.computed || null);
          setActiveRenewalLink(payload?.activeRenewalLink || null);
          setRecentPayments(Array.isArray(payload?.recentPayments) ? payload.recentPayments : []);
          setLicenseActivation(payload?.licenseActivation || null);
          if (!silent) setLoading(false);
          return;
        }
      }

      // Fallback on direct read if endpoint not available.
      const fallbackSelect = 'id,user_id,plan_id,status,provider,current_period_start,current_period_end,created_at';
      let fallbackSubscription = null;
      {
        const { data: prioritized, error: prioErr } = await supabase
          .from('billing_subscriptions')
          .select(fallbackSelect)
          .eq('user_id', user.id)
          .in('status', ['active', 'past_due'])
          .order('current_period_end', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(1);
        if (prioErr) throw prioErr;
        fallbackSubscription = Array.isArray(prioritized) ? prioritized[0] || null : null;
      }
      // Billing TENANT-scopé : un abonnement du tenant (souvent user_id=null,
      // posé par le checkout tenant / webhook) débloque TOUS ses membres. Le
      // repli par seul user_id le ratait → un tenant PAYANT (ex zahirwellness)
      // était vu en GRATUIT (live coupé 3 min) si l'endpoint n'avait pas répondu
      // (course au montage). Miroir du fix backend getSubscriptionStatus.
      if (!fallbackSubscription) {
        try {
          const { data: mems } = await supabase
            .from('tenant_memberships')
            .select('tenant_id')
            .eq('user_id', user.id);
          const tenantIds = [...new Set((mems || []).map((m) => m.tenant_id).filter(Boolean))];
          if (tenantIds.length) {
            const { data: tenantSubs } = await supabase
              .from('billing_subscriptions')
              .select(fallbackSelect)
              .in('tenant_id', tenantIds)
              .in('status', ['active', 'past_due'])
              .order('current_period_end', { ascending: false, nullsFirst: false })
              .order('created_at', { ascending: false })
              .limit(1);
            if (Array.isArray(tenantSubs) && tenantSubs[0]) fallbackSubscription = tenantSubs[0];
          }
        } catch {
          /* RLS / table absente : on conserve le comportement existant */
        }
      }
      if (!fallbackSubscription) {
        const { data: latest, error: latestErr } = await supabase
          .from('billing_subscriptions')
          .select(fallbackSelect)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
        if (latestErr) throw latestErr;
        fallbackSubscription = Array.isArray(latest) ? latest[0] || null : null;
      }
      setSubscription(fallbackSubscription);
      setSubscriptionComputed(null);
      setActiveRenewalLink(null);
      setRecentPayments([]);
      setLicenseActivation(null);
    } catch (e) {
      setError(e);
      setSubscription(null);
      setSubscriptionComputed(null);
      setActiveRenewalLink(null);
      setRecentPayments([]);
      setLicenseActivation(null);
    } finally {
      if (!silent) setLoading(false);
    }
    })();

    if (silent) {
      lastSilentAtRef.current = Date.now(); // ouvre la fenêtre de coalescence des refresh silencieux
      refreshInFlightRef.current = promise;
      promise.finally(() => {
        if (refreshInFlightRef.current === promise) refreshInFlightRef.current = null;
      });
    }
    await promise;
  };

  useEffect(() => {
    refresh({ silent: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const t = window.setInterval(() => {
      refresh({ silent: true });
    }, 30000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return undefined;
    // Un seul déclencheur au retour d'onglet : `visibilitychange` couvre le refocus. Le listener
    // `focus` (retiré) faisait DOUBLON → 2 refresh silencieux pour un seul retour d'onglet.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh({ silent: true });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const channel = supabase
      .channel(`billing-realtime-${user.id}`)
      // Events billing = fraîcheur post-paiement immédiate → force:true (ignore le throttle 15s).
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'billing_subscriptions', filter: `user_id=eq.${user.id}` },
        () => refresh({ silent: true, force: true })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'billing_payments', filter: `user_id=eq.${user.id}` },
        () => refresh({ silent: true, force: true })
      )
      // (Table `notifications` RETIRÉE du canal : la facturation ne dérive pas des notifications,
      //  or chaque insert de notif — fréquent à la navigation — refetchait /billing inutilement.)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const computed = useMemo(() => computeStatus(subscription, graceDays), [subscription, graceDays]);

  const value = useMemo(
    () => ({
      subscription,
      loading,
      error,
      status: computed.status, // none | active | past_due | expired
      inGrace: computed.inGrace,
      graceDays,
      computed: subscriptionComputed,
      activeRenewalLink,
      recentPayments,
      licenseActivation,
      refresh,
    }),
    [
      subscription,
      loading,
      error,
      computed.status,
      computed.inGrace,
      graceDays,
      subscriptionComputed,
      activeRenewalLink,
      recentPayments,
      licenseActivation,
    ]
  );

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
};

