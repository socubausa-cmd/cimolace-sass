import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useBilling } from '@/contexts/BillingContext';
import { supabase } from '@/lib/customSupabaseClient';
import { getBillingCheckoutPath } from '@/lib/eleveBillingPath';
import { useFormationStructure } from '@/hooks/useFormationStructure';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  BookOpen,
  Clock,
  Layers,
  Sparkles,
  Lock,
  ArrowRight,
} from 'lucide-react';

const FormationDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { status: billingStatus, inGrace } = useBilling();
  const { fetchStructure } = useFormationStructure();
  const [formation, setFormation] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enrolled, setEnrolled] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: formData, error: formErr } = await supabase
          .from('courses')
          .select('id, title, description, status, cycle, duration_weeks, price_cents, image_url, meta, created_at')
          .eq('id', id)
          .eq('status', 'published')
          .maybeSingle();

        if (formErr) throw formErr;
        if (!formData || cancelled) return;

        setFormation(formData);

        if (user?.id) {
          const { data: enrollData } = await supabase
            .from('student_progress')
            .select('id')
            .eq('course_id', id)
            .eq('user_id', user.id)
            .maybeSingle();
          setEnrolled(!!enrollData);
        }

        const { data: structData, error: structErr } = await fetchStructure(id);
        if (!structErr && Array.isArray(structData)) setModules(structData);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Erreur de chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user?.id]);

  const meta = formation?.meta && typeof formation.meta === 'object' ? formation.meta : {};
  const year = formation?.cycle === 'fondements' ? '1ère année' : formation?.cycle === 'approfondissement' ? '2ème année' : formation?.cycle === 'maitrise' ? '3ème année' : formation?.meta?.year || '';
  const accessMode = meta.access_mode || meta?.access?.mode || 'free';
  const price = meta.standalone_price ?? meta?.access?.standalone_price ?? formation?.price ?? null;
  const currency = meta.standalone_currency || meta?.access?.standalone_currency || 'XAF';
  const hasSubscriptionAccess = billingStatus === 'active' || (billingStatus === 'past_due' && inGrace);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1419] flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Chargement…</div>
      </div>
    );
  }

  if (error || !formation) {
    return (
      <div className="min-h-screen bg-[#0F1419] flex flex-col items-center justify-center p-8">
        <p className="text-gray-400 mb-4">{error || 'Formation introuvable.'}</p>
        <Button variant="outline" className="border-white/10 text-white" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-4 h-4 mr-2" /> Retour
        </Button>
      </div>
    );
  }

  const ensureEnrollment = async () => {
    if (!user?.id || !id) return;
    const { error: enrollErr } = await supabase.from('student_progress').insert({
      user_id: user.id,
      course_id: id,
      status: 'active',
    });
    if (enrollErr && enrollErr.code !== '23505') throw enrollErr;
  };

  const createOneTimePayment = async (paymentMethod = 'mobile_money') => {
    if (!session?.access_token) {
      navigate('/login', { state: { from: { pathname: `/formation/${id}` } } });
      return;
    }
    const res = await fetch('/.netlify/functions/billing-create-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        formationId: id,
        paymentMethod,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Erreur creation paiement module');
    const paymentId = data?.payment?.id;
    if (!paymentId) throw new Error('Paiement cree mais identifiant manquant');
    navigate(getBillingCheckoutPath(paymentId));
  };

  const handlePrimaryAction = async () => {
    setActionError('');
    setActionLoading(true);
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/formation/${id}` } } });
      setActionLoading(false);
      return;
    }
    try {
      if (enrolled) {
        navigate(`/formation/${id}/learn`);
        return;
      }
      if (accessMode === 'subscription') {
        if (!hasSubscriptionAccess) {
          navigate('/forfaits');
          return;
        }
        await ensureEnrollment();
        navigate(`/formation/${id}/learn`);
        return;
      }
      if (accessMode === 'one_time') {
        await createOneTimePayment('mobile_money');
        return;
      }
      await ensureEnrollment();
      navigate(`/formation/${id}/learn`);
    } catch (e) {
      setActionError(String(e?.message || 'Action impossible'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleOneTimeMethod = async (method) => {
    setActionError('');
    setActionLoading(true);
    try {
      await createOneTimePayment(method);
    } catch (e) {
      setActionError(String(e?.message || 'Paiement impossible'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1419] text-white relative overflow-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[color-mix(in_srgb,var(--school-accent)_6%,transparent)] rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-indigo-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-20 flex items-center justify-between px-4 md:px-8 py-4 bg-[#151a21]/80 backdrop-blur-xl border-b border-white/10"
      >
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-gray-400 hover:text-white -ml-2">
          <ChevronLeft className="w-4 h-4 mr-1" /> Retour
        </Button>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
          <Sparkles className="w-4 h-4 text-[var(--school-accent)]" />
          <span className="text-xs text-gray-400">Découvrir la formation</span>
        </div>
      </motion.header>

      <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#151a21]/80 backdrop-blur-xl mb-10"
        >
          <div className="h-48 md:h-64 bg-gray-800 relative">
            {formation.image_url ? (
              <img src={formation.image_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#0F1419]">
                <BookOpen className="w-20 h-20 text-gray-600" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#151a21] via-transparent to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge className="bg-black/50 text-white backdrop-blur border border-white/10">{year || 'Formation'}</Badge>
                <Badge className="bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)] border border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)]">
                  {accessMode === 'subscription' ? 'Abonnement' : accessMode === 'one_time' ? 'Vente module' : 'Gratuit'}
                </Badge>
              </div>
              <h1 className="text-2xl md:text-4xl font-serif font-bold text-white">{formation.title}</h1>
              <div className="flex items-center gap-6 mt-3 text-sm text-gray-400">
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[var(--school-accent)]" />
                  {modules.length} modules
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[var(--school-accent)]" />
                  {formation.duration_weeks ? `${formation.duration_weeks} semaines` : '—'}
                </span>
              </div>
            </div>
          </div>
          <div className="p-6 md:p-8">
            <p className="text-gray-400 leading-relaxed mb-8">{formation.description || 'Aucune description.'}</p>

            <div className="flex flex-wrap items-center gap-4">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  size="lg"
                  onClick={handlePrimaryAction}
                  disabled={actionLoading}
                  className="bg-[var(--school-accent)] hover:bg-amber-500 text-black font-bold px-8 py-6 shadow-lg shadow-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]"
                >
                  {actionLoading ? (
                    <>
                      <Sparkles className="w-5 h-5 mr-2 animate-pulse" />
                      Traitement...
                    </>
                  ) : enrolled ? (
                    <>
                      Accéder au cours <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  ) : (
                    <>
                      {accessMode === 'subscription'
                        ? (hasSubscriptionAccess ? 'S inscrire et acceder' : 'S abonner pour acceder')
                        : accessMode === 'one_time' && price != null
                          ? `Payer le module — ${Number(price).toLocaleString()} ${currency}`
                          : 'S inscrire gratuitement'}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </motion.div>
              {accessMode === 'subscription' && !hasSubscriptionAccess && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/forfaits')}
                  className="border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]"
                >
                  Voir les forfaits
                </Button>
              )}
              {accessMode === 'one_time' && !enrolled ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/5"
                    disabled={actionLoading}
                    onClick={() => handleOneTimeMethod('mobile_money')}
                  >
                    Mobile Money
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/5"
                    disabled={actionLoading}
                    onClick={() => handleOneTimeMethod('monero')}
                  >
                    Monero
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/5"
                    disabled={actionLoading}
                    onClick={() => handleOneTimeMethod('chariow')}
                  >
                    Chariow
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/5"
                    disabled={actionLoading}
                    onClick={() => handleOneTimeMethod('paypal')}
                  >
                    PayPal
                  </Button>
                </div>
              ) : null}
            </div>
            {actionError ? <p className="text-sm text-red-300 mt-3">{actionError}</p> : null}
          </div>
        </motion.section>

        {/* Programme */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-2xl border border-white/10 bg-[#151a21]/80 backdrop-blur-xl overflow-hidden"
        >
          <div className="p-6 border-b border-white/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] flex items-center justify-center">
              <Layers className="w-5 h-5 text-[var(--school-accent)]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Programme détaillé</h2>
              <p className="text-sm text-gray-400">Structure du cursus — débloquez l'accès en vous inscrivant</p>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {modules.length === 0 ? (
              <div className="text-center py-12 text-gray-500">Aucun module pour l'instant.</div>
            ) : (
              modules.map((mod, mIdx) => (
                <motion.div
                  key={mod.id || mIdx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: mIdx * 0.05 }}
                  className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden"
                >
                  <div className="p-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] flex items-center justify-center text-[var(--school-accent)] font-bold text-sm">
                      {mIdx + 1}
                    </div>
                    <h3 className="font-semibold text-white">{mod.title || `Module ${mIdx + 1}`}</h3>
                    <Lock className="w-4 h-4 text-gray-500 ml-auto" />
                  </div>
                  <div className="px-4 pb-4 pl-14 space-y-2">
                    {(mod.weeks || []).slice(0, 3).map((week, wIdx) => (
                      <div key={week.id || wIdx} className="flex items-center gap-2 text-sm text-gray-400">
                        <span className="w-2 h-2 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_50%,transparent)]" />
                        {week.title}
                        {(week.days || []).length > 0 && (
                          <span className="text-gray-500">· {(week.days || []).length} jours</span>
                        )}
                      </div>
                    ))}
                    {(mod.weeks || []).length > 3 && (
                      <div className="text-xs text-gray-500">+ {(mod.weeks || []).length - 3} semaines</div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.section>

        {/* CTA final */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-12 text-center"
        >
          <p className="text-gray-400 mb-4">Prêt à commencer votre parcours ?</p>
          <Button
            size="lg"
            onClick={handlePrimaryAction}
            disabled={actionLoading}
            className="bg-[var(--school-accent)] hover:bg-amber-500 text-black font-bold"
          >
            {enrolled
              ? 'Accéder au cours'
              : accessMode === 'subscription'
                ? (hasSubscriptionAccess ? 'S inscrire et acceder' : "S abonner")
                : accessMode === 'one_time'
                  ? 'Payer ce module'
                  : "S'inscrire gratuitement"}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default FormationDetailPage;
