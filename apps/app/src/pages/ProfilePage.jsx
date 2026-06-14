import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Save, User, Camera, Bell } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const ProfilePage = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({ full_name: '', country: '', objectives: '', notify_sms: false });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        country: profile.country || '',
        objectives: profile.objectives || '',
        notify_sms: profile.notify_sms === true,
      });
    }
  }, [profile]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').update(formData).eq('id', user.id);
      if (error) throw error;
      toast({ title: "Profil mis à jour" });
    } catch (err) {
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1419] py-12 px-4">
      <Helmet><title>{`Mon Profil — ${isnaTenantConfig.branding.name}`}</title></Helmet>
      
      <div className="max-w-3xl mx-auto bg-white/5 border border-white/10 rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-white mb-8">Mon Profil</h1>
        
        <div className="flex items-center mb-8">
           <div className="h-24 w-24 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center text-4xl font-bold text-black border-4 border-[#0F1419]">
              {profile?.full_name?.charAt(0) || <User />}
           </div>
           <div className="ml-6">
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                <Camera className="h-4 w-4 mr-2" /> Changer la photo
              </Button>
           </div>
        </div>

        <form onSubmit={handleUpdate} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2">
                <label className="text-sm text-gray-400">Nom complet</label>
                <input className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} />
             </div>
             <div className="space-y-2">
                <label className="text-sm text-gray-400">Pays</label>
                <input className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white" value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} />
             </div>
          </div>
          <div className="space-y-2">
             <label className="text-sm text-gray-400">Objectifs d'apprentissage</label>
             <textarea className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white" rows={4} value={formData.objectives} onChange={e => setFormData({...formData, objectives: e.target.value})} />
          </div>
          <div className="rounded-xl border border-white/15 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Bell className="mt-0.5 h-4 w-4 text-[var(--school-accent)]" />
                <div>
                  <p className="text-sm font-medium text-white">Rappels SMS rendez-vous</p>
                  <p className="text-xs text-gray-400">Recevoir les rappels J-1 et H-1 par SMS.</p>
                </div>
              </div>
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--school-accent)]"
                checked={formData.notify_sms === true}
                onChange={(e) => setFormData({ ...formData, notify_sms: e.target.checked })}
              />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="bg-yellow-600 text-black font-bold hover:bg-yellow-500">
             <Save className="h-4 w-4 mr-2" /> Enregistrer les modifications
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;