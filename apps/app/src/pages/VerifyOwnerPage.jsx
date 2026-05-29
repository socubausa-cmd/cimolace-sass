import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { verifyOwnerStatus } from '@/utils/verifyOwnerSetup';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Shield, LogOut, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

const StatusIcon = ({ status }) => {
  switch (status) {
    case 'ok': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
    case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    default: return <AlertTriangle className="w-5 h-5 text-gray-500" />;
  }
};

const VerifyOwnerPage = () => {
  const { user, loading: authLoading, logout } = useAuth();
  const [verificationResult, setVerificationResult] = useState(null);
  const [checking, setChecking] = useState(false);

  const runVerification = async () => {
    setChecking(true);
    const result = await verifyOwnerStatus();
    setVerificationResult(result);
    setChecking(false);
  };

  useEffect(() => {
    if (!authLoading) {
      runVerification();
    }
  }, [authLoading, user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0F1419] flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
        <span className="ml-2">Chargement de l'authentification...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1419] p-6 text-white flex flex-col items-center">
      <div className="max-w-3xl w-full space-y-8 mt-10">
        <div className="text-center">
          <Shield className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
          <h1 className="text-3xl font-bold font-serif">Diagnostic de Compte Propriétaire</h1>
          <p className="text-gray-400 mt-2">Outil de débogage pour vérifier la configuration des accès administrateur</p>
        </div>

        <div className="flex justify-center gap-4">
          <Button onClick={runVerification} disabled={checking} className="bg-[#D4AF37] text-black hover:bg-[#b5952f]">
            {checking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Relancer le Diagnostic
          </Button>
          {user && (
            <Button onClick={logout} variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10">
              <LogOut className="w-4 h-4 mr-2" /> Déconnexion
            </Button>
          )}
          {!user && (
            <Link to="/login">
              <Button variant="outline" className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10">
                Se Connecter
              </Button>
            </Link>
          )}
        </div>

        {verificationResult && (
          <div className="grid gap-6">
            {/* Auth Section */}
            <Card className="bg-[#192734] border-white/10 text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <StatusIcon status={verificationResult.auth.status} />
                  Authentification Supabase
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-black/30 p-3 rounded font-mono text-sm">
                   {JSON.stringify(verificationResult.auth.details, null, 2)}
                </div>
                {verificationResult.auth.status === 'missing' && (
                  <p className="text-yellow-400 text-sm mt-2">
                    Aucun utilisateur connecté. Veuillez vous connecter avec le compte owner@prorascience.com.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Profile Section */}
            <Card className="bg-[#192734] border-white/10 text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <StatusIcon status={verificationResult.profile.status} />
                  Profil Base de Données
                </CardTitle>
              </CardHeader>
              <CardContent>
                 <div className="bg-black/30 p-3 rounded font-mono text-sm">
                   {JSON.stringify(verificationResult.profile.details, null, 2)}
                 </div>
              </CardContent>
            </Card>

            {/* Role & Permissions Section */}
            <Card className="bg-[#192734] border-white/10 text-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <StatusIcon status={verificationResult.role.status} />
                  Rôle & Permissions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div>
                   <h4 className="text-sm font-semibold text-gray-400 mb-1">Vérification du Rôle</h4>
                   <p className={verificationResult.role.status === 'ok' ? 'text-green-400' : 'text-red-400'}>
                     {verificationResult.role.details}
                   </p>
                 </div>
                 <div>
                   <h4 className="text-sm font-semibold text-gray-400 mb-1">Permissions Database</h4>
                   <p className={verificationResult.permissions.status === 'ok' ? 'text-green-400' : 'text-yellow-400'}>
                     {JSON.stringify(verificationResult.permissions.details)}
                   </p>
                 </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyOwnerPage;