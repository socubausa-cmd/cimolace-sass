import React, { useState } from 'react';
import { useDataSync } from '@/contexts/DataSyncContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, HelpCircle, AlertCircle, CircleDot } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';

const SupportTab = () => {
  const { problems } = useDataSync();
  const [filter, setFilter] = useState('all');

  const filteredProblems = filter === 'all' ? problems : problems.filter(p => p.status === filter);

  return (
    <div className="space-y-6">
       <motion.div
         initial={{ opacity: 0, y: -8 }}
         animate={{ opacity: 1, y: 0 }}
         className="flex justify-between items-center"
       >
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <HelpCircle className="text-[var(--school-accent)]" /> Support & Problèmes
          </h2>
          <p className="text-gray-400 text-sm">Suivi des tickets et demandes d'assistance.</p>
        </div>
        <Button className="bg-[var(--school-accent)] text-black hover:bg-yellow-500">
          <Plus className="w-4 h-4 mr-2" /> Nouveau Ticket
        </Button>
      </motion.div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'Tous' },
          { key: 'open', label: 'Ouverts' },
          { key: 'in_progress', label: 'En cours' },
          { key: 'closed', label: 'Clos' },
        ].map((item) => (
          <Button
            key={item.key}
            type="button"
            variant={filter === item.key ? 'default' : 'outline'}
            onClick={() => setFilter(item.key)}
            className={filter === item.key ? 'bg-[var(--school-accent)] text-black hover:bg-[#c4a030]' : 'border-white/10 text-gray-300 hover:text-white'}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }}>
         <Card className="premium-panel border-white/10 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setFilter('all')}>
           <CardContent className="p-4">
              <p className="text-gray-400 text-xs uppercase">Total Tickets</p>
              <p className="text-2xl font-bold text-white">{problems.length}</p>
           </CardContent>
         </Card>
         </motion.div>
         <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} whileHover={{ y: -2 }}>
         <Card className="premium-panel border-white/10 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setFilter('open')}>
           <CardContent className="p-4">
              <p className="text-gray-400 text-xs uppercase">Ouverts</p>
              <p className="text-2xl font-bold text-red-400">{problems.filter(p => p.status === 'open').length}</p>
           </CardContent>
         </Card>
         </motion.div>
         <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} whileHover={{ y: -2 }}>
         <Card className="premium-panel border-white/10 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setFilter('in_progress')}>
           <CardContent className="p-4">
              <p className="text-gray-400 text-xs uppercase">En cours</p>
              <p className="text-2xl font-bold text-yellow-400">{problems.filter(p => p.status === 'in_progress').length}</p>
           </CardContent>
         </Card>
         </motion.div>
         <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} whileHover={{ y: -2 }}>
         <Card className="premium-panel border-white/10 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setFilter('closed')}>
           <CardContent className="p-4">
              <p className="text-gray-400 text-xs uppercase">Clotures</p>
              <p className="text-2xl font-bold text-green-400">{problems.filter(p => p.status === 'closed').length}</p>
           </CardContent>
         </Card>
         </motion.div>
      </div>

      <Card className="premium-panel border-white/10">
         <Table>
            <TableHeader className="bg-[#0F1419]">
               <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-gray-400">Sujet</TableHead>
                  <TableHead className="text-gray-400">Priorité</TableHead>
                  <TableHead className="text-gray-400">Catégorie</TableHead>
                  <TableHead className="text-gray-400">Créé</TableHead>
                  <TableHead className="text-gray-400">Assigné à</TableHead>
                  <TableHead className="text-gray-400">Statut</TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {filteredProblems.length === 0 ? (
                 <TableRow className="border-white/5">
                   <TableCell colSpan={6} className="text-center py-10">
                     <div className="inline-flex flex-col items-center gap-2">
                       <HelpCircle className="w-7 h-7 text-[var(--school-accent)]" />
                       <p className="text-white font-medium">Aucun ticket dans ce filtre</p>
                       <p className="text-xs text-gray-500">Change le filtre ou crée un nouveau ticket.</p>
                     </div>
                   </TableCell>
                 </TableRow>
               ) : filteredProblems.map((p) => (
                  <TableRow key={p.id} className="border-white/5 hover:bg-white/5">
                     <TableCell className="font-medium text-white">
                        {p.title}
                        <div className="text-sm text-gray-500 truncate max-w-[200px]">{p.description}</div>
                     </TableCell>
                     <TableCell>
                        <Badge variant="outline" className={`
                           ${p.priority === 'Critical' ? 'border-red-500 text-red-500' : ''}
                           ${p.priority === 'High' ? 'border-orange-500 text-orange-500' : ''}
                           ${p.priority === 'Medium' ? 'border-yellow-500 text-yellow-500' : ''}
                           ${p.priority === 'Low' ? 'border-blue-500 text-blue-500' : ''}
                        `}>{p.priority}</Badge>
                     </TableCell>
                     <TableCell className="text-gray-300">{p.category}</TableCell>
                     <TableCell className="text-gray-400 text-xs">
                        {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true, locale: fr })}
                     </TableCell>
                     <TableCell className="text-gray-300 text-sm">
                        {p.assignedTo || 'Non assigné'}
                     </TableCell>
                     <TableCell>
                        <Badge className={`
                           ${p.status === 'open' ? 'bg-red-500' : ''}
                           ${p.status === 'in_progress' ? 'bg-yellow-500 text-black' : ''}
                           ${p.status === 'closed' ? 'bg-green-500' : ''}
                        `}>
                          <span className="inline-flex items-center gap-1">
                            <CircleDot className="w-3 h-3" />
                            {p.status === 'in_progress' ? 'En cours' : p.status}
                          </span>
                        </Badge>
                     </TableCell>
                  </TableRow>
               ))}
            </TableBody>
         </Table>
      </Card>
    </div>
  );
};

export default SupportTab;