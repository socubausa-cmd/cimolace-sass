import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useDataSync } from '@/contexts/DataSyncContext';
import { AlertTriangle, Clock, Activity, Star, Gavel, HeartPulse, Mail, Calendar } from 'lucide-react';

export const QuickActionModal = ({ isOpen, onClose, type, student, onSuccess }) => {
  const { addWarning, addAbsence, addDelay, addBehavior, addConvocation, addSanction, addIllness, addCommunication } = useDataSync();
  const { toast } = useToast();
  const [formData, setFormData] = useState({});

  if (!student) return null;

  const handleSubmit = () => {
    const baseData = { 
      studentId: student.id, 
      studentName: student.name,
      date: new Date().toISOString()
    };
    
    const payload = { ...baseData, ...formData };

    switch(type) {
      case 'warning':
        addWarning(payload);
        break;
      case 'absence':
        addAbsence(payload);
        break;
      case 'delay':
        addDelay(payload);
        break;
      case 'behavior':
        addBehavior(payload);
        break;
      case 'convocation':
        addConvocation({ ...payload, status: 'scheduled' });
        break;
      case 'sanction':
        addSanction({ ...payload, status: 'active' });
        break;
      case 'illness':
        addIllness({ ...payload, status: 'active' });
        break;
      case 'message':
        addCommunication(payload);
        toast({ title: "Message envoyé", description: `Message envoyé à ${student.name}` });
        break;
      case 'appointment':
        addCommunication({ ...payload, type: 'appointment_invite' }); // Mocking appointment as comm for now
        toast({ title: "Rendez-vous programmé", description: `Invitation envoyée à ${student.name}` });
        break;
      default:
        break;
    }
    
    if (onSuccess) onSuccess();
    onClose();
    setFormData({});
  };

  const renderContent = () => {
    switch(type) {
      case 'warning':
        return (
          <>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="text-orange-500"/> Ajouter un Avertissement</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>Type</Label><Input onChange={e => setFormData({...formData, type: e.target.value})} placeholder="Ex: Retard répété" className="bg-[#0F1419] border-white/10"/></div>
              <div className="space-y-2"><Label>Motif</Label><Textarea onChange={e => setFormData({...formData, reason: e.target.value})} placeholder="Détails..." className="bg-[#0F1419] border-white/10"/></div>
            </div>
          </>
        );
      case 'absence':
        return (
          <>
             <DialogHeader><DialogTitle className="flex items-center gap-2"><Clock className="text-purple-500"/> Enregistrer une Absence</DialogTitle></DialogHeader>
             <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2"><Label>Date</Label><Input type="date" onChange={e => setFormData({...formData, date: e.target.value})} className="bg-[#0F1419] border-white/10 text-white"/></div>
                   <div className="space-y-2"><Label>Durée (jours)</Label><Input type="number" onChange={e => setFormData({...formData, duration: e.target.value})} className="bg-[#0F1419] border-white/10"/></div>
                </div>
                <div className="space-y-2"><Label>Motif</Label><Input onChange={e => setFormData({...formData, reason: e.target.value})} placeholder="Maladie, Famille..." className="bg-[#0F1419] border-white/10"/></div>
                <div className="flex items-center gap-2"><input type="checkbox" onChange={e => setFormData({...formData, justified: e.target.checked})}/> <Label>Justifiée ?</Label></div>
             </div>
          </>
        );
      case 'delay':
         return (
            <>
               <DialogHeader><DialogTitle className="flex items-center gap-2"><Activity className="text-yellow-500"/> Enregistrer un Retard</DialogTitle></DialogHeader>
               <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2"><Label>Heure d'arrivée</Label><Input type="time" onChange={e => setFormData({...formData, time: e.target.value})} className="bg-[#0F1419] border-white/10 text-white"/></div>
                     <div className="space-y-2"><Label>Durée (min)</Label><Input type="number" onChange={e => setFormData({...formData, duration: e.target.value})} className="bg-[#0F1419] border-white/10"/></div>
                  </div>
                  <div className="space-y-2"><Label>Motif</Label><Input onChange={e => setFormData({...formData, reason: e.target.value})} className="bg-[#0F1419] border-white/10"/></div>
               </div>
            </>
         );
       case 'behavior':
          return (
             <>
                <DialogHeader><DialogTitle className="flex items-center gap-2"><Star className="text-yellow-400"/> Noter le Comportement</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                   <div className="space-y-2"><Label>Appréciation</Label>
                     <Select onValueChange={v => setFormData({...formData, rating: v})}>
                        <SelectTrigger className="bg-[#0F1419] border-white/10"><SelectValue placeholder="Choisir..."/></SelectTrigger>
                        <SelectContent><SelectItem value="good">Bon</SelectItem><SelectItem value="average">Moyen</SelectItem><SelectItem value="bad">Mauvais</SelectItem></SelectContent>
                     </Select>
                   </div>
                   <div className="space-y-2"><Label>Domaine</Label><Input onChange={e => setFormData({...formData, domain: e.target.value})} placeholder="Participation, Respect..." className="bg-[#0F1419] border-white/10"/></div>
                   <div className="space-y-2"><Label>Commentaire</Label><Textarea onChange={e => setFormData({...formData, comment: e.target.value})} className="bg-[#0F1419] border-white/10"/></div>
                </div>
             </>
          );
        case 'message':
           return (
              <>
                 <DialogHeader><DialogTitle className="flex items-center gap-2"><Mail className="text-blue-400"/> Envoyer un Message</DialogTitle></DialogHeader>
                 <div className="space-y-4 py-4">
                    <div className="space-y-2"><Label>Sujet</Label><Input onChange={e => setFormData({...formData, subject: e.target.value})} className="bg-[#0F1419] border-white/10"/></div>
                    <div className="space-y-2"><Label>Message</Label><Textarea onChange={e => setFormData({...formData, message: e.target.value})} className="bg-[#0F1419] border-white/10 h-32"/></div>
                 </div>
              </>
           );
         case 'convocation':
           return (
             <>
               <DialogHeader><DialogTitle className="flex items-center gap-2"><Gavel className="text-indigo-400"/> Créer une Convocation</DialogTitle></DialogHeader>
               <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Date</Label><Input type="date" onChange={e => setFormData({...formData, date: e.target.value})} className="bg-[#0F1419] border-white/10 text-white"/></div>
                    <div className="space-y-2"><Label>Lieu</Label><Input onChange={e => setFormData({...formData, location: e.target.value})} className="bg-[#0F1419] border-white/10"/></div>
                  </div>
                  <div className="space-y-2"><Label>Motif</Label><Textarea onChange={e => setFormData({...formData, reason: e.target.value})} className="bg-[#0F1419] border-white/10"/></div>
               </div>
             </>
           );
      default: return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#192734] border-white/10 text-white sm:max-w-[500px]">
        {renderContent()}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-gray-400">Annuler</Button>
          <Button onClick={handleSubmit} className="bg-[#D4AF37] text-black font-bold hover:bg-yellow-500">Valider</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};