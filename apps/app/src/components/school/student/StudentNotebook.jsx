import React, { useState } from 'react';
import { useDataSync } from '@/contexts/DataSyncContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, PenTool, MessageSquare, CheckCircle, Clock } from 'lucide-react';

const StudentNotebook = () => {
  const { students, years } = useDataSync();
  const studentId = 's-1'; // Simulated current user
  const student = students.find(s => s.id === studentId);
  const writings = student?.progress?.writings || [];
  const [search, setSearch] = useState('');

  // Helper to find titles
  const getTitles = (dayId) => {
    for (let y of years) {
      for (let m of y.modules) {
        for (let w of m.weeks) {
          const d = w.days.find(d => d.id === dayId);
          if (d) return { dayTitle: d.title, weekTitle: w.title, moduleTitle: m.title };
        }
      }
    }
    return { dayTitle: 'Inconnu', weekTitle: '', moduleTitle: '' };
  };

  const filteredWritings = writings.filter(w => {
    const titles = getTitles(w.dayId);
    const content = typeof w.content === 'string' ? w.content : '';
    return titles.dayTitle.toLowerCase().includes(search.toLowerCase()) || content.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="p-8 min-h-screen bg-[#0F1419] text-white">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <PenTool className="text-[#D4AF37]"/> Mon Carnet Virtuel
        </h1>
        <div className="relative w-64">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
           <Input 
             placeholder="Rechercher..." 
             value={search}
             onChange={(e) => setSearch(e.target.value)}
             className="pl-9 bg-[#192734] border-white/10"
           />
        </div>
      </div>

      <div className="grid gap-6">
        {filteredWritings.map((writing, idx) => {
          const { dayTitle, weekTitle, moduleTitle } = getTitles(writing.dayId);
          return (
            <Card key={idx} className="bg-[#192734] border-white/10">
               <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        <h3 className="text-xl font-bold text-[#D4AF37]">{dayTitle}</h3>
                        <p className="text-sm text-gray-400">{moduleTitle} • {weekTitle}</p>
                     </div>
                     <Badge variant={writing.status === 'graded' ? 'default' : 'secondary'} className={writing.status === 'graded' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}>
                       {writing.status === 'graded' ? 'Corrigé' : 'En attente'}
                     </Badge>
                  </div>
                  
                  <div className="bg-[#0F1419] p-4 rounded-lg mb-4 text-gray-300 font-serif leading-relaxed">
                     "{typeof writing.content === 'string' ? writing.content : ''}"
                  </div>

                  {writing.status === 'graded' && (
                    <div className="border-t border-white/10 pt-4 mt-4 bg-green-900/10 -mx-6 -mb-6 p-6 rounded-b-lg">
                       <h4 className="font-bold flex items-center gap-2 mb-2 text-green-400">
                         <MessageSquare className="h-4 w-4"/> Retour du Professeur
                       </h4>
                       <p className="text-sm text-gray-300 mb-4">
                         {typeof writing.feedback === 'string' ? writing.feedback : ''}
                       </p>
                       <div className="flex gap-4">
                          <div className="text-center">
                             <div className="text-xl font-bold">
                               {typeof writing.grade?.comprehension === 'number' ? writing.grade.comprehension : '-'}
                               /10
                             </div>
                             <div className="text-sm text-gray-500">Compréhension</div>
                          </div>
                          <div className="text-center">
                             <div className="text-xl font-bold">
                               {typeof writing.grade?.clarity === 'number' ? writing.grade.clarity : '-'}
                               /5
                             </div>
                             <div className="text-sm text-gray-500">Clarté</div>
                          </div>
                          <div className="text-center">
                             <div className="text-xl font-bold">
                               {typeof writing.grade?.effort === 'number' ? writing.grade.effort : '-'}
                               /5
                             </div>
                             <div className="text-sm text-gray-500">Effort</div>
                          </div>
                       </div>
                    </div>
                  )}
               </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default StudentNotebook;