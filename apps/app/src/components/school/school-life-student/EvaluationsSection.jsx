import React, { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CheckCircle, XCircle, Search, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DataTable from '@/components/ui/DataTable';

const EvaluationsSection = ({ data }) => {
  const { evaluations = [] } = data;
  const [selectedQuiz, setSelectedQuiz] = useState(null);

  const columns = [
    { key: 'title', label: 'Titre' },
    { key: 'module', label: 'Module' },
    { key: 'date', label: 'Date', render: (val) => format(new Date(val), 'dd/MM/yyyy') },
    { key: 'score', label: 'Score', render: (val) => <span className={`font-bold ${val >= 12 ? 'text-green-400' : 'text-red-400'}`}>{val}/20</span> },
    { key: 'status', label: 'Statut', render: (_, r) => r.score >= 12 ? <Badge className="bg-green-500/20 text-green-400">Réussi</Badge> : <Badge className="bg-red-500/20 text-red-400">À revoir</Badge> },
    { key: 'actions', label: 'Détails', render: (_, r) => <Button size="sm" variant="ghost" onClick={() => setSelectedQuiz(r)}><Eye className="w-4 h-4"/></Button> }
  ];

  return (
    <div className="space-y-6">
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-[#192734] border-white/10">
             <CardContent className="p-6 text-center">
                <p className="text-3xl font-bold text-white">{evaluations.length}</p>
                <p className="text-sm text-gray-400">Quiz Total</p>
             </CardContent>
          </Card>
          <Card className="bg-[#192734] border-white/10">
             <CardContent className="p-6 text-center">
                <p className="text-3xl font-bold text-green-500">{evaluations.filter(e => e.score >= 12).length}</p>
                <p className="text-sm text-gray-400">Réussis</p>
             </CardContent>
          </Card>
          <Card className="bg-[#192734] border-white/10">
             <CardContent className="p-6 text-center">
                <p className="text-3xl font-bold text-[var(--school-accent)]">{evaluations.reduce((acc, c) => acc + c.score, 0) / evaluations.length || 0}/20</p>
                <p className="text-sm text-gray-400">Moyenne</p>
             </CardContent>
          </Card>
       </div>

       <Card className="bg-[#192734] border-white/10">
          <CardHeader><CardTitle className="text-white">Liste des Évaluations</CardTitle></CardHeader>
          <CardContent className="p-0">
             <DataTable columns={columns} data={evaluations} searchFields={['title', 'module']} />
          </CardContent>
       </Card>

       <Dialog open={!!selectedQuiz} onOpenChange={() => setSelectedQuiz(null)}>
          <DialogContent className="bg-[#192734] border-white/10 text-white max-w-2xl">
             <DialogHeader>
                <DialogTitle>{selectedQuiz?.title}</DialogTitle>
                <div className="flex gap-2 text-sm text-gray-400 mt-1">
                   <span>Score: <strong className="text-white">{selectedQuiz?.score}/20</strong></span>
                   <span>• {selectedQuiz && format(new Date(selectedQuiz.date), 'dd MMMM yyyy', {locale: fr})}</span>
                </div>
             </DialogHeader>
             <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                {selectedQuiz?.questions?.map((q, i) => (
                   <div key={i} className="p-4 rounded bg-black/20 border border-white/5">
                      <p className="font-bold mb-2 text-sm">{i+1}. {q.q}</p>
                      <div className="flex items-center gap-2 text-sm">
                         {q.correct ? <CheckCircle className="w-4 h-4 text-green-500"/> : <XCircle className="w-4 h-4 text-red-500"/>}
                         <span className={q.correct ? "text-green-400" : "text-red-400"}>{q.a}</span>
                      </div>
                   </div>
                ))}
             </div>
          </DialogContent>
       </Dialog>
    </div>
  );
};

export default EvaluationsSection;