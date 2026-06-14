import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useSchoolYear } from '@/hooks/useSchoolYear';
import { useDataSync } from '@/contexts/DataSyncContext';
import { format } from 'date-fns';

const PaymentForm = ({ isOpen, onClose, onSave, initialData }) => {
  const { currentYear } = useSchoolYear();
  const { students } = useDataSync();
  const [formData, setFormData] = useState({
    studentId: '',
    paymentNumber: '',
    amount: 0,
    method: 'Virement',
    reference: '',
    description: '',
    schoolYear: currentYear
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        studentId: '',
        paymentNumber: `PAY-${Date.now()}`,
        amount: 0,
        method: 'Virement',
        reference: '',
        description: '',
        schoolYear: currentYear
      });
    }
  }, [initialData, isOpen, currentYear]);

  const handleSubmit = () => {
    if (!formData.studentId || !formData.amount || !formData.reference) return;
    const student = students.find(s => s.id === formData.studentId);
    
    onSave({
      ...formData,
      studentName: student?.name || 'Inconnu',
      status: initialData?.status || 'pending',
      date: initialData?.date || new Date().toISOString()
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#192734] border-white/10 text-white sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Modifier Paiement' : 'Enregistrer Paiement'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
           <div className="grid gap-2">
             <Label>N° Paiement</Label>
             <Input value={formData.paymentNumber} disabled className="bg-[#0F1419] border-white/10 opacity-50" />
          </div>
          <div className="grid gap-2">
            <Label>Étudiant *</Label>
            <Select value={formData.studentId} onValueChange={(v) => setFormData({...formData, studentId: v})}>
              <SelectTrigger className="bg-[#0F1419] border-white/10"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
              <SelectContent>
                {students.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Montant (€) *</Label>
              <Input type="number" value={formData.amount} onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value)})} className="bg-[#0F1419] border-white/10" />
            </div>
            <div className="grid gap-2">
              <Label>Méthode *</Label>
              <Select value={formData.method} onValueChange={(v) => setFormData({...formData, method: v})}>
                <SelectTrigger className="bg-[#0F1419] border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Virement">Virement</SelectItem>
                  <SelectItem value="Carte bancaire">Carte bancaire</SelectItem>
                  <SelectItem value="Espèces">Espèces</SelectItem>
                  <SelectItem value="Chèque">Chèque</SelectItem>
                  <SelectItem value="Mobile money">Mobile money</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
             <Label>Référence Transaction *</Label>
             <Input value={formData.reference} onChange={(e) => setFormData({...formData, reference: e.target.value})} className="bg-[#0F1419] border-white/10" placeholder="Ex: VIR-12345" />
          </div>
          <div className="grid gap-2">
            <Label>Note / Description</Label>
            <Textarea 
              value={formData.description} 
              onChange={(e) => setFormData({...formData, description: e.target.value})} 
              className="bg-[#0F1419] border-white/10"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-white/10 text-white">Annuler</Button>
          <Button onClick={handleSubmit} className="bg-[var(--school-accent)] text-black hover:bg-yellow-500">Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentForm;