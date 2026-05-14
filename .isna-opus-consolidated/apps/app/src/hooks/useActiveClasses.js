import { useState, useEffect } from 'react';
import { mockLiveClasses } from '@/lib/mockLiveClassesData';

export const useActiveClasses = () => {
  const [activeClasses, setActiveClasses] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const now = new Date();
    const active = mockLiveClasses.filter(c => {
      const start = new Date(c.startTime);
      const end = new Date(c.endTime);
      return now >= start && now <= end;
    });
    setActiveClasses(active);
  }, []);

  return { activeClasses, loading };
};
