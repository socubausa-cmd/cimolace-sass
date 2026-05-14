import { useDataSync } from '@/contexts/DataSyncContext';
import { useMemo } from 'react';
import { format, subDays, isAfter } from 'date-fns';

export const useActivityLog = () => {
  const { activities, addActivity: logActivity, loading } = useDataSync();

  const getRecentActivities = (days = 7) => {
    if (!activities || !Array.isArray(activities)) return [];
    const cutoffDate = subDays(new Date(), days);
    return activities
      .filter(act => isAfter(new Date(act.timestamp), cutoffDate))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  };

  const getActivityByType = (type) => {
    if (!activities) return [];
    return activities.filter(act => act.type === type);
  };

  const clearOldActivities = (days = 30) => {
    // This functionality would ideally need to call a method in DataSyncContext to perform the deletion
    // For now we just return the filtered list locally
    console.warn("clearOldActivities: Persistent deletion requires context update.");
  };

  return {
    activities,
    loading,
    logActivity, // Exposed to allow components to log custom events
    getRecentActivities,
    getActivityByType,
    clearOldActivities
  };
};