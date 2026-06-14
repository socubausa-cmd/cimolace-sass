import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Lock, User, AlertCircle, CheckCircle2, ShieldCheck, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';

const SignupPage = () => {
  const [searchParams] = useSearchParams();

  // Détecte si l'utilisateur arrive depuis un choix de forfait payant
  const redirectParam = searchParams.get('redirect') || '';
  const isPaidFlow = redirectParam.includes('paiements');

  // Nom lisible du cycle — passé explicitement par ForfaitsPage (?planLabel=Académique)
  // ou extrait en fallback depuis le redirect (?plan=...)
  const planLabel = (() => {
    const explicit = searchParams.get('planLabel');
    if (explicit) return explicit;
    try {
      const innerParams = new URLSearchParams(redirectParam.split('?')[1] || '');
      return innerParams.get('plan') || '';
    } catch { return ''; }
  })();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signup, loginWithOAuth } = useAuth();
  const navigate = useNavigate();
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignup = async () => {
    setSubmitError('');
    setGoogleLoading(true);
    try {
      const redirectTo = searchParams.get('redirect') || ELEVE_MOBILE.home;
      // Stores the next path so AuthCallbackPage redirects correctly
      try { localStorage.setItem('oauth_next_path', redirectTo); } catch { /* ignore */ }
      const { error } = await loginWithOAuth('google', redirectTo);
      if (error) throw error;
    } catch (err) {
      setSubmitError(err.message || 'Erreur connexion Google.');
      setGoogleLoading(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.fullName.trim()) errors.fullName = "Le nom complet est requis";
    if (!formData.email) errors.email = "L'email est requis";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = "Format d'email invalide";
    
    if (!formData.password) errors.password = "Le mot de passe est requis";
    else if (formData.password.length < 8) errors.password = "Le mot de passe doit contenir au moins 8 caractères";
    
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = "Les mots de passe ne correspondent pas";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    try {
      const { error } = await signup(formData.email, formData.password, {
        full_name: formData.fullName,
        role: 'visitor'
      });

      if (error) {
        throw error;
      }

      // Redirige vers le paramètre `redirect` (lien d'invitation, paiement, etc.)
      // ou par défaut vers les forfaits pour que le nouvel inscrit choisisse un plan
      const redirectTo = searchParams.get('redirect') || '/forfaits';
      navigate(redirectTo);

    } catch (err) {
      console.error("Signup error:", err);
      if (err.message.includes("User already registered")) {
        setSubmitError("Un compte existe déjà avec cette adresse email.");
      } else {
        setSubmitError(err.message || "Une erreur est survenue lors de l'inscription.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const PERKS = isPaidFlow ? [
    { icon: ShieldCheck,  text: 'Compte sécurisé créé en 30 secondes' },
    { icon: CreditCard,   text: 'Paiement sécurisé — Chariow (carte ou mobile money)' },
    { icon: CheckCircle2, text: 'Accès immédiat à votre espace élève après paiement' },
    { icon: CheckCircle2, text: 'Suivi de progression, cours live et bibliothèque inclus' },
  ] : [
    { icon: CheckCircle2, text: 'Accès immédiat aux 21 modules de formation' },
    { icon: CheckCircle2, text: 'Bibliothèque du Savoir complète' },
    { icon: CheckCircle2, text: 'Espace élève personnel avec suivi de progression' },
    { icon: CheckCircle2, text: 'Cours en direct et sessions de coaching' },
  ];

  return (
    <div className="min-h-screen bg-[#0F1419] flex">
      <Helmet><title>Inscription | PRORASCIENCE ACADEMY</title></Helmet>

      {/* ── LEFT PANEL – branding ── */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F1419] via-[#192734] to-[#0F1419]" />
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-violet-900/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMC4yIiBzdHJva2Utb3BhY2l0eT0iMC4wNSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-40" />

        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-3">
            <img
              src="/logo.svg"
              alt=""
              className="h-11 w-auto max-w-[220px] object-contain opacity-[0.98]"
            />
            <div>
              <span className="block font-serif text-2xl font-bold text-white tracking-wider">PRORASCIENCE</span>
              <span className="block text-[0.65rem] text-[var(--school-accent)] tracking-[0.4em] uppercase mt-0.5">Academy · ISNA</span>
            </div>
          </Link>
        </div>

        <div className="relative z-10 space-y-6">
          <div>
            {isPaidFlow ? (
              <>
                <h2 className="text-3xl font-serif font-bold text-white leading-snug mb-2">
                  {planLabel ? (
                    <>Une dernière étape<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--school-accent)] to-yellow-400">
                      pour rejoindre {planLabel}
                    </span></>
                  ) : (
                    <>Créez votre compte<br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--school-accent)] to-yellow-400">
                      pour finaliser l&apos;inscription
                    </span></>
                  )}
                </h2>
                <p className="text-gray-400 text-sm">Votre compte sera créé, puis vous serez redirigé vers le paiement sécurisé.</p>
              </>
            ) : (
              <>
                <h2 className="text-3xl font-serif font-bold text-white leading-snug mb-2">
                  Rejoignez l&apos;élite<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--school-accent)] to-yellow-400">
                    de la connaissance
                  </span>
                </h2>
                <p className="text-gray-400 text-sm">L&apos;Académie PRORASCIENCE — fondée par le 5ᵉ Manikongo.</p>
              </>
            )}
          </div>

          <div className="space-y-3 pt-2">
            {PERKS.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-[var(--school-accent)] shrink-0" />
                <span className="text-sm text-gray-300">{text}</span>
              </div>
            ))}
          </div>

          {isPaidFlow ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] mt-4">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--school-accent)]" />
              <span className="text-[var(--school-accent)] text-xs font-bold uppercase tracking-widest">Inscription · Paiement sécurisé</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] mt-4">
              <span className="text-[var(--school-accent)] text-xs font-bold uppercase tracking-widest">Accès gratuit · Immédiat</span>
            </div>
          )}
        </div>

        <div className="relative z-10">
          <p className="text-xs text-gray-600">© {new Date().getFullYear()} PRORASCIENCE · NGOWAZULU · ISNA</p>
        </div>
      </div>

      {/* ── RIGHT PANEL – form ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-16">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="inline-flex flex-col items-center gap-2">
              <img
                src="/logo.svg"
                alt=""
                className="h-11 w-auto max-w-[min(260px,82vw)] object-contain py-1"
              />
              <span className="font-serif text-2xl font-bold text-white tracking-wider">PRORASCIENCE</span>
              <span className="text-[0.6rem] text-[var(--school-accent)] tracking-[0.3em] uppercase">Academy</span>
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-serif font-bold text-white mb-2">Créer un compte</h1>
            {isPaidFlow ? (
              <p className="text-gray-400 text-sm">
                Créez votre compte, puis vous serez dirigé vers le paiement sécurisé.
              </p>
            ) : (
              <p className="text-gray-400 text-sm">Inscription gratuite — création de votre profil prospect.</p>
            )}
          </div>

          {submitError && (
            <Alert variant="destructive" className="mb-5 bg-red-900/20 border-red-900/50 text-red-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          {/* ── Bouton Google ── */}
          <Button
            type="button"
            variant="outline"
            className="mb-5 h-12 w-full border-white/10 text-white hover:bg-white/5"
            style={{ background: 'rgba(255,255,255,0.04)' }}
            onClick={handleGoogleSignup}
            disabled={googleLoading || isLoading}
          >
            {googleLoading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Redirection Google...</>
            ) : (
              <>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {isPaidFlow ? "Continuer avec Google" : "S'inscrire avec Google"}
              </>
            )}
          </Button>

          <div className="mb-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-gray-500">ou par email</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-gray-300 text-sm">Nom complet</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input id="fullName" name="fullName" placeholder="Prénom Nom"
                  value={formData.fullName} onChange={handleChange}
                  className={`pl-10 h-11 bg-[#192734] border-white/10 text-white focus:border-[var(--school-accent)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] ${formErrors.fullName ? 'border-red-500' : ''}`}
                />
              </div>
              {formErrors.fullName && <p className="text-xs text-red-400">{formErrors.fullName}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-gray-300 text-sm">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input id="email" name="email" type="email" autoComplete="email" placeholder="exemple@email.com"
                  value={formData.email} onChange={handleChange}
                  className={`pl-10 h-11 bg-[#192734] border-white/10 text-white focus:border-[var(--school-accent)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] ${formErrors.email ? 'border-red-500' : ''}`}
                />
              </div>
              {formErrors.email && <p className="text-xs text-red-400">{formErrors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-gray-300 text-sm">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input id="password" name="password" type="password" autoComplete="new-password" placeholder="••••••••"
                  value={formData.password} onChange={handleChange}
                  className={`pl-10 h-11 bg-[#192734] border-white/10 text-white focus:border-[var(--school-accent)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] ${formErrors.password ? 'border-red-500' : ''}`}
                />
              </div>
              {formErrors.password && <p className="text-xs text-red-400">{formErrors.password}</p>}
              {formData.password && (
                <div className="flex gap-1 h-1 mt-1">
                  <div className={`flex-1 rounded-full transition-colors ${formData.password.length > 0 ? 'bg-red-500' : 'bg-white/10'}`} />
                  <div className={`flex-1 rounded-full transition-colors ${formData.password.length >= 6 ? 'bg-yellow-500' : 'bg-white/10'}`} />
                  <div className={`flex-1 rounded-full transition-colors ${formData.password.length >= 8 ? 'bg-green-500' : 'bg-white/10'}`} />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-gray-300 text-sm">Confirmer le mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" placeholder="••••••••"
                  value={formData.confirmPassword} onChange={handleChange}
                  className={`pl-10 h-11 bg-[#192734] border-white/10 text-white focus:border-[var(--school-accent)] focus:ring-1 focus:ring-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] ${formErrors.confirmPassword ? 'border-red-500' : ''}`}
                />
              </div>
              {formErrors.confirmPassword && <p className="text-xs text-red-400">{formErrors.confirmPassword}</p>}
            </div>

            <Button type="submit"
              className="w-full h-11 bg-[var(--school-accent)] hover:bg-[#bfa345] text-black font-bold text-base tracking-wide mt-2"
              disabled={isLoading}
            >
              {isLoading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Création en cours...</>
                : isPaidFlow
                  ? <><CreditCard className="mr-2 h-4 w-4" />Créer mon compte et payer</>
                  : "S'inscrire gratuitement"
              }
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            Déjà inscrit ?{' '}
            <Link
              to={redirectParam ? `/login?redirect=${encodeURIComponent(redirectParam)}` : '/login'}
              className="text-[var(--school-accent)] hover:underline font-medium"
            >Se connecter</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default SignupPage;