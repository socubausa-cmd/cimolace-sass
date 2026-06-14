import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { getEffectiveRole } from '@/lib/accountRoleMode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarIcon, Video, Link as LinkIcon, Loader2, Radio, AlertCircle } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Programmé' },
  { value: 'live', label: 'En direct' },
  { value: 'ended', label: 'Terminé / Replay' },
  { value: 'cancelled', label: 'Annulé' },
];

function toDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(local) {
  if (!local) return null;
  const t = new Date(local).getTime();
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

const LiveSessionManager = () => {
  const { user } = useAuth();
  const effectiveRole = String(getEffectiveRole(user) || '').toLowerCase();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);

  const canSeeAllSessions = ['admin', 'owner', 'secretariat'].includes(effectiveRole);

  const fetchSessions = useCallback(async () => {
    if (!user?.id) {
      setSessions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      let q = supabase
        .from('live_sessions')
        .select(
          'id,title,scheduled_at,status,video_room_url,video_room_id,session_type,teacher_id,started_at,ended_at'
        )
        .order('scheduled_at', { ascending: true })
        .limit(100);

      if (!canSeeAllSessions) {
        q = q.eq('teacher_id', user.id);
      }

      const { data, error } = await q;
      if (error) throw error;
      setSessions(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setLoadError(String(e.message || e));
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, canSeeAllSessions]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  const handleSave = async () => {
    if (!selected?.id) return;
    setSaving(true);
    try {
      const scheduled_at = fromDatetimeLocal(selected.scheduled_at_local);
      const { error } = await supabase
        .from('live_sessions')
        .update({
          title: selected.title || 'Live',
          scheduled_at: scheduled_at || selected.scheduled_at,
          status: selected.status || 'scheduled',
          video_room_url: selected.video_room_url || null,
          video_room_id: selected.video_room_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selected.id);

      if (error) throw error;
      await fetchSessions();
      setSelected(null);
    } catch (e) {
      console.error(e);
      setLoadError(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 min-h-0 max-w-[1600px] mx-auto w-full">
      <div className="rounded-xl border border-white/10 bg-[#15202B]/80 p-4">
        <h1 className="text-lg font-bold text-white">Gestion des lives</h1>
        <p className="text-sm text-gray-400 mt-1">
          Planifiez vos sessions virtuelles (Zoom / Meet / salle intégrée) : dates, statuts et liens de connexion.
          Les données proviennent de la table <code className="text-[#D4AF37]">live_sessions</code> (Supabase).
        </p>
        {!canSeeAllSessions && (
          <p className="text-xs text-amber-200/90 mt-2 flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 shrink-0" />
            Affichage limité aux sessions dont vous êtes l&apos;enseignant.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 flex-1">
        <div className="lg:col-span-4 bg-[#192734] border border-white/10 rounded-xl overflow-hidden flex flex-col min-h-[320px] max-h-[calc(100vh-220px)]">
          <div className="p-4 bg-[#15202B] border-b border-white/10 flex items-center justify-between gap-2">
            <h2 className="font-bold text-white text-sm">Sessions ({sessions.length})</h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/15 text-xs h-8"
              onClick={() => void fetchSessions()}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Rafraîchir'}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading && (
              <div className="flex items-center justify-center gap-2 text-gray-400 py-12">
                <Loader2 className="w-5 h-5 animate-spin" />
                Chargement…
              </div>
            )}
            {!loading && loadError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200 flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{loadError}</span>
              </div>
            )}
            {!loading && !loadError && sessions.length === 0 && (
              <div className="text-center text-gray-500 py-12 px-2 text-sm">
                Aucune session live pour l'instant. Les lives créés depuis le booking ou l\'espace studio apparaîtront
                ici.
              </div>
            )}
            {!loading &&
              sessions.map((live) => (
                <button
                  key={live.id}
                  type="button"
                  onClick={() =>
                    setSelected({
                      ...live,
                      scheduled_at_local: toDatetimeLocal(live.scheduled_at),
                    })
                  }
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selected?.id === live.id
                      ? 'bg-[#D4AF37]/15 border-[#D4AF37]/50 text-[#D4AF37]'
                      : 'bg-[#0F1419] border-white/10 text-gray-300 hover:border-white/20'
                  }`}
                >
                  <div className="font-semibold text-sm line-clamp-2">{live.title || 'Sans titre'}</div>
                  <div className="text-[11px] opacity-80 mt-1">
                    {live.scheduled_at ? new Date(live.scheduled_at).toLocaleString('fr-FR') : '—'}
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[11px]">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        live.status === 'live'
                          ? 'bg-emerald-400 animate-pulse'
                          : live.status === 'ended'
                            ? 'bg-gray-500'
                            : live.status === 'cancelled'
                              ? 'bg-red-400'
                              : 'bg-amber-400'
                      }`}
                    />
                    <span className="uppercase tracking-wide">{live.status || 'scheduled'}</span>
                    {live.session_type ? <span className="text-gray-500">· {live.session_type}</span> : null}
                  </div>
                </button>
              ))}
          </div>
        </div>

        <div className="lg:col-span-8 bg-[#192734] border border-white/10 rounded-xl p-6 overflow-y-auto min-h-[320px] max-h-[calc(100vh-220px)]">
          {selected ? (
            <div className="space-y-6 max-w-2xl mx-auto">
              <h2 className="text-xl font-bold text-white">Modifier la session</h2>

              <div className="space-y-2">
                <label className="text-sm text-gray-400">Titre</label>
                <Input
                  value={selected.title || ''}
                  onChange={(e) => setSelected((s) => ({ ...s, title: e.target.value }))}
                  className="bg-[#0F1419] border-white/10 text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Date & heure</label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      type="datetime-local"
                      value={selected.scheduled_at_local ?? toDatetimeLocal(selected.scheduled_at)}
                      onChange={(e) =>
                        setSelected((s) => ({
                          ...s,
                          scheduled_at_local: e.target.value,
                        }))
                      }
                      className="pl-10 bg-[#0F1419] border-white/10 text-white"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-400">Statut</label>
                  <select
                    value={selected.status || 'scheduled'}
                    onChange={(e) => setSelected((s) => ({ ...s, status: e.target.value }))}
                    className="w-full h-10 px-3 rounded-md bg-[#0F1419] border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-400">Lien de la visioconférence (Zoom, Meet, etc.)</label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    value={selected.video_room_url || ''}
                    onChange={(e) => setSelected((s) => ({ ...s, video_room_url: e.target.value }))}
                    placeholder="https://..."
                    className="pl-10 bg-[#0F1419] border-white/10 text-white"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-400">Identifiant salle (optionnel)</label>
                <Input
                  value={selected.video_room_id || ''}
                  onChange={(e) => setSelected((s) => ({ ...s, video_room_id: e.target.value }))}
                  className="bg-[#0F1419] border-white/10 text-white"
                  placeholder="ID fournisseur vidéo"
                />
              </div>

              <div className="rounded-lg border border-white/10 bg-[#0F1419]/50 p-3 text-xs text-gray-400 flex gap-2">
                <Video className="w-4 h-4 shrink-0 text-[#D4AF37]" />
                <span>
                  Le replay peut être géré via le statut « Terminé » et vos enregistrements côté fournisseur vidéo ; un
                  champ replay dédié peut être ajouté en base si besoin.
                </span>
              </div>

              <Button
                onClick={() => void handleSave()}
                disabled={saving}
                className="w-full bg-[#D4AF37] text-black font-bold hover:bg-amber-400"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin inline" /> : null}
                Enregistrer les modifications
              </Button>
            </div>
          ) : (
            <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-gray-500 text-center px-4">
              <CalendarIcon className="h-14 w-14 mb-4 opacity-20" />
              <p className="font-medium text-gray-400">Sélectionnez une session dans la liste</p>
              <p className="text-sm mt-2 max-w-md">
                Cette page sert à <strong className="text-gray-300">programmer et mettre à jour</strong> vos cours live
                : horaire, statut et liens pour les élèves.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveSessionManager;
