import React, { useState } from 'react';
import { useDataSync } from '@/contexts/DataSyncContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, Trash, Plus, MapPin, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import AnnouncementManager from '@/components/school/school-life/AnnouncementManager';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const OwnerSchoolLifeTab = () => {
  const { events, addEvent, deleteEvent } = useDataSync();
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: '', date: '', location: '', description: '' });

  const handleAddEvent = () => {
    if (!newEvent.title || !newEvent.date) return;
    addEvent(newEvent);
    setIsEventModalOpen(false);
    setNewEvent({ title: '', date: '', location: '', description: '' });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold" style={{ color: 'var(--lt-text)' }}>Vie Scolaire</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Announcements Manager */}
        <div className="space-y-6">
           <Card className="border-0 h-full" style={{ background: 'var(--lt-card-bg)', border: '1px solid var(--lt-card-border)', boxShadow: 'var(--lt-card-shadow)' }}>
             <CardContent className="pt-6">
                <AnnouncementManager />
             </CardContent>
           </Card>
        </div>

        {/* Right Column: Events Manager */}
        <div className="space-y-6">
          <Card className="border-0 h-full" style={{ background: 'var(--lt-card-bg)', border: '1px solid var(--lt-card-border)', boxShadow: 'var(--lt-card-shadow)' }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-[var(--lt-border)]">
              <CardTitle className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--lt-text)' }}>
                <Calendar className="h-5 w-5 text-blue-500" /> Agenda & Événements
              </CardTitle>
              <Button size="sm" onClick={() => setIsEventModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-3 w-3 mr-1" /> Ajouter
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {events.length > 0 ? (
                  events.map(event => (
                    <div key={event.id} className="flex gap-3 p-3 bg-[var(--lt-inner-bg)] rounded-lg border-l-4 border-blue-500 hover:opacity-80 transition-colors group">
                       <div className="flex flex-col items-center justify-center px-2 border-r border-[var(--lt-border)] pr-3 min-w-[60px]">
                          <span className="text-sm text-zinc-500 font-bold uppercase">{event.date ? format(new Date(event.date), 'MMM', { locale: fr }) : '---'}</span>
                          <span className="text-xl font-bold" style={{ color: 'var(--lt-text)' }}>{event.date ? format(new Date(event.date), 'dd') : '--'}</span>
                       </div>
                       <div className="flex-1 min-w-0">
                         <h4 className="font-bold truncate" style={{ color: 'var(--lt-text)' }}>{event.title}</h4>
                         <div className="flex items-center gap-3 text-sm text-zinc-500 mt-1">
                            {event.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3"/> {event.location}</span>}
                            {event.date && <span className="flex items-center gap-1"><Clock className="h-3 w-3"/> {format(new Date(event.date), 'HH:mm')}</span>}
                         </div>
                       </div>
                       <Button
                         size="icon"
                         variant="ghost"
                         onClick={() => deleteEvent(event.id)}
                         className="h-8 w-8 text-zinc-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                       >
                         <Trash className="h-4 w-4" />
                       </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-zinc-500">Aucun événement planifié.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isEventModalOpen} onOpenChange={setIsEventModalOpen}>
        <DialogContent className="bg-[var(--lt-card-bg)] border-[var(--lt-border)] text-[var(--lt-text)]">
          <DialogHeader>
            <DialogTitle>Nouvel Événement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Titre</Label>
              <Input
                value={newEvent.title}
                onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                className="bg-[var(--lt-inner-bg)] border-[var(--lt-border)] text-[var(--lt-text)] placeholder:text-zinc-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label>Date & Heure</Label>
                 <Input
                   type="datetime-local"
                   value={newEvent.date}
                   onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                   className="bg-[var(--lt-inner-bg)] border-[var(--lt-border)] text-[var(--lt-text)]"
                 />
               </div>
               <div className="space-y-2">
                 <Label>Lieu</Label>
                 <Input
                   value={newEvent.location}
                   onChange={(e) => setNewEvent({...newEvent, location: e.target.value})}
                   className="bg-[var(--lt-inner-bg)] border-[var(--lt-border)] text-[var(--lt-text)] placeholder:text-zinc-400"
                   placeholder="Zoom / Salle A"
                 />
               </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={newEvent.description}
                onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                className="bg-[var(--lt-inner-bg)] border-[var(--lt-border)] text-[var(--lt-text)] placeholder:text-zinc-400"
              />
            </div>
          </div>
          <DialogFooter>
             <Button variant="ghost" onClick={() => setIsEventModalOpen(false)}>Annuler</Button>
             <Button onClick={handleAddEvent} className="bg-blue-600 hover:bg-blue-700 text-white">Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OwnerSchoolLifeTab;