import { useState, useEffect } from 'react';
import { differenceInDays, parse, format } from 'date-fns';

export const useSchoolYear = () => {
  const [currentYear, setCurrentYear] = useState(() => {
    return localStorage.getItem('prora_school_year') || '2024-2025';
  });

  const [yearData, setYearData] = useState({
    startDate: '2024-09-01',
    endDate: '2025-08-31'
  });

  useEffect(() => {
    localStorage.setItem('prora_school_year', currentYear);
    // In a real app, dates might change based on the selected string
    if (currentYear === '2024-2025') {
      setYearData({ startDate: '2024-09-01', endDate: '2025-08-31' });
    } else if (currentYear === '2023-2024') {
      setYearData({ startDate: '2023-09-01', endDate: '2024-08-31' });
    }
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