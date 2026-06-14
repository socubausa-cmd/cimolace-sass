import React, { useEffect, useState } from 'react';
import { checkOwnerExists, getOwnerInfo } from '@/utils/ownerAccountSetup';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert, ShieldCheck, ExternalLink, RefreshCw, UserCheck, Loader2, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';

const VerifyOwnerAccountPage = () => {
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(false);
  const [ownerInfo, setOwnerInfo] = useState(null);

  const checkStatus = async () => {
    setLoading(true);
    const doesExist = await checkOwnerExists();
    setExists(doesExist);
    
    if (doesExist) {
      const info = await getOwnerInfo();
      setOwnerInfo(info);
    }
    setLoading(false);
  };

  useEffect(() => {
    checkStatus();
  }, []);

  return (
    <div className="min-h-screen bg-[#0F1419] text-white p-6 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-serif font-bold text-white mb-2">Vérification Système Propriétaire</h1>
          <p className="text-gray-400">État du compte administrateur principal</p>
        </div>

        <Card className="bg-[#192734] border-white/10 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 
               exists ? <ShieldCheck className="w-5 h-5 text-green-500" /> : 
               <ShieldAlert className="w-5 h-5 text-red-500" />}
              Statut du Compte
            </CardTitle>
            <CardDescription className="text-gray-400">
              Résultat du scan de la base de données
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {loading ? (
              <div className="py-8 text-center text-gray-500">Analyse en cours...</div>
            ) : exists ? (
              <div className="space-y-4">
                <Alert className="bg-green-900/20 border-green-500/50 text-green-200">
                  <UserCheck className="h-4 w-4" />
                  <AlertTitle>Compte Actif</AlertTitle>
                  <AlertDescription>
                    Un compte propriétaire a été détecté dans le système.
                  </AlertDescription>
                </Alert>

                <div className="bg-black/30 rounded-lg p-4 space-y-2 border border-white/5">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-gray-500">Nom Complet:</span>
                    <span className="col-span-2 font-medium">{ownerInfo?.full_name || 'N/A'}</span>
                    
                    <span className="text-gray-500">Email:</span>
                    <span className="col-span-2 font-medium">{ownerInfo?.email || 'Masqué'}</span>
                    
                    <span className="text-gray-500">Rôle:</span>
                    <span className="col-span-2 font-medium uppercase text-[var(--school-accent)]">{ownerInfo?.role || 'owner'}</span>
                    
                    <span className="text-gray-500">ID:</span>
                    <span className="col-span-2 font-mono text-sm text-gray-400 truncate">{ownerInfo?.id}</span>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Link to="/login">
                    <Button className="bg-[var(--school-accent)] hover:bg-[#b5952f] text-black">
                      <LogIn className="w-4 h-4 mr-2" /> Tester la Connexion
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Alert variant="destructive" className="bg-red-900/20 border-red-500/50 text-red-200">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertTitle>Aucun Propriétaire Détecté</AlertTitle>
                  <AlertDescription>
                    Le rôle 'owner' n'est assigné à aucun utilisateur actif.
                  </AlertDescription>
                </Alert>

                <div className="p-4 bg-yellow-900/10 border border-yellow-500/20 rounded-lg">
                  <h4 className="font-semibold text-yellow-500 mb-2">Actions Requises</h4>
                  <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                    <li>Créer un compte propriétaire via l'assistant</li>
                    <li>Ou assigner manuellement le rôle via Supabase Dashboard</li>
                  </ul>
                </div>

                <div className="flex flex-col gap-3 pt-4">
                  <Link to="/create-owner-account">
                    <Button className="w-full bg-[var(--school-accent)] hover:bg-[#b5952f] text-black font-bold">
                      Créer un Compte Propriétaire Maintenant
                    </Button>
                  </Link>
                  
                  <div className="text-center text-sm text-gray-500 my-2">- OU -</div>

                  <a 
                    href="https://supabase.com/dashboard" 
                    target="_blank" 
                    rel="noreferrer"
                    className="w-full"
                  >
                    <Button variant="outline" className="w-full border-white/10 hover:bg-white/5">
                      <ExternalLink className="w-4 h-4 mr-2" /> Accéder au Dashboard Supabase
                    </Button>
                  </a>
                </div>
              </div>
            )}
          </CardContent>
          
          <CardFooter className="justify-center border-t border-white/5 pt-4">
            <Button variant="ghost" size="sm" onClick={checkStatus} disabled={loading} className="text-gray-400 hover:text-white">
              <RefreshCw className={`w-3 h-3 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser le statut
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default VerifyOwnerAccountPage;