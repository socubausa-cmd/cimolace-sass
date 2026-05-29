import { useMemo } from 'react';
import { subDays, isSameDay, startOfDay } from 'date-fns';

export const useStatisticsCalculator = (data) => {
  const { students, formations, activities, payments } = data;

  const stats = useMemo(() => {
    if (!students) return {};

    const totalStudents = students.length;
    const activeStudents = students.filter(s => s.status === 'active').length;
    
    // Calculate active today (simulated based on 'lastLogin' or recent activity)
    const today = new Date();
    const activeToday = students.filter(s => 
      s.lastLogin && isSameDay(new Date(s.lastLogin), today)
    ).length;

    const publishedFormations = (formations || []).filter(f => f.status === 'published').length;
    const draftFormations = (formations || []).filter(f => f.status === 'draft').length;
    
    const totalModules = (formations || []).reduce((acc, curr) => acc + (curr.modules || 0), 0);
    const totalVideos = (formations || []).reduce((acc, curr) => acc + (curr.videos || 0), 0);
    const totalQuizzes = (formations || []).reduce((acc, curr) => acc + (curr.quizzes || 0), 0);

    const activeCoaching = students.filter(s => s.serviceType === 'coaching' || s.serviceType === 'both').length;
    const activeMentoring = students.filter(s => s.serviceType === 'mentoring' || s.serviceType === 'both').length;

    return {
      totalStudents,
      activeStudents,
      activeToday,
      publishedFormations,
      draftFormations,
      totalModules,
      totalVideos,
      totalQuizzes,
      activeCoaching,
      activeMentoring,
      totalRevenue: (payments || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
    };
  }, [students, formations, payments]);

  const trends = useMemo(() => {
    // Generate 7-day trend data
    const last7Days = Array.from({ length: 7 }).map((_, i) => subDays(new Date(), 6 - i));
    
    const enrollmentTrend = last7Days.map(date => {
        // Count enrollments on this date
        const count = (students || []).filter(s => isSameDay(new Date(s.enrollmentDate), date)).length;
        return { date: format(date, 'dd/MM'), count };
    });

    const activityTrend = last7Days.map(date => {
        const count = (activities || []).filter(a => isSameDay(new Date(a.timestamp), date)).length;
        return { date: format(date, 'dd/MM'), count };
    });

    return { enrollmentTrend, activityTrend };
  }, [students, activities]);

  // Helper function to format dates for Recharts
  function format(date, fmt) {
      // Simple formatter for dd/MM
      const d = date.getDate().toString().padStart(2, '0');
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      return `${d}/${m}`;
  }

  const getAlerts = () => {
      const alerts = [];
      
      // Inactive Students
      const inactiveThreshold = subDays(new Date(), 7);
      const inactiveCount = (students || []).filter(s => s.lastLogin && new Date(s.lastLogin) < inactiveThreshold).length;
      if (inactiveCount > 0) {
          alerts.push({
              id: 'inactive-students',
              title: 'Étudiants inactifs',
              message: `${inactiveCount} étudiants inactifs depuis +7 jours`,
              severity: 'medium',
              type: 'students'
          });
      }

      // Empty Formations
      const emptyFormations = (formations || []).filter(f => f.students === 0 && f.status === 'published');
      if (emptyFormations.length > 0) {
          alerts.push({
              id: 'empty-formations',
              title: 'Formations sans inscrits',
              message: `${emptyFormations.length} formations publiées n'ont aucun inscrit`,
              severity: 'high',
              type: 'formations'
          });
      }

      return alerts;
  };

  return {
    stats,
    trends,
    getAlerts
  };
};