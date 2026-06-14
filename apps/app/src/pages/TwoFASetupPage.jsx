import React, { useState } from 'react';
import OwnerDashboardLayout from '@/components/owner/OwnerDashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QrCode, Smartphone, CheckCircle, ShieldAlert } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const TwoFASetupPage = () => {
  const [step, setStep] = useState(1); // 1: Intro, 2: QR, 3: Verify, 4: Success
  const [code, setCode] = useState('');
  const { toast } = useToast();

  const handleVerify = () => {
     if (code === '123456') {
        setStep(4);
        toast({ title: "Succès", description: "2FA activé avec succès !" });
     } else {
        toast({ variant: "destructive", title: "Erreur", description: "Code incorrect. Essayez 123456" });
     }
  };

  return (
     <OwnerDashboardLayout activeTab="settings" onTabChange={() => {}}>
        <div className="max-w-2xl mx-auto py-10">
           <Card className="bg-[#192734] border-white/10">
              <CardHeader>
                 <CardTitle className="text-white text-2xl">Configuration 2FA</CardTitle>
                 <CardDescription>Sécurisez votre compte avec l'authentification à deux facteurs.</CardDescription>
              </CardHeader>
              <CardContent>
                 {step === 1 && (
                    <div className="space-y-6 text-center py-4">
                       <div className="w-20 h-20 bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] rounded-full flex items-center justify-center mx-auto text-[var(--school-accent)]">
                          <Smartphone className="w-10 h-10" />
                       </div>
                       <div>
                          <h3 className="text-lg font-bold text-white">Utiliser une application d'authentification</h3>
                          <p className="text-gray-400 mt-2">Utilisez Google Authenticator, Authy ou Microsoft Authenticator pour scanner un code QR.</p>
                       </div>
                       <Button onClick={() => setStep(2)} className="bg-[var(--school-accent)] text-black w-full">Commencer</Button>
                    </div>
                 )}

                 {step === 2 && (
                    <div className="space-y-6 text-center py-4">
                       <div className="bg-white p-4 rounded-lg w-fit mx-auto">
                          <QrCode className="w-40 h-40 text-black" />
                       </div>
                       <div>
                          <p className="text-sm text-gray-400">Scannez ce code avec votre application.</p>
                          <p className="text-sm text-gray-500 mt-2 font-mono bg-black/20 p-2 rounded">KEY: AB12 CD34 EF56 GH78</p>
                       </div>
                       <Button onClick={() => setStep(3)} className="bg-[var(--school-accent)] text-black w-full">J'ai scanné le code</Button>
                    </div>
                 )}

                 {step === 3 && (
                    <div className="space-y-6 py-4">
                       <div className="space-y-2">
                          <Label className="text-white">Entrez le code à 6 chiffres</Label>
                          <Input 
                             value={code} 
                             onChange={(e) => setCode(e.target.value)} 
                             className="bg-[#0F1419] border-white/10 text-white text-center text-2xl tracking-widest" 
                             placeholder="000 000"
                             maxLength={6}
                          />
                          <p className="text-sm text-gray-500 text-center">(Pour le test: 123456)</p>
                       </div>
                       <Button onClick={handleVerify} className="bg-[var(--school-accent)] text-black w-full">Vérifier</Button>
                    </div>
                 )}

                 {step === 4 && (
                    <div className="space-y-6 text-center py-4">
                       <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto text-green-500">
                          <CheckCircle className="w-10 h-10" />
                       </div>
                       <div>
                          <h3 className="text-lg font-bold text-white">2FA Activé !</h3>
                          <p className="text-gray-400 mt-2">Votre compte est maintenant sécurisé. Vous devrez entrer un code à chaque connexion.</p>
                       </div>
                       <div className="bg-[#0F1419] p-4 rounded text-left border border-red-500/20">
                          <p className="text-red-400 font-bold text-sm flex items-center gap-2 mb-2"><ShieldAlert className="w-4 h-4"/> Codes de secours</p>
                          <p className="text-gray-400 text-xs mb-2">Conservez ces codes en lieu sûr :</p>
                          <div className="grid grid-cols-2 gap-2 font-mono text-sm text-white">
                             <div>1234-5678</div><div>8765-4321</div>
                             <div>2345-6789</div><div>9876-5432</div>
                          </div>
                       </div>
                       <Button onClick={() => window.history.back()} variant="outline" className="border-white/10 text-white w-full">Retour aux paramètres</Button>
                    </div>
                 )}
              </CardContent>
           </Card>
        </div>
     </OwnerDashboardLayout>
  );
};

export default TwoFASetupPage;