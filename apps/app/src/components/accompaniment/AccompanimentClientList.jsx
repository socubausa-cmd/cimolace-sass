import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataSync } from '@/contexts/DataSyncContext';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, User, Filter, Plus, MoreHorizontal } from 'lucide-react';

const AccompanimentClientList = () => {
  const { students, useSearch, addStudent } = useDataSync();
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: '', email: '', serviceType: 'coaching', status: 'active' });
  const navigate = useNavigate();

  const filteredStudents = useSearch(students, ['name', 'email'], searchQuery).filter(s => {
    if (filter === 'all') return true;
    return s.serviceType === filter || s.serviceType === 'both';
  });

  const handleAddStudent = () => {
    if (!newStudent.name || !newStudent.email) return;
    addStudent({ 
      ...newStudent, 
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${newStudent.name}`,
      year: '1',
      progress: 0
    });
    setIsAddModalOpen(false);
    setNewStudent({ name: '', email: '', serviceType: 'coaching', status: 'active' });
  };

  const getServiceBadge = (type) => {
    switch(type) {
      case 'both': return <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/50">Coaching + Mentorat</Badge>;
      case 'coaching': return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/50">Coaching</Badge>;
      case 'mentoring': return <Badge className="bg-green-500/20 text-green-300 border-green-500/50">Mentorat</Badge>;
      default: return <Badge variant="outline">Aucun service</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Clients & Suivi</h2>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input 
              placeholder="Rechercher un client..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-[#192734] border-white/10 text-white"
            />
          </div>
          <Button variant="outline" className="border-white/10 text-white bg-[#192734]" onClick={() => setFilter(filter === 'all' ? 'coaching' : filter === 'coaching' ? 'mentoring' : 'all')}>
            <Filter className="h-4 w-4 mr-2" /> {filter === 'all' ? 'Tous' : filter === 'coaching' ? 'Coaching' : 'Mentorat'}
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)} className="bg-[var(--school-accent)] text-black hover:bg-yellow-500">
            <Plus className="h-4 w-4 mr-2" /> Nouveau
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredStudents.map(student => (
          <Card 
            key={student.id} 
            onClick={() => navigate(`/owner-dashboard/client/${student.id}`)}
            className="bg-[#192734] border-white/10 hover:border-[var(--school-accent)] cursor-pointer transition-all group"
          >
            <CardContent className="p-6 flex items-start gap-4">
              <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-700 flex-shrink-0 border-2 border-transparent group-hover:border-[var(--school-accent)] transition-colors">
                <img src={student.avatar} alt={student.name} className="h-full w-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-white truncate pr-2">
                    {typeof student.name === 'string' ? student.name : 'Client'}
                  </h3>
                  <div className={`h-2 w-2 rounded-full ${student.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`} title={student.status} />
                </div>
                <p className="text-sm text-gray-400 truncate mb-3">
                  {typeof student.email === 'string' ? student.email : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                   {getServiceBadge(student.serviceType)}
                   <Badge variant="secondary" className="bg-white/5 text-gray-400">
                     Année {typeof student.year === 'string' || typeof student.year === 'number' ? student.year : '-'}
                   </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredStudents.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
             Aucun client trouvé.
          </div>
        )}
      </div>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="bg-[#192734] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Ajouter un Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
             <div className="space-y-2">
               <Label>Nom Complet</Label>
               <Input 
                 value={newStudent.name} 
                 onChange={e => setNewStudent({...newStudent, name: e.target.value})} 
                 className="bg-[#0F1419] border-white/10"
               />
             </div>
             <div className="space-y-2">
               <Label>Email</Label>
               <Input 
                 type="email"
                 value={newStudent.email} 
                 onChange={e => setNewStudent({...newStudent, email: e.target.value})} 
                 className="bg-[#0F1419] border-white/10"
               />
             </div>
             <div className="space-y-2">
               <Label>Service</Label>
               <Select onValueChange={v => setNewStudent({...newStudent, serviceType: v})} defaultValue={newStudent.serviceType}>
                 <SelectTrigger className="bg-[#0F1419] border-white/10"><SelectValue /></SelectTrigger>
                 <SelectContent>
                   <SelectItem value="coaching">Coaching</SelectItem>
                   <SelectItem value="mentoring">Mentorat</SelectItem>
                   <SelectItem value="both">Les deux</SelectItem>
                 </SelectContent>
               </Select>
             </div>
          </div>
          <DialogFooter>
             <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>Annuler</Button>
             <Button onClick={handleAddStudent} className="bg-[var(--school-accent)] text-black hover:bg-yellow-500">Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccompanimentClientList;