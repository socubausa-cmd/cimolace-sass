import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Fond, grille, orbes et styles communs à la page d'accueil Prorascience (`ProrascienceCommercialPage`)
 * pour uniformiser les pages publiques / parcours invité (ex. salle d'attente).
 */
export function ProrasciencePublicPageShell({
  children,
  className = '',
  /** Barre minimale : marque + retour accueil (comme le header commercial) */
  simpleNav = false,
  navTitle = 'LIRI',
}) {
  return (
    <div
      className={`prs-live-site relative min-h-screen overflow-x-hidden bg-[#070b12] text-white ${className}`}
    >
      <style>{`
        .prs-bg-grid {
          background-image:
            linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px);
          background-size: 36px 36px;
          mask-image: radial-gradient(ellipse at center, black 45%, transparent 100%);
        }
        .prs-orb {
          filter: blur(72px);
          opacity: .24;
          animation: prsFloat 12s ease-in-out infinite;
        }
        .prs-orb.alt {
          animation-duration: 15s;
          animation-delay: -2s;
        }
        @keyframes prsFloat {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(0, -22px, 0) scale(1.08); }
        }
        .prs-light-rays {
          background: conic-gradient(
            from 210deg at 50% 45%,
            transparent 0deg,
            rgba(212, 175, 55, 0.14) 40deg,
            transparent 78deg,
            rgba(111, 76, 255, 0.12) 130deg,
            transparent 175deg,
            rgba(15, 179, 255, 0.12) 240deg,
            transparent 300deg,
            rgba(212, 175, 55, 0.08) 340deg,
            transparent 360deg
          );
          opacity: 0.38;
          filter: blur(1px);
          mask-image: radial-gradient(ellipse 55% 50% at 50% 42%, black 0%, transparent 72%);
        }
        .prs-card-glow {
          box-shadow: 0 0 0 1px rgba(212, 175, 55, 0.12), 0 20px 50px rgba(0, 0, 0, 0.45);
          transition: box-shadow 0.5s ease, border-color 0.5s ease, transform 0.5s ease;
        }
        @media (hover: hover) {
          .prs-card-glow:hover {
            box-shadow: 0 0 0 1px rgba(212, 175, 55, 0.35), 0 28px 70px rgba(212, 175, 55, 0.12);
            transform: translateY(-2px);
          }
        }
        .prs-live-site h1, .prs-live-site h2, .prs-live-site h3 {
          letter-spacing: -0.01em;
        }
        .prs-live-site .rounded-2xl.border,
        .prs-live-site .rounded-3xl.border {
          box-shadow: 0 16px 45px rgba(0, 0, 0, 0.3);
        }
        .prs-cta-primary.ring-offset-0 {
          box-shadow: 0 6px 28px rgba(212, 175, 55, 0.35);
        }
        @media (hover: hover) {
          .prs-cta-primary:hover {
            box-shadow: 0 10px 42px rgba(212, 175, 55, 0.48);
            filter: brightness(1.06);
          }
        }
        .prs-waiting-nav {
          background-color: rgba(7, 11, 18, 0.88);
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
        }
        @media (prefers-reduced-motion: reduce) {
          .prs-orb { animation: none !important; }
        }
      `}</style>

      <div className="pointer-events-none fixed inset-0 prs-bg-grid opacity-[0.85]" aria-hidden />
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="prs-orb absolute -left-20 top-16 h-80 w-80 rounded-full bg-[#6f4cff]" />
        <div className="prs-orb alt absolute right-8 top-24 h-96 w-96 rounded-full bg-[#D4AF37]" />
        <div className="prs-orb absolute bottom-8 left-1/3 h-72 w-72 rounded-full bg-[#0fb3ff]" />
        <div
          className="prs-light-rays pointer-events-none absolute left-1/2 top-[6%] h-[125vh] w-[125vh] -translate-x-1/2"
          style={{ transform: 'translateX(-50%) rotate(18deg)' }}
        />
      </div>

      {simpleNav ? (
        <header className="prs-waiting-nav sticky top-0 z-[60] border-b border-white/10">
          <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6">
            <div className="flex flex-1 justify-start">
              <Button variant="ghost" size="sm" className="gap-2 text-white/80 hover:bg-white/10 hover:text-white" asChild>
                <Link to="/">
                  <ArrowLeft className="h-4 w-4" />
                  Accueil
                </Link>
              </Button>
            </div>
            <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.22em] text-[#ebca5e]">
              {navTitle}
            </span>
            <div className="flex flex-1 justify-end" aria-hidden />
          </div>
        </header>
      ) : null}

      <div className="relative z-10">{children}</div>
    </div>
  );
}

/** Carte type « produit » page d'accueil (#101729 + bordure or douce) */
export function ProrasciencePublicCard({ className = '', children, ...rest }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-white/10 bg-[#101729]/95 p-5 backdrop-blur-sm prs-card-glow sm:p-6',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
