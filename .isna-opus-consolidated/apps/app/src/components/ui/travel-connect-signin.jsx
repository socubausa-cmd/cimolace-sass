import React, { useState, useRef, useEffect } from "react";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

/* ── Dot-map canvas (Africa-centric) ── */
const DotMap = () => {
  const canvasRef    = useRef(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
      canvas.width  = width;
      canvas.height = height;
    });
    ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!dims.width || !dims.height) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const gap = 12;
    const w   = dims.width;
    const h   = dims.height;
    const dots = [];

    for (let x = 0; x < w; x += gap) {
      for (let y = 0; y < h; y += gap) {
        const inMap =
          ((x < w * 0.25 && x > w * 0.05) && (y < h * 0.4  && y > h * 0.1)) || // North America
          ((x < w * 0.25 && x > w * 0.15) && (y < h * 0.8  && y > h * 0.4)) || // South America
          ((x < w * 0.45 && x > w * 0.3 ) && (y < h * 0.35 && y > h * 0.15)) || // Europe
          ((x < w * 0.5  && x > w * 0.35) && (y < h * 0.65 && y > h * 0.35)) || // Africa ← enlarged
          ((x < w * 0.7  && x > w * 0.45) && (y < h * 0.5  && y > h * 0.1)) ||  // Asia
          ((x < w * 0.8  && x > w * 0.65) && (y < h * 0.8  && y > h * 0.6));    // Australia
        if (inMap && Math.random() > 0.3)
          dots.push({ x, y, opacity: Math.random() * 0.5 + 0.1 });
      }
    }

    const routes = [
      { sx: w*0.4, sy: h*0.45, ex: w*0.38, ey: h*0.3, color: "#8b5cf6", delay: 0 },
      { sx: w*0.38, sy: h*0.3, ex: w*0.45, ey: h*0.2, color: "#8b5cf6", delay: 2 },
      { sx: w*0.42, sy: h*0.5, ex: w*0.35, ey: h*0.55, color: "#06b6d4", delay: 1 },
      { sx: w*0.35, sy: h*0.55, ex: w*0.3, ey: h*0.4, color: "#06b6d4", delay: 3 },
    ];

    let startTime  = Date.now();
    let rafId;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      dots.forEach((d) => {
        ctx.beginPath();
        ctx.arc(d.x, d.y, 1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${d.opacity})`;
        ctx.fill();
      });

      const t = (Date.now() - startTime) / 1000;
      routes.forEach((r) => {
        const elapsed = t - r.delay;
        if (elapsed <= 0) return;
        const prog = Math.min(elapsed / 3, 1);
        const x = r.sx + (r.ex - r.sx) * prog;
        const y = r.sy + (r.ey - r.sy) * prog;

        ctx.beginPath(); ctx.moveTo(r.sx, r.sy); ctx.lineTo(x, y);
        ctx.strokeStyle = r.color; ctx.lineWidth = 1.5; ctx.stroke();

        ctx.beginPath(); ctx.arc(r.sx, r.sy, 3, 0, Math.PI * 2);
        ctx.fillStyle = r.color; ctx.fill();

        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#a78bfa"; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(167,139,250,0.3)"; ctx.fill();
      });

      if (t > 12) startTime = Date.now();
      rafId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafId);
  }, [dims]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
};

/* ── Main visual component — accepts auth props ── */
export function CimolaceSignIn({
  onSubmit,
  onGoogleLogin,
  isLoading = false,
  error = "",
  onForgotPassword,
  onSignup,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [hovered,  setHovered]  = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.({ email, password });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #06050e 0%, #0d0a1e 100%)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-4xl overflow-hidden rounded-2xl flex shadow-2xl"
        style={{ background: "#08070f", border: "1px solid rgba(139,92,246,0.15)" }}
      >
        {/* Left — DotMap + branding */}
        <div className="hidden md:block w-1/2 relative overflow-hidden" style={{ borderRight: "1px solid rgba(139,92,246,0.12)" }}>
          <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #0f0d1e, #14112a)" }}>
            <DotMap />
          </div>

          {/* Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-violet-600/10 blur-3xl pointer-events-none" />

          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mb-6"
            >
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/30"
                style={{ background: "linear-gradient(135deg, #7c3aed, #06b6d4)" }}>
                <ArrowRight className="text-white h-7 w-7" />
              </div>
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="text-3xl font-black mb-2 text-center bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #a78bfa, #34d399)" }}
            >
              CIMOLACE
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="text-sm text-center max-w-xs leading-relaxed"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              Connecte-toi pour accéder à ton infrastructure intelligente et développer ton business en Afrique.
            </motion.p>

            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 }}
              className="mt-8 flex gap-6"
            >
              {[["10+", "Modules"], ["12", "Pays"], ["IA", "Intégrée"]].map(([val, label]) => (
                <div key={label} className="text-center">
                  <div className="text-lg font-black text-white">{val}</div>
                  <div className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(167,139,250,0.6)" }}>{label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Right — form */}
        <div className="w-full md:w-1/2 p-8 md:p-10 flex flex-col justify-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

            <h1 className="text-2xl md:text-3xl font-black mb-1 text-white">Bienvenue</h1>
            <p className="mb-7 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              Connecte-toi à ton espace CIMOLACE
            </p>

            {/* Google */}
            <button
              type="button"
              onClick={() => onGoogleLogin?.()}
              className="w-full flex items-center justify-center gap-2 rounded-xl p-3 mb-5 transition-colors text-sm font-medium text-white"
              style={{ background: "#111020", border: "1px solid rgba(139,92,246,0.2)" }}
              onMouseOver={(e) => e.currentTarget.style.background = "#1a1633"}
              onMouseOut={(e)  => e.currentTarget.style.background = "#111020"}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuer avec Google
            </button>

            {/* Divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full" style={{ borderTop: "1px solid rgba(139,92,246,0.15)" }} />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 text-white/30" style={{ background: "#08070f" }}>ou</span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 px-4 py-3 rounded-lg text-sm text-red-400" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-widest" style={{ color: "rgba(167,139,250,0.8)" }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ton@email.com"
                  required
                  className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition-colors"
                  style={{ background: "#111020", border: "1px solid rgba(139,92,246,0.2)" }}
                  onFocus={(e) => e.target.style.borderColor = "rgba(139,92,246,0.5)"}
                  onBlur={(e)  => e.target.style.borderColor = "rgba(139,92,246,0.2)"}
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-widest" style={{ color: "rgba(167,139,250,0.8)" }}>
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-white/20 outline-none transition-colors"
                    style={{ background: "#111020", border: "1px solid rgba(139,92,246,0.2)" }}
                    onFocus={(e) => e.target.style.borderColor = "rgba(139,92,246,0.5)"}
                    onBlur={(e)  => e.target.style.borderColor = "rgba(139,92,246,0.2)"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-3 flex items-center text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <motion.div
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onHoverStart={() => setHovered(true)}
                onHoverEnd={() => setHovered(false)}
                className="pt-1"
              >
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full relative overflow-hidden rounded-xl py-3 text-sm font-bold text-white flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #06b6d4)", boxShadow: hovered ? "0 8px 30px rgba(124,58,237,0.35)" : "none" }}
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : (
                    <>
                      Se connecter
                      <ArrowRight size={16} />
                    </>
                  )}
                  {hovered && !isLoading && (
                    <motion.span
                      initial={{ left: "-100%" }}
                      animate={{ left: "100%" }}
                      transition={{ duration: 1, ease: "easeInOut" }}
                      className="absolute top-0 bottom-0 w-20 pointer-events-none"
                      style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)", filter: "blur(6px)" }}
                    />
                  )}
                </button>
              </motion.div>
            </form>

            <div className="mt-5 flex items-center justify-between text-xs">
              <button onClick={() => onForgotPassword?.()} className="text-violet-400 hover:text-violet-300 transition-colors">
                Mot de passe oublié ?
              </button>
              <button onClick={() => onSignup?.()} className="transition-colors" style={{ color: "rgba(255,255,255,0.3)" }}>
                Pas encore inscrit ?{" "}
                <span className="text-violet-400 hover:text-violet-300">Créer un compte</span>
              </button>
            </div>

          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

export default CimolaceSignIn;
