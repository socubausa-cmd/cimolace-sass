import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Users, BookOpen, Calendar, Edit, Trash, Check } from 'lucide-react';
import { useMockData } from '@/hooks/useMockData';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

// --- DASHBOARD TAB ---
export const DashboardTab = ({ stats }) => {
  // Defensive check for stats object
  const safeStats = stats || { activeStudents: 0, activeFormations: 0, revenue: 0 };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#192734] border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-gray-400 text-sm">Étudiants Actifs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{safeStats.activeStudents || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-[#192734] border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-gray-400 text-sm">Formations Actives</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#D4AF37]">{safeStats.activeFormations || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-[#192734] border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-gray-400 text-sm">Revenus (Simulé)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">{safeStats.revenue || 0}€</div>
          </CardContent>
        </Card>
      </div>
      
      <Card className="bg-[#192734] border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Aperçu Rapide</CardTitle>
          <CardDescription>Vue d'ensemble de l'activité récente (Mode Local Storage)</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400">Le système fonctionne actuellement en mode local. Toutes les données sont stockées dans le navigateur.</p>
        </CardContent>
      </Card>
    </div>
  );
};

// --- FORMATIONS TAB ---
export const FormationsTab = () => {
  const { data, loading, addItem, deleteItem } = useMockData('formations');
  const [newTitle, setNewTitle] = useState('');
  
  // Ensure data is an array
  const safeData = Array.isArray(data) ? data : [];

  const handleAdd = async () => {
    if (!newTitle) return;
    await addItem({ title: newTitle, status: 'draft', price: 0, students: 0 });
    setNewTitle('');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Gestion des Formations</h2>
        <div className="flex gap-2">
          <Input 
            value={newTitle} 
            onChange={(e) => setNewTitle(e.target.value)} 
            placeholder="Nouvelle formation..." 
            className="w-64 bg-[#0F1419] border-white/10 text-white"
          />
          <Button onClick={handleAdd} className="bg-[#D4AF37] text-black hover:bg-yellow-500">
            <Plus className="w-4 h-4 mr-2" /> Ajouter
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[#D4AF37]" /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {safeData.map((formation) => (
            <Card key={formation.id} className="bg-[#192734] border-white/10 hover:border-[#D4AF37]/30 transition-all">
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <h3 className="font-bold text-white text-lg">{formation.title}</h3>
                  <div className="flex gap-2 mt-2">
                     <Badge variant="outline" className={formation.status === 'active' ? 'text-green-400 border-green-500/30' : 'text-gray-400 border-white/10'}>
                       {formation.status}
                     </Badge>
                     <span className="text-sm text-gray-500">{formation.students} étudiants</span>
                     <span className="text-sm text-gray-500">{formation.price} €</span>
                  </div>
                </div>
                <div className="flex gap-2">
                   <Button size="icon" variant="ghost" className="text-gray-400 hover:text-white">
                     <Edit className="w-4 h-4" />
                   </Button>
                   <Button size="icon" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => deleteItem(formation.id)}>
                     <Trash className="w-4 h-4" />
                   </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {safeData.length === 0 && <p className="text-gray-500 text-center py-10">Aucune formation trouvée.</p>}
        </div>
      )}
    </div>
  );
};

// --- ACCOMPANIMENT TAB ---
export const AccompanimentTab = () => {
  const { data, loading } = useMockData('accompaniment');
  const safeData = Array.isArray(data) ? data : [];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Suivi Mentoring & Coaching</h2>
      <Card className="bg-[#192734] border-white/10">
        <CardHeader>
           <CardTitle className="text-white">Sessions Récentes</CardTitle>
        </CardHeader>
        <CardContent>
           {loading ? <Loader2 className="animate-spin text-[#D4AF37]" /> : (
             <div className="space-y-4">
               {safeData.map(item => (
                 <div key={item.id} className="flex justify-between items-center border-b border-white/5 pb-4 last:border-0">
                    <div>
                      <p className="text-white font-medium">{item.type} - {item.student}</p>
                      <p className="text-sm text-gray-500">{item.date}</p>
                    </div>
                    <Badge className={item.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}>
                      {item.status}
                    </Badge>
                 </div>
               ))}
             </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
};

// --- SCHOOL LIFE TAB ---
export const SchoolLifeTab = () => {
   const { data, loading, addItem, deleteItem } = useMockData('school_life');
   const [newEvent, setNewEvent] = useState({ title: '', date: '', type: 'event' });
   const safeData = Array.isArray(data) ? data : [];

   const handleAdd = async () => {
     if(!newEvent.title) return;
     await addItem(newEvent);
     setNewEvent({ title: '', date: '', type: 'event' });
   };

   return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Vie Scolaire (Événements & Annonces)</h2>
        <Dialog>
          <DialogTrigger asChild>
             <Button className="bg-[#D4AF37] text-black"><Plus className="w-4 h-4 mr-2"/> Ajouter</Button>
          </DialogTrigger>
          <DialogContent className="bg-[#192734] border-white/10 text-white">
             <DialogHeader><DialogTitle>Nouvel Événement</DialogTitle></DialogHeader>
             <div className="space-y-4 py-4">
               <Input placeholder="Titre" className="bg-[#0F1419]" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
               <Input type="date" className="bg-[#0F1419]" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
               <Button onClick={handleAdd} className="w-full bg-[#D4AF37] text-black">Créer</Button>
             </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {loading ? <Loader2 className="animate-spin text-[#D4AF37] mx-auto" /> : 
           safeData.map(item => (
             <div key={item.id} className="flex items-center justify-between p-4 bg-[#192734] rounded-lg border border-white/5">
                <div className="flex items-center gap-4">
                   <div className={`p-2 rounded-full ${item.type === 'event' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'}`}>
                      <Calendar className="w-5 h-5" />
                   </div>
                   <div>
                     <h4 className="font-bold text-white">{item.title}</h4>
                     <p className="text-sm text-gray-500">{item.date}</p>
                   </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => deleteItem(item.id)} className="text-red-400"><Trash className="w-4 h-4"/></Button>
             </div>
           ))
        }
      </div>
    </div>
   );
};