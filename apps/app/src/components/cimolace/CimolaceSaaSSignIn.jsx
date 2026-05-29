import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, ArrowRight, Loader2, Zap, Globe, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Animated grid background ─── */
const GridBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f12_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f12_1px,transparent_1px)] bg-[size:48px_48px]" />
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-violet-600/10 rounded-full blur-[140px]" />
    <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-cyan-500/6 rounded-full blur-[120px]" />
  </div>
);

/* ─── Floating stat pill ─── */
const StatPill = ({ icon: Icon, label, value, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    className="flex items-center gap-3 px-4 py-2.5 rounded-2xl"
    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
  >
    <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ background: 'rgba(139,92,246,0.15)' }}>
      <Icon size={14} className="text-violet-400" />
    </span>
    <div>
      <div className="text-xs font-black text-white leading-none">{value}</div>
      <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</div>
    </div>
  </motion.div>
);

/* ─── Module badge chip ─── */
const ModuleChip = ({ name, color, delay }) => (
  <motion.span
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay, duration: 0.4 }}
    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold"
    style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
  >
    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
    {name}
  </motion.span>
);

/* ──────────────────────────────────────────────
   CimolaceSaaSSignIn — composant visuel pur
   Props: onSubmit, onGoogleLogin, isLoading, error,
          onForgotPassword, onSignup
─────────────────────────────────────────────── */
export function CimolaceSaaSSignIn({
  onSubmit,
  onGoogleLogin,
  isLoading = false,
  error = '',
  onForgotPassword,
  onSignup,
}) {
  const [showPw,   setShowPw]   = useState(false);
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [hovered,  setHovered]  = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.({ email, password });
  };

  const modules = [
    { name: 'Virtuel Mbolo™',    color: '#8b5cf6' },
    { name: 'Payflow Africa™',   color: '#f59e0b' },
    { name: 'LIRI AI Core™',     color: '#06b6d4' },
    { name: 'Smart Logistics™',  color: '#10b981' },
    { name: 'LIRI Live Engine™', color: '#ec4899' },
    { name: 'LIRI EDU Core™',    color: '#34d399' },
  ];

  return (
    <div
      className="min-h-screen w-full flex items-stretch"
      style={{ background: '#07060f' }}
    >
      {/* ── LEFT PANEL — branding + social proof ── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-12 overflow-hidden">
        <GridBackground />

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 flex items-center gap-3"
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-lg shadow-lg"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}
          >
            C
          </div>
          <div>
            <div className="font-black text-white text-lg tracking-tight leading-none">CIMOLACE</div>
            <div className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'rgba(139,92,246,0.7)' }}>
              SaaS Platform
            </div>
          </div>
        </motion.div>

        {/* Hero text */}
        <div className="relative z-10 space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="text-5xl xl:text-6xl font-black text-white leading-[1.08] tracking-tight mb-5">
              L'infrastructure<br />
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa 0%, #34d399 100%)' }}
              >
                intelligente<br />africaine.
              </span>
            </h1>
            <p className="text-base leading-relaxed max-w-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Une plateforme. Plusieurs intelligences. Gérez votre commerce, vos paiements, votre logistique et votre croissance depuis un seul espace.
            </p>
          </motion.div>

          {/* Module chips */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap gap-2"
          >
            {modules.map((m, i) => (
              <ModuleChip key={m.name} name={m.name} color={m.color} delay={0.5 + i * 0.07} />
            ))}
          </motion.div>

          {/* Stats */}
          <div className="flex flex-wrap gap-3">
            <StatPill icon={Globe}       label="Pays couverts"   value="12"    delay={0.9} />
            <StatPill icon={Zap}         label="Modules actifs"  value="10+"   delay={1.0} />
            <StatPill icon={ShieldCheck} label="Uptime garanti"  value="99.9%" delay={1.1} />
          </div>
        </div>

        {/* Bottom quote */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.3 }}
          className="relative z-10"
        >
          <div
            className="px-5 py-4 rounded-2xl text-sm italic"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}
          >
            "CIMOLACE m'a permis de lancer ma boutique, gérer mes livraisons et accepter des paiements mobile — tout en une semaine."
            <div className="mt-2 text-xs font-semibold not-italic" style={{ color: 'rgba(167,139,250,0.7)' }}>
              — Aminata K., Lagos
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── RIGHT PANEL — form ── */}
      <div
        className="w-full lg:w-[48%] flex items-center justify-center p-6 lg:p-12 relative"
        style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* Mobile logo */}
        <div className="absolute top-6 left-6 flex items-center gap-2 lg:hidden">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-sm"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>C</div>
          <span className="font-black text-white text-base">CIMOLACE</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <div className="mb-8">
            <h2 className="text-3xl font-black text-white mb-2">Connexion</h2>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Accède à ton espace opérateur CIMOLACE
            </p>
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={() => onGoogleLogin?.()}
            className="w-full flex items-center justify-center gap-3 rounded-xl p-3.5 mb-6 text-sm font-semibold text-white transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            onMouseOut={(e)  => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
          >
            <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuer avec Google
          </button>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3" style={{ background: '#07060f', color: 'rgba(255,255,255,0.25)' }}>ou avec ton email</span>
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-5 px-4 py-3 rounded-xl text-sm text-red-400"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-bold mb-2 uppercase tracking-widest" style={{ color: 'rgba(167,139,250,0.7)' }}>
                Email professionnel
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@entreprise.com"
                required
                className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', caretColor: '#a78bfa' }}
                onFocus={(e)  => { e.target.style.borderColor = 'rgba(139,92,246,0.6)'; e.target.style.background = 'rgba(139,92,246,0.05)'; }}
                onBlur={(e)   => { e.target.style.borderColor = 'rgba(255,255,255,0.1)';  e.target.style.background = 'rgba(255,255,255,0.04)'; }}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold mb-2 uppercase tracking-widest" style={{ color: 'rgba(167,139,250,0.7)' }}>
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  required
                  className="w-full rounded-xl px-4 py-3 pr-12 text-sm text-white outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', caretColor: '#a78bfa' }}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(139,92,246,0.6)'; e.target.style.background = 'rgba(139,92,246,0.05)'; }}
                  onBlur={(e)  => { e.target.style.borderColor = 'rgba(255,255,255,0.1)';  e.target.style.background = 'rgba(255,255,255,0.04)'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute inset-y-0 right-4 flex items-center transition-colors"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                  onMouseOver={(e) => e.currentTarget.style.color = 'rgba(167,139,250,0.8)'}
                  onMouseOut={(e)  => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Forgot */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onForgotPassword?.()}
                className="text-xs transition-colors"
                style={{ color: 'rgba(167,139,250,0.6)' }}
                onMouseOver={(e) => e.currentTarget.style.color = '#a78bfa'}
                onMouseOut={(e)  => e.currentTarget.style.color = 'rgba(167,139,250,0.6)'}
              >
                Mot de passe oublié ?
              </button>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onHoverStart={() => setHovered(true)}
              onHoverEnd={() => setHovered(false)}
              className="relative w-full overflow-hidden rounded-xl py-3.5 text-sm font-black text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #06b6d4 100%)',
                boxShadow: hovered ? '0 12px 40px rgba(124,58,237,0.4)' : '0 4px 20px rgba(124,58,237,0.2)',
              }}
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  Accéder à mon espace
                  <ArrowRight size={16} />
                </>
              )}
              {hovered && !isLoading && (
                <motion.span
                  initial={{ left: '-100%' }}
                  animate={{ left: '100%' }}
                  transition={{ duration: 0.9, ease: 'easeInOut' }}
                  className="absolute top-0 bottom-0 w-24 pointer-events-none"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)', filter: 'blur(6px)' }}
                />
              )}
            </motion.button>
          </form>

          {/* Signup */}
          <p className="mt-6 text-center text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Pas encore de compte CIMOLACE ?{' '}
            <button
              onClick={() => onSignup?.()}
              className="font-bold transition-colors"
              style={{ color: 'rgba(167,139,250,0.8)' }}
              onMouseOver={(e) => e.currentTarget.style.color = '#a78bfa'}
              onMouseOut={(e)  => e.currentTarget.style.color = 'rgba(167,139,250,0.8)'}
            >
              Créer un compte opérateur →
            </button>
          </p>

          {/* Trust badges */}
          <div className="mt-8 flex items-center justify-center gap-4">
            {['SSL sécurisé', 'RGPD conforme', 'Données en Afrique'].map((t) => (
              <span key={t} className="flex items-center gap-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                <ShieldCheck size={10} className="text-green-500/50" />
                {t}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default CimolaceSaaSSignIn;
