import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { User, BookOpen, Video, Calendar, Settings, LogOut, CreditCard, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const SITE_NAME = `${isnaTenantConfig.branding.name} · LIRI`;
const PUBLIC_HOST = (() => {
  try {
    return new URL(isnaTenantConfig.branding.publicSiteOrigin).host;
  } catch {
    return 'prorascience.org';
  }
})();

const MemberAreaPage = () => {
  const { user, profile, signOut, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  const handleFeatureClick = (feature) => {
    toast({
      title: `Section "${feature}"`,
      description: "🚧 Cette fonctionnalité n'est pas encore implémentée—mais ne vous inquiétez pas ! Vous pouvez la demander dans votre prochain message ! 🚀",
    });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-white">Chargement de l'espace membre...</div>;
  }

  if (!user) {
    return null; // Should be redirected by useEffect
  }

  const tabs = [
    { id: 'dashboard', label: 'Tableau de bord', icon: User },
    { id: 'my-formations', label: 'Mes Formations', icon: BookOpen },
    { id: 'my-videos', label: 'Mes Vidéos Premium', icon: Video },
    { id: 'my-consultations', label: 'Mes Consultations', icon: Calendar },
    { id: 'my-payments', label: 'Mes Paiements', icon: CreditCard },
    { id: 'my-certificates', label: 'Mes Certificats', icon: Award },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ];

  return (
    <div className="min-h-screen py-20 px-4">
      <Helmet>
        <title>{`Espace membre — ${SITE_NAME}`}</title>
        <meta name="description" content={`Gérez vos formations, vidéos, consultations et profil sur ${PUBLIC_HOST}.`} />
      </Helmet>

      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="mb-8">
          <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-xl p-6 border border-white/10">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center overflow-hidden">
                {profile?.profile_picture_url ? (
                  <img src={profile.profile_picture_url} alt="Photo de profil" className="w-full h-full object-cover" />
                ) : (
                  <User className="h-8 w-8 text-white" />
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Bienvenue, {profile?.full_name || 'Membre'} !</h1>
                <p className="text-gray-300">Votre espace personnel pour explorer les sciences nocturnes avancées.</p>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-4 gap-8">
          <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="lg:col-span-1">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 sticky top-24">
              <h2 className="text-xl font-bold text-white mb-4">Navigation</h2>
              <PremiumSegmentedSelector
                value={activeTab}
                onChange={setActiveTab}
                options={tabs.map((tab) => ({
                  value: tab.id,
                  label: tab.label,
                  badge: tab.id.startsWith('my-') ? 'Espace membre' : 'Compte',
                  icon: tab.icon,
                }))}
                layoutId="member-area-segment-pill"
                className="mb-3"
                optionClassName="w-full"
                showChevron={false}
              />
              <div className="space-y-2">
                <Button onClick={signOut} className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-red-400 hover:text-red-300 hover:bg-white/10 bg-transparent border-none justify-start">
                  <LogOut className="h-5 w-5" /> <span>Déconnexion</span>
                </Button>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.4 }} className="lg:col-span-3">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-white">Tableau de bord</h2>
                  <p className="text-gray-300">{`Bienvenue dans votre espace personnel. Ici, vous pouvez gérer toutes vos activités sur ${PUBLIC_HOST}.`}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/10 p-4 rounded-lg border border-white/20">
                      <h3 className="text-xl font-semibold text-white mb-2">Prochaine Consultation</h3>
                      <p className="text-gray-300">Aucune consultation prévue pour le moment.</p>
                      <Button onClick={() => navigate('/consultations')} className="mt-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">Réserver une consultation</Button>
                    </div>
                    <div className="bg-white/10 p-4 rounded-lg border border-white/20">
                      <h3 className="text-xl font-semibold text-white mb-2">Dernière Formation</h3>
                      <p className="text-gray-300">Vous n'avez pas encore de formation active.</p>
                      <Button onClick={() => navigate('/formations')} className="mt-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">Découvrir les formations</Button>
                    </div>
                  </div>
                </div>
              )}

              {['my-formations', 'my-videos', 'my-consultations', 'my-payments', 'my-certificates', 'settings'].includes(activeTab) && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🚧</div>
                  <h2 className="text-2xl font-bold text-white mb-4"> Section {tabs.find(t => t.id === activeTab)?.label} </h2>
                  <p className="text-gray-300 mb-6"> Cette fonctionnalité est en cours de développement. </p>
                  <Button onClick={() => handleFeatureClick(tabs.find(t => t.id === activeTab)?.label)} className="bg-gradient-to-r from-purple-600 to-pink-600"> Demander cette fonctionnalité </Button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default MemberAreaPage;