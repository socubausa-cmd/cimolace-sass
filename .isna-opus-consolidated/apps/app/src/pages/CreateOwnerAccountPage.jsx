import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Loader2, CheckCircle2, AlertTriangle, Eye, EyeOff, X, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

const CreateOwnerAccountPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    password: '',
    passwordConfirm: ''
  });
  
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    hasMinLength: false,
    hasUpper: false,
    hasLower: false,
    hasNumber: false,
    hasSpecial: false
  });

  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [createdId, setCreatedId] = useState(null);

  // Password validation logic
  useEffect(() => {
    const pwd = formData.password;
    const strength = {
      hasMinLength: pwd.length >= 8,
      hasUpper: /[A-Z]/.test(pwd),
      hasLower: /[a-z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(pwd)
    };
    
    let score = 0;
    if (strength.hasMinLength) score++;
    if (strength.hasUpper) score++;
    if (strength.hasLower) score++;
    if (strength.hasNumber) score++;
    if (strength.hasSpecial) score++;
    
    setPasswordStrength({ ...strength, score });
  }, [formData.password]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear specific error on change
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!formData.email) newErrors.email = "L'email est requis.";
    else if (!emailRegex.test(formData.email)) newErrors.email = "Format d'email invalide.";
    
    if (!formData.fullName) newErrors.fullName = "Le nom complet est requis.";
    
    if (!formData.password) newErrors.password = "Le mot de passe est requis.";
    else if (passwordStrength.score < 5) newErrors.password = "Le mot de passe n'est pas assez fort.";

    if (formData.password !== formData.passwordConfirm) {
      newErrors.passwordConfirm = "Les mots de passe ne correspondent pas.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // Direct sign up using Supabase Auth
      // Note: This relies on "Enable email signups" being on in Supabase
      // and potentially requires disabling "Confirm email" if you want instant login,
      // or handling the confirmation flow. For an owner setup, usually this is done 
      // via a secure backend function or manually, but requested task specifies auth.signUp 
      // with metadata.
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            role: 'owner', // CRITICAL: Setting role in metadata
            status: 'active'
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        // Optional: Create record in public.users if your system requires it alongside Auth
        // Assuming RLS or triggers handle this, or we do it here if possible (requires open RLS)
        // For security, usually 'users' table is managed by Triggers from auth.users
        
        setSuccess(true);
        setCreatedId(data.user.id);
        toast({
          title: "Compte créé avec succès",
          description: "Redirection vers la page de connexion...",
          variant: "default",
        });

        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        // Case where email confirmation is required and user is not returned immediately active
         setSuccess(true);
         toast({
          title: "Vérifiez votre email",
          description: "Un lien de confirmation a été envoyé.",
          variant: "default",
        });
      }

    } catch (err) {
      console.error("Submission error:", err);
      setErrors({ form: err.message || "Échec de la création du compte." });
      toast({
        title: "Erreur",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const StrengthIndicator = ({ label, met }) => (
    <div className={`flex items-center text-xs ${met ? 'text-green-400' : 'text-gray-500'} transition-colors duration-300`}>
      {met ? <Check className="w-3 h-3 mr-1" /> : <div className="w-3 h-3 mr-1 rounded-full border border-gray-600" />}
      {label}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F1419] via-[#1a2c3b] to-[#0F1419] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-[#D4AF37]/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full relative z-10"
      >
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.1 }}
            className="w-20 h-20 bg-[#192734] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#D4AF37]/30 shadow-[0_0_30px_rgba(212,175,55,0.15)]"
          >
            <ShieldCheck className="w-10 h-10 text-[#D4AF37]" />
          </motion.div>
          <h1 className="text-3xl font-serif font-bold text-white mb-2">Initialisation Système</h1>
          <p className="text-gray-400">Configuration du compte Propriétaire (Owner)</p>
        </div>

        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Card className="bg-[#192734]/90 backdrop-blur-sm border-green-500/50 shadow-2xl">
                <CardContent className="pt-8 pb-8 text-center space-y-6">
                  <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-10 h-10 text-green-500" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">Compte Créé !</h2>
                    <p className="text-gray-300">Les privilèges administrateur ont été configurés.</p>
                  </div>
                  {createdId && (
                    <div className="bg-black/30 p-3 rounded-lg border border-white/5 font-mono text-xs text-green-400 break-all">
                      ID: {createdId}
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-2 text-sm text-[#D4AF37] animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Redirection vers la connexion...
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card className="bg-[#192734]/80 backdrop-blur-md border-white/10 text-white shadow-xl">
                <CardHeader>
                  <CardTitle className="text-xl">Informations du Compte</CardTitle>
                  <CardDescription className="text-gray-400">
                    Tous les champs sont obligatoires pour la sécurité du compte.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {errors.form && (
                    <Alert variant="destructive" className="mb-6 border-red-500/50 bg-red-900/20 text-red-200">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Erreur d'initialisation</AlertTitle>
                      <AlertDescription>{errors.form}</AlertDescription>
                    </Alert>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-gray-300">Nom Complet</Label>
                      <Input 
                        id="fullName" 
                        name="fullName" 
                        value={formData.fullName} 
                        onChange={handleChange}
                        className={`bg-[#0F1419] border-white/10 focus:border-[#D4AF37] text-white transition-all ${errors.fullName ? 'border-red-500' : ''}`}
                        placeholder="Ex: Jean Dupont"
                      />
                      {errors.fullName && <p className="text-xs text-red-400 mt-1">{errors.fullName}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-gray-300">Email Professionnel</Label>
                      <Input 
                        id="email" 
                        name="email" 
                        type="email"
                        value={formData.email} 
                        onChange={handleChange}
                        className={`bg-[#0F1419] border-white/10 focus:border-[#D4AF37] text-white transition-all ${errors.email ? 'border-red-500' : ''}`}
                        placeholder="owner@prorascience.com"
                      />
                      {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-gray-300">Mot de passe Maître</Label>
                      <div className="relative">
                        <Input 
id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          value={formData.password}
                          onChange={handleChange}
                          className={`bg-[#0F1419] border-white/10 pr-10 focus:border-[#D4AF37] text-white transition-all ${errors.password ? 'border-red-500' : ''}`}
                          placeholder="••••••••"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      
                      {/* Password Strength Meter */}
                      <div className="space-y-2 pt-1">
                        <div className="h-1 w-full bg-gray-700 rounded-full overflow-hidden">
                          <motion.div 
                            className={`h-full ${
                              passwordStrength.score <= 2 ? 'bg-red-500' : 
                              passwordStrength.score <= 4 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            initial={{ width: 0 }}
                            animate={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <StrengthIndicator label="Min. 8 caractères" met={passwordStrength.hasMinLength} />
                          <StrengthIndicator label="Majuscule" met={passwordStrength.hasUpper} />
                          <StrengthIndicator label="Minuscule" met={passwordStrength.hasLower} />
                          <StrengthIndicator label="Chiffre" met={passwordStrength.hasNumber} />
                          <StrengthIndicator label="Caractère spécial" met={passwordStrength.hasSpecial} />
                        </div>
                      </div>
                      
                      {errors.password && <p className="text-xs text-red-400 mt-1">{errors.password}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="passwordConfirm" className="text-gray-300">Confirmation</Label>
                      <Input 
                        id="passwordConfirm" 
                        name="passwordConfirm" 
                        type="password"
                        autoComplete="new-password"
                        value={formData.passwordConfirm} 
                        onChange={handleChange}
                        className={`bg-[#0F1419] border-white/10 focus:border-[#D4AF37] text-white transition-all ${errors.passwordConfirm ? 'border-red-500' : ''}`}
                        placeholder="••••••••"
                      />
                      {errors.passwordConfirm && <p className="text-xs text-red-400 mt-1">{errors.passwordConfirm}</p>}
                    </div>

                    <Button 
                      type="submit" 
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-[#D4AF37] to-[#b5952f] hover:from-[#E5C048] hover:to-[#c6a63d] text-black font-bold mt-4 h-11 transition-all shadow-lg shadow-[#D4AF37]/20"
                    >
                      {isLoading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Création en cours...</>
                      ) : (
                        'Créer le Compte Propriétaire'
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default CreateOwnerAccountPage;