import { useState, useEffect } from 'react';

export const useAlertsManager = (rawAlerts) => {
  const [alerts, setAlerts] = useState([]);
  const [dismissedIds, setDismissedIds] = useState(() => {
    try {
        return JSON.parse(localStorage.getItem('prora_dismissed_alerts') || '[]');
    } catch {
        return [];
    }
  });

  useEffect(() => {
      if (rawAlerts) {
          const visibleAlerts = rawAlerts.filter(a => !dismissedIds.includes(a.id));
          setAlerts(visibleAlerts);
      }
  }, [rawAlerts, dismissedIds]);

  const dismissAlert = (id) => {
      const newDismissed = [...dismissedIds, id];
      setDismissedIds(newDismissed);
      localStorage.setItem('prora_dismissed_alerts', JSON.stringify(newDismissed));
  };

  const getAlertColor = (severity) => {
      switch(severity) {
          case 'high': return 'bg-red-500/20 text-red-400 border-red-500/50';
          case 'medium': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
          case 'low': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
          default: return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      }
  };

  return {
      alerts,
      dismissAlert,
      getAlertColor
  };
};