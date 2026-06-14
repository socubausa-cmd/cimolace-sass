/**
 * DebateCore — fiche débat (modérateur) : statut, rounds, participants, prochaines étapes.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Swords, Loader2, Users, ListOrdered, Trash2, Copy, Check, Video, Sparkles, Mail,
} from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { cn } from '@/lib/utils';
import useTenantBranding from '@/hooks/useTenantBranding';

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

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function generateInviteToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export default function StudioDebateDetailPage() {
  const { debateId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { branding, cssVars } = useTenantBranding();
  const [debate, setDebate] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [roundSaveBusy, setRoundSaveBusy] = useState(null);
  const [aiReports, setAiReports] = useState([]);
  const [inviteEmailDraft, setInviteEmailDraft] = useState({});
  const [emailSendBusyId, setEmailSendBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!debateId || !user?.id) return;
    setLoading(true);
    setError('');
    const { data: d, error: dErr } = await supabase.from('debates').select('*').eq('id', debateId).maybeSingle();
    if (dErr || !d) {
      setError(dErr?.message || 'Débat introuvable.');
      setDebate(null);
      setLoading(false);
      return;
    }
    if (d.moderator_id !== user.id) {
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      const r = String(prof?.role || '').toLowerCase();
      if (!['owner', 'admin'].includes(r)) {
        setError('Vous n\'êtes pas modérateur de ce débat.');
        setDebate(null);
        setLoading(false);
        return;
      }
    }
    setDebate(d);

    const { data: rws } = await supabase
      .from('debate_rounds')
      .select(
        'id, round_number, status, score_a, score_b, ai_score_a, ai_score_b, winner_side, round_label, brief_public',
      )
      .eq('debate_id', debateId)
      .order('round_number', { ascending: true });
    setRounds(rws || []);

    const { data: parts } = await supabase
      .from('debate_participants')
      .select('id, user_id, role, side, ready_status, invited_at')
      .eq('debate_id', debateId)
      .order('invited_at', { ascending: true });
    setParticipants(parts || []);

    const { data: invs } = await supabase
      .from('debate_invitations')
      .select('id, side, token, email, expires_at, accepted_at, created_at')
      .eq('debate_id', debateId)
      .order('created_at', { ascending: false });
    setInvitations(invs || []);

    const { data: reps } = await supabase
      .from('debate_ai_reports')
      .select('id, round_number, score_a, score_b, summary, provider, created_at')
      .eq('debate_id', debateId)
      .order('created_at', { ascending: false })
      .limit(20);
    setAiReports(reps || []);

    setLoading(false);
  }, [debateId, user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const goAwaitingDebaters = async () => {
    if (!debateId || debate?.status !== 'draft') return;
    setActionBusy(true);
    const { error: uErr } = await supabase.from('debates').update({ status: 'awaiting_debaters' }).eq('id', debateId);
    setActionBusy(false);
    if (uErr) {
      setError(uErr.message);
      return;
    }
    void load();
  };

  const inviteUrl = (token) =>
    `${typeof window !== 'undefined' ? window.location.origin : ''}/studio/debate-invite?token=${encodeURIComponent(token)}`;

  const createInvitation = async (side) => {
    if (!debateId || !user?.id || inviteBusy) return;
    setInviteBusy(true);
    setError('');
    const token = generateInviteToken();
    const { error: insErr } = await supabase.from('debate_invitations').insert({
      debate_id: debateId,
      side,
      token,
      created_by: user.id,
    });
    setInviteBusy(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    void load();
  };

  const copyInviteLink = async (inv) => {
    const url = inviteUrl(inv.token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(inv.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError('Impossible de copier le lien (permissions navigateur).');
    }
  };

  const revokeInvitation = async (invId) => {
    if (!window.confirm('Révoquer cette invitation ? Les liens existants ne fonctionneront plus.')) return;
    setInviteBusy(true);
    const { error: delErr } = await supabase.from('debate_invitations').delete().eq('id', invId);
    setInviteBusy(false);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    void load();
  };

  const openArena = async () => {
    if (!debateId || !user?.id || !debate || actionBusy) return;
    if (debate.live_session_id) {
      navigate(`/studio/live-arena/${debate.live_session_id}`);
      return;
    }
    setActionBusy(true);
    setError('');
    const scheduledAt = debate.scheduled_at || new Date().toISOString();
    const durationMinutes = Math.max(
      30,
      Math.ceil((Number(debate.round_count) * Number(debate.seconds_per_turn) * 2) / 60),
    );
    const { data: row, error: insErr } = await supabase
      .from('live_sessions')
      .insert({
        teacher_id: user.id,
        title: `[Débat] ${debate.title || 'Sans titre'}`,
        session_type: 'debate',
        scheduled_at: scheduledAt,
        debate_id: debateId,
        visibility_mode: 'secret',
        status: 'scheduled',
        duration_minutes: durationMinutes,
        config: { debate_core: true },
      })
      .select('id')
      .single();

    if (insErr || !row?.id) {
      setError(
        insErr?.message ||
          'Création de session impossible. Vérifiez la migration live_sessions (colonne debate_id, type debate).',
      );
      setActionBusy(false);
      return;
    }

    const { error: linkErr } = await supabase.from('debates').update({ live_session_id: row.id }).eq('id', debateId);
    if (linkErr) {
      await supabase.from('live_sessions').delete().eq('id', row.id);
      setError(linkErr.message);
      setActionBusy(false);
      return;
    }

    setDebate((d) => (d ? { ...d, live_session_id: row.id } : d));
    setActionBusy(false);
    navigate(`/studio/live-arena/${row.id}`);
  };

  const saveRoundPrep = async (roundRow) => {
    if (!debateId || !roundRow?.id || roundSaveBusy) return;
    setRoundSaveBusy(roundRow.id);
    setError('');
    const { error: uErr } = await supabase
      .from('debate_rounds')
      .update({
        round_label: roundRow.round_label?.trim() || null,
        brief_public: roundRow.brief_public?.trim() || null,
      })
      .eq('id', roundRow.id)
      .eq('debate_id', debateId);
    setRoundSaveBusy(null);
    if (uErr) {
      setError(uErr.message);
      return;
    }
    setRounds((prev) =>
      prev.map((r) =>
        r.id === roundRow.id
          ? {
              ...r,
              round_label: roundRow.round_label?.trim() || null,
              brief_public: roundRow.brief_public?.trim() || null,
            }
          : r,
      ),
    );
  };

  const updateRoundLocal = (roundId, patch) => {
    setRounds((prev) => prev.map((r) => (r.id === roundId ? { ...r, ...patch } : r)));
  };

  const handleDelete = async () => {
    if (!debateId || !debate) return;
    if (!window.confirm('Supprimer ce débat et toutes ses données associées ?')) return;
    setActionBusy(true);
    const { error: delErr } = await supabase.from('debates').delete().eq('id', debateId);
    setActionBusy(false);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    navigate('/studio/debate-builder');
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
        <Link to="/studio/debate-builder" className="text-sm text-rose-300/80 hover:text-rose-200 inline-flex items-center gap-2 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Retour à la liste
        </Link>
        <p className="text-sm text-red-300/90">{error}</p>
      </div>
    );
  }

  const debaters = participants.filter((p) => p.role === 'debater');
  const readyA = debaters.some((p) => p.side === 'A' && p.ready_status === 'ready');
  const readyB = debaters.some((p) => p.side === 'B' && p.ready_status === 'ready');

  return (
    <div
      className="min-h-screen text-white"
      data-school-shell="debate-detail"
      data-tenant-brand={branding.slug}
      style={{ ...cssVars, background: 'var(--school-background, #090D14)', fontFamily: 'var(--school-font-family, Inter, sans-serif)' }}
    >
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
        <Link
          to="/studio/debate-builder"
          className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-[var(--school-accent,#D4AF37)] transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Tous les débats
        </Link>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
                <Swords className="w-6 h-6 text-rose-300" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-rose-300/80 font-semibold">DebateCore</p>
                <h1 className="text-xl md:text-2xl font-bold truncate">{debate.title}</h1>
                {debate.topic ? <p className="text-sm text-white/50 mt-1">{debate.topic}</p> : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={actionBusy}
              className="shrink-0 h-9 w-9 rounded-xl border border-red-500/30 text-red-300/80 hover:bg-red-500/10 flex items-center justify-center disabled:opacity-40"
              title="Supprimer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {error ? <p className="text-xs text-amber-300/90">{error}</p> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase text-white/40 mb-1">Statut</p>
              <p className="text-sm font-medium text-white/90">{STATUS_LABELS[debate.status] || debate.status}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase text-white/40 mb-1">Rendez-vous</p>
              <p className="text-sm font-medium text-white/90">{formatWhen(debate.scheduled_at)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase text-white/40 mb-1">Rounds / tour</p>
              <p className="text-sm font-medium text-white/90">
                {debate.round_count} rounds · {Math.round(debate.seconds_per_turn / 60)} min / tour
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase text-white/40 mb-1">Options</p>
              <p className="text-xs text-white/70">
                Accès : {debate.access_mode} · NeuronQ : {debate.neuronq_enabled ? 'oui' : 'non'} · IA :{' '}
                {debate.ai_judge_enabled ? `${Math.round(debate.ai_weight * 100)}%` : 'non'}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:col-span-2">
              <p className="text-[10px] uppercase text-white/40 mb-1">Arena Live</p>
              <p className="text-xs text-white/70">
                {debate.live_session_id
                  ? 'Session liée — ouvrez l\'Arena pour diffuser (les participants au débat peuvent se connecter).'
                  : 'Aucune session — créez-en une pour lancer la salle LiveKit.'}
              </p>
            </div>
          </div>

          {debate.description ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-[10px] uppercase text-white/40 mb-2">Description</p>
              <p className="text-sm text-white/70 whitespace-pre-wrap">{debate.description}</p>
            </div>
          ) : null}

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white/85 mb-3">
              <Users className="w-4 h-4 text-rose-300/80" />
              Participants
            </div>
            <p className="text-xs text-white/45 mb-3">
              Préparation « prêt » : camp A {readyA ? '✓' : '—'} · camp B {readyB ? '✓' : '—'}
            </p>

            <div className="rounded-lg border border-white/8 bg-black/20 p-3 mb-4 space-y-3">
              <p className="text-[10px] uppercase text-white/35 font-semibold tracking-wide">Invitations débatteurs</p>
              <p className="text-[11px] text-white/40">
                Générez un lien par camp. Le destinataire se connecte puis est ajouté automatiquement au débat.
                Vous pouvez aussi envoyer le lien par e-mail (Resend sur Netlify).
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={inviteBusy}
                  onClick={() => void createInvitation('A')}
                  className="h-9 px-3 rounded-lg bg-rose-600/35 hover:bg-rose-600/50 border border-rose-500/25 text-xs font-medium disabled:opacity-40"
                >
                  Nouveau lien · camp A
                </button>
                <button
                  type="button"
                  disabled={inviteBusy}
                  onClick={() => void createInvitation('B')}
                  className="h-9 px-3 rounded-lg bg-sky-600/25 hover:bg-sky-600/40 border border-sky-500/20 text-xs font-medium disabled:opacity-40"
                >
                  Nouveau lien · camp B
                </button>
              </div>
              {invitations.length > 0 ? (
                <ul className="space-y-2 mt-2">
                  {invitations.map((inv) => {
                    const used = Boolean(inv.accepted_at);
                    const expired = inv.expires_at && new Date(inv.expires_at) < new Date();
                    return (
                      <li
                        key={inv.id}
                        className="flex flex-col gap-2 py-2 border-t border-white/8 first:border-0 text-[11px]"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <span className="text-white/55 shrink-0">
                            Camp {inv.side}
                            {used ? ' · acceptée' : expired ? ' · expirée' : ' · en attente'}
                          </span>
                          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                            <button
                              type="button"
                              disabled={used || expired}
                              onClick={() => void copyInviteLink(inv)}
                              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-white/12 text-white/70 hover:bg-white/5 disabled:opacity-35"
                            >
                              {copiedId === inv.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              Copier le lien
                            </button>
                            {!used ? (
                              <button
                                type="button"
                                disabled={inviteBusy}
                                onClick={() => void revokeInvitation(inv.id)}
                                className="h-8 px-2.5 rounded-lg text-red-300/70 hover:bg-red-500/10 text-[11px]"
                              >
                                Révoquer
                              </button>
                            ) : null}
                          </div>
                          <span className="text-white/25 text-[10px] sm:w-full sm:order-first sm:pl-0">
                            Exp. {formatWhen(inv.expires_at)}
                          </span>
                        </div>
                        {!used && !expired ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="email"
                              autoComplete="email"
                              placeholder="email@exemple.com"
                              value={inviteEmailDraft[inv.id] ?? inv.email ?? ''}
                              onChange={(e) =>
                                setInviteEmailDraft((d) => ({ ...d, [inv.id]: e.target.value }))
                              }
                              className="flex-1 min-w-[12rem] h-8 rounded-lg bg-white/[0.06] border border-white/10 px-2.5 text-xs text-white/90 placeholder:text-white/25"
                            />
                            <button
                              type="button"
                              disabled={emailSendBusyId === inv.id}
                              onClick={() => void sendDebateInviteEmail(inv)}
                              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-amber-600/40 hover:bg-amber-600/55 border border-amber-500/30 text-[11px] font-medium text-white/90 disabled:opacity-40"
                            >
                              {emailSendBusyId === inv.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Mail className="w-3.5 h-3.5" />
                              )}
                              Envoyer par e-mail
                            </button>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-[11px] text-white/30 italic">Aucune invitation pour l'instant.</p>
              )}
            </div>
            <ul className="space-y-2 text-xs">
              {participants.map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between gap-2 py-2 border-b border-white/5 last:border-0"
                >
                  <span className="text-white/60">
                    {p.role}
                    {p.side ? ` · camp ${p.side}` : ''}
                  </span>
                  <span className={cn(p.ready_status === 'ready' ? 'text-emerald-400/90' : 'text-white/35')}>
                    {p.ready_status === 'ready' ? 'Prêt' : 'Pas prêt'}
                  </span>
                </li>
              ))}
              {participants.length === 0 ? <li className="text-white/35">Aucun participant enregistré.</li> : null}
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white/85 mb-1">
              <ListOrdered className="w-4 h-4 text-rose-300/80" />
              Rounds ({rounds.length})
            </div>
            <p className="text-[11px] text-white/38 mb-3">
              Titre et consigne par round — visibles dans l'espace préparation et le bandeau Arena pour le round en cours.
            </p>
            <ul className="space-y-3 max-h-[min(70vh,28rem)] overflow-y-auto pr-1">
              {rounds.map((r) => (
                <li key={r.id} className="rounded-lg border border-white/8 bg-black/25 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-white/75">Round {r.round_number}</span>
                    <span className="text-[10px] text-white/30 uppercase tracking-wide">{r.status}</span>
                  </div>
                  {(r.status === 'completed' || r.score_a > 0 || r.score_b > 0) && (
                    <p className="text-[10px] text-white/40 tabular-nums">
                      Voix A {r.score_a ?? 0} · B {r.score_b ?? 0}
                      {r.ai_score_a != null && r.ai_score_b != null
                        ? ` · IA (0–10) A ${Number(r.ai_score_a).toFixed(1)} · B ${Number(r.ai_score_b).toFixed(1)}`
                        : ''}
                    </p>
                  )}
                  <input
                    type="text"
                    value={r.round_label ?? ''}
                    onChange={(e) => updateRoundLocal(r.id, { round_label: e.target.value })}
                    placeholder="Titre du round (ex. Ouverture, Contre-interrogatoire)"
                    className="w-full h-9 rounded-lg bg-white/[0.06] border border-white/10 px-3 text-xs text-white/90 placeholder:text-white/25"
                  />
                  <textarea
                    value={r.brief_public ?? ''}
                    onChange={(e) => updateRoundLocal(r.id, { brief_public: e.target.value })}
                    placeholder="Consigne partagée avec débatteurs et public…"
                    rows={3}
                    className="w-full rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2 text-xs text-white/80 placeholder:text-white/25 resize-y min-h-[4rem]"
                  />
                  <button
                    type="button"
                    disabled={roundSaveBusy === r.id}
                    onClick={() => void saveRoundPrep(r)}
                    className="h-8 px-3 rounded-lg bg-rose-600/40 hover:bg-rose-600/55 border border-rose-500/25 text-[11px] font-medium text-white/90 disabled:opacity-40"
                  >
                    {roundSaveBusy === r.id ? '…' : 'Enregistrer ce round'}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {debate.ai_judge_enabled || aiReports.length > 0 ? (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-200/90 mb-2">
                <Sparkles className="w-4 h-4 shrink-0 opacity-90" />
                Synthèses juge IA
              </div>
              {!debate.ai_judge_enabled ? (
                <p className="text-[11px] text-white/45 mb-2">
                  Juge IA désactivé sur ce débat — historique conservé ci-dessous.
                </p>
              ) : (
                <p className="text-[11px] text-white/40 mb-3">
                  Générées depuis l'Arena (pilotage débat). Pondération config :{' '}
                  {Math.round(Number(debate.ai_weight || 0) * 100)} %.
                </p>
              )}
              {aiReports.length === 0 ? (
                <p className="text-xs text-white/35 italic">Aucune synthèse enregistrée pour l'instant.</p>
              ) : (
                <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {aiReports.map((rep) => (
                    <li
                      key={rep.id}
                      className="rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[11px]"
                    >
                      <p className="text-white/55 tabular-nums">
                        Round {rep.round_number} · A {Number(rep.score_a).toFixed(1)} · B {Number(rep.score_b).toFixed(1)}
                        <span className="text-white/30"> · {formatWhen(rep.created_at)}</span>
                        {rep.provider ? (
                          <span className="text-white/25"> · {rep.provider}</span>
                        ) : null}
                      </p>
                      {rep.summary ? (
                        <p className="text-white/65 mt-1 whitespace-pre-wrap line-clamp-3">{rep.summary}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3 items-center">
            {debate.status === 'draft' ? (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => void goAwaitingDebaters()}
                className="h-10 px-4 rounded-xl bg-rose-500/75 hover:bg-rose-500 text-sm font-medium disabled:opacity-50"
              >
                Passer en « attente des débatteurs »
              </button>
            ) : null}
            <Link
              to={`/studio/debate-prep/${debateId}`}
              className="h-10 px-4 rounded-xl border border-white/15 text-sm font-medium text-white/75 hover:bg-white/5 inline-flex items-center"
            >
              Espace préparation (aperçu)
            </Link>
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => void openArena()}
              className="h-10 px-4 rounded-xl bg-amber-600/85 hover:bg-amber-600 text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Video className="w-4 h-4 shrink-0" />
              {debate.live_session_id ? 'Ouvrir l\'Arena' : 'Créer la salle Arena'}
            </button>
            <p className="text-[11px] text-white/35 w-full basis-full">
              Accès LiveKit : modérateur + toute personne enregistrée comme participant à ce débat (débatteurs, spectateurs).
              Votes et timers débat — itérations suivantes.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
