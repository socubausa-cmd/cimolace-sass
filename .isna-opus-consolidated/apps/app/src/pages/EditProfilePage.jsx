import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useMessaging } from '@/contexts/MessagingContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const EditProfilePage = () => {
  const { user, refreshProfile, supabase } = useAuth();
  const { reloadProfiles } = useMessaging() || {};
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [country, setCountry] = useState('');

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, city, region, country')
        .eq('id', user.id)
        .maybeSingle();
      if (!alive) return;
      if (error) {
        toast({ variant: 'destructive', title: 'Erreur', description: error.message });
        setLoading(false);
        return;
      }
      setName(String(data?.name || '').trim());
      setCity(String(data?.city || '').trim());
      setRegion(String(data?.region || '').trim());
      setCountry(String(data?.country || '').trim());
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [user?.id, supabase, toast]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user?.id) return;
    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      toast({ variant: 'destructive', title: 'Le nom est requis' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: trimmedName,
          city: city.trim() || null,
          region: region.trim() || null,
          country: country.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (error) throw error;
      await refreshProfile();
      if (typeof reloadProfiles === 'function') {
        await reloadProfiles();
      }
      toast({ title: 'Profil mis à jour' });
      navigate('/profil/mon-profil');
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Enregistrement impossible',
        description: err?.message || 'Erreur inconnue',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-24 pb-16 px-4">
      <Helmet><title>{`Modifier le profil | ${isnaTenantConfig.branding.name}`}</title></Helmet>

      <div className="max-w-xl mx-auto">
        <Link
          to="/profil/mon-profil"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Retour au profil
        </Link>

        <div className="bg-[#192734] border border-white/10 rounded-2xl p-6 md:p-8">
          <h1 className="text-2xl font-bold mb-2">Modifier le profil</h1>
          <p className="text-sm text-gray-400 mb-8">
            Ces informations peuvent apparaître dans les lives (liste des participants, lieu affiché).
          </p>

          {loading ? (
            <div className="flex justify-center py-12 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Nom affiché</label>
                <input
                  className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white"
                  value={name}
                  onChange={(ev) => setName(ev.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Ville</label>
                <input
                  className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white"
                  value={city}
                  onChange={(ev) => setCity(ev.target.value)}
                  placeholder="Optionnel"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Région / province</label>
                <input
                  className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white"
                  value={region}
                  onChange={(ev) => setRegion(ev.target.value)}
                  placeholder="Optionnel"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Pays</label>
                <input
                  className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white"
                  value={country}
                  onChange={(ev) => setCountry(ev.target.value)}
                  placeholder="Optionnel"
                />
              </div>
              <Button
                type="submit"
                disabled={saving}
                className="w-full bg-[#D4AF37] text-black font-semibold hover:bg-[#c9a432]"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditProfilePage;
