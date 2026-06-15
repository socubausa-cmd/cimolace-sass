import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useSchoolYear } from '@/hooks/useSchoolYear';
import { useDataSync } from '@/contexts/DataSyncContext';
import { addDays, format } from 'date-fns';

const InvoiceForm = ({ isOpen, onClose, onSave, initialData }) => {
  const { currentYear } = useSchoolYear();
  const { students } = useDataSync();
  const [formData, setFormData] = useState({
    studentId: '',
    invoiceNumber: '',
    totalAmount: 0,
    dueDate: '',
    description: '',
    schoolYear: currentYear
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        studentId: '',
        invoiceNumber: `FACT-${Date.now()}`, // Auto-generated simple logic
        totalAmount: 0,
        dueDate: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
        description: '',
        schoolYear: currentYear
      });
    }
  }, [initialData, isOpen, currentYear]);

  const handleSubmit = () => {
    if (!formData.studentId || !formData.totalAmount) return;
    const student = students.find(s => s.id === formData.studentId);
    
    onSave({
      ...formData,
      studentName: student?.name || 'Inconnu',
      status: initialData?.status || 'pending',
      issueDate: initialData?.issueDate || new Date().toISOString(),
      paidAmount: initialData?.paidAmount || 0,
      pendingAmount: initialData ? initialData.pendingAmount : formData.totalAmount
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white border-black/10 text-zinc-900 sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Modifier Facture' : 'Nouvelle Facture'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
             <Label>N° Facture</Label>
             <Input value={formData.invoiceNumber} disabled className="bg-zinc-100 border-black/10 text-zinc-500" />
          </div>
          <div className="grid gap-2">
            <Label>Étudiant *</Label>
            <Select value={formData.studentId} onValueChange={(v) => setFormData({...formData, studentId: v})}>
              <SelectTrigger className="bg-[#F4F5F7] border-black/10 text-zinc-900 placeholder:text-zinc-400"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
              <SelectContent>
                {students.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Montant Total (€) *</Label>
              <Input type="number" value={formData.totalAmount} onChange={(e) => setFormData({...formData, totalAmount: parseFloat(e.target.value)})} className="bg-[#F4F5F7] border-black/10 text-zinc-900 placeholder:text-zinc-400" />
            </div>
            <div className="grid gap-2">
              <Label>Date d'échéance *</Label>
              <Input type="date" value={formData.dueDate ? format(new Date(formData.dueDate), 'yyyy-MM-dd') : ''} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} className="bg-[#F4F5F7] border-black/10 text-zinc-900 placeholder:text-zinc-400" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea 
              value={formData.description} 
              onChange={(e) => setFormData({...formData, description: e.target.value})} 
              className="bg-[#F4F5F7] border-black/10 text-zinc-900 placeholder:text-zinc-400"
              placeholder="Détails de la facture..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="bg-white border-black/10 text-zinc-700 hover:bg-zinc-50">Annuler</Button>
          <Button onClick={handleSubmit} className="bg-[var(--school-accent)] text-black hover:bg-amber-500 font-semibold">Créer Facture</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceForm;