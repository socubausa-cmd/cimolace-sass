import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Archive, CheckCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const MOCK_ARCHIVES = [
   { id: 1, title: 'Semaine 1 - Les Bases', date: '10 Oct 2024', score: 95, notes: 5, status: 'completed' },
   { id: 2, title: 'Semaine 2 - L\'Énergie', date: '17 Oct 2024', score: 88, notes: 5, status: 'completed' },
   { id: 3, title: 'Semaine 3 - La Conscience', date: '24 Oct 2024', score: 92, notes: 5, status: 'completed' }
];

const ClassroomArchivePage = () => {
  return (
    <div className="min-h-screen bg-[#0F1419] p-8">
       <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
             <Link to="/classroom">
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                   <ChevronLeft className="w-6 h-6" />
                </Button>
             </Link>
             <h1 className="text-3xl font-serif font-bold text-white flex items-center gap-3">
                <Archive className="w-8 h-8 text-[#D4AF37]" /> Archives des cours
             </h1>
          </div>

          <div className="grid gap-4">
             {MOCK_ARCHIVES.map((week) => (
                <Card key={week.id} className="bg-[#192734] border-white/10 p-6 flex items-center justify-between hover:border-[#D4AF37]/30 transition-all group">
                   <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-[#D4AF37] transition-colors">{week.title}</h3>
                      <div className="flex gap-4 text-sm text-gray-400 mt-1">
                         <span>Complété le {week.date}</span>
                         <span className="flex items-center gap-1 text-green-400"><CheckCircle className="w-3 h-3" /> Validé</span>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-6">
                      <div className="text-right">
                         <div className="text-sm text-gray-400">Score Quiz</div>
                         <div className="font-bold text-white">{week.score}%</div>
                      </div>
                      <div className="text-right">
                         <div className="text-sm text-gray-400">Notes</div>
                         <div className="font-bold text-white">{week.notes}/5</div>
                      </div>
                      <Button variant="outline" className="border-white/10 hover:bg-white/5 text-gray-300">
                         Revoir
                      </Button>
                   </div>
                </Card>
             ))}
          </div>
       </div>
    </div>
  );
};

export default ClassroomArchivePage;