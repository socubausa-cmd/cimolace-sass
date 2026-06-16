import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Clock, X, Paperclip, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useStudentAttendanceRecords } from '@/hooks/useStudentAttendanceRecords';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
// Thème host-aware : `T` = tokens vivants (clair sous l'espace élève, sombre sous le portail prof).
import { themeProxy as T, useSslThemeMode } from '@/pages/school/student-school-life/sslTheme';

const STORAGE_BUCKET = 'justificatifs';

const StudentAbsencesPage = () => {
  useSslThemeMode(); // publie le mode (clair/sombre) pour `T` AVANT le rendu des sous-composants
  const { isDemoMode, demoData, restrictedAction } = useDemoMode();
  const { user } = useAuth();
  const { rows, refresh } = useStudentAttendanceRecords(isDemoMode ? null : user?.id);
  const { toast } = useToast();

  // Champs de justification non couverts par le hook de parité : on les
  // récupère directement ici (id -> { note, status, file_url }) pour refléter
  // l'état réel sans modifier la requête partagée.
  const [justifications, setJustifications] = useState({});
  const [modalRecord, setModalRecord] = useState(null);
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadJustifications = useCallback(async () => {
    if (isDemoMode || !user?.id) {
      setJustifications({});
      return;
    }
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('id,justification_note,justification_status,justification_file_url')
        .eq('student_id', user.id)
        .limit(200);
      if (error) throw error;
      const map = {};
      (data || []).forEach((r) => {
        map[r.id] = {
          note: r.justification_note || null,
          status: r.justification_status || null,
          fileUrl: r.justification_file_url || null,
        };
      });
      setJustifications(map);
    } catch (e) {
      // On reste silencieux : la liste de base reste fonctionnelle même si les
      // champs de justification ne sont pas disponibles.
      setJustifications({});
    }
  }, [isDemoMode, user?.id]);

  useEffect(() => {
    void loadJustifications();
  }, [loadJustifications]);

  // Statut effectif d'une ligne réelle : la justification prime sur le statut
  // de présence brut.
  const effectiveStatus = (record) => {
    const j = justifications[record.id];
    if (j?.status === 'pending') return 'pending';
    if (j?.status === 'approved') return 'justified';
    return record.status === 'excused' ? 'justified' : record.status === 'late' ? 'pending' : 'unjustified';
  };

  const absences = isDemoMode
    ? demoData.absences
    : rows.map((r) => ({
        id: r.id,
        date: isValid(new Date(r.attendance_date)) ? format(new Date(r.attendance_date), 'dd/MM/yyyy', { locale: fr }) : String(r.attendance_date || ''),
        course: 'Session pedagogique',
        duration: r.status === 'late' ? 'Retard' : 'Journee',
        reason: justifications[r.id]?.note || r.note || null,
        status: effectiveStatus(r),
        justificationStatus: justifications[r.id]?.status || null,
      }));

  const unjustifiedCount = useMemo(() => absences.filter((a) => a.status === 'unjustified').length, [absences]);
  const justifiedCount = useMemo(() => absences.filter((a) => a.status === 'justified').length, [absences]);
  const pendingCount = useMemo(() => absences.filter((a) => a.status === 'pending').length, [absences]);

  const openModal = (absence) => {
    if (restrictedAction('Justifier cette absence')) return; // mode démo : bloqué
    setModalRecord(absence);
    setNote('');
    setFile(null);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalRecord(null);
    setNote('');
    setFile(null);
  };

  const handleSubmit = async () => {
    if (!modalRecord || submitting) return;
    if (restrictedAction('Justifier cette absence')) return; // garde-fou démo
    const trimmed = note.trim();
    if (!trimmed) {
      toast({ title: 'Motif requis', description: 'Indiquez le motif de la justification.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      let filePath = null;
      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${user.id}/${modalRecord.id}-${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, file, { cacheControl: '3600', upsert: false });
        if (upErr) throw upErr;
        filePath = path;
      }

      // RPC SECURITY DEFINER : vérifie student_id = auth.uid() et n'écrit que
      // les colonnes de justification (RLS bloque l'UPDATE direct côté élève).
      const { error: updErr } = await supabase.rpc('justify_absence', {
        p_record_id: modalRecord.id,
        p_note: trimmed,
        p_file_url: filePath,
      });
      if (updErr) throw updErr;

      // Mise à jour optimiste de l'état local de la ligne.
      setJustifications((prev) => ({
        ...prev,
        [modalRecord.id]: { note: trimmed, status: 'pending', fileUrl: filePath },
      }));

      toast({
        title: 'Justification envoyée',
        description: 'Votre justificatif a été transmis. Statut : en attente de validation.',
      });
      setModalRecord(null);
      setNote('');
      setFile(null);
      // Resynchronise depuis la source de vérité sans bloquer l'UI.
      void refresh?.();
      void loadJustifications();
    } catch (e) {
      toast({
        title: 'Échec de l’envoi',
        description: e?.message || 'Impossible d’enregistrer la justification. Réessayez.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-white">Mes Absences</h1>
          <p className="text-gray-400">Suivi de l'assiduité et justification des absences.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#192734] border-white/10">
          <CardContent className="p-6 flex flex-col items-center">
            <span className="text-4xl font-bold text-white mb-2">{absences.length}</span>
            <span className="text-sm text-gray-400">Total Absences</span>
          </CardContent>
        </Card>
        <Card className="bg-[#192734] border-white/10">
          <CardContent className="p-6 flex flex-col items-center">
            <span className="text-4xl font-bold text-red-500 mb-2">{unjustifiedCount}</span>
            <span className="text-sm text-gray-400">Non Justifiées</span>
          </CardContent>
        </Card>
        <Card className="bg-[#192734] border-white/10">
           <CardContent className="p-6 flex flex-col items-center">
            <span className="text-4xl font-bold text-green-500 mb-2">{justifiedCount}</span>
            <span className="text-sm text-gray-400">Justifiées</span>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {absences.map((absence) => (
          <div key={absence.id} className="bg-[#192734] border border-white/10 rounded-lg p-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
               <div className={`p-3 rounded-full ${
                  absence.status === 'justified' ? 'bg-green-500/10 text-green-500' :
                  absence.status === 'pending' ? 'bg-orange-500/10 text-orange-500' :
                  'bg-red-500/10 text-red-500'
               }`}>
                 {absence.status === 'justified' ? <CheckCircle className="w-6 h-6" /> :
                  absence.status === 'pending' ? <Clock className="w-6 h-6" /> :
                  <AlertTriangle className="w-6 h-6" />}
               </div>
               <div>
                 <p className="text-white font-medium">{absence.date} • {absence.course}</p>
                 <p className="text-sm text-gray-400">Durée: {absence.duration}</p>
                 {absence.reason && <p className="text-sm text-gray-500 mt-1">Motif: {absence.reason}</p>}
               </div>
            </div>

            <div className="flex items-center gap-4">
              <Badge variant="outline" className={`
                 ${absence.status === 'justified' ? 'border-green-500 text-green-500' :
                   absence.status === 'pending' ? 'border-orange-500 text-orange-500' :
                   'border-red-500 text-red-500'}
              `}>
                {absence.status === 'justified' ? 'Justifiée' :
                 absence.status === 'pending'
                   ? (absence.justificationStatus === 'pending' ? 'Justification en attente' : 'En attente')
                   : 'Injustifiée'}
              </Badge>

              {absence.status === 'unjustified' && !absence.justificationStatus && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/10 text-white hover:bg-white/10"
                  onClick={() => openModal(absence)}
                >
                  Justifier
                </Button>
              )}
            </div>
          </div>
        ))}
        {absences.length === 0 && <p className="text-gray-500 text-center py-4">Aucune absence enregistrée.</p>}
      </div>

      {modalRecord && (
        <div
          role="dialog"
          aria-modal="true"
          onMouseDown={closeModal}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '520px',
              background: T.surface,
              border: `1px solid ${T.borderMid}`,
              borderRadius: '16px',
              boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
              overflow: 'hidden',
            }}
          >
            {/* Bandeau or */}
            <div style={{ height: '3px', background: `linear-gradient(90deg, ${T.goldMid}, ${T.gold}, ${T.goldMid})` }} />

            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: T.gold, fontFamily: T.mono, marginBottom: '6px' }}>
                    Justification d’absence
                  </div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: T.t1 }}>
                    {modalRecord.date} • {modalRecord.course}
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: T.t3 }}>Durée : {modalRecord.duration}</p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  aria-label="Fermer"
                  style={{
                    background: 'transparent',
                    border: `1px solid ${T.border}`,
                    borderRadius: '8px',
                    color: T.t2,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    padding: '6px',
                    lineHeight: 0,
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div style={{ marginTop: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.t2, marginBottom: '8px' }}>
                  Motif de la justification
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  disabled={submitting}
                  rows={4}
                  placeholder="Expliquez le motif de votre absence (rendez-vous médical, problème technique, etc.)"
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    background: T.surface2,
                    border: `1px solid ${T.border}`,
                    borderRadius: '10px',
                    color: T.t1,
                    fontSize: '14px',
                    padding: '12px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: T.t2, marginBottom: '8px' }}>
                  Justificatif (PDF/image) <span style={{ color: T.t3, fontWeight: 400 }}>— optionnel</span>
                </label>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: T.goldDim,
                    border: `1px dashed ${T.goldMid}`,
                    borderRadius: '10px',
                    padding: '12px 14px',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Paperclip className="w-4 h-4" style={{ color: T.gold }} />
                  <span style={{ fontSize: '13px', color: file ? T.t1 : T.t3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file ? file.name : 'Choisir un fichier (PDF, JPG, PNG…)'}
                  </span>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    disabled={submitting}
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${T.border}`,
                    borderRadius: '10px',
                    color: T.t2,
                    fontSize: '14px',
                    fontWeight: 600,
                    padding: '10px 16px',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: T.gold,
                    border: 'none',
                    borderRadius: '10px',
                    color: '#000',
                    fontSize: '14px',
                    fontWeight: 700,
                    padding: '10px 18px',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.75 : 1,
                  }}
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? 'Envoi…' : 'Envoyer la justification'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentAbsencesPage;
