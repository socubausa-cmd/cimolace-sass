import React from 'react';
import { Smartphone, ExternalLink, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getEleveStoreInstallUrl,
  getEleveAppOpenUrl,
  isSameOriginStudentAppOpenUrl,
  isStudentWebFallbackEnabled,
  setStudentWebLimitedOptIn,
} from '@/lib/studentWebPlatform';
import { EV_MUTED, EV_R, EV_LINE, EV_SH, EV_ACCENT } from '@/pages/school/eleve-mobile/eleveMobileScreensShared';

const CTA = {
  background: `linear-gradient(90deg, ${EV_ACCENT} 0%, #5B21B6 100%)`,
  boxShadow: EV_SH.cta,
  borderRadius: EV_R.lg,
};

/**
 * @param {{ onContinueWeb: () => void, onOpenStore?: () => void }} props
 */
export function InstallAppGate({ onContinueWeb, onOpenStore }) {
  const storeUrl = getEleveStoreInstallUrl();
  const openAppUrl = getEleveAppOpenUrl();
  /** Même hôte = pas de vrai « deep link » : sans opt-in, un reload <a href> ne quitte jamais le gate. */
  const openAppInPlace = isSameOriginStudentAppOpenUrl(openAppUrl);
  const showWebFallback = isStudentWebFallbackEnabled();

  return (
    <div
      className="mx-auto w-full max-w-md px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-app-gate-title"
    >
      <div className="mb-6 flex justify-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/10"
          style={{ borderRadius: EV_R.lg }}
        >
          <Smartphone className="h-8 w-8 text-violet-200" aria-hidden />
        </div>
      </div>
      <h1
        id="install-app-gate-title"
        className="text-center text-[22px] font-extrabold leading-tight tracking-tight text-white"
      >
        LIRI — application élève
      </h1>
      <p className="mt-3 text-center text-[14px] leading-relaxed" style={{ color: EV_MUTED }}>
        Pour une expérience complète (notifications, accès optimisé, hors-ligne partiel), installez l'application
        LIRI sur votre téléphone. La connexion élève sur le site mobile reste secondaire.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <Button
          type="button"
          className="h-12 w-full text-[15px] font-bold text-white shadow-lg"
          style={CTA}
          asChild
        >
          <a href={storeUrl} target="_blank" rel="noopener noreferrer" onClick={onOpenStore}>
            <span className="inline-flex w-full items-center justify-center gap-2">
              Installer l'application
            </span>
          </a>
        </Button>

        {openAppInPlace ? (
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full border-violet-500/40 text-violet-100 hover:bg-violet-500/10"
            style={{ borderColor: EV_LINE }}
            onClick={() => {
              setStudentWebLimitedOptIn();
              onContinueWeb();
            }}
          >
            <span className="inline-flex w-full items-center justify-center gap-2">
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
              Ouvrir l'app
            </span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full border-violet-500/40 text-violet-100 hover:bg-violet-500/10"
            style={{ borderColor: EV_LINE }}
            asChild
          >
            <a href={openAppUrl} className="inline-flex w-full items-center justify-center gap-2" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
              Ouvrir l'app
            </a>
          </Button>
        )}

        {showWebFallback ? (
          <Button
            type="button"
            variant="ghost"
            className="h-12 w-full text-white/60 hover:bg-white/5 hover:text-white/90"
            onClick={() => {
              setStudentWebLimitedOptIn();
              onContinueWeb();
            }}
          >
            <Globe className="mr-2 h-4 w-4" aria-hidden />
            Continuer sur le web (limité)
          </Button>
        ) : null}
      </div>

      {!showWebFallback ? (
        <p className="mt-6 text-center text-[12px] leading-relaxed" style={{ color: EV_MUTED }}>
          L'accès web élève sur mobile n\'est pas activé sur ce domaine. Utilisez les boutons ci-dessus ou un
          ordinateur pour vous connecter.
        </p>
      ) : null}
    </div>
  );
}
