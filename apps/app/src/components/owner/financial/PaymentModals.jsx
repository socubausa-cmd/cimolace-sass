import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const PaymentConfirmationModal = ({ isOpen, onClose, onConfirm, payment }) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="bg-[#192734] border-white/10 text-white">
      <DialogHeader>
        <DialogTitle>Confirmer le paiement</DialogTitle>
      </DialogHeader>
      <div className="py-4">
        <p>Êtes-vous sûr de vouloir confirmer le paiement de <strong>{payment?.amount}€</strong> de <strong>{payment?.studentName}</strong> ?</p>
        <p className="text-sm text-gray-400 mt-2">Cette action mettra à jour le solde de l'étudiant.</p>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} className="border-white/10 text-white">Annuler</Button>
        <Button onClick={onConfirm} className="bg-green-600 hover:bg-green-700 text-white">Confirmer</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export const PaymentRejectionModal = ({ isOpen, onClose, onReject, payment }) => {
  const [reason, setReason] = useState('Montant incorrect');
  const [message, setMessage] = useState('');

  const handleReject = () => {
    onReject(reason, message);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#192734] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Rejeter le paiement</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p>Le paiement de <strong>{payment?.amount}€</strong> sera marqué comme rejeté.</p>
          <div className="space-y-2">
             <Label>Motif du rejet</Label>
             <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="bg-[#0F1419] border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent>
                   <SelectItem value="Montant incorrect">Montant incorrect</SelectItem>
                   <SelectItem value="Référence invalide">Référence invalide</SelectItem>
                   <SelectItem value="Compte fermé">Compte fermé</SelectItem>
                   <SelectItem value="Autre">Autre</SelectItem>
                </SelectContent>
             </Select>
          </div>
          <div className="space-y-2">
             <Label>Message (optionnel)</Label>
             <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="bg-[#0F1419] border-white/10" placeholder="Explication supplémentaire..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-white/10 text-white">Annuler</Button>
          <Button onClick={handleReject} className="bg-red-600 hover:bg-red-700 text-white">Rejeter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};