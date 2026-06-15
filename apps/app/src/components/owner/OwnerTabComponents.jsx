import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Users, BookOpen, Calendar, Edit, Trash, Check } from 'lucide-react';
import { useMockData } from '@/hooks/useMockData';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

/* Thème CLAIR « Wix Studio » — surface blanche, aligné sur OwnerDashboardOverview. */
const LT_CARD = {
  background: 'var(--lt-card-bg)',
  border: '1px solid var(--lt-card-border)',
  boxShadow: 'var(--lt-card-shadow)',
};

// --- DASHBOARD TAB ---
export const DashboardTab = ({ stats }) => {
  // Defensive check for stats object
  const safeStats = stats || { activeStudents: 0, activeFormations: 0, revenue: 0 };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0" style={LT_CARD}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm" style={{ color: 'var(--lt-muted)' }}>Étudiants Actifs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" style={{ color: 'var(--lt-text)' }}>{safeStats.activeStudents || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-0" style={LT_CARD}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm" style={{ color: 'var(--lt-muted)' }}>Formations Actives</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" style={{ color: 'var(--lt-gold-ink)' }}>{safeStats.activeFormations || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-0" style={LT_CARD}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm" style={{ color: 'var(--lt-muted)' }}>Revenus (Simulé)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{safeStats.revenue || 0}€</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0" style={LT_CARD}>
        <CardHeader>
          <CardTitle style={{ color: 'var(--lt-text)' }}>Aperçu Rapide</CardTitle>
          <CardDescription className="text-zinc-500">Vue d'ensemble de l'activité récente (Mode Local Storage)</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-zinc-500">Le système fonctionne actuellement en mode local. Toutes les données sont stockées dans le navigateur.</p>
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
        <h2 className="text-xl font-bold" style={{ color: 'var(--lt-text)' }}>Gestion des Formations</h2>
        <div className="flex gap-2">
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Nouvelle formation..."
            className="w-64 bg-[var(--lt-inner-bg)] border-[var(--lt-border)] placeholder:text-zinc-400"
            style={{ color: 'var(--lt-text)' }}
          />
          <Button onClick={handleAdd} className="bg-[var(--school-accent)] text-black hover:bg-amber-500 font-semibold">
            <Plus className="w-4 h-4 mr-2" /> Ajouter
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin" style={{ color: 'var(--lt-gold-ink)' }} /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {safeData.map((formation) => (
            <Card key={formation.id} className="border-0 transition-all" style={LT_CARD}>
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <h3 className="font-bold text-lg" style={{ color: 'var(--lt-text)' }}>{formation.title}</h3>
                  <div className="flex gap-2 mt-2 items-center">
                     <Badge variant="outline" className={formation.status === 'active' ? 'text-emerald-700 border-emerald-300 bg-emerald-50' : 'text-zinc-500 border-[var(--lt-border)]'}>
                       {formation.status}
                     </Badge>
                     <span className="text-sm text-zinc-500">{formation.students} étudiants</span>
                     <span className="text-sm text-zinc-500">{formation.price} €</span>
                  </div>
                </div>
                <div className="flex gap-2">
                   <Button size="icon" variant="ghost" className="text-zinc-500 hover:opacity-80">
                     <Edit className="w-4 h-4" />
                   </Button>
                   <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => deleteItem(formation.id)}>
                     <Trash className="w-4 h-4" />
                   </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {safeData.length === 0 && <p className="text-center py-10" style={{ color: 'var(--lt-muted)' }}>Aucune formation trouvée.</p>}
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
      <h2 className="text-xl font-bold" style={{ color: 'var(--lt-text)' }}>Suivi Mentoring & Coaching</h2>
      <Card className="border-0" style={LT_CARD}>
        <CardHeader>
           <CardTitle style={{ color: 'var(--lt-text)' }}>Sessions Récentes</CardTitle>
        </CardHeader>
        <CardContent>
           {loading ? <Loader2 className="animate-spin" style={{ color: 'var(--lt-gold-ink)' }} /> : (
             <div className="space-y-4">
               {safeData.map(item => (
                 <div key={item.id} className="flex justify-between items-center border-b border-[var(--lt-border)] pb-4 last:border-0">
                    <div>
                      <p className="font-medium" style={{ color: 'var(--lt-text)' }}>{item.type} - {item.student}</p>
                      <p className="text-sm text-zinc-500">{item.date}</p>
                    </div>
                    <Badge className={item.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}>
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
        <h2 className="text-xl font-bold" style={{ color: 'var(--lt-text)' }}>Vie Scolaire (Événements & Annonces)</h2>
        <Dialog>
          <DialogTrigger asChild>
             <Button className="bg-[var(--school-accent)] text-black hover:bg-amber-500 font-semibold"><Plus className="w-4 h-4 mr-2"/> Ajouter</Button>
          </DialogTrigger>
          <DialogContent className="bg-[var(--lt-card-bg)] border-[var(--lt-border)]" style={{ color: 'var(--lt-text)' }}>
             <DialogHeader><DialogTitle>Nouvel Événement</DialogTitle></DialogHeader>
             <div className="space-y-4 py-4">
               <Input placeholder="Titre" className="bg-[var(--lt-inner-bg)] border-[var(--lt-border)] placeholder:text-zinc-400" style={{ color: 'var(--lt-text)' }} value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
               <Input type="date" className="bg-[var(--lt-inner-bg)] border-[var(--lt-border)]" style={{ color: 'var(--lt-text)' }} value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
               <Button onClick={handleAdd} className="w-full bg-[var(--school-accent)] text-black hover:bg-amber-500 font-semibold">Créer</Button>
             </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {loading ? <Loader2 className="animate-spin mx-auto" style={{ color: 'var(--lt-gold-ink)' }} /> :
           safeData.map(item => (
             <div key={item.id} className="flex items-center justify-between p-4 rounded-[14px]" style={LT_CARD}>
                <div className="flex items-center gap-4">
                   <div className={`p-2 rounded-full ${item.type === 'event' ? 'bg-blue-100 text-blue-600' : 'bg-violet-100 text-violet-600'}`}>
                      <Calendar className="w-5 h-5" />
                   </div>
                   <div>
                     <h4 className="font-bold" style={{ color: 'var(--lt-text)' }}>{item.title}</h4>
                     <p className="text-sm text-zinc-500">{item.date}</p>
                   </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => deleteItem(item.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50"><Trash className="w-4 h-4"/></Button>
             </div>
           ))
        }
      </div>
    </div>
   );
};