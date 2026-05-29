import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useDataSync } from '@/contexts/DataSyncContext';
import { Shield, Smartphone, QrCode } from 'lucide-react';
import { Link } from 'react-router-dom';

export const GeneralSettingsForm = () => {
   const { settings, updateSettings } = useDataSync();
   const [formData, setFormData] = useState(settings.school);

   const handleChange = (e) => setFormData({...formData, [e.target.name]: e.target.value});
   const handleSave = () => updateSettings({ school: formData });

   return (
      <Card className="bg-[#192734] border-white/10">
         <CardHeader>
            <CardTitle className="text-white">Informations de l'École</CardTitle>
            <CardDescription>Détails généraux affichés sur les factures et emails.</CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
            <div className="grid gap-2">
               <Label className="text-white">Nom de l'école</Label>
               <Input name="name" value={formData.name} onChange={handleChange} className="bg-[#0F1419] border-white/10 text-white" />
            </div>
            <div className="grid gap-2">
               <Label className="text-white">Adresse Email de contact</Label>
               <Input name="email" value={formData.email} onChange={handleChange} className="bg-[#0F1419] border-white/10 text-white" />
            </div>
            <div className="grid gap-2">
               <Label className="text-white">Adresse physique</Label>
               <Input name="address" value={formData.address} onChange={handleChange} className="bg-[#0F1419] border-white/10 text-white" />
            </div>
            <Button onClick={handleSave} className="bg-[#D4AF37] text-black">Enregistrer</Button>
         </CardContent>
      </Card>
   );
};

export const SecuritySettingsForm = () => {
   const { settings, updateSettings } = useDataSync();
   
   return (
      <div className="space-y-6">
         <Card className="bg-[#192734] border-white/10">
            <CardHeader>
               <CardTitle className="text-white flex items-center gap-2"><Shield className="w-5 h-5 text-[#D4AF37]"/> Sécurité du Compte</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
               <div className="flex items-center justify-between p-4 bg-[#0F1419] rounded-lg border border-white/5">
                  <div className="space-y-1">
                     <p className="font-medium text-white flex items-center gap-2"><Smartphone className="w-4 h-4"/> Authentification à deux facteurs (2FA)</p>
                     <p className="text-sm text-gray-400">Ajoutez une couche de sécurité supplémentaire à votre compte.</p>
                  </div>
                  <Link to="/settings/2fa">
                     <Button variant="outline" className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black">
                        Configurer
                     </Button>
                  </Link>
               </div>
               
               <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between">
                     <div className="space-y-0.5">
                        <Label className="text-white">Timeout de Session</Label>
                        <p className="text-sm text-gray-500">Déconnexion automatique après inactivité</p>
                     </div>
                     <select className="bg-[#0F1419] border border-white/10 text-white rounded p-2 text-sm">
                        <option value="15">15 minutes</option>
                        <option value="30">30 minutes</option>
                        <option value="60">1 heure</option>
                     </select>
                  </div>
               </div>
            </CardContent>
         </Card>
      </div>
   );
};

export const StripeSettingsForm = () => (
   <Card className="bg-[#192734] border-white/10">
      <CardHeader>
         <CardTitle className="text-white">Intégration Stripe</CardTitle>
         <CardDescription>Gérez vos clés API pour les paiements en ligne.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
         <div className="grid gap-2">
            <Label className="text-white">Clé Publique (Publishable Key)</Label>
            <Input type="text" placeholder="pk_test_..." className="bg-[#0F1419] border-white/10 text-white font-mono" />
         </div>
         <div className="grid gap-2">
            <Label className="text-white">Clé Secrète (Secret Key)</Label>
            <Input type="password" placeholder="sk_test_..." className="bg-[#0F1419] border-white/10 text-white font-mono" />
         </div>
         <Button className="bg-[#635BFF] text-white hover:bg-[#4b45c6]">Connecter Stripe</Button>
      </CardContent>
   </Card>
);