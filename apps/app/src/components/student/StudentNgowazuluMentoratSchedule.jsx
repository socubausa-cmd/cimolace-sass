import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, CalendarClock } from 'lucide-react';
import {
  getNgowazuluMentoratOffer,
  NGOWAZULU_SESSION_TYPE_LABELS,
} from '@/config/ngowazuluMentoratOffers';
import { countSessionsInCalendarMonth, countSessionsInContractPeriod } from '@/lib/ngowazuluMentoratSessions';

/**
 * Planification mentorat Ngowazulu (lecture seule) : contrat actif, quota, séances à venir.
 */
export default function StudentNgowazuluMentoratSchedule({ studentId, planSlug }) {
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState([]);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [{ data: cRows }, { data: sRows }] = await Promise.all([
          supabase
            .from('ngowazulu_mentorat_contracts')
            .select('*')
            .eq('student_id', studentId)
            .order('period_start', { ascending: false }),
          supabase
            .from('ngowazulu_mentorat_sessions')
            .select('*')
            .eq('student_id', studentId)
            .order('scheduled_start', { ascending: true }),
        ]);
        if (cancelled) return;
        setContracts(cRows || []);
        setSessions(sRows || []);
      } catch {
        if (!cancelled) {
          setContracts([]);
          setSessions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const offer = useMemo(() => getNgowazuluMentoratOffer(planSlug || ''), [planSlug]);

  const activeContract = useMemo(() => {
    const now = Date.now();
    return (contracts || []).find((c) => {
      const a = new Date(c.period_start).getTime();
      const b = new Date(c.period_end).getTime();
      return now >= a && now < b;
    });
  }, [contracts]);

  const usedInContract = useMemo(() => {
    if (!activeContract) return 0;
    return countSessionsInContractPeriod(sessions, activeContract.period_start, activeContract.period_end);
  }, [sessions, activeContract]);

  const usedThisMonth = useMemo(() => countSessionsInCalendarMonth(sessions), [sessions]);

  const quota = activeContract?.sessions_quota ?? null;
  const remaining =
    quota != null && quota >= 0 ? Math.max(0, quota - usedInContract) : null;

  const upcoming = useMemo(() => {
    const t = Date.now();
    return (sessions || []).filter(
      (s) => s.status !== 'cancelled' && new Date(s.scheduled_start).getTime() >= t
    );
  }, [sessions]);

  if (!studentId) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Chargement du calendrier mentorat…
      </div>
    );
  }

  if (!activeContract && (sessions || []).length === 0) {
    return (
      <p className="text-xs text-gray-500 border-t border-white/10 pt-3 mt-2">
        Dès que le temple enregistre ta période de mentorat, tu verras ici le début de la première semaine, le quota de
        rencontres et tes ateliers planifiés (IRI, prière, rencontres).
      </p>
    );
  }

  return (
    <div className="border-t border-white/10 pt-3 mt-2 space-y-3 text-xs text-gray-300">
      <div className="flex items-center gap-2 text-[#D4AF37] font-semibold">
        <CalendarClock className="w-4 h-4 shrink-0" />
        Planification
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg bg-black/25 border border-white/10 p-2">
          <p className="text-[10px] uppercase text-gray-500">Contrat</p>
          <p className="text-white font-medium mt-0.5">{offer?.commercialName || planSlug || 'Mentorat'}</p>
        </div>
        <div className="rounded-lg bg-black/25 border border-white/10 p-2">
          <p className="text-[10px] uppercase text-gray-500">1ʳᵉ semaine</p>
          <p className="text-white font-medium mt-0.5">{activeContract?.week1_starts_on || '—'}</p>
        </div>
        <div className="rounded-lg bg-black/25 border border-white/10 p-2">
          <p className="text-[10px] uppercase text-gray-500">Reste (période)</p>
          <p className="text-white font-medium mt-0.5">
            {remaining != null ? `${remaining} / ${quota}` : '—'}
          </p>
        </div>
        <div className="rounded-lg bg-black/25 border border-white/10 p-2">
          <p className="text-[10px] uppercase text-gray-500">Ce mois-ci</p>
          <p className="text-white font-medium mt-0.5">{usedThisMonth} séance(s)</p>
        </div>
      </div>
      {upcoming.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase text-gray-500">À venir</p>
          <ul className="space-y-1 max-h-36 overflow-y-auto">
            {upcoming.slice(0, 12).map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-1 border border-white/5 rounded-md px-2 py-1.5">
                <span className="text-white">{s.title}</span>
                <span className="text-gray-500">
                  {new Date(s.scheduled_start).toLocaleString('fr-FR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
                <span className="w-full text-[10px] text-gray-500">
                  {NGOWAZULU_SESSION_TYPE_LABELS[s.session_type] || s.session_type}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-gray-500">Aucune séance à venir pour l'instant.</p>
      )}
    </div>
  );
}
