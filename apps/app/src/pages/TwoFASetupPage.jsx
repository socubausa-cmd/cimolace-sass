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
           <Card className="border-0" style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <CardHeader>
                 <CardTitle className="text-zinc-900 text-2xl">Configuration 2FA</CardTitle>
                 <CardDescription className="text-zinc-500">Sécurisez votre compte avec l'authentification à deux facteurs.</CardDescription>
              </CardHeader>
              <CardContent>
                 {step === 1 && (
                    <div className="space-y-6 text-center py-4">
                       <div className="w-20 h-20 bg-[color-mix(in_srgb,var(--school-accent)_14%,transparent)] rounded-full flex items-center justify-center mx-auto" style={{ color: '#8A6D1A' }}>
                          <Smartphone className="w-10 h-10" />
                       </div>
                       <div>
                          <h3 className="text-lg font-bold text-zinc-900">Utiliser une application d'authentification</h3>
                          <p className="text-zinc-500 mt-2">Utilisez Google Authenticator, Authy ou Microsoft Authenticator pour scanner un code QR.</p>
                       </div>
                       <Button onClick={() => setStep(2)} className="bg-[var(--school-accent)] text-black hover:bg-amber-500 font-semibold w-full">Commencer</Button>
                    </div>
                 )}

                 {step === 2 && (
                    <div className="space-y-6 text-center py-4">
                       <div className="bg-white p-4 rounded-lg w-fit mx-auto border border-black/10">
                          <QrCode className="w-40 h-40 text-black" />
                       </div>
                       <div>
                          <p className="text-sm text-zinc-500">Scannez ce code avec votre application.</p>
                          <p className="text-sm text-zinc-700 mt-2 font-mono bg-zinc-100 border border-black/[0.06] p-2 rounded">KEY: AB12 CD34 EF56 GH78</p>
                       </div>
                       <Button onClick={() => setStep(3)} className="bg-[var(--school-accent)] text-black hover:bg-amber-500 font-semibold w-full">J'ai scanné le code</Button>
                    </div>
                 )}

                 {step === 3 && (
                    <div className="space-y-6 py-4">
                       <div className="space-y-2">
                          <Label className="text-zinc-900">Entrez le code à 6 chiffres</Label>
                          <Input
                             value={code}
                             onChange={(e) => setCode(e.target.value)}
                             className="bg-[#F4F5F7] border-black/10 text-zinc-900 text-center text-2xl tracking-widest"
                             placeholder="000 000"
                             maxLength={6}
                          />
                          <p className="text-sm text-zinc-400 text-center">(Pour le test: 123456)</p>
                       </div>
                       <Button onClick={handleVerify} className="bg-[var(--school-accent)] text-black hover:bg-amber-500 font-semibold w-full">Vérifier</Button>
                    </div>
                 )}

                 {step === 4 && (
                    <div className="space-y-6 text-center py-4">
                       <div className="w-20 h-20 bg-emerald-500/12 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                          <CheckCircle className="w-10 h-10" />
                       </div>
                       <div>
                          <h3 className="text-lg font-bold text-zinc-900">2FA Activé !</h3>
                          <p className="text-zinc-500 mt-2">Votre compte est maintenant sécurisé. Vous devrez entrer un code à chaque connexion.</p>
                       </div>
                       <div className="bg-red-50 p-4 rounded text-left border border-red-200">
                          <p className="text-red-700 font-bold text-sm flex items-center gap-2 mb-2"><ShieldAlert className="w-4 h-4"/> Codes de secours</p>
                          <p className="text-zinc-600 text-xs mb-2">Conservez ces codes en lieu sûr :</p>
                          <div className="grid grid-cols-2 gap-2 font-mono text-sm text-zinc-900">
                             <div>1234-5678</div><div>8765-4321</div>
                             <div>2345-6789</div><div>9876-5432</div>
                          </div>
                       </div>
                       <Button onClick={() => window.history.back()} variant="outline" className="bg-white border-black/10 text-zinc-700 hover:bg-zinc-50 w-full">Retour aux paramètres</Button>
                    </div>
                 )}
              </CardContent>
           </Card>
        </div>
     </OwnerDashboardLayout>
  );
};

export default TwoFASetupPage;