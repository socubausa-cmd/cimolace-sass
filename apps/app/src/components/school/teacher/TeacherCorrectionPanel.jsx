import React, { useMemo, useState } from 'react';
import { useDataSync } from '@/contexts/DataSyncContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Check, RotateCcw, ClipboardList } from 'lucide-react';

const subKey = (sub) => sub?.id || `${sub.studentId}-${sub.dayId}`;

const TeacherCorrectionPanel = () => {
  const { students, gradeWriting, loading } = useDataSync();
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [grades, setGrades] = useState({ comprehension: '', clarity: '', effort: '' });
  const [feedback, setFeedback] = useState('');

  const allSubmissions = useMemo(() => {
    const list = (students || []).flatMap((s) =>
      (s.progress?.writings || []).map((w) => ({
        ...w,
        studentName: s.name,
        studentId: s.id,
      }))
    );
    return list.filter((w) => w.status === 'pending');
  }, [students]);

  const handleGrade = () => {
    if (!selectedSubmission || typeof gradeWriting !== 'function') return;
    gradeWriting(selectedSubmission.studentId, selectedSubmission.dayId || selectedSubmission.id, grades, feedback, 'graded');
    setSelectedSubmission(null);
    setGrades({ comprehension: '', clarity: '', effort: '' });
    setFeedback('');
  };

  const handleRequestRevision = () => {
    if (!selectedSubmission || typeof gradeWriting !== 'function') return;
    gradeWriting(selectedSubmission.studentId, selectedSubmission.dayId || selectedSubmission.id, grades, feedback, 'revision_requested');
    setSelectedSubmission(null);
    setGrades({ comprehension: '', clarity: '', effort: '' });
    setFeedback('');
  };

  const selectSubmission = (sub) => {
    setSelectedSubmission(sub);
    setGrades({ comprehension: '', clarity: '', effort: '' });
    setFeedback('');
  };

  return (
    <div className="flex flex-col gap-4 min-h-0 max-w-[1600px] mx-auto w-full">
      <div className="rounded-xl border border-white/10 bg-[#15202B]/80 p-4">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-[var(--school-accent)]" />
          Corrections de rédactions
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Interface pour <strong className="text-gray-300">noter les travaux écrits</strong> des élèves (compréhension,
          clarté, effort) et laisser un commentaire. Les entrées proviennent du{' '}
          <span className="text-[var(--school-accent)]">mock pédagogique local</span> (DataSync) — branchez une table Supabase
          (devoirs / soumissions) pour la production.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[min(70vh,720px)] lg:min-h-[520px]">
        <div className="lg:col-span-4 bg-[#192734] border border-white/10 rounded-xl overflow-hidden flex flex-col min-h-[280px] max-h-[calc(100vh-240px)]">
          <div className="p-4 bg-[#15202B] border-b border-white/10 flex items-center justify-between gap-2">
            <h2 className="font-bold text-white text-sm">À corriger ({loading ? '…' : allSubmissions.length})</h2>
            {allSubmissions.length > 0 ? (
              <Badge className="bg-amber-500/20 text-amber-200 border-amber-500/40">En attente</Badge>
            ) : null}
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {loading && <p className="text-sm text-gray-500">Chargement des données…</p>}
            {!loading && allSubmissions.length === 0 && (
              <p className="text-sm text-gray-500">
                Aucune copie en attente. Dès qu'un élève soumet une rédaction (statut « pending »), elle apparaîtra ici.
              </p>
            )}
            {!loading &&
              allSubmissions.map((sub) => (
                <div
                  key={subKey(sub)}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectSubmission(sub)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') selectSubmission(sub);
                  }}
                  className={`p-4 rounded-lg cursor-pointer transition-colors border ${
                    selectedSubmission && subKey(selectedSubmission) === subKey(sub)
                      ? 'bg-[var(--school-accent)] text-black border-[var(--school-accent)]'
                      : 'bg-[#0F1419] text-gray-300 hover:bg-white/5 border-white/10'
                  }`}
                >
                  <div className="font-bold">{sub.studentName}</div>
                  {sub.assignmentTitle ? (
                    <div className="text-xs opacity-80 mt-1 line-clamp-2">{sub.assignmentTitle}</div>
                  ) : null}
                  <div className="text-xs opacity-70 mt-1">
                    {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('fr-FR') : '—'}
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="lg:col-span-8 bg-[#192734] border border-white/10 rounded-xl p-6 overflow-y-auto min-h-[280px] max-h-[calc(100vh-240px)]">
          {selectedSubmission ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Rédaction de {selectedSubmission.studentName}</h2>
                <p className="text-gray-400 text-sm">
                  Soumis le{' '}
                  {selectedSubmission.submittedAt
                    ? new Date(selectedSubmission.submittedAt).toLocaleString('fr-FR')
                    : '—'}
                </p>
              </div>

              <Card className="bg-[#0F1419] border-white/10 p-6 text-gray-200 leading-relaxed font-serif text-lg">
                <CardContent className="p-0 whitespace-pre-wrap">{selectedSubmission.content}</CardContent>
              </Card>

              <div className="space-y-4 pt-4 border-t border-white/10">
                <h3 className="font-bold text-white">Évaluation</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm text-gray-400">Compréhension (/10)</label>
                    <Input
                      type="number"
                      max="10"
                      min="0"
                      value={grades.comprehension}
                      onChange={(e) => setGrades({ ...grades, comprehension: e.target.value })}
                      className="bg-[#0F1419] border-white/10"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Clarté (/5)</label>
                    <Input
                      type="number"
                      max="5"
                      min="0"
                      value={grades.clarity}
                      onChange={(e) => setGrades({ ...grades, clarity: e.target.value })}
                      className="bg-[#0F1419] border-white/10"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Effort (/5)</label>
                    <Input
                      type="number"
                      max="5"
                      min="0"
                      value={grades.effort}
                      onChange={(e) => setGrades({ ...grades, effort: e.target.value })}
                      className="bg-[#0F1419] border-white/10"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-400">Feedback / commentaire</label>
                  <Textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="bg-[#0F1419] border-white/10 min-h-[120px]"
                    placeholder="Ex. : Excellente analyse, approfondir la partie pratique…"
                  />
                </div>

                <div className="flex flex-wrap gap-4 justify-end">
                  <Button variant="destructive" className="gap-2" type="button" onClick={handleRequestRevision}>
                    <RotateCcw className="h-4 w-4" />
                    Demander révision
                  </Button>
                  <Button onClick={handleGrade} className="bg-green-600 hover:bg-green-700 text-white gap-2" type="button">
                    <Check className="h-4 w-4" />
                    Valider & noter
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-gray-500 text-center px-4">
              <ClipboardList className="h-14 w-14 mb-4 opacity-20" />
              <p>Sélectionnez une copie dans la liste ou attendez une nouvelle soumission.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherCorrectionPanel;
