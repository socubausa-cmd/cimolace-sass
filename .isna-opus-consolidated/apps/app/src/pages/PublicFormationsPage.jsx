import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useBilling } from '@/contexts/BillingContext';
import { supabase } from '@/lib/customSupabaseClient';
import { BookOpen, CalendarClock, ChevronRight, Loader2, Lock, Search, Sparkles } from 'lucide-react';

const resolveAccess = (formation) => {
  const meta = formation?.meta && typeof formation.meta === 'object' ? formation.meta : {};
  return {
    mode: meta.access_mode || meta?.access?.mode || 'free',
    standalonePrice: meta.standalone_price ?? meta?.access?.standalone_price ?? formation?.price ?? null,
    standaloneCurrency: meta.standalone_currency || meta?.access?.standalone_currency || 'XAF',
  };
};

const PublicFormationsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { status: billingStatus, inGrace } = useBilling();
  const hasSubscriptionAccess = billingStatus === 'active' || (billingStatus === 'past_due' && inGrace);

  const [formations, setFormations] = useState([]);
  const [enrollments, setEnrollments] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: publishedRows } = await supabase
      .from('formations')
      .select('id, title, description, status, cycle, duration_weeks, image_url, price, meta')
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    setFormations(publishedRows || []);

    if (user?.id) {
      const { data: enrollRows } = await supabase
        .from('enrollments')
        .select('formation_id, status')
        .eq('student_id', user.id);
      const map = {};
      (enrollRows || []).forEach((e) => {
        map[e.formation_id] = e;
      });
      setEnrollments(map);
    } else {
      setEnrollments({});
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const displayedFormations = useMemo(() => {
    const normalizedSearch = String(searchTerm || '').toLowerCase().trim();
    return (formations || []).filter((f) => {
      const access = resolveAccess(f);
      if (activeFilter !== 'all' && access.mode !== activeFilter) return false;
      if (!normalizedSearch) return true;
      const blob = `${f.title || ''} ${f.description || ''}`.toLowerCase();
      return blob.includes(normalizedSearch);
    });
  }, [activeFilter, formations, searchTerm]);

  const handleEnrollFreeOrSubscription = useCallback(
    async (formation) => {
      if (!user?.id) {
        navigate('/login', { state: { from: { pathname: '/formations/list' } } });
        return;
      }
      setActionLoadingId(formation.id);
      try {
        const { error } = await supabase.from('enrollments').insert({
          student_id: user.id,
          formation_id: formation.id,
          status: 'active',
          service_type: 'academique',
        });
        if (error && error.code !== '23505') throw error;
        await load();
        navigate(`/formation/${formation.id}/learn`);
      } finally {
        setActionLoadingId(null);
      }
    },
    [load, navigate, user?.id]
  );

  return (
    <div className="min-h-screen bg-[#0F1419] p-8 pb-20 text-white">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="premium-panel rounded-2xl border border-white/10 p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30 mb-3">Catalogue public</Badge>
              <h1 className="text-3xl md:text-4xl font-bold">Cours publies</h1>
              <p className="text-gray-400 mt-2">
                {formations.length} cours publies actuellement.
              </p>
            </div>
            <div className="flex gap-2">
              <Link to="/formations/mes-formations">
                <Button variant="outline" className="border-white/20 text-white hover:bg-white/5">
                  Mes cours
                </Button>
              </Link>
              <Link to="/forfaits">
                <Button className="bg-[#D4AF37] text-black hover:bg-yellow-500">Voir les abonnements</Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-[#151a21]/80 border-white/10"
              placeholder="Rechercher un cours publie..."
            />
          </div>
          <PremiumSegmentedSelector
            value={activeFilter}
            onChange={setActiveFilter}
            options={[
              { value: 'all', label: 'Tous', badge: `${formations.length}` },
              { value: 'free', label: 'Gratuit' },
              { value: 'one_time', label: 'Module payant' },
              { value: 'subscription', label: 'Abonnement' },
            ]}
            layoutId="public-formations-filter-segment-pill"
            compact
            showChevron={false}
          />
        </div>

        {loading ? (
          <div className="premium-panel rounded-2xl border border-white/10 p-10 text-center text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-3" />
            Chargement des cours publies...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedFormations.map((formation) => {
              const access = resolveAccess(formation);
              const isEnrolled = Boolean(enrollments[formation.id]);
              const isSubscription = access.mode === 'subscription';
              const isOneTime = access.mode === 'one_time';

              return (
                <Card key={formation.id} className="premium-panel border-white/10 hover:border-[#D4AF37]/30 transition-all">
                  <CardHeader className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge className="bg-white/10 text-gray-300 border border-white/10">
                        {isSubscription ? 'Abonnement' : isOneTime ? 'Module payant' : 'Gratuit'}
                      </Badge>
                      {isEnrolled ? (
                        <Badge className="bg-green-500/20 text-green-300 border border-green-500/30">Inscrit</Badge>
                      ) : null}
                    </div>
                    <CardTitle className="text-white text-xl">{formation.title}</CardTitle>
                    <p className="text-sm text-gray-400 line-clamp-2">{formation.description || 'Aucune description.'}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-xs text-gray-500 flex items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-[#D4AF37]" />
                        {formation.cycle || 'Cursus'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="w-3.5 h-3.5 text-[#D4AF37]" />
                        {formation.duration_weeks ? `${formation.duration_weeks} semaines` : 'duree variable'}
                      </span>
                    </div>

                    {isEnrolled ? (
                      <Link to={`/formation/${formation.id}/learn`}>
                        <Button className="w-full bg-[#D4AF37] text-black hover:bg-yellow-500">
                          Acceder au cours
                        </Button>
                      </Link>
                    ) : isSubscription ? (
                      hasSubscriptionAccess ? (
                        <Button
                          className="w-full bg-[#D4AF37] text-black hover:bg-yellow-500"
                          disabled={actionLoadingId === formation.id}
                          onClick={() => handleEnrollFreeOrSubscription(formation)}
                        >
                          {actionLoadingId === formation.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
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
                    ) : isOneTime ? (
                      <Link to={`/formation/${formation.id}`}>
                        <Button className="w-full bg-[#D4AF37] text-black hover:bg-yellow-500">
                          Payer le module
                          {access.standalonePrice != null ? ` (${Number(access.standalonePrice).toLocaleString()} ${access.standaloneCurrency})` : ''}
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        className="w-full bg-[#D4AF37] text-black hover:bg-yellow-500"
                        disabled={actionLoadingId === formation.id}
                        onClick={() => handleEnrollFreeOrSubscription(formation)}
                      >
                        {actionLoadingId === formation.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        S'inscrire gratuitement
                      </Button>
                    )}

                    <Link to={`/formation/${formation.id}`}>
                      <Button variant="ghost" className="w-full text-gray-300 hover:text-white hover:bg-white/5">
                        Voir details <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {!loading && displayedFormations.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p>Aucun cours publie pour ce filtre.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default PublicFormationsPage;