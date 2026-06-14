import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCommunities } from '@/hooks/useCommunities';
import { MessageCircle, Users, ChevronRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const CommunityListPage = () => {
  const navigate = useNavigate();
  const { communities, loading, error } = useCommunities();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1419] flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-[var(--school-accent)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1419] text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-bold flex items-center gap-3">
            <MessageCircle className="w-8 h-8 text-[var(--school-accent)]" />
            Mes communautés
          </h1>
          <p className="text-gray-400 mt-2">
            Rejoignez les échanges avec les autres membres de votre communauté.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
            {error.message}
          </div>
        )}

        {communities.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-white/10 bg-[#151a21]/80 backdrop-blur-xl p-12 text-center"
          >
            <MessageCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Vous n'êtes pas encore membre d\'une communauté.</p>
            <p className="text-sm text-gray-500 mt-2">
              Contactez l'administrateur pour être ajouté à une communauté.
            </p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {communities.map((item, i) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/community/${item.community?.id}`)}
                className="w-full rounded-xl border border-white/10 bg-[#151a21]/80 backdrop-blur-xl p-6 flex items-center justify-between hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] hover:bg-[#151a21] transition-all text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] flex items-center justify-center">
                    <Users className="w-6 h-6 text-[var(--school-accent)]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{item.community?.name}</h3>
                    <p className="text-sm text-gray-400">{item.community?.description || '—'}</p>
                    <p className="text-xs text-[var(--school-accent)] mt-1">
                      Créateur : {item.community?.creator?.name || 'Inconnu'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunityListPage;
