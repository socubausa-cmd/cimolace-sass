import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Save, Upload } from 'lucide-react';
import { useVitrineContactEmail } from '@/contexts/VitrineContactEmailContext';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const SITE_NAME = `${isnaTenantConfig.branding.name} · LIRI`;

const SettingsForm = ({ children, onSave }) => (
  <Card className="bg-[#192734] border-white/10">
    <CardContent className="space-y-6 pt-6">
      {children}
      <div className="flex justify-end pt-4 border-t border-white/10">
        <Button variant="accent" onClick={onSave}>
          <Save className="w-4 h-4 mr-2" /> Save Changes
        </Button>
      </div>
    </CardContent>
  </Card>
);

export const StoreSettingsTab = () => {
  const vitrineEmail = useVitrineContactEmail();
  const { toast } = useToast();
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Store Configuration</h2>
      <SettingsForm onSave={() => toast({ title: "Settings Saved" })}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-white">Store Name</Label>
            <Input defaultValue={SITE_NAME} className="bg-[#0F1419] border-white/10 text-white" />
          </div>
          <div className="space-y-2">
            <Label className="text-white">Support Email</Label>
            <Input defaultValue={vitrineEmail} className="bg-[#0F1419] border-white/10 text-white" />
          </div>
          <div className="space-y-2">
            <Label className="text-white">Phone Number</Label>
            <Input defaultValue="+33 7 66 52 57 08" className="bg-[#0F1419] border-white/10 text-white" />
          </div>
          <div className="space-y-2">
            <Label className="text-white">Address</Label>
            <Input defaultValue="Agondjé Village, Libreville, Gabon" className="bg-[#0F1419] border-white/10 text-white" />
          </div>
          <div className="space-y-2 md:col-span-2">
             <Label className="text-white">Description</Label>
             <Textarea className="bg-[#0F1419] border-white/10 text-white" placeholder="Store description..." />
          </div>
        </div>
      </SettingsForm>
    </div>
  );
};

export const PaymentSettingsTab = () => {
  const { toast } = useToast();
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Payment Gateway</h2>
      <SettingsForm onSave={() => toast({ title: "Payment Settings Updated" })}>
        <div className="space-y-4">
          <div className="p-4 border border-white/10 rounded-lg bg-[#0F1419]">
            <h3 className="font-bold text-white mb-4">Stripe Configuration</h3>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label className="text-gray-400">Publishable Key</Label>
                <Input type="password" value="pk_test_..." className="bg-[#192734] border-white/10 text-white" readOnly />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-400">Secret Key</Label>
                <Input type="password" value="sk_test_..." className="bg-[#192734] border-white/10 text-white" readOnly />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between p-4 border border-white/10 rounded-lg bg-[#0F1419]">
            <div>
              <h4 className="text-white font-medium">Enable Test Mode</h4>
              <p className="text-sm text-gray-400">Process transactions without real charges</p>
            </div>
            <Switch checked={true} />
          </div>
        </div>
      </SettingsForm>
    </div>
  );
};

export const OwnerProfileTab = () => {
  const vitrineEmail = useVitrineContactEmail();
  const { toast } = useToast();
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">My Profile</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-[#192734] border-white/10 lg:col-span-1">
          <CardContent className="pt-6 flex flex-col items-center">
             <div className="w-32 h-32 rounded-full bg-gray-700 mb-4 overflow-hidden relative group">
                <img src="https://github.com/shadcn.png" alt="Profile" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Upload className="w-8 h-8 text-white" />
                </div>
             </div>
             <h3 className="text-xl font-bold text-white">Owner Admin</h3>
             <p className="text-gray-400">Super Administrator</p>
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          <SettingsForm onSave={() => toast({ title: "Profile Updated" })}>
             <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <Label className="text-white">Full Name</Label>
                      <Input defaultValue="Owner Admin" className="bg-[#0F1419] border-white/10 text-white" />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-white">Email</Label>
                      <Input defaultValue={vitrineEmail} className="bg-[#0F1419] border-white/10 text-white" />
                   </div>
                </div>
                <div className="space-y-2 pt-4 border-t border-white/10">
                   <h4 className="text-white font-medium mb-2">Change Password</h4>
                   <Input type="password" placeholder="Current Password" className="bg-[#0F1419] border-white/10 text-white mb-2" />
                   <Input type="password" placeholder="New Password" className="bg-[#0F1419] border-white/10 text-white mb-2" />
                   <Input type="password" placeholder="Confirm Password" className="bg-[#0F1419] border-white/10 text-white" />
                </div>
             </div>
          </SettingsForm>
        </div>
      </div>
    </div>
  );
};