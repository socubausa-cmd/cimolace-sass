import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CreditCard, Lock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useDataSync } from '@/contexts/DataSyncContext';

// Mock UI for Stripe Elements
const StripePaymentForm = ({ amount, description, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { addStripePayment } = useDataSync();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
       setLoading(false);
       addStripePayment({
          amount,
          description,
          status: 'succeeded',
          date: new Date().toISOString(),
          method: 'card_visa'
       });
       toast({ title: "Paiement Réussi", description: "Votre transaction a été traitée avec succès." });
       if (onSuccess) onSuccess();
    }, 2000);
  };

  return (
    <Card className="bg-white text-black border-none shadow-xl">
       <CardContent className="p-6 space-y-4">
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-lg">Paiement Sécurisé</h3>
             <div className="flex gap-2">
                <div className="w-8 h-5 bg-gray-200 rounded"></div>
                <div className="w-8 h-5 bg-gray-200 rounded"></div>
             </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
             <p className="text-sm text-gray-500">Montant à payer</p>
             <p className="text-2xl font-bold">{amount} €</p>
             <p className="text-sm text-gray-400 mt-1">{description}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
             <div className="space-y-2">
                <Label>Numéro de carte</Label>
                <div className="relative">
                   <CreditCard className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                   <Input placeholder="0000 0000 0000 0000" className="pl-9 bg-white border-gray-300" />
                </div>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <Label>Expiration</Label>
                   <Input placeholder="MM/AA" className="bg-white border-gray-300" />
                </div>
                <div className="space-y-2">
                   <Label>CVC</Label>
                   <Input placeholder="123" className="bg-white border-gray-300" />
                </div>
             </div>
             
             <Button type="submit" disabled={loading} className="w-full bg-[#635BFF] hover:bg-[#4b45c6] text-white">
                {loading ? 'Traitement...' : `Payer ${amount} €`}
             </Button>
             
             <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <Lock className="w-3 h-3" /> Paiement sécurisé par Stripe
             </div>
          </form>
       </CardContent>
    </Card>
  );
};

export default StripePaymentForm;