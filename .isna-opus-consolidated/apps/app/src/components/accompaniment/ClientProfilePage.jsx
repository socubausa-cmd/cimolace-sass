import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDataSync } from '@/contexts/DataSyncContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Phone, Calendar, Clock, AlertCircle, FileText, Activity, ArrowLeft, Video, MessageSquare } from 'lucide-react';

const ClientProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { students, addInteraction } = useDataSync();
  const student = students.find(s => s.id === id);

  if (!student) return <div className="text-white p-8">Client non trouvé</div>;

  // Helper to safely get progress value
  const getProgressValue = (prog) => {
    if (typeof prog === 'number') return prog;
    // If it's the object causing the error, return 0 or a calculated value if possible
    return 0;
  };

  const progressValue = getProgressValue(student.progress);

  return (
    <div className="min-h-screen bg-[#0F1419] p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-gray-400 hover:text-white pl-0">
          <ArrowLeft className="mr-2 h-4 w-4" /> Retour liste
        </Button>
        <div className="flex gap-2">
           <Button className="bg-blue-600 hover:bg-blue-700 text-white"><Video className="mr-2 h-4 w-4" /> Lancer appel</Button>
           <Button className="bg-[#D4AF37] hover:bg-yellow-600 text-black"><MessageSquare className="mr-2 h-4 w-4" /> Message</Button>
        </div>
      </div>

      {/* Profile Header Card */}
      <Card className="bg-[#192734] border-white/10 overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-[#D4AF37]/20 to-blue-900/20"></div>
        <CardContent className="relative pt-0 px-8 pb-8">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-6 -mt-12 mb-6">
            <div className="h-24 w-24 rounded-xl border-4 border-[#192734] overflow-hidden bg-gray-800 shadow-xl">
               <img src={student.avatar} alt={student.name} className="h-full w-full object-cover" />
            </div>
            <div className="flex-1 mb-2">
              <h1 className="text-3xl font-bold text-white">{student.name}</h1>
              <div className="flex items-center gap-4 text-gray-400 mt-1">
                <span className="flex items-center gap-1"><Mail className="h-4 w-4" /> {student.email}</span>
                <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> {student.phone}</span>
              </div>
            </div>
            <div className="flex gap-2 mb-2">
               <Badge className="text-lg px-4 py-1 bg-green-500/20 text-green-400 border-green-500/50 capitalize">{student.status}</Badge>
            </div>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-black/20 w-full justify-start border-b border-white/10 rounded-none h-auto p-0">
              <TabsTrigger value="overview" className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#D4AF37] data-[state=active]:bg-transparent data-[state=active]:text-[#D4AF37]">Vue d'ensemble</TabsTrigger>
              <TabsTrigger value="contracts" className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#D4AF37] data-[state=active]:bg-transparent data-[state=active]:text-[#D4AF37]">Contrats & Services</TabsTrigger>
              <TabsTrigger value="health" className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#D4AF37] data-[state=active]:bg-transparent data-[state=active]:text-[#D4AF37]">Santé & Bien-être</TabsTrigger>
              <TabsTrigger value="history" className="px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#D4AF37] data-[state=active]:bg-transparent data-[state=active]:text-[#D4AF37]">Historique</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="pt-6 space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <Card className="bg-[#0F1419] border-white/10">
                   <CardHeader><CardTitle className="text-white text-lg">Problématiques en cours</CardTitle></CardHeader>
                   <CardContent className="space-y-4">
                     {student.issues && student.issues.length > 0 ? student.issues.map(issue => (
                       <div key={issue.id} className="p-4 rounded-lg bg-red-900/10 border border-red-500/20 flex justify-between items-center">
                         <div>
                           <h4 className="font-bold text-red-200">{issue.title}</h4>
                           <p className="text-xs text-red-300/60">{new Date(issue.date).toLocaleDateString()}</p>
                         </div>
                         <Badge variant="destructive">{issue.status}</Badge>
                       </div>
                     )) : <p className="text-gray-500 italic">Aucune problématique signalée.</p>}
                   </CardContent>
                 </Card>

                 <Card className="bg-[#0F1419] border-white/10">
                   <CardHeader><CardTitle className="text-white text-lg">Progression Académique</CardTitle></CardHeader>
                   <CardContent>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-sm mb-1 text-gray-400">
                             <span>Progression Globale</span>
                             <span>{progressValue}%</span>
                          </div>
                          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                             <div className="h-full bg-[#D4AF37]" style={{ width: `${progressValue}%` }}></div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                           <div className="p-3 bg-white/5 rounded-lg text-center">
                              <div className="text-2xl font-bold text-white">
                                {typeof student.progressionData?.grades?.['m-1'] === 'number' || typeof student.progressionData?.grades?.['m-1'] === 'string' ? student.progressionData.grades['m-1'] : '-'}
                              </div>
                              <div className="text-sm text-gray-500">Dernière Note</div>
                           </div>
                           <div className="p-3 bg-white/5 rounded-lg text-center">
                              <div className="text-2xl font-bold text-white">
                                {typeof student.progressionData?.attendance === 'number' ? student.progressionData.attendance : 0}%
                              </div>
                              <div className="text-sm text-gray-500">Présence</div>
                           </div>
                        </div>
                      </div>
                   </CardContent>
                 </Card>
               </div>
            </TabsContent>

            <TabsContent value="contracts" className="pt-6">
              <div className="space-y-4">
                 {student.contracts && student.contracts.map(contract => (
                   <Card key={contract.id} className="bg-[#0F1419] border-white/10">
                     <CardContent className="p-6 flex justify-between items-center">
                        <div>
                          <h3 className="font-bold text-white text-lg">{contract.type}</h3>
                          <p className="text-gray-400 text-sm">Du {contract.startDate} au {contract.endDate}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-[#D4AF37]">{contract.remainingSessions} / {contract.totalSessions}</div>
                          <div className="text-sm text-gray-500">Sessions restantes</div>
                        </div>
                     </CardContent>
                   </Card>
                 ))}
              </div>
            </TabsContent>

            <TabsContent value="history" className="pt-6">
               <div className="relative border-l border-white/10 ml-4 space-y-8 py-2">
                  {student.interactions?.map((interaction, i) => (
                    <div key={i} className="relative pl-8">
                       <div className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-[#D4AF37] ring-4 ring-[#0F1419]"></div>
                       <div className="flex flex-col gap-1">
                          <span className="text-sm text-gray-500">{new Date(interaction.date).toLocaleDateString()}</span>
                          <h4 className="text-white font-bold capitalize">{interaction.type}</h4>
                          <p className="text-gray-400 bg-white/5 p-3 rounded-lg text-sm">{interaction.description}</p>
                       </div>
                    </div>
                  ))}
               </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientProfilePage;