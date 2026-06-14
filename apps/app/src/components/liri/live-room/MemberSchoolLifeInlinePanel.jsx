import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Calendar, MapPin, Clock, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { liveRegulariteFromStats } from '@/lib/liveRegularite';

function isProfileUuid(s) {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/**
 * Aperçu vie scolaire dans le modal membre (sans quitter le live).
 * `embedded` : masque la barre « Retour au flux » (ex. colonne messagerie hôte).
 */
export function MemberSchoolLifeInlinePanel({ studentId, studentName, onBack, embedded = false }) {
  const [tab, setTab] = useState('resume');
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [attRows, setAttRows] = useState([]);
  const [attLoading, setAttLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  useEffect(() => {
    if (!studentId || !isProfileUuid(studentId)) {
      setProfile(null);
      setProfileLoading(false);
      return undefined;
    }
    let cancelled = false;
    setProfileLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, role, avatar_url, live_immersive_session_count, live_immersive_last_at')
        .eq('id', studentId)
        .maybeSingle();
      if (!cancelled) {
        setProfileLoading(false);
        if (!error) setProfile(data || null);
        else setProfile(null);
      }
    })();
    return () => { cancelled = true; };
  }, [studentId]);

  useEffect(() => {
    if (!studentId || !isProfileUuid(studentId)) {
      setAttRows([]);
      setAttLoading(false);
      return undefined;
    }
    let cancelled = false;
    setAttLoading(true);
    (async () => {
      const { data } = await supabase
        .from('attendance_records')
        .select('id,status,attendance_date,note')
        .eq('student_id', studentId)
        .is('deleted_at', null)
        .order('attendance_date', { ascending: false })
        .limit(80);
      if (!cancelled) {
        setAttRows(data || []);
        setAttLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [studentId]);

  useEffect(() => {
    let cancelled = false;
    setEventsLoading(true);
    (async () => {
      const { data } = await supabase
        .from('school_events')
        .select('id,title,description,start_at,location')
        .in('target_role', ['all', 'student'])
        .order('start_at', { ascending: true })
        .limit(24);
      if (!cancelled) {
        setEvents(data || []);
        setEventsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const regularite = useMemo(() => {
    if (!profile) return null;
    return liveRegulariteFromStats({
      count: profile.live_immersive_session_count,
      lastAt: profile.live_immersive_last_at,
    });
  }, [profile]);

  const present = attRows.filter((r) => r.status === 'present').length;
  const totalAtt = attRows.length;
  const rate = totalAtt > 0 ? Math.round((present / totalAtt) * 100) : null;

  const now = new Date();
  const upcomingEv = events.filter((e) => new Date(e.start_at) >= now).slice(0, 8);

  const safeDate = (s) => {
    try {
      return new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  if (!isProfileUuid(studentId)) {
    return (
      <div className={cn('flex flex-col gap-4 text-center', embedded ? 'gap-2 p-3' : 'gap-4 p-4')}>
        <p className="text-sm text-white/60">
          La fiche vie scolaire détaillée nécessite un profil élève reconnu (UUID). Ce participant utilise une identité technique LiveKit.
        </p>
        {!embedded && onBack ? (
          <Button type="button" variant="outline" className="border-white/20 text-white" onClick={onBack}>
            Retour
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 text-white">
      {!embedded && onBack ? (
        <div className="flex items-center gap-2 pb-3 border-b border-white/10 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-white/80 hover:text-white gap-1 -ml-2"
            onClick={onBack}
          >
            <ChevronLeft className="w-4 h-4" />
            Retour au flux
          </Button>
        </div>
      ) : null}
      <p className={cn('text-sm font-semibold text-[#D4AF37] pb-2', embedded ? 'pt-1 px-1' : 'pt-3')}>
        Vie scolaire — {studentName || profile?.name || 'Élève'}
      </p>
      <div className="flex gap-1.5 flex-wrap pb-3 shrink-0">
        {[
          { id: 'resume', label: 'Résumé' },
          { id: 'presences', label: 'Présences' },
          { id: 'events', label: 'Événements' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors',
              tab === t.id
                ? 'border-[#D4AF37]/45 bg-[#D4AF37]/15 text-[#f5dd8a]'
                : 'border-white/12 bg-white/[0.04] text-white/65 hover:bg-white/[0.07]',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4 pb-4">
        {tab === 'resume' && (
          <div className="space-y-3">
            {profileLoading ? (
              <div className="flex items-center gap-2 text-white/50 text-sm py-6">
                <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
              </div>
            ) : profile ? (
              <>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
                  <p className="text-xs text-white/45">Profil</p>
                  <p className="text-sm font-medium">{profile.name || studentName}</p>
                  {profile.role ? (
                    <p className="text-[11px] text-white/55 capitalize">{profile.role}</p>
                  ) : null}
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <p className="text-xs text-white/45 mb-1">Régularité live immersif</p>
                  <p className="text-sm text-white/85">
                    {regularite
                      ? `${regularite.label} · ${regularite.count} session${regularite.count > 1 ? 's' : ''}`
                      : '—'}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <p className="text-xs text-white/45 mb-1">Présences (aperçu)</p>
                  {attLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white/40" />
                  ) : (
                    <p className="text-sm text-white/85">
                      {totalAtt === 0
                        ? 'Aucune ligne de présence enregistrée.'
                        : `${present} présence${present > 1 ? 's' : ''} sur ${totalAtt} enregistrement${totalAtt > 1 ? 's' : ''}${rate != null ? ` (${rate} %)` : ''}.`}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-white/50">
                Impossible de charger le profil (droits ou profil introuvable).
              </p>
            )}
          </div>
        )}

        {tab === 'presences' && (
          <div className="space-y-2">
            {attLoading ? (
              <div className="flex items-center gap-2 text-white/50 text-sm py-8">
                <Loader2 className="w-4 h-4 animate-spin" /> Chargement des présences…
              </div>
            ) : attRows.length === 0 ? (
              <p className="text-sm text-white/45 py-6">Aucune donnée de présence.</p>
            ) : (
              attRows.slice(0, 40).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px]"
                >
                  <span className="text-white/75">{r.attendance_date}</span>
                  <span
                    className={cn(
                      'font-medium',
                      r.status === 'present'
                        ? 'text-emerald-400'
                        : r.status === 'excused'
                          ? 'text-amber-400'
                          : r.status === 'late'
                            ? 'text-orange-400'
                            : 'text-red-400',
                    )}
                  >
                    {r.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'events' && (
          <div className="space-y-2">
            {eventsLoading ? (
              <div className="flex items-center gap-2 text-white/50 text-sm py-8">
                <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
              </div>
            ) : upcomingEv.length === 0 ? (
              <p className="text-sm text-white/45 py-6">Aucun événement campus à venir.</p>
            ) : (
              upcomingEv.map((evt) => (
                <div
                  key={evt.id}
                  className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-1"
                >
                  <p className="text-sm font-medium text-white">{evt.title}</p>
                  <div className="flex flex-wrap gap-2 text-[10px] text-white/50">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {safeDate(evt.start_at)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {(() => {
                        try {
                          return new Date(evt.start_at).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          });
                        } catch {
                          return '';
                        }
                      })()}
                    </span>
                    {evt.location ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {evt.location}
                      </span>
                    ) : null}
                  </div>
                  {evt.description ? (
                    <p className="text-[11px] text-white/45 line-clamp-3">{evt.description}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MemberSchoolLifeInlinePanel;
