import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * CourseUnlockAdminPage — programmation du DÉBLOCAGE par semaine (#44).
 * Réservé encadrant (garde côté RPC set_week_unlock). Le gating n'a d'effet que
 * si le cours est en mode='cursus' (continue/masterclass = libre). Une date
 * passée = accessible (rétroactif). Route /cours/:courseId/deblocage. Coral.
 */
const COL = {
  coral: '#d97757', coralDim: 'rgba(217,119,87,0.10)', coralMid: 'rgba(217,119,87,0.30)',
  cream: '#f5f1e9', t2: 'rgba(245,241,233,0.66)', t3: 'rgba(245,241,233,0.42)',
  line: 'rgba(245,241,233,0.10)', field: 'rgba(245,241,233,0.04)',
  mono: "'JetBrains Mono','Fira Code',monospace",
};

// ISO → valeur d'un <input type=datetime-local> (heure locale) et inverse.
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function CourseUnlockAdminPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: mods }] = await Promise.all([
      supabase.from('courses').select('id, title, mode').eq('id', courseId).maybeSingle(),
      supabase.from('modules').select('id, title, sort_order, formation_weeks(id, title, sort_order, unlock_at)').eq('formation_id', courseId),
    ]);
    setCourse(c || null);
    const flat = [];
    (mods || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).forEach((m) => {
      (m.formation_weeks || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).forEach((w) => {
        flat.push({ ...w, moduleTitle: m.title });
      });
    });
    setWeeks(flat);
    setLoading(false);
  }, [courseId]);

  useEffect(() => { void load(); }, [load]);

  const setUnlock = async (weekId, localValue) => {
    setBusy(weekId); setMsg('');
    try {
      const iso = localValue ? new Date(localValue).toISOString() : null;
      const { error } = await supabase.rpc('set_week_unlock', { p_week_id: weekId, p_unlock_at: iso });
      if (error) throw error;
      setWeeks((prev) => prev.map((w) => (w.id === weekId ? { ...w, unlock_at: iso } : w)));
      setMsg('✓ Enregistré');
    } catch (e) { setMsg('Échec : ' + (e?.message || e)); } finally { setBusy(''); }
  };

  const isCursus = course?.mode === 'cursus';
  const now = Date.now();
  const lockedLabel = (w) => {
    if (!isCursus) return { txt: 'Libre (mode ≠ cursus)', c: COL.t3 };
    if (!w.unlock_at) return { txt: 'Ouvert (pas de date)', c: COL.t3 };
    return new Date(w.unlock_at).getTime() > now ? { txt: '🔒 Verrouillé', c: COL.coral } : { txt: 'Ouvert (rétroactif)', c: '#6cc08b' };
  };

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '8px 16px 60px' }}>
      <button onClick={() => navigate(-1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 18, padding: '7px 13px', borderRadius: 9, cursor: 'pointer', background: 'rgba(217,119,87,0.10)', border: '1px solid rgba(217,119,87,0.28)', color: COL.coral, fontSize: 12.5, fontWeight: 600 }}>← Retour</button>
      <div style={{ fontFamily: COL.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.10em', color: COL.coral, textTransform: 'uppercase', marginBottom: 6 }}>Déblocage progressif</div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: COL.cream, margin: 0, lineHeight: 1.15 }}>{course?.title || 'Cours'}</h1>

      <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 12, background: isCursus ? COL.coralDim : COL.field, border: `1px solid ${isCursus ? COL.coralMid : COL.line}`, fontSize: 13, color: COL.t2 }}>
        {isCursus
          ? "Ce cours est en mode « cursus » : chaque semaine se débloque à sa date (une date passée = accès rétroactif immédiat)."
          : "Ce cours est en mode « " + (course?.mode || 'continue') + " » → accès libre. Les dates ci-dessous n'auront d'effet qu'en passant le cours en mode « cursus » (page du cours)."}
      </div>

      {msg ? <div style={{ marginTop: 12, fontSize: 12.5, fontFamily: COL.mono, color: msg.startsWith('Échec') ? '#f0a58a' : COL.coral }}>{msg}</div> : null}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: COL.mono, fontSize: 10, letterSpacing: '0.12em', color: COL.t3 }}>CHARGEMENT…</div>
      ) : weeks.length === 0 ? (
        <div style={{ marginTop: 22, padding: '28px 20px', textAlign: 'center', color: COL.t3, border: `1px dashed ${COL.line}`, borderRadius: 14 }}>Ce cours n'a pas encore de semaines (structure studio).</div>
      ) : (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {weeks.map((w, i) => {
            const st = lockedLabel(w);
            return (
              <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 14px', borderRadius: 12, background: 'rgba(245,241,233,0.02)', border: `1px solid ${COL.line}` }}>
                <span style={{ fontFamily: COL.mono, fontSize: 12, fontWeight: 700, color: COL.coral, minWidth: 24 }}>{String(i + 1).padStart(2, '0')}</span>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: COL.cream }}>{w.title || `Semaine ${i + 1}`}</div>
                  <div style={{ fontSize: 11, color: COL.t3 }}>{w.moduleTitle || ''}</div>
                </div>
                <input
                  type="datetime-local"
                  defaultValue={toLocalInput(w.unlock_at)}
                  disabled={busy === w.id}
                  onChange={(e) => setUnlock(w.id, e.target.value)}
                  style={{ height: 34, padding: '0 10px', borderRadius: 8, background: COL.field, border: `1px solid ${COL.line}`, color: COL.cream, fontSize: 12.5, colorScheme: 'dark' }}
                />
                <span style={{ fontSize: 11.5, fontFamily: COL.mono, color: st.c, minWidth: 120, textAlign: 'right' }}>{st.txt}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
