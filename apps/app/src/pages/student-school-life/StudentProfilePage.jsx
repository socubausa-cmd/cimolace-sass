import React, { useEffect, useMemo, useState } from 'react';
import { User, Lock, Bell, Globe, Shield } from 'lucide-react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';

const StudentProfilePage = () => {
  const { user, updatePassword } = useAuth();
  const { isDemoMode, demoData, restrictedAction } = useDemoMode();
  const [profile, setProfile] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [notifySms, setNotifySms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingNotifPrefs, setSavingNotifPrefs] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isDemoMode || !user?.id) return;
    let alive = true;
    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id,name,email,role,phone,avatar_url,notify_sms')
        .eq('id', user.id)
        .maybeSingle();
      if (!alive) return;
      const row = data || {
        id: user.id,
        name: user.name || '',
        email: user.email || '',
        role: user.role || 'student',
        phone: user.phone || '',
        avatar_url: user.avatar_url || null,
        notify_sms: false,
      };
      setProfile(row);
      const nameParts = String(row.name || '').trim().split(/\s+/).filter(Boolean);
      setFirstName(nameParts[0] || '');
      setLastName(nameParts.slice(1).join(' '));
      setPhone(String(row.phone || ''));
      setNotifySms(row.notify_sms === true);
    };
    void load();
    return () => {
      alive = false;
    };
  }, [isDemoMode, user?.avatar_url, user?.email, user?.id, user?.name, user?.phone, user?.role]);

  const effectiveProfile = isDemoMode ? demoData.profile : profile || user || null;
  const email = effectiveProfile?.email || 'email@example.com';
  const nameParts = email.split('@')[0].split('.');
  const displayName = effectiveProfile?.name || nameParts[0];
  const saveProfile = async () => {
    if (isDemoMode) {
      restrictedAction('Enregistrer les modifications');
      return;
    }
    if (!user?.id) return;
    setSaving(true);
    setMessage('');
    const mergedName = `${String(firstName || '').trim()} ${String(lastName || '').trim()}`.trim();
    const { error } = await supabase
      .from('profiles')
      .update({
        name: mergedName || displayName,
        phone: String(phone || '').trim() || null,
      })
      .eq('id', user.id);
    setSaving(false);
    setMessage(error ? `Erreur: ${error.message}` : 'Profil mis a jour.');
  };

  const saveNotificationPrefs = async () => {
    if (isDemoMode) {
      restrictedAction('Enregistrer les préférences notifications');
      return;
    }
    if (!user?.id) return;
    setSavingNotifPrefs(true);
    setMessage('');
    const { error } = await supabase
      .from('profiles')
      .update({
        notify_sms: notifySms === true,
      })
      .eq('id', user.id);
    setSavingNotifPrefs(false);
    setMessage(error ? `Erreur préférences: ${error.message}` : 'Préférences notifications mises à jour.');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-serif font-bold text-white">Mon Profil</h1>
        <p className="text-gray-400">
           {isDemoMode ? "Profil fictif en mode démo." : "Gérez vos informations personnelles et préférences."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Avatar & Basic Info */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-[#192734] border-white/10">
            <CardContent className="pt-6 flex flex-col items-center">
              <Avatar className="w-32 h-32 border-4 border-[#D4AF37] mb-4">
                <AvatarImage src={isDemoMode ? effectiveProfile.avatar : (effectiveProfile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`)} />
                <AvatarFallback>{email.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-bold text-white capitalize">{displayName}</h2>
              <p className="text-[#D4AF37] text-sm font-medium">{effectiveProfile?.role === 'student' ? 'Etudiant' : 'Invite'}</p>
              <Button 
                className="mt-4 w-full bg-white/10 hover:bg-white/20"
                onClick={() => restrictedAction('Changer la photo')}
              >
                Changer la photo
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-[#192734] border-white/10">
             <CardHeader><CardTitle className="text-white text-lg flex items-center gap-2"><Shield className="w-4 h-4 text-[#D4AF37]" /> Sécurité</CardTitle></CardHeader>
             <CardContent className="space-y-4">
               <div className="flex justify-between items-center">
                 <span className="text-gray-300 text-sm">Double Authentification</span>
                 <Switch disabled={isDemoMode} />
               </div>
               <Button 
                 variant="outline" 
                 className="w-full border-red-500/50 text-red-500 hover:bg-red-500/10"
                 onClick={async () => {
                   if (isDemoMode) {
                     restrictedAction('Changer le mot de passe');
                     return;
                   }
                   const next = window.prompt('Nouveau mot de passe (min 6 caracteres):');
                   if (!next || next.length < 6) return;
                   const { error } = await updatePassword(next);
                   setMessage(error ? `Erreur mot de passe: ${error.message}` : 'Mot de passe mis a jour.');
                 }}
               >
                 Changer mot de passe
               </Button>
             </CardContent>
          </Card>
        </div>

        {/* Right Column: Forms */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-[#192734] border-white/10">
            <CardHeader><CardTitle className="text-white">Informations Personnelles</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-400">Nom</Label>
                  <Input value={isDemoMode ? "Demo" : firstName} onChange={(e) => setFirstName(e.target.value)} className="bg-black/20 border-white/10 text-white" disabled={isDemoMode} />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400">Prenom</Label>
                  <Input value={isDemoMode ? "Etudiant" : lastName} onChange={(e) => setLastName(e.target.value)} className="bg-black/20 border-white/10 text-white" disabled={isDemoMode} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-400">Email</Label>
                <Input defaultValue={email} disabled className="bg-black/40 border-white/10 text-gray-500" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-400">Telephone</Label>
                <Input value={isDemoMode ? "+33 6 12 34 56 78" : phone} onChange={(e) => setPhone(e.target.value)} className="bg-black/20 border-white/10 text-white" disabled={isDemoMode} />
              </div>
              <Button 
                className="bg-[#D4AF37] text-black hover:bg-[#b5952f]"
                onClick={saveProfile}
                disabled={saving}
              >
                {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </Button>
              {message ? <p className="text-xs text-gray-300">{message}</p> : null}
            </CardContent>
          </Card>

          <Card className="bg-[#192734] border-white/10">
            <CardHeader><CardTitle className="text-white">Préférences</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-white text-sm font-medium">Rappels SMS rendez-vous</p>
                    <p className="text-sm text-gray-500">Recevoir les rappels J-1 et H-1 par SMS</p>
                  </div>
                </div>
                <Switch checked={isDemoMode ? true : notifySms} onCheckedChange={setNotifySms} disabled={isDemoMode} />
              </div>
              <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-white text-sm font-medium">Notifications Email</p>
                    <p className="text-sm text-gray-500">Recevoir les résumés hebdomadaires</p>
                  </div>
                </div>
                <Switch defaultChecked disabled={isDemoMode} />
              </div>
              <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-white text-sm font-medium">Langue</p>
                    <p className="text-sm text-gray-500">Français (Défaut)</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-[#D4AF37]" onClick={() => restrictedAction('Changer la langue')}>Modifier</Button>
              </div>
              <Button
                className="bg-[#D4AF37] text-black hover:bg-[#b5952f]"
                onClick={saveNotificationPrefs}
                disabled={savingNotifPrefs}
              >
                {savingNotifPrefs ? 'Enregistrement...' : 'Enregistrer préférences notifications'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StudentProfilePage;