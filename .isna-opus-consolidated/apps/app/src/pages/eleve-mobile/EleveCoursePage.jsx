import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BookOpen,
  ChevronLeft,
  Layers,
  Clock,
  Lock,
  Sparkles,
  ArrowRight,
  MessageCircle,
} from 'lucide-react';
import { EleveMobileShell } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/eleve-mobile/connection/EleveConnectionLayout';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { useBilling } from '@/contexts/BillingContext';
import { useFormationStructure } from '@/hooks/useFormationStructure';
import { supabase } from '@/lib/customSupabaseClient';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';
import { getLoginEntryPath } from '@/lib/loginEntryPath';
import { getBillingCheckoutPath } from '@/lib/eleveBillingPath';
import { LiriPageFooterLine } from '@/components/brand/LiriWordmark';
import { EV_LINE, EV_PAGE_AMBIENT } from '@/pages/eleve-mobile/eleveMobileScreensShared';

const WEB_FORMATION_BG = '#0F1419';
const GOLD = '#D4AF37';
const PANEL = 'rgba(21, 26, 33, 0.85)';

/**
 * Fiche formation élève — alignée sur `FormationDetailPage` (web) : même données,
 * programme, CTA (inscription, abonnement, paiement, accès au cours).
 * Route : `/m/eleve/cours/:courseId`
 */
export default function EleveCoursePage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { status: billingStatus, inGrace } = useBilling();
  const { fetchStructure } = useFormationStructure();
  const { notifications: sync } = useDataSync();
  const inboxUnread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;

  const [formation, setFormation] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [enrolled, setEnrolled] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const hasSubscriptionAccess = billingStatus === 'active' || (billingStatus === 'past_due' && inGrace);

  const id = courseId ? String(courseId) : '';

  useEffect(() => {
    if (!id) {
      setFormation(null);
      setModules([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { data: formData, error: formErr } = await supabase
          .from('formations')
          .select('id, title, description, status, cycle, duration_weeks, price, image_url, meta, created_at')
          .eq('id', id)
          .eq('status', 'published')
          .maybeSingle();

        if (formErr) throw formErr;
        if (cancelled) return;
        if (!formData) {
          setFormation(null);
          setLoadError('Formation introuvable ou non publiée.');
          setModules([]);
          return;
        }
        setFormation(formData);

        if (user?.id) {
          const { data: enrollData } = await supabase
            .from('enrollments')
            .select('id, status')
            .eq('formation_id', id)
            .eq('student_id', user.id)
            .maybeSingle();
          if (!cancelled) setEnrolled(!!enrollData);
        } else {
          setEnrolled(false);
        }

        const { data: structData, error: structErr } = await fetchStructure(id);
        if (!cancelled && !structErr && Array.isArray(structData)) setModules(structData);
        else if (!cancelled) setModules([]);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e?.message || 'Erreur de chargement');
          setFormation(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user?.id, fetchStructure]);

  const meta = formation?.meta && typeof formation.meta === 'object' ? formation.meta : {};
  const year = useMemo(() => {
    if (!formation) return '';
    if (formation.cycle === 'fondements') return '1ère année';
    if (formation.cycle === 'approfondissement') return '2ème année';
    if (formation.cycle === 'maitrise') return '3ème année';
    return formation.meta?.year || '';
  }, [formation]);

  const accessMode = meta.access_mode || meta?.access?.mode || 'free';
  const price = meta.standalone_price ?? meta?.access?.standalone_price ?? formation?.price ?? null;
  const currency = meta.standalone_currency || meta?.access?.standalone_currency || 'XAF';

  const learnHref = id ? `/formation/${encodeURIComponent(id)}/learn` : null;
  const webDetailHref = id ? `/formation/${encodeURIComponent(id)}` : null;

  const ensureEnrollment = useCallback(async () => {
    if (!user?.id || !id) return;
    const { error: enrollErr } = await supabase.from('enrollments').insert({
      student_id: user.id,
      formation_id: id,
      status: 'active',
      service_type: 'academique',
    });
    if (enrollErr && enrollErr.code !== '23505') throw enrollErr;
  }, [user?.id, id]);

  const createOneTimePayment = useCallback(
    async (paymentMethod = 'mobile_money') => {
      if (!session?.access_token) {
        navigate(getLoginEntryPath(), { state: { from: { pathname: `/formation/${id}` } } });
        return;
      }
      const res = await fetch('/.netlify/functions/billing-create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ formationId: id, paymentMethod }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur creation paiement module');
      const paymentId = data?.payment?.id;
      if (!paymentId) throw new Error('Paiement cree mais identifiant manquant');
      navigate(getBillingCheckoutPath(paymentId));
    },
    [session?.access_token, id, navigate],
  );

  const handlePrimaryAction = useCallback(async () => {
    setActionError('');
    setActionLoading(true);
    if (!user) {
      navigate(getLoginEntryPath(), { state: { from: { pathname: `/formation/${id}` } } });
      setActionLoading(false);
      return;
    }
    try {
      if (enrolled) {
        if (learnHref) navigate(learnHref);
        return;
      }
      if (accessMode === 'subscription') {
        if (!hasSubscriptionAccess) {
          navigate('/forfaits');
          return;
        }
        await ensureEnrollment();
        if (learnHref) navigate(learnHref);
        return;
      }
      if (accessMode === 'one_time') {
        await createOneTimePayment('mobile_money');
        return;
      }
      await ensureEnrollment();
      if (learnHref) navigate(learnHref);
    } catch (e) {
      setActionError(String(e?.message || 'Action impossible'));
    } finally {
      setActionLoading(false);
    }
  }, [
    user,
    navigate,
    id,
    enrolled,
    accessMode,
    hasSubscriptionAccess,
    learnHref,
    ensureEnrollment,
    createOneTimePayment,
  ]);

  const handleOneTimeMethod = useCallback(
    async (method) => {
      setActionError('');
      setActionLoading(true);
      try {
        await createOneTimePayment(method);
      } catch (e) {
        setActionError(String(e?.message || 'Paiement impossible'));
      } finally {
        setActionLoading(false);
      }
    },
    [createOneTimePayment],
  );

  const primaryButtonLabel = () => {
    if (actionLoading) return 'Traitement...';
    if (enrolled) return 'Accéder au cours';
    if (accessMode === 'subscription') {
      return hasSubscriptionAccess ? "S'inscrire et accéder" : "S'abonner pour accéder";
    }
    if (accessMode === 'one_time' && price != null) {
      return `Payer le module — ${Number(price).toLocaleString()} ${currency}`;
    }
    return "S'inscrire gratuitement";
  };

  return (
    <EleveMobileShell user={user} notificationCount={inboxUnread} hideHeader contentClassName="!px-0">
      <div
        className="flex w-full flex-1 flex-col"
        style={{
          minHeight: '100dvh',
          backgroundColor: WEB_FORMATION_BG,
          backgroundImage: EV_PAGE_AMBIENT,
        }}
      >
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div
            className="absolute top-0 left-1/2 h-[300px] w-[min(100vw,800px)] -translate-x-1/2 rounded-full opacity-90"
            style={{ background: `${GOLD}0f`, filter: 'blur(80px)' }}
          />
        </div>

        <div className="px-4 pt-[max(0.35rem,env(safe-area-inset-top))]">
          <LiriStatusBar />
        </div>

        <div
          className="sticky top-0 z-20 -mx-0 flex items-center justify-between border-b border-white/10 px-4 py-3"
          style={{ background: `${PANEL}`, backdropFilter: 'blur(16px)' }}
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 py-1.5 pl-0 pr-2 text-sm text-white/50 transition hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            Retour
          </button>
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
            <Sparkles className="h-3.5 w-3.5" style={{ color: GOLD }} />
            <span className="text-[10px] text-white/50">Formation</span>
          </div>
        </div>

        <div className="px-4 pb-6">
          {loading ? (
            <div className="mt-4 space-y-4" aria-busy="true" aria-label="Chargement de la formation">
              <div
                className="h-[180px] animate-pulse rounded-2xl border border-white/10"
                style={{ background: PANEL }}
              />
              <div className="h-24 animate-pulse rounded-2xl border border-white/10" style={{ background: PANEL }} />
              <div className="h-12 animate-pulse rounded-2xl bg-white/[0.06]" />
            </div>
          ) : loadError || !formation ? (
            <div className="mt-8 text-center">
              <p className="text-sm text-white/50">{loadError || 'Formation introuvable.'}</p>
              <Link
                to={ELEVE_MOBILE.bibliotheque}
                className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl border border-white/15 px-5 text-sm font-semibold text-white/90"
                style={{ borderColor: EV_LINE, background: 'rgba(255,255,255,0.05)' }}
              >
                Retour à la bibliothèque
              </Link>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <section
                className="mt-4 overflow-hidden rounded-2xl border border-white/10"
                style={{ background: PANEL, backdropFilter: 'blur(12px)' }}
              >
                <div className="relative h-44 bg-neutral-800">
                  {formation.image_url ? (
                    <img src={formation.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#0F1419]">
                      <BookOpen className="h-16 w-16 text-white/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#151a21] via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      <span
                        className="rounded-full border border-white/10 bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white/95 backdrop-blur"
                      >
                        {year || 'Formation'}
                      </span>
                      <span
                        className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                        style={{ borderColor: `${GOLD}66`, color: GOLD, background: `${GOLD}22` }}
                      >
                        {accessMode === 'subscription'
                          ? 'Abonnement'
                          : accessMode === 'one_time'
                            ? 'Vente module'
                            : 'Gratuit'}
                      </span>
                    </div>
                    <h1 className="font-serif text-2xl font-bold leading-tight text-white">{formation.title}</h1>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-white/45">
                      <span className="inline-flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5" style={{ color: GOLD }} />
                        {modules.length} modules
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" style={{ color: GOLD }} />
                        {formation.duration_weeks ? `${formation.duration_weeks} semaines` : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <p className="mb-5 text-sm leading-relaxed text-white/45">
                    {formation.description?.trim() || 'Aucune description.'}
                  </p>

                  <div className="flex flex-col gap-2.5">
                    <button
                      type="button"
                      onClick={handlePrimaryAction}
                      disabled={actionLoading}
                      className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-bold text-black shadow-lg active:scale-[0.99] disabled:opacity-70"
                      style={{ background: GOLD, boxShadow: `0 8px 24px -6px ${GOLD}55` }}
                    >
                      {actionLoading ? <Sparkles className="h-4 w-4 animate-pulse" /> : null}
                      {primaryButtonLabel()}
                      {!actionLoading ? <ArrowRight className="h-4 w-4" /> : null}
                    </button>

                    {accessMode === 'subscription' && !hasSubscriptionAccess && (
                      <Link
                        to="/forfaits"
                        className="flex h-12 w-full items-center justify-center rounded-2xl border text-sm font-semibold text-white/90"
                        style={{ borderColor: `${GOLD}66`, color: GOLD, background: `${GOLD}12` }}
                      >
                        Voir les forfaits
                      </Link>
                    )}

                    {accessMode === 'one_time' && !enrolled ? (
                      <div className="flex flex-wrap gap-2">
                        {['mobile_money', 'monero', 'chariow', 'paypal'].map((m) => (
                          <button
                            key={m}
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleOneTimeMethod(m)}
                            className="min-h-[40px] flex-1 rounded-xl border border-white/20 bg-white/[0.04] py-2 text-xs font-medium text-white active:scale-[0.99] disabled:opacity-50"
                          >
                            {m === 'mobile_money'
                              ? 'Mobile Money'
                              : m === 'monero'
                                ? 'Monero'
                                : m === 'paypal'
                                  ? 'PayPal'
                                  : 'Chariow'}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {actionError ? <p className="mt-3 text-sm text-red-300/95">{actionError}</p> : null}

                  {webDetailHref ? (
                    <a
                      href={webDetailHref}
                      className="mt-4 block w-full text-center text-[11px] text-white/35 underline decoration-white/20 underline-offset-2"
                    >
                      Ouvrir la fiche sur le site web
                    </a>
                  ) : null}
                </div>
              </section>

              <section
                className="mt-4 overflow-hidden rounded-2xl border border-white/10"
                style={{ background: PANEL, backdropFilter: 'blur(12px)' }}
              >
                <div className="flex items-center gap-3 border-b border-white/10 p-4">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{ background: `${GOLD}30` }}
                  >
                    <Layers className="h-5 w-5" style={{ color: GOLD }} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Programme détaillé</h2>
                    <p className="text-xs text-white/40">Même contenu que sur le web</p>
                  </div>
                </div>
                <div className="max-h-[min(50vh,420px)] space-y-3 overflow-y-auto p-4 [scrollbar-width:thin]">
                  {modules.length === 0 ? (
                    <p className="py-6 text-center text-sm text-white/40">Aucun module pour l’instant.</p>
                  ) : (
                    modules.map((mod, mIdx) => (
                      <div
                        key={mod.id || mIdx}
                        className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]"
                      >
                        <div className="flex items-center gap-2.5 p-3">
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                            style={{ background: `${GOLD}28`, color: GOLD }}
                          >
                            {mIdx + 1}
                          </div>
                          <h3 className="min-w-0 flex-1 text-sm font-semibold text-white">
                            {mod.title || `Module ${mIdx + 1}`}
                          </h3>
                          <Lock className="h-4 w-4 shrink-0 text-white/35" />
                        </div>
                        <div className="space-y-1.5 border-t border-white/[0.06] px-3 py-2 pl-[3.25rem]">
                          {(mod.weeks || []).slice(0, 4).map((week, wIdx) => (
                            <div
                              key={week.id || wIdx}
                              className="flex items-start gap-2 text-xs text-white/40"
                            >
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: `${GOLD}80` }} />
                              <span>
                                {week.title}
                                {(week.days || []).length > 0 ? (
                                  <span className="text-white/30"> · {(week.days || []).length} jours</span>
                                ) : null}
                              </span>
                            </div>
                          ))}
                          {(mod.weeks || []).length > 4 ? (
                            <p className="text-[10px] text-white/30">
                              + {(mod.weeks || []).length - 4} autre(s) semaine(s)
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <div className="mt-4 flex flex-col gap-2">
                <Link
                  to={ELEVE_MOBILE.bibliotheque}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border py-3.5 text-sm font-semibold text-white/90 active:scale-[0.99]"
                  style={{ borderColor: EV_LINE, background: 'rgba(255,255,255,0.04)' }}
                >
                  <BookOpen className="h-4 w-4" />
                  Voir mes cours
                </Link>
                <Link
                  to={ELEVE_MOBILE.messages}
                  className="flex w-full items-center justify-center gap-2 py-2 text-sm font-medium text-white/40 active:text-white/70"
                >
                  <MessageCircle className="h-4 w-4" />
                  Contacter le formateur
                </Link>
              </div>

              <LiriPageFooterLine marginClass="mt-5" suffix="Formation" />
            </motion.div>
          )}
        </div>
      </div>
    </EleveMobileShell>
  );
}
