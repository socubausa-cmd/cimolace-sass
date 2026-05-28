import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Heart, LogIn } from 'lucide-react';

export function PatientLogin() {
  const { signIn, signUp, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try { if (isSignUp) await signUp(email, password); else await signIn(email, password); }
    catch (err: any) { setError(err.message || 'Erreur'); }
  };
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ecfdf5' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}><Heart size={40} color="#0f766e" /><h1 style={{ fontSize: 24, fontWeight: 700, marginTop: 12 }}>Espace Patient</h1><p style={{ color: '#64748b', marginTop: 4 }}>MedOS</p></div>
        {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: 10, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{error}</div>}
        <form onSubmit={submit}>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" required style={{ width: '100%', padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, marginBottom: 12 }} />
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Mot de passe" type="password" required minLength={6} style={{ width: '100%', padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, marginBottom: 20 }} />
          <button type="submit" disabled={loading} style={{ width: '100%', padding: 12, background: '#0f766e', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><LogIn size={18} /> {isSignUp ? 'Creer mon espace' : 'Acceder'}</button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#64748b' }}>{isSignUp ? 'Deja un espace ?' : 'Premiere visite ?'} <button onClick={() => setIsSignUp(!isSignUp)} style={{ color: '#0f766e', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>{isSignUp ? 'Se connecter' : 'Creer'}</button></p>
      </div>
    </div>
  );
}
