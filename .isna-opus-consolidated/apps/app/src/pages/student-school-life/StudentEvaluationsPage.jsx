import React, { useMemo, useState } from 'react';
import { Clock, FileText, CheckCircle, BarChart2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { format, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useStudentEvaluationsParityData } from '@/hooks/useStudentEvaluationsParityData';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';

// Helper for safe date formatting
const safeFormat = (dateInput, formatStr) => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  return isValid(date) ? format(date, formatStr, { locale: fr }) : '';
};

const EvaluationCard = ({ evaluation, status, restrictedAction }) => (
  <Card className="bg-[#192734] border-white/10 mb-4 hover:border-[#D4AF37]/30 transition-all">
    <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
      <div className="flex items-start gap-4">
        <div className={`p-3 rounded-lg ${
          status === 'completed' ? 'bg-green-500/20 text-green-500' : 
          status === 'upcoming' ? 'bg-blue-500/20 text-blue-500' : 
          'bg-yellow-500/20 text-yellow-500'
        }`}>
          {status === 'completed' ? <CheckCircle className="w-6 h-6" /> : 
           status === 'upcoming' ? <Clock className="w-6 h-6" /> : 
           <FileText className="w-6 h-6" />}
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">{evaluation.title}</h3>
          <p className="text-sm text-gray-400">{evaluation.module}</p>
          <div className="flex gap-3 mt-2 text-sm text-gray-500">
             {evaluation.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {evaluation.duration} min</span>}
             {evaluation.questions && <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {evaluation.questions} questions</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2">
        {status === 'upcoming' && (
          <div className="text-right">
             <p className="text-sm text-[#D4AF37] font-bold">Prévu le {safeFormat(evaluation.date, 'dd MMM yyyy')}</p>
             <Button size="sm" className="mt-2 bg-white/10 hover:bg-white/20" onClick={() => restrictedAction('Voir les détails')}>Voir Détails</Button>
          </div>
        )}
        
        {status === 'completed' && (
           <div className="text-right flex items-center gap-4">
             <div>
               <p className="text-sm text-gray-400">Note obtenue</p>
               <p className="text-xl font-bold text-white">{evaluation.score}<span className="text-gray-500 text-sm">/{evaluation.maxScore}</span></p>
             </div>
             <Button size="sm" variant="outline" className="border-[#D4AF37] text-[#D4AF37]" onClick={() => restrictedAction('Revoir la correction')}>Revoir</Button>
           </div>
        )}
      </div>
    </CardContent>
  </Card>
);

const StudentEvaluationsPage = () => {
  const { isDemoMode, demoData, restrictedAction } = useDemoMode();
  const { user } = useAuth();
  const { evaluationsRows, upcomingRows } = useStudentEvaluationsParityData(isDemoMode ? null : user?.id);
  const [activeTab, setActiveTab] = useState('upcoming');

  // Data selection
  const upcoming = isDemoMode
    ? demoData.evaluations.upcoming
    : upcomingRows.map((row) => ({
        id: row.id,
        title: row.title || 'Evaluation',
        module: 'Programme',
        duration: null,
        questions: null,
        date: row.start_at,
      }));
  const completed = isDemoMode
    ? demoData.evaluations.completed
    : (evaluationsRows || []).map((row) => ({
        id: row.id,
        title: row.title || 'Evaluation',
        module: 'Module',
        date: row.evaluated_at,
        score: Number(row.score || 0),
        maxScore: Number(row.max_score || 20),
      }));
  const average = useMemo(() => {
    if (isDemoMode) return demoData.stats.average;
    if (!completed.length) return 'N/A';
    const mean = completed.reduce((acc, ev) => acc + ((Number(ev.score || 0) / Number(ev.maxScore || 20)) * 20), 0) / completed.length;
    return mean.toFixed(1);
  }, [completed, demoData.stats.average, isDemoMode]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
           <h1 className="text-3xl font-serif font-bold text-white">Mes Évaluations</h1>
           <p className="text-gray-400">Suivi de vos performances et examens à venir.</p>
        </div>
        <Card className="bg-[#192734] border-white/10 p-4 flex items-center gap-4">
           <BarChart2 className="w-8 h-8 text-[#D4AF37]" />
           <div>
             <p className="text-sm text-gray-400 uppercase">Moyenne Générale</p>
             <p className="text-2xl font-bold text-white">{average}/20</p>
           </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <PremiumSegmentedSelector
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: 'upcoming', label: 'A venir', badge: `${upcoming.length}` },
            { value: 'completed', label: 'Terminees', badge: `${completed.length}` },
          ]}
          layoutId="student-evaluations-tab-segment-pill"
          className="mb-6"
          compact
          showChevron={false}
        />

        <TabsContent value="upcoming">
          {upcoming.length > 0 ? (
            upcoming.map(ev => <EvaluationCard key={ev.id} evaluation={ev} status="upcoming" restrictedAction={restrictedAction} />)
          ) : (
            <p className="text-gray-500 text-center py-8">Aucune évaluation à venir.</p>
          )}
        </TabsContent>
        
        <TabsContent value="completed">
           {completed.length > 0 ? (
             completed.map(ev => <EvaluationCard key={ev.id} evaluation={ev} status="completed" restrictedAction={restrictedAction} />)
           ) : (
             <p className="text-gray-500 text-center py-8">Aucune évaluation terminée.</p>
           )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentEvaluationsPage;