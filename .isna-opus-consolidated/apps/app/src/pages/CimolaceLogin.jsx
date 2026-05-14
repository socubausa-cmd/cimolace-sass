/**
 * ═══════════════════════════════════════════════════════════════
 * CIMOLACE LOGIN PAGE
 * Page de connexion CIMOLACE avec branding propre
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Mail, Lock, ArrowRight } from 'lucide-react';
import { cimolacePlatformConfig } from '@/tenants/cimolace/cimolacePlatform.config';

const CimolaceLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // TODO: Implement actual login logic with Supabase
    setTimeout(() => {
      setLoading(false);
      navigate('/cimolace/admin');
    }, 1000);
  };

  return (
    <>
      <Helmet>
        <title>Connexion | CIMOLACE</title>
        <meta name="description" content="Connectez-vous à votre espace CIMOLACE" />
        <meta name="theme-color" content="#0a0a0f" />
        <link rel="icon" type="image/png" href="/logo.png" />
      </Helmet>

      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-6 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[150px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[150px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative w-full max-w-md"
        >
          {/* Logo */}
          <Link to="/cimolace" className="flex items-center gap-3 justify-center mb-8">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-xl blur-lg opacity-50" />
              <div className="relative w-full h-full bg-gradient-to-br from-violet-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
            </div>
            <div>
              <span className="text-2xl font-bold text-white tracking-tight">CIMOLACE</span>
              <span className="block text-[10px] text-violet-400 tracking-[0.2em] uppercase">{cimolacePlatformConfig.logoTagline}</span>
            </div>
          </Link>

          {/* Login Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
            <h1 className="text-2xl font-bold text-white mb-2">Bienvenue</h1>
            <p className="text-gray-400 mb-8">Connectez-vous à votre espace CIMOLACE</p>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                    placeholder="votre@email.com"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {/* Forgot Password */}
              <div className="text-right">
                <Link to="/cimolace/forgot-password" className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
                  Mot de passe oublié ?
                </Link>
              </div>

              {/* Submit Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  'Connexion...'
                ) : (
                  <>
                    Se connecter
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-[#0a0a0f] text-gray-500">ou</span>
              </div>
            </div>

            {/* Sign Up Link */}
            <p className="text-center text-gray-400">
              Pas encore de compte ?{' '}
              <Link to="/cimolace/signup" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
                Créer un compte
              </Link>
            </p>
          </div>

          {/* Back to Home */}
          <div className="text-center mt-8">
            <Link to="/cimolace" className="text-sm text-gray-500 hover:text-white transition-colors">
              ← Retour à l'accueil
            </Link>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default CimolaceLogin;
