import React, { useMemo } from 'react';
import { TrendingUp, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useStudentNotesParityData } from '@/hooks/useStudentNotesParityData';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';

const StudentNotesPage = () => {
  const { isDemoMode, demoData } = useDemoMode();
  const { user } = useAuth();
  const { gradesRows, rankingValue } = useStudentNotesParityData(isDemoMode ? null : user?.id);

  // Mock data source switch
  const grades = isDemoMode
    ? demoData.grades
    : gradesRows.map((g) => ({
        id: g.id,
        date: isValid(new Date(g.evaluated_at)) ? format(new Date(g.evaluated_at), 'dd/MM/yyyy', { locale: fr }) : '',
        subject: g.title || 'Evaluation',
        type: 'Evaluation',
        score: Number(g.score || 0),
        max: Number(g.max_score || 20),
        feedback: g.comment || '',
      }));
  const average = isDemoMode
    ? demoData.stats.average
    : grades.length
      ? (grades.reduce((acc, g) => acc + ((Number(g.score || 0) / Number(g.max || 20)) * 20), 0) / grades.length).toFixed(1)
      : 'N/A';
  const ranking = isDemoMode ? demoData.stats.ranking : rankingValue;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-serif font-bold text-white">Mes Notes & Résultats</h1>
        <p className="text-gray-400">Suivi détaillé de vos performances académiques.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#192734] border-white/10">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-[#D4AF37]/20 rounded-full text-[#D4AF37]">
              <Award className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm text-gray-400 uppercase tracking-wider">Moyenne Générale</p>
              <p className="text-3xl font-bold text-white">{average}<span className="text-lg text-gray-500">/20</span></p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#192734] border-white/10">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-full text-blue-500">
              <TrendingUp className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm text-gray-400 uppercase tracking-wider">Classement</p>
              <p className="text-3xl font-bold text-white">{ranking}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#192734] border-white/10">
          <CardContent className="p-6">
            <div className="flex justify-between text-sm mb-2">
               <span className="text-gray-400">Validation Année</span>
               <span className="text-green-500 font-bold">En bonne voie</span>
            </div>
            <Progress value={isDemoMode ? 75 : Math.min(100, Math.max(0, Number(average === 'N/A' ? 0 : average) * 5))} className="h-2" indicatorClassName="bg-green-500" />
            <p className="text-sm text-gray-500 mt-2">Basé sur les crédits validés.</p>
          </CardContent>
        </Card>
      </div>

      {/* Grades Table */}
      <Card className="bg-[#192734] border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Relevé de Notes Détaillé</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-white/5">
                <TableHead className="text-gray-400">Date</TableHead>
                <TableHead className="text-gray-400">Sujet / Module</TableHead>
                <TableHead className="text-gray-400">Type</TableHead>
                <TableHead className="text-gray-400 text-right">Note</TableHead>
                <TableHead className="text-gray-400">Appréciation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grades.map((grade) => (
                <TableRow key={grade.id} className="border-white/10 hover:bg-white/5">
                  <TableCell className="text-gray-300">{grade.date}</TableCell>
                  <TableCell className="font-medium text-white">{grade.subject}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-gray-400 border-gray-600">{grade.type}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`font-bold ${grade.score >= 15 ? 'text-green-500' : grade.score >= 10 ? 'text-[#D4AF37]' : 'text-red-500'}`}>
                      {grade.score}
                    </span>
                    <span className="text-gray-500">/{grade.max}</span>
                  </TableCell>
                  <TableCell className="text-gray-400 text-sm italic">{grade.feedback}</TableCell>
                </TableRow>
              ))}
              {grades.length === 0 && (
                <TableRow>
                   <TableCell colSpan={5} className="text-center text-gray-500 py-8">Aucune note disponible.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentNotesPage;