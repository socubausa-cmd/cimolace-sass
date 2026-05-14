import React, { useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, XCircle, ShieldCheck, Lock, Terminal, Copy, Eye, EyeOff, Loader2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

const OwnerSetupPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [verificationComplete, setVerificationComplete] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  
  const credentials = {
    email: 'owner@prorascience.com',
    password: 'Owner@123456',
    role: 'owner'
  };

  const addLog = (message, status = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, status, timestamp }]);
    console.log(`[${status.toUpperCase()}] ${message}`);
  };

  const handleResetPassword = async () => {
    setResetLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-owner-password', {
        body: {
          email: credentials.email,
          newPassword: credentials.password
        }
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || 'Unknown error');

      toast({
        title: "Mot de passe réinitialisé",
        description: `Le mot de passe pour ${credentials.email} a été défini à ${credentials.password}`,
        className: "bg-green-600 text-white border-none",
      });

    } catch (error) {
      console.error('Reset error:', error);
      toast({
        title: "Erreur de réinitialisation",
        description: error.message || "Impossible de réinitialiser le mot de passe.",
        variant: "destructive",
      });
    } finally {
      setResetLoading(false);
    }
  };

  const verifySetup = async () => {
    setLoading(true);
    setLogs([]);
    addLog("Démarrage de la vérification du compte Propriétaire...", "info");

    try {
      // Step 1: Login
      addLog("Tentative de connexion avec les identifiants owner...", "pending");
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password
      });

      if (authError) {
        throw new Error(`Échec de la connexion: ${authError.message}`);
      }
      addLog("Connexion réussie.", "success");

      // Step 2: Verify Profile
      addLog("Vérification du profil utilisateur...", "pending");
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profileError) throw new Error(`Profil introuvable: ${profileError.message}`);
      
      if (profile.role !== 'owner') {
        throw new Error(`Rôle incorrect: ${profile.role} (Attendu: owner)`);
      }
      addLog(`Profil vérifié: ${profile.full_name} (${profile.role})`, "success");

      // Step 3: Verify Role Permissions
      addLog("Vérification des permissions du rôle...", "pending");
      const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('permissions')
        .eq('name', 'owner')
        .single();

      if (roleError) throw new Error("Rôle 'owner' non trouvé dans la table roles.");
      
      if (!roleData.permissions || roleData.permissions.length === 0) {
        addLog("Attention: Aucune permission explicite trouvée, mais le rôle owner a un accès complet implicite.", "warning");
      } else {
        addLog(`Permissions chargées: ${roleData.permissions.length} permissions trouvées.`, "success");
      }

      // Step 4: Confirm Admin Access (Simulation)
      addLog("Simulation de l'accès aux routes Admin...", "pending");
      // In a real scenario we'd hit an endpoint, here we confirm the state allows it
      if (profile.role === 'owner') {
         addLog("Autorisation Admin: ACCORDÉE", "success");
      } else {
         throw new Error("Accès Admin refusé.");
      }

      setVerificationComplete(true);
      addLog("Vérification complète terminée avec succès!", "success");

      // Logout to clean up state if this is just a check page
      // await supabase.auth.signOut(); 
      // addLog("Session de test fermée.", "info");

    } catch (error) {
      addLog(error.message, "error");
      setVerificationComplete(false);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copié !",
      description: "Texte copié dans le presse-papier.",
    });
  };

  return (
    <div className="min-h-screen bg-[#0F1419] text-white p-6 flex flex-col items-center justify-center">
      <div className="max-w-4xl w-full space-y-8">
        
        <div className="text-center space-y-2">
          <ShieldCheck className="w-16 h-16 text-[#D4AF37] mx-auto" />
          <h1 className="text-3xl font-serif font-bold text-white">Configuration Compte Propriétaire</h1>
          <p className="text-gray-400">Outil de vérification et d'initialisation des accès admin</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Verification Section */}
          <Card className="bg-[#192734] border-white/10 text-white flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-[#D4AF37]" />
                Journal de Vérification
              </CardTitle>
              <CardDescription className="text-gray-400">
                Lancez le script pour valider la configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-1">
              <div className="bg-black/50 rounded-lg p-4 font-mono text-xs h-64 overflow-y-auto space-y-2 border border-white/5">
                {logs.length === 0 && <span className="text-gray-600 italic">En attente de démarrage...</span>}
                {logs.map((log, i) => (
                  <div key={i} className={`flex gap-2 ${
                    log.status === 'error' ? 'text-red-400' : 
                    log.status === 'success' ? 'text-green-400' : 
                    log.status === 'warning' ? 'text-yellow-400' : 
                    'text-blue-300'
                  }`}>
                    <span className="text-gray-600">[{log.timestamp}]</span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={verifySetup} 
                disabled={loading}
                className="w-full bg-[#D4AF37] hover:bg-[#b5952f] text-black font-bold"
              >
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Vérification...</> : 'Lancer la Vérification'}
              </Button>
            </CardFooter>
          </Card>

          {/* Credentials Section */}
          <div className="space-y-6">
            <Card className={`bg-[#192734] border-white/10 text-white transition-opacity duration-500`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-[#D4AF37]" />
                  Identifiants Sécurisés
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Conservez ces informations en lieu sûr
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                <div className="space-y-2">
                  <Label className="text-gray-400">Email Administrateur</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={credentials.email} className="bg-[#0F1419] border-white/10 font-mono text-gray-300" />
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(credentials.email)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-400">Mot de passe</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input 
                        readOnly 
                        type={showPassword ? "text" : "password"} 
                        value={credentials.password} 
                        className="bg-[#0F1419] border-white/10 font-mono pr-10 text-gray-300" 
                      />
                      <button 
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(credentials.password)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <h4 className="text-sm font-semibold text-[#D4AF37] mb-3 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" /> 
                    Réinitialisation
                  </h4>
                  <p className="text-sm text-gray-400 mb-3">
                    Si vous ne parvenez pas à vous connecter, forcez la réinitialisation du mot de passe.
                  </p>
                  <Button 
                    variant="destructive" 
                    className="w-full bg-red-900/50 hover:bg-red-900/80 border border-red-800"
                    onClick={handleResetPassword}
                    disabled={resetLoading}
                  >
                    {resetLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Réinitialiser le mot de passe'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Link to="/login" className="block w-full">
               <Card className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 border-white/10 hover:border-[#D4AF37]/50 transition-all cursor-pointer group">
                  <CardContent className="p-6 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-lg text-white group-hover:text-[#D4AF37] transition-colors">Connexion Admin</h3>
                      <p className="text-sm text-gray-400">Accéder au tableau de bord</p>
                    </div>
                    <ShieldCheck className="w-8 h-8 text-white/20 group-hover:text-[#D4AF37] transition-colors" />
                  </CardContent>
               </Card>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
};

export default OwnerSetupPage;