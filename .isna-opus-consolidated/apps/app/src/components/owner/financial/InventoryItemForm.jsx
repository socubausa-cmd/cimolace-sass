import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useSchoolYear } from '@/hooks/useSchoolYear';

const InventoryItemForm = ({ isOpen, onClose, onSave, initialData }) => {
  const { currentYear } = useSchoolYear();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Fournitures',
    quantity: 0,
    minQuantity: 5,
    unitPrice: 0,
    supplier: '',
    schoolYear: currentYear
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        name: '',
        description: '',
        category: 'Fournitures',
        quantity: 0,
        minQuantity: 5,
        unitPrice: 0,
        supplier: '',
        schoolYear: currentYear
      });
    }
  }, [initialData, isOpen, currentYear]);

  const handleSubmit = () => {
    if (!formData.name) return;
    onSave({
      ...formData,
      dateAdded: initialData?.dateAdded || new Date().toISOString()
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#192734] border-white/10 text-white sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Modifier Article' : 'Nouvel Article'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Nom de l'article *</Label>
            <Input 
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})} 
              className="bg-[#0F1419] border-white/10"
              placeholder="Ex: Stylo Bleu"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Catégorie</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                <SelectTrigger className="bg-[#0F1419] border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fournitures">Fournitures</SelectItem>
                  <SelectItem value="Équipements">Équipements</SelectItem>
                  <SelectItem value="Livres">Livres</SelectItem>
                  <SelectItem value="Autres">Autres</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Fournisseur</Label>
              <Input 
                value={formData.supplier} 
                onChange={(e) => setFormData({...formData, supplier: e.target.value})} 
                className="bg-[#0F1419] border-white/10"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Quantité *</Label>
              <Input type="number" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value)})} className="bg-[#0F1419] border-white/10" />
            </div>
            <div className="grid gap-2">
              <Label>Min. Alerte *</Label>
              <Input type="number" value={formData.minQuantity} onChange={(e) => setFormData({...formData, minQuantity: parseInt(e.target.value)})} className="bg-[#0F1419] border-white/10" />
            </div>
            <div className="grid gap-2">
              <Label>Prix Unitaire *</Label>
              <Input type="number" value={formData.unitPrice} onChange={(e) => setFormData({...formData, unitPrice: parseFloat(e.target.value)})} className="bg-[#0F1419] border-white/10" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea 
              value={formData.description} 
              onChange={(e) => setFormData({...formData, description: e.target.value})} 
              className="bg-[#0F1419] border-white/10"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-white/10 text-white">Annuler</Button>
          <Button onClick={handleSubmit} className="bg-[#D4AF37] text-black hover:bg-yellow-500">Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InventoryItemForm;