import { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const STORAGE_KEY = 'twin_onboarding_done';

/**
 * Tour interactif 6 étapes (driver.js) — déclenché au 1er load.
 * Pour relancer manuellement : supprimer localStorage['twin_onboarding_done'] + reload.
 */
export function OnboardingTour() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(STORAGE_KEY) === 'true') return;

    // Style brand-primary (override CSS variables de driver.js)
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-onboarding-tour', '1');
    styleEl.textContent = `
      .driver-popover.isna-theme {
        background: #fff;
        color: var(--zw-text);
        border-radius: 14px;
        box-shadow: 0 20px 50px -12px rgba(15, 23, 42, 0.35);
        max-width: 380px;
      }
      .driver-popover.isna-theme .driver-popover-title {
        font-size: 16px;
        font-weight: 700;
        color: var(--zw-text);
        margin-bottom: 6px;
      }
      .driver-popover.isna-theme .driver-popover-description {
        font-size: 13.5px;
        color: var(--zw-text-soft);
        line-height: 1.5;
      }
      .driver-popover.isna-theme .driver-popover-footer button {
        background: var(--brand-primary, #2563eb);
        color: #fff;
        text-shadow: none;
        border: none;
        border-radius: 8px;
        padding: 7px 14px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }
      .driver-popover.isna-theme .driver-popover-footer button.driver-popover-prev-btn {
        background: var(--zw-bg-subtle);
        color: var(--zw-text-soft);
      }
      .driver-popover.isna-theme .driver-popover-close-btn {
        color: var(--zw-text-faint);
        font-size: 18px;
      }
      .driver-popover.isna-theme .driver-popover-progress-text {
        color: var(--zw-text-faint);
        font-size: 12px;
      }
    `;
    document.head.appendChild(styleEl);

    const drv = driver({
      popoverClass: 'isna-theme',
      showProgress: true,
      allowClose: true,
      nextBtnText: 'Suivant',
      prevBtnText: 'Précédent',
      doneBtnText: 'Terminer',
      progressText: 'Étape {{current}} / {{total}}',
      steps: [
        {
          popover: {
            title: 'Bienvenue dans le Jumeau Numérique',
            description:
              "En 5 étapes rapides, découvrez les outils-clé : onboarding patient, corps 3D interactif, laboratoire virtuel et copilote IA. Le thérapeute reste 100 % décisionnaire.",
          },
        },
        {
          element: '#twin-cta-onboarding',
          popover: {
            title: 'Onboarding Twin',
            description:
              "Créez un nouveau jumeau numérique en quelques minutes : profil, biomarqueurs, contexte clinique.",
            side: 'bottom',
            align: 'end',
          },
        },
        {
          element: '[data-tour-id="corps-3d"]',
          popover: {
            title: 'Corps 3D',
            description:
              "Visualisez les organes scorés en temps réel. Cliquez un organe pour explorer ses biomarqueurs contributifs.",
            side: 'bottom',
            align: 'start',
          },
        },
        {
          element: '[data-tour-id="laboratoire"]',
          popover: {
            title: 'Laboratoire virtuel',
            description:
              "Importez ou saisissez les biomarqueurs. Le score est recalculé automatiquement à chaque ajout.",
            side: 'bottom',
            align: 'start',
          },
        },
        {
          element: '[data-tour-id="copilote"]',
          popover: {
            title: 'Copilote IA',
            description:
              "Posez vos questions cliniques au copilote IA — explications, examens recommandés et raisonnement explicable.",
            side: 'bottom',
            align: 'start',
          },
        },
        {
          popover: {
            title: 'Tout est prêt',
            description:
              "Vous pouvez relancer ce tour à tout moment via le bouton « ? » dans l'en-tête. Bonne exploration !",
          },
        },
      ],
      onDestroyed: () => {
        try {
          localStorage.setItem(STORAGE_KEY, 'true');
        } catch {
          /* noop */
        }
      },
    });

    // Délai court pour laisser le DOM se monter (onglets, boutons).
    const timer = window.setTimeout(() => {
      try {
        drv.drive();
      } catch {
        /* noop */
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      try {
        drv.destroy();
      } catch {
        /* noop */
      }
      styleEl.remove();
    };
  }, []);

  return null;
}

export default OnboardingTour;
