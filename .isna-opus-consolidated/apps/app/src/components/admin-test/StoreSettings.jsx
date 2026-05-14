import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Save } from 'lucide-react';
import { useVitrineContactEmail } from '@/contexts/VitrineContactEmailContext';

const StoreSettings = () => {
  const vitrineEmail = useVitrineContactEmail();
  const { toast } = useToast();

  const handleSave = () => {
    toast({
      title: "Settings Saved",
      description: "Your store configuration has been updated successfully.",
      className: "bg-green-600 text-white border-none",
    });
  };

  return (
    <Card className="border-none shadow-lg bg-[#192734]">
      <CardHeader>
        <CardTitle className="text-white">Store Configuration</CardTitle>
        <CardDescription className="text-gray-400">Manage your general store settings</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="bg-[#0F1419] border border-white/10 w-full justify-start mb-6">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="contact">Contact Info</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-4">
            <div className="grid gap-2">
              <Label className="text-gray-300">Store Name</Label>
              <Input defaultValue="Prorascience Store" className="bg-[#0F1419] border-white/10 text-white" />
            </div>
            <div className="grid gap-2">
              <Label className="text-gray-300">Currency</Label>
              <Input defaultValue="EUR (€)" className="bg-[#0F1419] border-white/10 text-white" />
            </div>
            <div className="flex items-center justify-between py-4 border-t border-white/10 mt-4">
              <div className="space-y-0.5">
                <Label className="text-white">Maintenance Mode</Label>
                <p className="text-sm text-gray-500">Disable store access for customers</p>
              </div>
              <Switch />
            </div>
          </TabsContent>

          <TabsContent value="contact" className="space-y-4">
            <div className="grid gap-2">
              <Label className="text-gray-300">Support Email</Label>
              <Input
                defaultValue={vitrineEmail}
                className="bg-[#0F1419] border-white/10 text-white"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-gray-300">Phone Number</Label>
              <Input defaultValue="+33 7 66 52 57 08" className="bg-[#0F1419] border-white/10 text-white" />
            </div>
            <div className="grid gap-2">
              <Label className="text-gray-300">Address</Label>
              <Input defaultValue="Agondjé Village, Libreville, Gabon" className="bg-[#0F1419] border-white/10 text-white" />
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
               <div className="border border-blue-500 rounded-lg p-4 bg-[#0F1419] cursor-pointer">
                  <div className="h-20 bg-gray-800 rounded mb-2"></div>
                  <p className="text-center text-blue-400 font-bold">Dark Theme</p>
               </div>
               <div className="border border-white/10 rounded-lg p-4 bg-gray-100 opacity-50 cursor-not-allowed">
                  <div className="h-20 bg-white border border-gray-300 rounded mb-2"></div>
                  <p className="text-center text-gray-500">Light Theme (Disabled)</p>
               </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="border-t border-white/10 pt-6">
        <Button onClick={handleSave} className="ml-auto bg-green-600 hover:bg-green-700 text-white">
          <Save className="w-4 h-4 mr-2" /> Save Changes
        </Button>
      </CardFooter>
    </Card>
  );
};

export default StoreSettings;