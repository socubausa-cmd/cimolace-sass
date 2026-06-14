import React from 'react';
import { useDataSync } from '@/contexts/DataSyncContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trophy, Clock, Calendar } from 'lucide-react';

const ProgressionNotebook = () => {
  const { students, formations } = useDataSync();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <Trophy className="text-[var(--school-accent)]"/> Carnet de Progression
      </h2>

      <Tabs defaultValue="overview" className="w-full">
         <TabsList className="bg-[#192734] border border-white/10">
            <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="students">Par Étudiant</TabsTrigger>
            <TabsTrigger value="stats">Statistiques</TabsTrigger>
         </TabsList>

         <TabsContent value="overview" className="mt-6">
            <Card className="bg-[#192734] border-white/10">
               <Table>
                 <TableHeader>
                   <TableRow className="border-white/10 hover:bg-transparent">
                     <TableHead className="text-gray-400">Étudiant</TableHead>
                     <TableHead className="text-gray-400">Formation</TableHead>
                     <TableHead className="text-gray-400">Progression</TableHead>
                     <TableHead className="text-gray-400">Dernière activité</TableHead>
                     <TableHead className="text-gray-400 text-right">Statut</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {students.map(student => (
                     <TableRow key={student.id} className="border-white/5 hover:bg-white/5">
                        <TableCell className="font-medium text-white">
                           <div className="flex items-center gap-3">
                              <img src={student.avatar} className="h-8 w-8 rounded-full"/>
                              {student.name}
                           </div>
                        </TableCell>
                        <TableCell className="text-gray-400">Formation Année {student.year}</TableCell>
                        <TableCell>
                           <div className="flex items-center gap-2">
                              <div className="h-2 w-24 bg-gray-700 rounded-full overflow-hidden">
                                 <div className="h-full bg-green-500" style={{ width: `${student.progress}%` }}></div>
                              </div>
                              <span className="text-xs text-white">{student.progress}%</span>
                           </div>
                        </TableCell>
                        <TableCell className="text-gray-500 text-sm">Aujourd'hui</TableCell>
                        <TableCell className="text-right"><Badge variant="outline" className={student.progress > 80 ? 'text-green-400 border-green-500/30' : 'text-yellow-400 border-yellow-500/30'}>{student.progress > 80 ? 'Avancé' : 'En cours'}</Badge></TableCell>
                     </TableRow>
                   ))}
                 </TableBody>
               </Table>
            </Card>
         </TabsContent>

         <TabsContent value="students" className="mt-6">
            <div className="grid grid-cols-1 gap-6">
               {/* Detail view would go here, simplified placeholder */}
               <div className="bg-[#192734] p-8 rounded-xl border border-white/10 text-center text-gray-400">
                  Sélectionnez un étudiant pour voir son carnet détaillé (Semaines / Mois / Trimestres).
               </div>
            </div>
         </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProgressionNotebook;