import { useState, useEffect } from 'react';
import { differenceInDays } from 'date-fns';

/* Année scolaire = septembre → août : en août on est ENCORE sur l'année entamée
   au septembre précédent. Rien en dur — sinon la valeur ment dès la rentrée suivante.
   Même logique que l'Aperçu rapide du propriétaire (OwnerDashboardOverview) :
   SOURCE UNIQUE ici pour que les deux écrans ne divergent plus. */
export const schoolYearOf = (d) => {
  const y = d.getFullYear();
  return d.getMonth() + 1 >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
};

/** Options du sélecteur : année précédente, courante, et les deux à venir
    (en fin d'année scolaire on prépare déjà la rentrée). */
export const buildYearOptions = (stored) => {
  const start = Number(schoolYearOf(new Date()).slice(0, 4));
  const opts = [-1, 0, 1, 2].map((i) => `${start - i}-${start - i + 1}`);
  // Une année mémorisée hors fenêtre reste proposée : on montre, on ne décide pas.
  if (stored && !opts.includes(stored)) opts.push(stored);
  return opts;
};

/** Bornes d'une année scolaire « YYYY-YYYY » (1er sept → 31 août). */
const boundsOf = (year) => {
  const m = /^(\d{4})-(\d{4})$/.exec(year || '');
  const start = m ? Number(m[1]) : Number(schoolYearOf(new Date()).slice(0, 4));
  return { startDate: `${start}-09-01`, endDate: `${start + 1}-08-31` };
};

export const useSchoolYear = () => {
  const [currentYear, setCurrentYear] = useState(() => {
    // Défaut = l'année scolaire réellement en cours (plus jamais « 2024-2025 » figé).
    // Le FORMAT « YYYY-YYYY » ne change pas : les formulaires financiers le consomment tel quel.
    try {
      return localStorage.getItem('prora_school_year') || schoolYearOf(new Date());
    } catch {
      return schoolYearOf(new Date());
    }
  });

  const [yearData, setYearData] = useState(() => boundsOf(currentYear));

  useEffect(() => {
    try { localStorage.setItem('prora_school_year', currentYear); } catch { /* stockage indisponible : on garde l'état mémoire */ }
    setYearData(boundsOf(currentYear));
  }, [currentYear]);

  const setSchoolYear = (year) => {
    setCurrentYear(year);
  };

  const getProgressData = () => {
    const start = new Date(yearData.startDate);
    const end = new Date(yearData.endDate);
    const now = new Date();

    const totalDays = differenceInDays(end, start);
    const daysPassed = differenceInDays(now, start);
    const daysRemaining = differenceInDays(end, now);

    const progress = Math.min(100, Math.max(0, (daysPassed / totalDays) * 100));

    return {
      daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
      progressPercentage: Math.round(progress),
      isActive: now >= start && now <= end
    };
  };

  return {
    currentYear,
    startDate: yearData.startDate,
    endDate: yearData.endDate,
    setSchoolYear,
    getProgressData
  };
};
