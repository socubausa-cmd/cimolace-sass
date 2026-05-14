import React, { useState } from 'react';
import { useDataSync } from '@/contexts/DataSyncContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, User, Clock, Radio, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

const CoachingMentoringTab = () => {
  const { coachingSessions } = useDataSync();
  const [activeSubTab, setActiveSubTab] = useState('upcoming');

  const upcomingSessions = coachingSessions.filter(s => new Date(s.date) >= new Date()).sort((a,b) => new Date(a.date) - new Date(b.date));
  const pastSessions = coachingSessions.filter(s => new Date(s.date) < new Date()).sort((a,b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <User className="text-[#D4AF37]" /> Coaching & Mentorat
          </h2>
          <p className="text-gray-400 text-sm">
            Gérez vos sessions individuelles et de groupe ({activeSubTab === 'upcoming' ? 'vue planification' : 'vue historique'}).
          </p>
        </div>
        <Button className="bg-[#D4AF37] text-black hover:bg-yellow-500">
          <Plus className="w-4 h-4 mr-2" /> Nouvelle Session
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }}>
        <Card className="premium-panel border-white/10">
          <CardContent className="p-4">
             <p className="text-gray-400 text-xs uppercase">Sessions a venir</p>
             <p className="text-2xl font-bold text-white">{upcomingSessions.length}</p>
             <div className="mt-2 text-xs text-blue-300 flex items-center gap-1"><Calendar className="w-3 h-3" /> Planifiees</div>
          </CardContent>
        </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} whileHover={{ y: -2 }}>
        <Card className="premium-panel border-white/10">
          <CardContent className="p-4">
             <p className="text-gray-400 text-xs uppercase">Sessions realisees</p>
             <p className="text-2xl font-bold text-green-400">{pastSessions.length}</p>
             <div className="mt-2 text-xs text-emerald-300 flex items-center gap-1"><Activity className="w-3 h-3" /> Terminees</div>
          </CardContent>
        </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} whileHover={{ y: -2 }}>
        <Card className="premium-panel border-white/10">
          <CardContent className="p-4">
             <p className="text-gray-400 text-xs uppercase">Heures totales</p>
             <p className="text-2xl font-bold text-[#D4AF37]">{pastSessions.length * 1.5}h</p>
             <div className="mt-2 text-xs text-amber-300 flex items-center gap-1"><Radio className="w-3 h-3" /> Activite globale</div>
          </CardContent>
        </Card>
        </motion.div>
      </div>

      <Tabs defaultValue="upcoming" onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="premium-panel border border-white/10">
          <TabsTrigger value="upcoming" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">A venir</TabsTrigger>
          <TabsTrigger value="past" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">Historique</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">
           <SessionsTable sessions={upcomingSessions} />
        </TabsContent>
        <TabsContent value="past">
           <SessionsTable sessions={pastSessions} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const SessionsTable = ({ sessions }) => (
  <Card className="premium-panel border-white/10 mt-4">
    <Table>
      <TableHeader className="bg-[#0F1419]">
        <TableRow className="border-white/10 hover:bg-transparent">
          <TableHead className="text-gray-400">Titre</TableHead>
          <TableHead className="text-gray-400">Coach</TableHead>
          <TableHead className="text-gray-400">Date</TableHead>
          <TableHead className="text-gray-400">Heure</TableHead>
          <TableHead className="text-gray-400">Type</TableHead>
          <TableHead className="text-gray-400">Statut</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.length === 0 ? (
          <TableRow className="border-white/5">
            <TableCell colSpan={6} className="text-center py-10">
              <div className="inline-flex flex-col items-center gap-2">
                <Calendar className="w-7 h-7 text-[#D4AF37]" />
                <p className="text-white font-medium">Aucune session dans cette vue</p>
                <p className="text-xs text-gray-500">Crée une nouvelle session pour alimenter le planning.</p>
              </div>
            </TableCell>
          </TableRow>
        ) : sessions.map((s) => (
          <TableRow key={s.id} className="border-white/5 hover:bg-white/5">
            <TableCell className="font-medium text-white">{s.title}</TableCell>
            <TableCell className="text-gray-300">{s.coachName}</TableCell>
            <TableCell className="text-gray-300">{format(new Date(s.date), 'dd/MM/yyyy')}</TableCell>
            <TableCell className="text-gray-300 flex items-center gap-1"><Clock className="w-3 h-3"/> {s.startTime}</TableCell>
            <TableCell>
              <Badge variant="outline" className="border-white/20 text-white capitalize">{s.type}</Badge>
            </TableCell>
            <TableCell>
               <Badge className={s.status === 'scheduled' ? 'bg-blue-500' : 'bg-green-500'}>{s.status}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </Card>
);

export default CoachingMentoringTab;