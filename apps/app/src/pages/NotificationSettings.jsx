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
           <h1 className="text-2xl font-bold tracking-tight text-zinc-900 mb-6">Paramètres de Notification</h1>

           <Card className="border-0" style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <CardHeader>
                 <CardTitle className="text-zinc-900 text-lg">Préférences Générales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                 <div className="flex items-center justify-between">
                    <div className="space-y-1">
                       <Label className="text-zinc-900">Activer les notifications</Label>
                       <p className="text-sm text-zinc-500">Recevoir des notifications dans l'application</p>
                    </div>
                    <Switch defaultChecked />
                 </div>
                 <div className="flex items-center justify-between">
                    <div className="space-y-1">
                       <Label className="text-zinc-900">Sons</Label>
                       <p className="text-sm text-zinc-500">Jouer un son lors d'une nouvelle notification</p>
                    </div>
                    <Switch defaultChecked />
                 </div>
              </CardContent>
           </Card>

           <Card className="border-0" style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <CardHeader>
                 <CardTitle className="text-zinc-900 text-lg">Types de Notification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                 {['Messages', 'Paiements', 'Formations', 'Coaching', 'Système'].map(type => (
                    <div key={type} className="flex items-center justify-between">
                       <Label className="text-zinc-900">{type}</Label>
                       <Switch defaultChecked />
                    </div>
                 ))}
              </CardContent>
           </Card>

           <div className="flex justify-end">
              <Button className="bg-[var(--school-accent)] text-black hover:bg-amber-500 font-semibold">Enregistrer</Button>
           </div>
        </div>
     </OwnerDashboardLayout>
  );
};

export default NotificationSettings;