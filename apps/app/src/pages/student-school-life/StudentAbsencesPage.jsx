import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useStudentAttendanceRecords } from '@/hooks/useStudentAttendanceRecords';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';

const StudentAbsencesPage = () => {
  const { isDemoMode, demoData, restrictedAction } = useDemoMode();
  const { user } = useAuth();
  const { rows } = useStudentAttendanceRecords(isDemoMode ? null : user?.id);

  const absences = isDemoMode
    ? demoData.absences
    : rows.map((r) => ({
        id: r.id,
        date: isValid(new Date(r.attendance_date)) ? format(new Date(r.attendance_date), 'dd/MM/yyyy', { locale: fr }) : String(r.attendance_date || ''),
        course: 'Session pedagogique',
        duration: r.status === 'late' ? 'Retard' : 'Journee',
        reason: r.note || null,
        status: r.status === 'excused' ? 'justified' : r.status === 'late' ? 'pending' : 'unjustified',
      }));
  const unjustifiedCount = useMemo(() => absences.filter((a) => a.status === 'unjustified').length, [absences]);
  const justifiedCount = useMemo(() => absences.filter((a) => a.status === 'justified').length, [absences]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif font-bold text-white">Mes Absences</h1>
          <p className="text-gray-400">Suivi de l'assiduité et justification des absences.</p>
        </div>
        <Button 
          className="bg-[#D4AF37] text-black hover:bg-[#b5952f]"
          onClick={() => restrictedAction('Soumettre un justificatif')}
        >
          Justifier une absence
        </Button>
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
                 absence.status === 'pending' ? 'En attente' : 'Injustifiée'}
              </Badge>
              
              {absence.status === 'unjustified' && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="border-white/10 text-white hover:bg-white/10"
                  onClick={() => restrictedAction('Justifier cette absence')}
                >
                  Justifier
                </Button>
              )}
            </div>
          </div>
        ))}
        {absences.length === 0 && <p className="text-gray-500 text-center py-4">Aucune absence enregistrée.</p>}
      </div>
    </div>
  );
};

export default StudentAbsencesPage;