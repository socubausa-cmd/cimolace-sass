import React from 'react';
import { Calendar as CalendarIcon, FileText, AlertTriangle, MessageSquare, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';

// This component handles the specific "Vie Scolaire" tab content (Agenda, Absences, Notes, etc.)
const StudentSchoolLifeContent = () => {
  const [tab, setTab] = React.useState('agenda');
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-serif font-bold text-white">Vie Scolaire</h1>
        <p className="text-gray-400">Gérez votre agenda, vos justificatifs et documents administratifs.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <PremiumSegmentedSelector
          value={tab}
          onChange={setTab}
          layoutId="student-schoollife-segment-pill"
          className="mb-6"
          options={[
            { value: 'agenda', label: 'Agenda', badge: 'Planning', icon: CalendarIcon },
            { value: 'absences', label: 'Absences', badge: 'Suivi', icon: AlertTriangle },
            { value: 'notes', label: 'Notes', badge: 'Résultats', icon: FileText },
            { value: 'behavior', label: 'Comportement', badge: 'Discipline', icon: MessageSquare },
            { value: 'documents', label: 'Documents', badge: 'Téléchargements', icon: Download },
          ]}
        />

        <TabsContent value="agenda">
          <Card className="bg-[#192734] border-white/10">
            <CardHeader><CardTitle className="text-white">Emploi du temps de la semaine</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { day: 'Lundi', time: '09:00 - 11:00', title: 'Cours Magistral: Ontologie', type: 'Cours', loc: 'Salle Virtuelle 1' },
                  { day: 'Mercredi', time: '14:00 - 16:00', title: 'Atelier Pratique', type: 'Atelier', loc: 'Zoom' },
                  { day: 'Vendredi', time: '18:00 - 20:00', title: 'Live de Clôture', type: 'Live', loc: 'Zoom' }
                ].map((ev, i) => (
                  <div key={i} className="flex items-center p-4 rounded-lg bg-black/20 border-l-4 border-[var(--school-accent)]">
                    <div className="w-24 font-bold text-[var(--school-accent)]">{ev.day}</div>
                    <div className="w-32 text-gray-400 text-sm">{ev.time}</div>
                    <div className="flex-1">
                      <p className="text-white font-medium">{ev.title}</p>
                      <p className="text-sm text-gray-500">{ev.loc}</p>
                    </div>
                    <Badge variant="outline">{ev.type}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="absences">
          <Card className="bg-[#192734] border-white/10">
            <CardHeader className="flex flex-row justify-between items-center">
              <CardTitle className="text-white">Mes Absences</CardTitle>
              <Button size="sm" className="bg-[var(--school-accent)] text-black hover:bg-[#b5952f]">Justifier une absence</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-white/5">
                    <TableHead className="text-gray-400">Date</TableHead>
                    <TableHead className="text-gray-400">Cours</TableHead>
                    <TableHead className="text-gray-400">Durée</TableHead>
                    <TableHead className="text-gray-400">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="border-white/10 hover:bg-white/5">
                    <TableCell className="text-white">12 Jan 2026</TableCell>
                    <TableCell className="text-white">Module 2 - Live</TableCell>
                    <TableCell className="text-white">2h</TableCell>
                    <TableCell><Badge className="bg-green-500/20 text-green-500">Justifiée</Badge></TableCell>
                  </TableRow>
                  <TableRow className="border-white/10 hover:bg-white/5">
                    <TableCell className="text-white">05 Fév 2026</TableCell>
                    <TableCell className="text-white">Atelier Pratique</TableCell>
                    <TableCell className="text-white">1h30</TableCell>
                    <TableCell><Badge className="bg-red-500/20 text-red-500">Injustifiée</Badge></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
           <Card className="bg-[#192734] border-white/10">
             <CardHeader><CardTitle className="text-white">Documents Administratifs</CardTitle></CardHeader>
             <CardContent className="grid gap-4">
               {[
                 { name: 'Certificat de scolarité 2025-2026', date: '01 Sept 2025' },
                 { name: 'Règlement Intérieur Signé', date: '28 Aout 2025' },
                 { name: 'Relevé de notes Trimestre 1', date: '15 Déc 2025' }
               ].map((doc, i) => (
                 <div key={i} className="flex justify-between items-center p-4 bg-black/20 rounded-lg">
                   <div className="flex items-center gap-3">
                     <FileText className="w-8 h-8 text-[var(--school-accent)]" />
                     <div>
                       <p className="text-white font-medium">{doc.name}</p>
                       <p className="text-sm text-gray-500">Ajouté le {doc.date}</p>
                     </div>
                   </div>
                   <Button variant="ghost" size="sm" className="text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]"><Download className="w-4 h-4 mr-2" /> Télécharger</Button>
                 </div>
               ))}
             </CardContent>
           </Card>
        </TabsContent>

        {/* Placeholders for other tabs */}
        <TabsContent value="notes"><div className="text-gray-500 text-center py-10">Relevé de notes détaillé disponible en fin de trimestre.</div></TabsContent>
        <TabsContent value="behavior"><div className="text-gray-500 text-center py-10">Aucun incident comportemental signalé.</div></TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentSchoolLifeContent;