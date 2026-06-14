/**
 * DebateCore — espace préparation débatteur (statut prêt, rappel règles).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Swords, Loader2, CheckCircle2, Circle, Video } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';

const STATUS_LABELS = {
  draft: 'Brouillon',
  awaiting_debaters: 'En attente des débatteurs',
  preparing: 'Préparation',
  ready_to_start: 'Prêt à démarrer',
  live: 'En direct',
  interactive_exchange: 'Échange libre',
  audience_questions: 'Questions public',
  round_break: 'Pause',
  finished: 'Terminé',
  archived: 'Archivé',
};

export default function StudioDebatePrepPage() {
  const { debateId } = useParams();
  const { user } = useAuth();
  const [debate, setDebate] = useState(null);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toggleBusy, setToggleBusy] = useState(false);
  const [prepRounds, setPrepRounds] = useState([]);

  const load = useCallback(async () => {
    if (!debateId || !user?.id) return;
    setLoading(true);
    setError('');
    const { data: d, error: dErr } = await supabase.from('debates').select('*').eq('id', debateId).maybeSingle();
    if (dErr || !d) {
      setError(dErr?.message || 'Débat introuvable.');
      setDebate(null);
      setMe(null);
      setLoading(false);
      return;
    }
    setDebate(d);

    const { data: rws } = await supabase
      .from('debate_rounds')
      .select('round_number, status, round_label, brief_public')
      .eq('debate_id', debateId)
      .order('round_number', { ascending: true });
    setPrepRounds(rws || []);

    const { data: row, error: pErr } = await supabase
      .from('debate_participants')
      .select('id, role, side, ready_status')
      .eq('debate_id', debateId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (pErr || !row) {
      setError('Vous ne participez pas à ce débat.');
      setMe(null);
      setLoading(false);
      return;
    }

    if (row.role !== 'debater' && row.role !== 'moderator') {
      setError('Cette page est réservée aux débatteurs (ou modérateur).');
      setMe(null);
      setLoading(false);
      return;
    }

    setMe(row);
    setLoading(false);
  }, [debateId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleReady = async () => {
    if (!me?.id || me.role !== 'debater' || toggleBusy) return;
    const next = me.ready_status === 'ready' ? 'not_ready' : 'ready';
    setToggleBusy(true);
    const { error: uErr } = await supabase.from('debate_participants').update({ ready_status: next }).eq('id', me.id);
    setToggleBusy(false);
    if (uErr) {
      setError(uErr.message);
      return;
    }
    setMe((prev) => (prev ? { ...prev, ready_status: next } : prev));
  };

  if (!user?.id) {
    return (
      <div className="min-h-screen bg-[#090D14] text-white flex items-center justify-center px-4">
        <p className="text-sm text-white/50">Connectez-vous.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090D14] text-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-rose-400/60 animate-spin" />
      </div>
    );
  }

  if (error && !debate) {
    return (
      <div className="min-h-screen bg-[#090D14] text-white px-4 py-12 max-w-lg mx-auto">
        <Link to="/studio" className="text-sm text-rose-300/80 hover:text-rose-200 inline-flex items-center gap-2 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Studio
        </Link>
        <p className="text-sm text-red-300/90">{error}</p>
      </div>
    );
  }

  const isDebater = me?.role === 'debater';
  const ready = me?.ready_status === 'ready';

  return (
    <div className="min-h-screen bg-[#090D14] text-white">
      <div className="max-w-lg mx-auto px-4 py-10 md:py-14">
        <Link
          to={isDebater ? '/studio/debate-builder#debater-invites' : `/studio/debate-builder/${debateId}`}
          className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-[var(--school-accent)] transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {isDebater ? 'Mes invitations (débats)' : 'Fiche débat'}
        </Link>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
              <Swords className="w-6 h-6 text-rose-300" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-rose-300/80 font-semibold">Préparation</p>
              <h1 className="text-xl font-bold truncate">{debate.title}</h1>
              {debate.topic ? <p className="text-sm text-white/45 mt-0.5">{debate.topic}</p> : null}
            </div>
          </div>

          {error ? <p className="text-xs text-amber-300/90">{error}</p> : null}

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2 text-sm">
            <p>
              <span className="text-white/40">Statut débat : </span>
              <span className="text-white/85">{STATUS_LABELS[debate.status] || debate.status}</span>
            </p>
            {isDebater ? (
              <p>
                <span className="text-white/40">Votre camp : </span>
                <span className="text-rose-200/90 font-medium">{me.side}</span>
              </p>
            ) : (
              <p className="text-white/50 text-xs">Vue modérateur — les débatteurs marquent leur préparation ici.</p>
            )}
            <p className="text-xs text-white/35">
              Rounds : {debate.round_count} · {Math.round(debate.seconds_per_turn / 60)} min par tour
            </p>
          </div>

          {debate.description ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-[10px] uppercase text-white/40 mb-2">Consignes</p>
              <p className="text-sm text-white/65 whitespace-pre-wrap">{debate.description}</p>
            </div>
          ) : null}

          {prepRounds.length > 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
              <p className="text-[10px] uppercase text-white/40">Programme des rounds</p>
              <ul className="space-y-3">
                {prepRounds.map((rw) => (
                  <li key={rw.round_number} className="rounded-lg border border-white/8 bg-black/20 px-3 py-2.5">
                    <p className="text-xs font-medium text-white/85">
                      Round {rw.round_number}
                      {rw.round_label ? (
                        <span className="text-rose-200/90 font-normal"> · {rw.round_label}</span>
                      ) : null}
                    </p>
                    {rw.brief_public ? (
                      <p className="text-[11px] text-white/50 mt-1.5 whitespace-pre-wrap">{rw.brief_public}</p>
                    ) : (
                      <p className="text-[10px] text-white/25 mt-1 italic">Consigne à définir par le modérateur.</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {isDebater ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {ready ? (
                  <CheckCircle2 className="w-8 h-8 text-emerald-400/85 shrink-0" />
                ) : (
                  <Circle className="w-8 h-8 text-white/25 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-white/90">{ready ? 'Vous êtes prêt' : 'Pas encore prêt'}</p>
                  <p className="text-[11px] text-white/40">Le modérateur voit votre statut sur la fiche débat.</p>
                </div>
              </div>
              <button
                type="button"
                disabled={toggleBusy}
                onClick={() => void toggleReady()}
                className={cn(
                  'shrink-0 h-10 px-4 rounded-xl text-sm font-medium transition-colors disabled:opacity-45',
                  ready ? 'border border-white/20 text-white/80 hover:bg-white/5' : 'bg-emerald-600/80 hover:bg-emerald-600 text-white'
                )}
              >
                {toggleBusy ? '…' : ready ? 'Annuler' : 'Je suis prêt'}
              </button>
            </div>
          ) : null}

          {debate.live_session_id ? (
            <Link
              to={`/studio/live-arena/${debate.live_session_id}`}
              className="flex items-center justify-center gap-2 h-11 rounded-xl bg-amber-600/85 hover:bg-amber-600 text-sm font-medium"
            >
              <Video className="w-4 h-4 shrink-0" />
              Rejoindre l'Arena
            </Link>
          ) : (
            <p className="text-[11px] text-white/35 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
              L'Arena sera disponible ici dès que le modérateur aura créé la salle depuis la fiche débat.
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
