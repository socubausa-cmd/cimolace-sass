import React, { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { User, Mail, MapPin, Shield, Edit2, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const MyProfilePage = () => {
  const { user, logout } = useAuth();

  const locationLine = useMemo(() => {
    if (!user) return 'Non renseigné';
    const parts = [user.city, user.region, user.country].filter(Boolean);
    return parts.length ? parts.join(', ') : 'Non renseigné';
  }, [user]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-24 pb-20">
      <Helmet><title>{`Mon Profil | ${isnaTenantConfig.branding.name}`}</title></Helmet>

      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-[#192734] border border-white/10 rounded-2xl overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-[#D4AF37]/20 to-purple-900/20" />

          <div className="px-8 pb-8">
            <div className="flex justify-between items-end -mt-12 mb-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-[#0F1419] p-1 border-2 border-[#D4AF37]">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      className="w-full h-full rounded-full object-cover"
                      alt=""
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gray-800 flex items-center justify-center">
                      <User className="w-10 h-10 text-gray-400" />
                    </div>
                  )}
                </div>
              </div>
              <Link to="/profil/modifier">
                <Button variant="outline" className="border-white/10 text-white hover:bg-white/5 gap-2">
                  <Edit2 className="w-4 h-4" /> Modifier
                </Button>
              </Link>
            </div>

            <h1 className="text-2xl font-bold text-white mb-1">{user.name || 'Membre'}</h1>
            <p className="text-[#D4AF37] text-sm font-medium uppercase tracking-wide mb-6">{user.role || 'Membre'}</p>

            <div className="grid md:grid-cols-2 gap-6 pt-6 border-t border-white/5">
              <div className="space-y-4">
                <h3 className="text-gray-400 text-xs font-bold uppercase">Informations personnelles</h3>
                <div className="flex items-center gap-3 text-gray-300">
                  <Mail className="w-5 h-5 text-gray-500 shrink-0" /> {user.email}
                </div>
                <div className="flex items-start gap-3 text-gray-300">
                  <MapPin className="w-5 h-5 text-gray-500 shrink-0 mt-0.5" /> {locationLine}
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-gray-400 text-xs font-bold uppercase">Statut</h3>
                <div className="flex items-center gap-3 text-gray-300">
                  <Shield className="w-5 h-5 text-gray-500 shrink-0" />
                  Compte&nbsp;:
                  <span className="bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-0.5 rounded text-xs font-bold border border-[#D4AF37]/20 capitalize">
                    {user.status || 'actif'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-white/5 flex justify-end">
              <Button
                variant="destructive"
                onClick={() => void logout()}
                className="gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20"
              >
                <LogOut className="w-4 h-4" /> Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyProfilePage;
