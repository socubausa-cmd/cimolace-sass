import React, { useMemo } from 'react';
import { useDataSync } from '@/contexts/DataSyncContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Calendar, Sparkles, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

const WorkshopsTab = () => {
  const { workshops } = useDataSync();
  const stats = useMemo(() => {
    const now = new Date();
    const upcoming = workshops.filter((w) => new Date(w.date) >= now).length;
    const full = workshops.filter((w) => Number(w.enrolledCount || 0) >= Number(w.spots || 0)).length;
    const occupancy = workshops.reduce((acc, w) => {
      const spots = Number(w.spots || 0);
      const enrolled = Number(w.enrolledCount || 0);
      if (!spots) return acc;
      return acc + Math.min(1, enrolled / spots);
    }, 0);
    const occupancyPct = workshops.length ? Math.round((occupancy / workshops.length) * 100) : 0;
    return { total: workshops.length, upcoming, full, occupancyPct };
  }, [workshops]);

  return (
    <div className="space-y-6">
       <motion.div
         initial={{ opacity: 0, y: -8 }}
         animate={{ opacity: 1, y: 0 }}
         className="flex justify-between items-center"
       >
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="text-[#D4AF37]" /> Ateliers
          </h2>
          <p className="text-gray-400 text-sm">Gérez les ateliers collectifs et les inscriptions.</p>
        </div>
        <Button className="bg-[#D4AF37] text-black hover:bg-yellow-500">
          <Plus className="w-4 h-4 mr-2" /> Créer Atelier
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total ateliers', value: stats.total, icon: Sparkles, color: 'text-[#D4AF37]' },
          { label: 'A venir', value: stats.upcoming, icon: Calendar, color: 'text-blue-400' },
          { label: 'Complets', value: stats.full, icon: CheckCircle2, color: 'text-green-400' },
          { label: 'Taux remplissage', value: `${stats.occupancyPct}%`, icon: Users, color: 'text-purple-400' },
        ].map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            whileHover={{ y: -2 }}
          >
            <Card className="premium-panel border-white/10">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-400">{item.label}</p>
                  <p className="text-2xl font-bold text-white mt-1">{item.value}</p>
                </div>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="premium-panel border-white/10">
         <div className="p-4 border-b border-white/10">
            <h3 className="font-bold text-white">Tous les ateliers</h3>
         </div>
         {workshops.length === 0 ? (
           <CardContent className="p-10 text-center">
             <Users className="w-8 h-8 text-[#D4AF37] mx-auto mb-3" />
             <p className="text-white font-semibold">Aucun atelier pour le moment</p>
             <p className="text-gray-400 text-sm mt-1">Crée ton premier atelier pour activer la programmation collective.</p>
             <Button className="mt-4 bg-[#D4AF37] text-black hover:bg-[#c4a030]">
               <Plus className="w-4 h-4 mr-2" /> Créer le premier atelier
             </Button>
           </CardContent>
         ) : (
         <Table>
            <TableHeader className="bg-[#0F1419]">
               <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-gray-400">Atelier</TableHead>
                  <TableHead className="text-gray-400">Date</TableHead>
                  <TableHead className="text-gray-400">Participants</TableHead>
                  <TableHead className="text-gray-400">Niveau</TableHead>
                  <TableHead className="text-gray-400">Statut</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {workshops.map((w) => (
                  <TableRow key={w.id} className="border-white/5 hover:bg-white/5 transition-colors">
                     <TableCell className="font-medium text-white">
                        <div>{w.title}</div>
                        <div className="text-sm text-gray-500">{w.category}</div>
                     </TableCell>
                     <TableCell className="text-gray-300">
                        <div className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {format(new Date(w.date), 'dd/MM/yyyy')}</div>
                        <div className="text-sm text-gray-500">{w.startTime} - {w.endTime}</div>
                     </TableCell>
                     <TableCell className="text-white">
                        {w.enrolledCount} / {w.spots}
                     </TableCell>
                     <TableCell>
                        <Badge variant="outline" className="border-[#D4AF37] text-[#D4AF37]">{w.level}</Badge>
                     </TableCell>
                     <TableCell>
                        <Badge className="bg-blue-600 capitalize">{w.status}</Badge>
                     </TableCell>
                  </TableRow>
               ))}
            </TableBody>
         </Table>
         )}
      </Card>
    </div>
  );
};

export default WorkshopsTab;