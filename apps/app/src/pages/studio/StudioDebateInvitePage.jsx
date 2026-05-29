/**
 * DebateCore — acceptation d'invitation débatteur (query ?token=).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Swords, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';

const ERR_FR = {
  auth_required: 'Connectez-vous pour accepter l\'invitation.',
  missing_token: 'Lien incomplet (token manquant).',
  invalid_or_expired: 'Invitation invalide ou expirée.',
  debate_missing: 'Ce débat n\'existe plus.',
  moderator_cannot_join: 'Le modérateur ne peut pas rejoindre en tant que débatteur.',
  side_taken: 'Ce camp est déjà pris par un autre participant.',
};

export default function StudioDebateInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const autoTried = useRef(false);

  const redeem = useCallback(async () => {
    if (!token.trim()) {
      setError(ERR_FR.missing_token);
      return;
    }
    if (!user?.id) {
      setError(ERR_FR.auth_required);
      return;
    }
    setBusy(true);
    setError('');
    const { data, error: rpcErr } = await supabase.rpc('redeem_debate_invite', { p_token: token.trim() });
    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.message || 'Erreur serveur.');
      return;
    }
    const row = data;
    if (!row?.ok) {
      const code = row?.error || 'invalid_or_expired';
      setError(ERR_FR[code] || code);
      return;
    }
    navigate(`/studio/debate-prep/${row.debate_id}`, { replace: true });
  }, [token, user?.id, navigate]);

  useEffect(() => {
    if (!user?.id || !token.trim() || autoTried.current) return;
    autoTried.current = true;
    void redeem();
  }, [user?.id, token, redeem]);

  const loginHref = `/login?next=${encodeURIComponent(`/studio/debate-invite?token=${encodeURIComponent(token)}`)}`;

  return (
    <div className="min-h-screen bg-[#090D14] text-white flex flex-col items-center justify-center px-4 py-12">
      <Link to="/studio" className="absolute top-6 left-4 sm:left-8 text-sm text-white/45 hover:text-[#D4AF37] inline-flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" />
        Studio
      </Link>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/20 flex items-center justify-center mx-auto">
          <Swords className="w-7 h-7 text-rose-300" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-rose-300/80 font-semibold mb-1">DebateCore</p>
          <h1 className="text-xl font-bold">Invitation au débat</h1>
        </div>

        {!token.trim() ? (
          <p className="text-sm text-white/50">{ERR_FR.missing_token}</p>
        ) : !user?.id ? (
          <div className="space-y-4">
            <p className="text-sm text-white/60">{ERR_FR.auth_required}</p>
            <Link
              to={loginHref}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-rose-500/80 hover:bg-rose-500 px-6 text-sm font-medium"
            >
              Se connecter
            </Link>
          </div>
        ) : busy ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="w-9 h-9 text-rose-400/70 animate-spin" />
            <p className="text-sm text-white/45">Validation de l'invitation…</p>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <p className="text-sm text-amber-200/90">{error}</p>
            <button
              type="button"
              onClick={() => void redeem()}
              className="h-10 px-4 rounded-xl border border-white/15 text-sm hover:bg-white/5"
            >
              Réessayer
            </button>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
