import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * ClassesAdminPage — gestion des CLASSES (#43, modèle promo stricte).
 * Réservé encadrant (owner/admin). Un seul appel get_classes_admin() ramène
 * parcours + élèves + classes(+membres). Créer une classe = create_school_class ;
 * affecter un élève = assign_student_to_class (DÉPLACE l'élève, 1 classe/tenant).
 * Directive artistique LIRI : chaud/coral.
 */
const COL = {
  coral: '#d97757', coralDim: 'rgba(217,119,87,0.10)', coralMid: 'rgba(217,119,87,0.30)',
  cream: '#f5f1e9', t2: 'rgba(245,241,233,0.66)', t3: 'rgba(245,241,233,0.42)',
  line: 'rgba(245,241,233,0.10)', field: 'rgba(245,241,233,0.04)',
  mono: "'JetBrains Mono','Fira Code',monospace",
};

const inputStyle = {
  height: 38, padding: '0 12px', borderRadius: 9, background: COL.field,
  border: `1px solid ${COL.line}`, color: COL.cream, fontSize: 13.5, outline: 'none',
};

export default function ClassesAdminPage() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  // formulaire création
  const [pathId, setPathId] = useState('');
  const [name, setName] = useState('');
  const [year, setYear] = useState('');

  const load = useCallback(async () => {
    const { data: d, error } = await supabase.rpc('get_classes_admin');
    if (error) { setMsg('Erreur : ' + error.message); setData({ can_manage: false, paths: [], students: [], classes: [] }); return; }
    setData(d || { can_manage: false, paths: [], students: [], classes: [] });
    if (d?.paths?.[0] && !pathId) setPathId(d.paths[0].id);
  }, [pathId]);

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const studentName = (id) => (data?.students || []).find((s) => s.id === id)?.name || id;

  const createClass = async () => {
    if (busy || !pathId || !name.trim()) return;
    setBusy(true); setMsg('');
    try {
      const { error } = await supabase.rpc('create_school_class', { p_school_path_id: pathId, p_name: name.trim(), p_academic_year: year.trim() || null, p_teacher_id: null });
      if (error) throw error;
      setName(''); setYear('');
      await load();
      setMsg('✓ Classe créée');
    } catch (e) { setMsg('Échec : ' + (e?.message || e)); } finally { setBusy(false); }
  };

  const assign = async (classId, studentId) => {
    if (busy || !studentId) return;
    setBusy(true); setMsg('');
    try {
      const { error } = await supabase.rpc('assign_student_to_class', { p_class_id: classId, p_student_id: studentId });
      if (error) throw error;
      await load();
      setMsg('✓ Élève affecté (déplacé de son ancienne classe le cas échéant)');
    } catch (e) { setMsg('Échec : ' + (e?.message || e)); } finally { setBusy(false); }
  };

  if (!data) return <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: COL.mono, fontSize: 10, letterSpacing: '0.12em', color: COL.t3 }}>CHARGEMENT…</div>;

  if (!data.can_manage) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px' }}>
        <div style={{ padding: '24px 20px', textAlign: 'center', color: COL.t3, border: `1px solid ${COL.line}`, borderRadius: 12 }}>
          La gestion des classes est réservée aux encadrants.
        </div>
      </div>
    );
  }

  const paths = data.paths || [];
  const students = data.students || [];
  const classes = data.classes || [];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '8px 16px 60px' }}>
      <div style={{ fontFamily: COL.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.10em', color: COL.coral, textTransform: 'uppercase', marginBottom: 6 }}>Vie scolaire · Classes</div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: COL.cream, margin: 0, lineHeight: 1.15, letterSpacing: '-0.02em' }}>Classes</h1>
      <p style={{ marginTop: 8, fontSize: 14, color: COL.t2, maxWidth: 560 }}>Une classe = une promotion liée à un parcours. Un élève appartient à une seule classe.</p>

      {/* Création */}
      <div style={{ marginTop: 22, padding: '16px 16px', borderRadius: 14, background: COL.coralDim, border: `1px solid ${COL.coralMid}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: COL.coral, marginBottom: 12 }}>Créer une classe</div>
        {paths.length === 0 ? (
          <div style={{ fontSize: 13, color: COL.t3 }}>Aucun parcours (school_path) dans ce tenant — créez-en un d'abord.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <select value={pathId} onChange={(e) => setPathId(e.target.value)} style={{ ...inputStyle, minWidth: 180 }}>
              {paths.map((p) => <option key={p.id} value={p.id} style={{ color: '#1c1a17' }}>{p.title || 'Parcours'}</option>)}
            </select>
            <input placeholder="Nom (ex. Promo 2026)" value={name} onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, minWidth: 200 }} />
            <input placeholder="Année (ex. 2026-2027)" value={year} onChange={(e) => setYear(e.target.value)} style={{ ...inputStyle, width: 150 }} />
            <button onClick={createClass} disabled={busy || !name.trim()} style={{ height: 38, padding: '0 18px', borderRadius: 9, cursor: busy || !name.trim() ? 'not-allowed' : 'pointer', background: COL.coral, color: '#1c1a17', border: 'none', fontSize: 13.5, fontWeight: 700, opacity: busy || !name.trim() ? 0.6 : 1 }}>Créer</button>
          </div>
        )}
      </div>

      {msg ? <div style={{ marginTop: 12, fontSize: 12.5, fontFamily: COL.mono, color: msg.startsWith('Échec') || msg.startsWith('Erreur') ? '#f0a58a' : COL.coral }}>{msg}</div> : null}

      {/* Liste des classes */}
      <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {classes.length === 0 ? (
          <div style={{ padding: '28px 20px', textAlign: 'center', color: COL.t3, border: `1px dashed ${COL.line}`, borderRadius: 14 }}>Aucune classe pour l'instant.</div>
        ) : classes.map((c) => {
          const members = c.member_ids || [];
          return (
            <div key={c.id} style={{ padding: '16px 18px', borderRadius: 14, background: 'rgba(245,241,233,0.02)', border: `1px solid ${COL.line}` }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: COL.cream }}>{c.name}</div>
                <div style={{ fontSize: 11.5, fontFamily: COL.mono, color: COL.t3 }}>
                  {(paths.find((p) => p.id === c.school_path_id)?.title) || 'Parcours'}{c.academic_year ? ` · ${c.academic_year}` : ''} · {members.length} élève{members.length > 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {members.length === 0 ? <span style={{ fontSize: 12.5, color: COL.t3 }}>Aucun élève.</span> :
                  members.map((sid) => <span key={sid} style={{ padding: '4px 10px', borderRadius: 999, background: COL.coralDim, border: `1px solid ${COL.coralMid}`, color: COL.cream, fontSize: 12 }}>{studentName(sid)}</span>)}
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <select defaultValue="" onChange={(e) => { const v = e.target.value; e.target.value = ''; assign(c.id, v); }} disabled={busy} style={{ ...inputStyle, height: 34, minWidth: 220 }}>
                  <option value="" style={{ color: '#1c1a17' }}>+ Ajouter un élève…</option>
                  {students.map((s) => <option key={s.id} value={s.id} style={{ color: '#1c1a17' }}>{s.name}</option>)}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
