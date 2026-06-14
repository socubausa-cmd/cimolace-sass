import React from 'react';
import OwnerDashboardLayout from '@/components/owner/OwnerDashboardLayout';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const NotificationSettings = () => {
  return (
     <OwnerDashboardLayout activeTab="settings" onTabChange={() => {}}>
        <div className="max-w-2xl mx-auto space-y-6">
           <h1 className="text-3xl font-bold text-white mb-8">Paramètres de Notification</h1>
           
           <Card className="bg-[#192734] border-white/10">
              <CardHeader>
                 <CardTitle className="text-white text-lg">Préférences Générales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                 <div className="flex items-center justify-between">
                    <div className="space-y-1">
                       <Label className="text-white">Activer les notifications</Label>
                       <p className="text-sm text-gray-400">Recevoir des notifications dans l'application</p>
                    </div>
                    <Switch defaultChecked />
                 </div>
                 <div className="flex items-center justify-between">
                    <div className="space-y-1">
                       <Label className="text-white">Sons</Label>
                       <p className="text-sm text-gray-400">Jouer un son lors d'une nouvelle notification</p>
                    </div>
                    <Switch defaultChecked />
                 </div>
              </CardContent>
           </Card>

           <Card className="bg-[#192734] border-white/10">
              <CardHeader>
                 <CardTitle className="text-white text-lg">Types de Notification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                 {['Messages', 'Paiements', 'Formations', 'Coaching', 'Système'].map(type => (
                    <div key={type} className="flex items-center justify-between">
                       <Label className="text-white">{type}</Label>
                       <Switch defaultChecked />
                    </div>
                 ))}
              </CardContent>
           </Card>
           
           <div className="flex justify-end">
              <Button className="bg-[var(--school-accent)] text-black hover:bg-yellow-500">Enregistrer</Button>
           </div>
        </div>
     </OwnerDashboardLayout>
  );
};

export default NotificationSettings;