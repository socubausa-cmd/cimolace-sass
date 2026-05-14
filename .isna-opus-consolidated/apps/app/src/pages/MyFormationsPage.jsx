import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, CalendarClock, GraduationCap, Loader2, Lock, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useBilling } from '@/contexts/BillingContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';

const isSchemaMismatchError = (error) => {
  const msg = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '');
  return code === '42703' || msg.includes('column') || msg.includes('does not exist');
};

const resolveAccess = (formation) => {
  const meta = formation?.meta && typeof formation.meta === 'object' ? formation.meta : {};
  return {
    mode: meta.access_mode || meta?.access?.mode || 'free',
    standalonePrice: meta.standalone_price ?? meta?.access?.standalone_price ?? formation?.price ?? null,
    standaloneCurrency: meta.standalone_currency || meta?.access?.standalone_currency || 'XAF',
  };
};

const MyFormationsPage = () => {
  const { user } = useAuth();
  const { status: billingStatus, inGrace } = useBilling();
  const navigate = useNavigate();
  const hasSubscriptionAccess = billingStatus === 'active' || (billingStatus === 'past_due' && inGrace);

  const [activeTab, setActiveTab] = useState('mes-cours');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [published, setPublished] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [liveClasses, setLiveClasses] = useState([]);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [{ data: publishedRows, error: pubErr }, { data: enrollmentRows, error: enrErr }, participantsRes] = await Promise.all([
        supabase
          .from('formations')
          .select('id, title, description, status, cycle, duration_weeks, image_url, price, meta')
          .eq('status', 'published')
          .order('created_at', { ascending: false }),
        supabase
          .from('enrollments')
          .select('id, status, enrolled_at, completed_at, formation_id, formations(id, title, description, image_url, duration_weeks, meta, price)')
          .eq('student_id', user.id)
          .order('enrolled_at', { ascending: false }),
        supabase.from('live_session_participants').select('live_session_id').eq('user_id', user.id),
      ]);
      if (pubErr) throw pubErr;
      if (enrErr) throw enrErr;

      const sessionIds = [...new Set((participantsRes?.data || []).map((p) => p.live_session_id).filter(Boolean))];
      let lives = [];
      if (sessionIds.length > 0) {
        let liveRes = await supabase
          .from('live_sessions')
          .select('id, title, scheduled_at, status, teacher_id')
          .in('id', sessionIds)
          .gte('scheduled_at', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString())
          .order('scheduled_at', { ascending: true });
        if (liveRes.error && isSchemaMismatchError(liveRes.error)) {
          liveRes = await supabase
            .from('live_sessions')
            .select('id, title, scheduled_at, status')
            .in('id', sessionIds)
            .gte('scheduled_at', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString())
            .order('scheduled_at', { ascending: true });
        }
        lives = liveRes.data || [];
      }

      setPublished(publishedRows || []);
      setEnrollments(enrollmentRows || []);
      setLiveClasses(lives);
    } catch (e) {
      setError(String(e?.message || 'Erreur de chargement'));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const enrolledByFormationId = useMemo(() => {
    const map = {};
    for (const e of enrollments) {
      if (e?.formation_id) map[e.formation_id] = e;
    }
    return map;
  }, [enrollments]);

  const mesCours = useMemo(() => {
    return enrollments
      .map((e) => ({
        id: e.formations?.id || e.formation_id,
        title: e.formations?.title || 'Formation',
        description: e.formations?.description || '',
        image_url: e.formations?.image_url || '',
        duration_weeks: e.formations?.duration_weeks || null,
        status: e.status || 'active',
      }))
      .filter((c) => !!c.id);
  }, [enrollments]);

  const aDecouvrir = useMemo(() => {
    return (published || []).filter((p) => !enrolledByFormationId[p.id]);
  }, [published, enrolledByFormationId]);

  const classesProgrammees = useMemo(() => {
    return (liveClasses || []).filter((s) => String(s.status || '').toLowerCase() !== 'cancelled');
  }, [liveClasses]);

  const handleEnroll = useCallback(
    async (formation) => {
      if (!formation?.id || !user?.id) {
        navigate('/login', { state: { from: { pathname: '/formations/mes-formations' } } });
        return;
      }
      setActionLoadingId(formation.id);
      try {
        const { error: enrollErr } = await supabase.from('enrollments').insert({
          student_id: user.id,
          formation_id: formation.id,
          status: 'active',
          service_type: 'academique',
        });
        if (enrollErr && enrollErr.code !== '23505') throw enrollErr;
        await loadData();
        navigate(`/formation/${formation.id}/learn`);
      } catch (e) {
        setError(String(e?.message || 'Erreur inscription'));
      } finally {
        setActionLoadingId(null);
      }
    },
    [loadData, navigate, user?.id]
  );

  const tabs = [
    { value: 'mes-cours', label: 'Mes cours', badge: `${mesCours.length}` },
    { value: 'decouvrir', label: 'Decouvrir', badge: `${aDecouvrir.length}` },
    { value: 'salle', label: 'Salle de cours', badge: `${classesProgrammees.length}` },
  ];

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-24 pb-16 px-4">
      <Helmet>
        <title>Mes Cours | PRORASCIENCE</title>
      </Helmet>

      <div className="max-w-6xl mx-auto space-y-6">
        <div className="premium-panel rounded-2xl border border-white/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 mb-2">Hub eleve</Badge>
              <h1 className="text-2xl md:text-3xl font-bold">Mes cours et parcours</h1>
              <p className="text-sm text-gray-400 mt-1">
                {published.length} cours publies visibles dans le catalogue public.
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/formations/list">
                <Button variant="outline" className="border-white/20 text-white hover:bg-white/5">
                  Catalogue public
                </Button>
              </Link>
              <Link to="/classroom/live">
                <Button className="bg-[#D4AF37] text-black hover:bg-yellow-500">Salle de cours</Button>
              </Link>
            </div>
          </div>
        </div>

        <PremiumSegmentedSelector
          value={activeTab}
          onChange={setActiveTab}
          options={tabs}
          layoutId="my-formations-hub-segment-pill"
          compact
          showChevron={false}
        />

        {loading ? (
          <div className="premium-panel rounded-2xl border border-white/10 p-10 text-center text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-3" />
            Chargement des cours...
          </div>
        ) : null}

        {!loading && error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200 text-sm">{error}</div>
        ) : null}

        {!loading && activeTab === 'mes-cours' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {mesCours.length === 0 ? (
              <div className="md:col-span-2 lg:col-span-3 premium-panel rounded-2xl border border-white/10 p-8 text-center text-gray-400">
                Aucun cours relie a ton compte. Va dans Decouvrir pour t'inscrire.
              </div>
            ) : (
              mesCours.map((course) => (
                <Card key={course.id} className="premium-panel border-white/10 hover:border-[#D4AF37]/30 transition-all">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">{course.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-400 line-clamp-2">{course.description || 'Aucune description.'}</p>
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                      <BookOpen className="w-3.5 h-3.5" />
                      {course.duration_weeks ? `${course.duration_weeks} semaines` : 'Parcours en cours'}
                    </div>
                    <Link to={`/formation/${course.id}/learn`}>
                      <Button className="w-full bg-[#D4AF37] text-black hover:bg-yellow-500">Continuer le cours</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        ) : null}

        {!loading && activeTab === 'decouvrir' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {aDecouvrir.length === 0 ? (
              <div className="md:col-span-2 lg:col-span-3 premium-panel rounded-2xl border border-white/10 p-8 text-center text-gray-400">
                Tous les cours publies sont deja dans ton espace.
              </div>
            ) : (
              aDecouvrir.map((formation) => {
                const access = resolveAccess(formation);
                const isSubscription = access.mode === 'subscription';
                const isOneTime = access.mode === 'one_time';
                return (
                  <Card key={formation.id} className="premium-panel border-white/10 hover:border-[#D4AF37]/30 transition-all">
                    <CardHeader>
                      <CardTitle className="text-white text-lg">{formation.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-gray-400 line-clamp-2">{formation.description || 'Aucune description.'}</p>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-white/10 text-gray-300 border border-white/10">
                          {isSubscription ? 'Abonnement' : isOneTime ? 'Module payant' : 'Gratuit'}
                        </Badge>
                      </div>

                      {isSubscription ? (
                        hasSubscriptionAccess ? (
                          <Button
                            className="w-full bg-[#D4AF37] text-black hover:bg-yellow-500"
                            disabled={actionLoadingId === formation.id}
                            onClick={() => handleEnroll(formation)}
                          >
                            {actionLoadingId === formation.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <GraduationCap className="w-4 h-4 mr-2" />}
                            S'inscrire et acceder
                          </Button>
                        ) : (
                          <Link to="/forfaits">
                            <Button className="w-full bg-[#D4AF37] text-black hover:bg-yellow-500">
                              <Lock className="w-4 h-4 mr-2" />
                              S'abonner pour acceder
                            </Button>
                          </Link>
                        )
                      ) : null}

                      {isOneTime ? (
                        <Link to={`/formation/${formation.id}`}>
                          <Button className="w-full bg-[#D4AF37] text-black hover:bg-yellow-500">
                            Payer le module
                            {access.standalonePrice != null ? ` (${Number(access.standalonePrice).toLocaleString()} ${access.standaloneCurrency})` : ''}
                          </Button>
                        </Link>
                      ) : null}

                      {!isSubscription && !isOneTime ? (
                        <Button
                          className="w-full bg-[#D4AF37] text-black hover:bg-yellow-500"
                          disabled={actionLoadingId === formation.id}
                          onClick={() => handleEnroll(formation)}
                        >
                          {actionLoadingId === formation.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                          S'inscrire gratuitement
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        ) : null}

        {!loading && activeTab === 'salle' ? (
          <div className="space-y-4">
            <Card className="premium-panel border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Cours programmes et classes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {classesProgrammees.length === 0 ? (
                  <p className="text-sm text-gray-400">Aucune classe programmee pour le moment.</p>
                ) : (
                  classesProgrammees.map((session) => (
                    <div key={session.id} className="rounded-xl border border-white/10 bg-[#0F1419]/60 p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{session.title || 'Cours live'}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          <CalendarClock className="w-3.5 h-3.5 inline mr-1" />
                          {session.scheduled_at ? new Date(session.scheduled_at).toLocaleString('fr-FR') : 'Horaire a definir'}
                        </p>
                      </div>
                      <Link to={`/live/${session.id}`}>
                        <Button className="bg-[#D4AF37] text-black hover:bg-yellow-500">Entrer en salle</Button>
                      </Link>
                    </div>
                  ))
                )}

                <div className="pt-2">
                  <Link to="/classroom/live">
                    <Button variant="outline" className="border-white/20 text-white hover:bg-white/5">
                      Voir toute la salle de cours
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default MyFormationsPage;