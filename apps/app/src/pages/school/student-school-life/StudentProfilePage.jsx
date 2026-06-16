import React, { useEffect, useRef, useState } from 'react';
import {
  UserCircle, User, Phone, Mail, Lock, Bell, Globe, Shield,
  ShieldCheck, Camera, Save, Loader2, CheckCircle2, AlertCircle,
  QrCode, KeyRound, X, Copy,
} from 'lucide-react';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
// Thème host-aware : `T` = tokens vivants (clair sous l'espace élève, sombre sous le portail prof).
import { themeProxy as T, useSslThemeMode } from '@/pages/school/student-school-life/sslTheme';

/* ─── Boutons ─── */
const Btn = ({ children, onClick, variant = 'ghost', disabled, title, type, style: extra }) => {
  const [hov, setHov] = useState(false);
  const gold = variant === 'gold';
  const style = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 10,
    padding: '9px 15px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit',
    cursor: disabled ? 'default' : 'pointer', textDecoration: 'none',
    transition: 'all 150ms ease', whiteSpace: 'nowrap',
    background: gold ? (hov && !disabled ? '#E5C66B' : T.gold) : (hov && !disabled ? T.surface2 : 'transparent'),
    color: gold ? '#000' : (hov && !disabled ? T.t1 : T.t2),
    border: gold ? '1px solid transparent' : `1px solid ${hov && !disabled ? T.borderMid : T.border}`,
    opacity: disabled ? 0.55 : 1, ...extra,
  };
  return (
    <button
      type={type || 'button'} onClick={onClick} disabled={disabled} style={style} title={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    >
      {children}
    </button>
  );
};

/* ─── Carte premium ─── */
const Card = ({ children, style: extra }) => (
  <div style={{
    background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 16,
    padding: 20, ...extra,
  }}>
    {children}
  </div>
);

const CardTitle = ({ icon: Icon, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 }}>
    {Icon && <Icon size={16} color={T.gold} />}
    <h2 style={{ fontSize: 15, fontWeight: 700, color: T.t1, margin: 0, letterSpacing: '-0.01em' }}>{children}</h2>
  </div>
);

/* ─── Champ texte premium ─── */
const Field = ({ label, icon: Icon, value, onChange, placeholder, disabled, type }) => {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <label style={{ fontSize: 11.5, fontWeight: 600, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9,
        background: disabled ? 'rgba(0,0,0,0.28)' : T.surface,
        border: `1px solid ${focus ? T.goldMid : T.border}`,
        borderRadius: 10, padding: '10px 12px', transition: 'border-color 150ms ease',
        opacity: disabled ? 0.7 : 1,
      }}>
        {Icon && <Icon size={15} color={focus ? T.gold : T.t3} style={{ flexShrink: 0, transition: 'color 150ms ease' }} />}
        <input
          type={type || 'text'}
          value={value}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none',
            color: disabled ? T.t2 : T.t1, fontSize: 13.5, fontFamily: 'inherit',
            cursor: disabled ? 'not-allowed' : 'text',
          }}
        />
      </div>
    </div>
  );
};

/* ─── Interrupteur (switch) ─── */
const Toggle = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={!!checked}
    disabled={disabled}
    onClick={() => !disabled && onChange && onChange(!checked)}
    style={{
      position: 'relative', width: 42, height: 24, borderRadius: 999, flexShrink: 0,
      background: checked ? T.gold : 'rgba(255,255,255,0.10)',
      border: `1px solid ${checked ? 'transparent' : T.border}`,
      cursor: disabled ? 'not-allowed' : 'pointer', padding: 0,
      transition: 'background 180ms ease', opacity: disabled ? 0.5 : 1,
    }}
  >
    <span style={{
      position: 'absolute', top: 2, left: checked ? 20 : 2,
      width: 18, height: 18, borderRadius: '50%',
      background: checked ? '#000' : T.t2,
      transition: 'left 180ms ease, background 180ms ease',
    }} />
  </button>
);

/* ─── Rangée préférence (icône + libellé + contrôle) ─── */
const PrefRow = ({ icon: Icon, title, hint, children }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
    background: 'rgba(0,0,0,0.22)', border: `1px solid ${T.border}`,
    borderRadius: 12, padding: '13px 14px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        background: 'rgba(0,0,0,0.28)', border: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} color={T.t2} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 13.5, fontWeight: 600, color: T.t1, margin: 0 }}>{title}</p>
        {hint && <p style={{ fontSize: 11.5, color: T.t3, margin: '2px 0 0' }}>{hint}</p>}
      </div>
    </div>
    <div style={{ flexShrink: 0 }}>{children}</div>
  </div>
);

/* ─── Ligne de statut (succès / erreur / info) ─── */
const StatusLine = ({ msg }) => {
  if (!msg?.text) return null;
  const err = msg.type === 'error';
  const info = msg.type === 'info';
  const Icon = err ? AlertCircle : (info ? Loader2 : CheckCircle2);
  const col = err ? T.danger : (info ? T.gold : T.success);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: col,
      animation: 'spFade .3s ease both',
    }}>
      <Icon size={14} style={info ? { animation: 'spSpin 1s linear infinite' } : undefined} />
      {' '}<span style={{ color: err ? T.danger : T.t2 }}>{msg.text}</span>
    </div>
  );
};

/* ═══════════════════════ PAGE ═══════════════════════ */
const StudentProfilePage = () => {
  useSslThemeMode(); // publie le mode (clair/sombre) pour `T` AVANT le rendu des sous-composants
  const { user, updatePassword } = useAuth();
  const { isDemoMode, demoData, restrictedAction } = useDemoMode();

  const [profile, setProfile] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notifySms, setNotifySms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [infoMsg, setInfoMsg] = useState(null);   // Informations personnelles
  const [prefMsg, setPrefMsg] = useState(null);   // Préférences
  const [secMsg, setSecMsg] = useState(null);     // Sécurité (mot de passe)

  /* ─── Avatar (upload réel Supabase Storage) ─── */
  const fileInputRef = useRef(null);
  const [avatarUrl, setAvatarUrl] = useState(null);   // override local après upload
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState(null);

  /* ─── 2FA (Supabase MFA TOTP) ─── */
  const [mfaFactor, setMfaFactor] = useState(null);   // facteur TOTP vérifié existant
  const [mfaLoading, setMfaLoading] = useState(false); // chargement liste facteurs
  const [mfaBusy, setMfaBusy] = useState(false);       // action en cours (enroll/verify/unenroll)
  const [enroll, setEnroll] = useState(null);          // { factorId, qr, secret } pendant l'inscription
  const [mfaCode, setMfaCode] = useState('');
  const [mfaMsg, setMfaMsg] = useState(null);

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
      setName(String(row.name || ''));
      setPhone(String(row.phone || ''));
      setNotifySms(row.notify_sms === true);
    };
    void load();
    return () => {
      alive = false;
    };
  }, [isDemoMode, user?.avatar_url, user?.email, user?.id, user?.name, user?.phone, user?.role]);

  /* Charger les facteurs MFA existants (hors démo) */
  const refreshMfaFactors = async () => {
    setMfaLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const totp = (data?.totp || data?.all || []).find(
        (f) => f.factor_type === 'totp' && f.status === 'verified'
      );
      setMfaFactor(totp || null);
    } catch (e) {
      setMfaMsg({ type: 'error', text: `Erreur 2FA : ${e.message || e}` });
    } finally {
      setMfaLoading(false);
    }
  };

  useEffect(() => {
    if (isDemoMode || !user?.id) return;
    let alive = true;
    (async () => {
      setMfaLoading(true);
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        if (!alive) return;
        const totp = (data?.totp || data?.all || []).find(
          (f) => f.factor_type === 'totp' && f.status === 'verified'
        );
        setMfaFactor(totp || null);
      } catch (e) {
        if (alive) setMfaMsg({ type: 'error', text: `Erreur 2FA : ${e.message || e}` });
      } finally {
        if (alive) setMfaLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isDemoMode, user?.id]);

  const effectiveProfile = isDemoMode ? demoData?.profile : (profile || user || null);
  const email = effectiveProfile?.email || 'email@example.com';
  const fallbackName = String(email).split('@')[0].split('.')[0] || 'Étudiant';
  const displayName = effectiveProfile?.name || fallbackName;
  const role = effectiveProfile?.role;
  const roleLabel = role === 'student' ? 'Étudiant' : (role === 'teacher' ? 'Enseignant' : 'Invité');
  const avatarSrc = isDemoMode
    ? (effectiveProfile?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`)
    : (avatarUrl || effectiveProfile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`);

  const saveProfile = async () => {
    if (isDemoMode) {
      restrictedAction('Enregistrer les modifications');
      return;
    }
    if (!user?.id) return;
    setSaving(true);
    setInfoMsg(null);
    const mergedName = String(name || '').trim();
    const { error } = await supabase
      .from('profiles')
      .update({
        name: mergedName || displayName,
        phone: String(phone || '').trim() || null,
      })
      .eq('id', user.id);
    setSaving(false);
    setInfoMsg(
      error
        ? { type: 'error', text: `Erreur : ${error.message}` }
        : { type: 'success', text: 'Profil mis à jour.' }
    );
  };

  const saveNotificationPrefs = async () => {
    if (isDemoMode) {
      restrictedAction('Enregistrer les préférences notifications');
      return;
    }
    if (!user?.id) return;
    setSavingPrefs(true);
    setPrefMsg(null);
    const { error } = await supabase
      .from('profiles')
      .update({
        notify_sms: notifySms === true,
      })
      .eq('id', user.id);
    setSavingPrefs(false);
    setPrefMsg(
      error
        ? { type: 'error', text: `Erreur préférences : ${error.message}` }
        : { type: 'success', text: 'Préférences mises à jour.' }
    );
  };

  const changePassword = async () => {
    if (isDemoMode) {
      restrictedAction('Changer le mot de passe');
      return;
    }
    const next = window.prompt('Nouveau mot de passe (min. 6 caractères) :');
    if (!next || next.length < 6) {
      if (next != null) setSecMsg({ type: 'error', text: 'Mot de passe trop court (min. 6 caractères).' });
      return;
    }
    setSecMsg(null);
    const { error } = await updatePassword(next);
    setSecMsg(
      error
        ? { type: 'error', text: `Erreur : ${error.message}` }
        : { type: 'success', text: 'Mot de passe mis à jour.' }
    );
  };

  /* ─── Avatar : ouvrir le sélecteur de fichier ─── */
  const pickAvatar = () => {
    if (isDemoMode) {
      restrictedAction('Changer la photo');
      return;
    }
    fileInputRef.current?.click();
  };

  /* ─── Avatar : upload réel vers le bucket 'avatars' ─── */
  const onAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = '';   // reset pour pouvoir re-choisir le même fichier
    if (!file) return;
    if (isDemoMode) {
      restrictedAction('Changer la photo');
      return;
    }
    if (!user?.id) return;
    if (!file.type.startsWith('image/')) {
      setAvatarMsg({ type: 'error', text: 'Veuillez choisir un fichier image.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarMsg({ type: 'error', text: 'Image trop volumineuse (max 5 Mo).' });
      return;
    }

    setAvatarUploading(true);
    setAvatarMsg({ type: 'info', text: 'Téléversement en cours…' });
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const path = `${user.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase
        .storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) throw new Error('URL publique introuvable.');

      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);
      if (dbErr) throw dbErr;

      setAvatarUrl(publicUrl);
      setProfile((p) => (p ? { ...p, avatar_url: publicUrl } : p));
      setAvatarMsg({ type: 'success', text: 'Photo mise à jour.' });
    } catch (err) {
      setAvatarMsg({ type: 'error', text: `Erreur : ${err.message || err}` });
    } finally {
      setAvatarUploading(false);
    }
  };

  /* ─── 2FA : démarrer l'inscription TOTP ─── */
  const startEnroll = async () => {
    if (isDemoMode) {
      restrictedAction('Activer la 2FA');
      return;
    }
    setMfaBusy(true);
    setMfaMsg(null);
    setMfaCode('');
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      setEnroll({
        factorId: data.id,
        qr: data.totp?.qr_code || '',
        secret: data.totp?.secret || '',
      });
    } catch (e) {
      setMfaMsg({ type: 'error', text: `Erreur : ${e.message || e}` });
    } finally {
      setMfaBusy(false);
    }
  };

  /* ─── 2FA : annuler l'inscription en cours ─── */
  const cancelEnroll = async () => {
    const fid = enroll?.factorId;
    setEnroll(null);
    setMfaCode('');
    setMfaMsg(null);
    if (fid) {
      try { await supabase.auth.mfa.unenroll({ factorId: fid }); } catch { /* ignore */ }
    }
  };

  /* ─── 2FA : vérifier le code à 6 chiffres ─── */
  const verifyEnroll = async () => {
    if (!enroll?.factorId) return;
    const code = String(mfaCode || '').trim();
    if (code.length !== 6) {
      setMfaMsg({ type: 'error', text: 'Entrez le code à 6 chiffres.' });
      return;
    }
    setMfaBusy(true);
    setMfaMsg(null);
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enroll.factorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: enroll.factorId,
        challengeId: ch.id,
        code,
      });
      if (vErr) throw vErr;
      setEnroll(null);
      setMfaCode('');
      setMfaMsg({ type: 'success', text: '2FA activée.' });
      await refreshMfaFactors();
    } catch (e) {
      setMfaMsg({ type: 'error', text: `Code invalide : ${e.message || e}` });
    } finally {
      setMfaBusy(false);
    }
  };

  /* ─── 2FA : désactiver le facteur existant ─── */
  const disableMfa = async () => {
    if (isDemoMode) {
      restrictedAction('Désactiver la 2FA');
      return;
    }
    if (!mfaFactor?.id) return;
    if (!window.confirm('Désactiver la double authentification ?')) return;
    setMfaBusy(true);
    setMfaMsg(null);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactor.id });
      if (error) throw error;
      setMfaFactor(null);
      setMfaMsg({ type: 'success', text: '2FA désactivée.' });
    } catch (e) {
      setMfaMsg({ type: 'error', text: `Erreur : ${e.message || e}` });
    } finally {
      setMfaBusy(false);
    }
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(enroll?.secret || '');
      setMfaMsg({ type: 'success', text: 'Secret copié.' });
    } catch {
      setMfaMsg({ type: 'error', text: 'Copie impossible.' });
    }
  };

  return (
    <div style={{ paddingBottom: 8 }}>
      <style>{`
        @keyframes spFade { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes spIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes spSpin { to { transform: rotate(360deg) } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, background: T.goldDim, border: `1px solid ${T.goldMid}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <UserCircle size={22} color={T.gold} />
        </div>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.t1, letterSpacing: '-0.02em', lineHeight: 1.15, margin: 0 }}>
            Mon Profil
          </h1>
          <p style={{ fontSize: 13, color: T.t3, marginTop: 3 }}>
            {isDemoMode ? 'Profil fictif en mode démo.' : 'Gère tes informations et préférences.'}
          </p>
        </div>
      </div>

      {/* Grille responsive : 2 colonnes -> empilées sur écran étroit */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 360px) 1fr',
          gap: 18,
          alignItems: 'start',
          animation: 'spIn .4s ease both',
        }}
        className="isna-profile-grid"
      >
        {/* Forcer l'empilement sur mobile sans média query JS */}
        <style>{`
          @media (max-width: 820px) {
            .isna-profile-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>

        {/* ── Colonne gauche : Identité + Sécurité ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Carte identité */}
          <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{
              position: 'relative', width: 112, height: 112, borderRadius: '50%',
              padding: 3, background: `linear-gradient(135deg, ${T.gold}, rgba(212,175,55,0.35))`,
              marginBottom: 14,
            }}>
              <img
                src={avatarSrc}
                alt={displayName}
                style={{
                  width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover',
                  background: T.surface, display: 'block',
                }}
                onError={(e) => { e.currentTarget.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`; }}
              />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: T.t1, margin: 0, textTransform: 'capitalize' }}>
              {displayName}
            </h2>
            <p style={{ fontSize: 12.5, color: T.t3, margin: '4px 0 10px', wordBreak: 'break-all' }}>{email}</p>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontFamily: T.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em',
              color: T.gold, background: T.goldDim, border: `1px solid ${T.goldMid}`,
              borderRadius: 20, padding: '3px 11px', textTransform: 'uppercase',
            }}>
              {roleLabel}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onAvatarFile}
              style={{ display: 'none' }}
            />
            <Btn
              onClick={pickAvatar}
              disabled={avatarUploading}
              title={isDemoMode ? 'Indisponible en mode démo' : 'Choisir une nouvelle photo'}
              style={{ marginTop: 16, width: '100%' }}
            >
              {avatarUploading
                ? <Loader2 size={14} style={{ animation: 'spSpin 1s linear infinite' }} />
                : <Camera size={14} />}
              {avatarUploading ? 'Téléversement…' : 'Changer la photo'}
            </Btn>
            {avatarMsg?.text && (
              <div style={{ marginTop: 10 }}>
                <StatusLine msg={avatarMsg} />
              </div>
            )}
          </Card>

          {/* Carte sécurité */}
          <Card>
            <CardTitle icon={Shield}>Sécurité</CardTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Btn onClick={changePassword} style={{ width: '100%' }}>
                <Lock size={14} /> Changer le mot de passe
              </Btn>
              <StatusLine msg={secMsg} />

              {/* ── Double authentification (Supabase MFA TOTP) ── */}
              <PrefRow
                icon={ShieldCheck}
                title="Double authentification"
                hint={
                  isDemoMode
                    ? 'Indisponible en mode démo'
                    : (mfaLoading
                        ? 'Vérification…'
                        : (mfaFactor ? '2FA activée (TOTP)' : 'Protégez votre compte avec une app TOTP'))
                }
              >
                {isDemoMode ? (
                  <Btn onClick={() => restrictedAction('Activer la 2FA')} style={{ padding: '7px 12px' }}>
                    Activer
                  </Btn>
                ) : mfaLoading ? (
                  <Loader2 size={16} color={T.t3} style={{ animation: 'spSpin 1s linear infinite' }} />
                ) : mfaFactor ? (
                  <Btn
                    onClick={disableMfa}
                    disabled={mfaBusy}
                    style={{ padding: '7px 12px', color: T.danger, borderColor: T.border }}
                  >
                    {mfaBusy
                      ? <Loader2 size={14} style={{ animation: 'spSpin 1s linear infinite' }} />
                      : <X size={14} />}
                    Désactiver
                  </Btn>
                ) : (
                  <Btn
                    variant="gold"
                    onClick={enroll ? cancelEnroll : startEnroll}
                    disabled={mfaBusy}
                    style={{ padding: '7px 12px' }}
                  >
                    {mfaBusy && !enroll
                      ? <Loader2 size={14} style={{ animation: 'spSpin 1s linear infinite' }} />
                      : <ShieldCheck size={14} />}
                    {enroll ? 'Annuler' : 'Activer la 2FA'}
                  </Btn>
                )}
              </PrefRow>

              {/* Panneau d'inscription TOTP inline */}
              {!isDemoMode && enroll && (
                <div style={{
                  background: 'rgba(0,0,0,0.28)', border: `1px solid ${T.goldMid}`,
                  borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 14,
                  animation: 'spFade .3s ease both',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <QrCode size={15} color={T.gold} />
                    <p style={{ fontSize: 12.5, color: T.t2, margin: 0, lineHeight: 1.45 }}>
                      Scannez ce QR code avec votre application d'authentification
                      (Google Authenticator, Authy…), puis saisissez le code à 6 chiffres.
                    </p>
                  </div>

                  {enroll.qr && (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <img
                        src={enroll.qr}
                        alt="QR code 2FA"
                        style={{
                          width: 168, height: 168, borderRadius: 10,
                          background: '#fff', padding: 8, display: 'block',
                        }}
                      />
                    </div>
                  )}

                  {enroll.secret && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Clé secrète (saisie manuelle)
                      </label>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: T.surface, border: `1px solid ${T.border}`,
                        borderRadius: 9, padding: '8px 10px',
                      }}>
                        <KeyRound size={14} color={T.t3} style={{ flexShrink: 0 }} />
                        <code style={{
                          flex: 1, minWidth: 0, fontFamily: T.mono, fontSize: 12, color: T.t1,
                          wordBreak: 'break-all',
                        }}>
                          {enroll.secret}
                        </code>
                        <button
                          type="button"
                          onClick={copySecret}
                          title="Copier la clé"
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: T.t3, padding: 2, flexShrink: 0,
                          }}
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: T.t3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Code de vérification
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !mfaBusy) verifyEnroll(); }}
                      placeholder="000000"
                      style={{
                        background: T.surface, border: `1px solid ${T.border}`, borderRadius: 9,
                        padding: '11px 12px', color: T.t1, fontSize: 18, fontFamily: T.mono,
                        letterSpacing: '0.35em', textAlign: 'center', outline: 'none', width: '100%',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <Btn variant="gold" onClick={verifyEnroll} disabled={mfaBusy || mfaCode.length !== 6}>
                      {mfaBusy
                        ? <Loader2 size={14} style={{ animation: 'spSpin 1s linear infinite' }} />
                        : <CheckCircle2 size={14} />}
                      {mfaBusy ? 'Vérification…' : 'Vérifier et activer'}
                    </Btn>
                    <Btn onClick={cancelEnroll} disabled={mfaBusy}>Annuler</Btn>
                  </div>
                </div>
              )}

              <StatusLine msg={mfaMsg} />
            </div>
          </Card>
        </div>

        {/* ── Colonne droite : Infos perso + Préférences ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Informations personnelles */}
          <Card>
            <CardTitle icon={User}>Informations personnelles</CardTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field
                label="Nom"
                icon={User}
                value={isDemoMode ? displayName : name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ton nom complet"
                disabled={isDemoMode}
              />
              <Field
                label="Téléphone"
                icon={Phone}
                type="tel"
                value={isDemoMode ? '+33 6 12 34 56 78' : phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+33 6 00 00 00 00"
                disabled={isDemoMode}
              />
              <Field
                label="Email"
                icon={Mail}
                value={email}
                onChange={() => {}}
                disabled
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 2 }}>
                <Btn variant="gold" onClick={saveProfile} disabled={saving}>
                  {saving ? <Loader2 size={14} style={{ animation: 'spSpin 1s linear infinite' }} /> : <Save size={14} />}
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </Btn>
                <StatusLine msg={infoMsg} />
              </div>
            </div>
          </Card>

          {/* Préférences */}
          <Card>
            <CardTitle icon={Bell}>Préférences</CardTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <PrefRow
                icon={Bell}
                title="Rappels SMS"
                hint="Recevoir les rappels J-1 et H-1 par SMS"
              >
                <Toggle
                  checked={isDemoMode ? true : notifySms}
                  onChange={setNotifySms}
                  disabled={isDemoMode}
                />
              </PrefRow>
              <PrefRow
                icon={Globe}
                title="Langue"
                hint="Français (par défaut)"
              >
                <Btn onClick={() => restrictedAction('Changer la langue')} title="Bientôt disponible" style={{ padding: '7px 12px' }}>
                  Modifier
                </Btn>
              </PrefRow>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 2 }}>
                <Btn variant="gold" onClick={saveNotificationPrefs} disabled={savingPrefs}>
                  {savingPrefs ? <Loader2 size={14} style={{ animation: 'spSpin 1s linear infinite' }} /> : <Save size={14} />}
                  {savingPrefs ? 'Enregistrement…' : 'Enregistrer les préférences'}
                </Btn>
                <StatusLine msg={prefMsg} />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StudentProfilePage;
