import React, { createContext, useContext, useState, useEffect } from 'react';

const VideoProgressContext = createContext(null);

export const VideoProgressProvider = ({ children }) => {
  const [progressData, setProgressData] = useState({});

  useEffect(() => {
    // Load progress from localStorage on mount
    const savedProgress = localStorage.getItem('prora_video_progress');
    if (savedProgress) {
      try {
        setProgressData(JSON.parse(savedProgress));
      } catch (e) {
        console.error("Failed to parse video progress", e);
      }
    }
  }, []);

  const saveProgress = (newData) => {
    setProgressData(newData);
    localStorage.setItem('prora_video_progress', JSON.stringify(newData));
  };

  const updateVideoProgress = (videoId, currentTime, duration) => {
    const percentage = Math.min(100, Math.round((currentTime / duration) * 100));
    const status = percentage >= 95 ? 'watched' : (percentage > 0 ? 'in-progress' : 'unwatched');
    
    const newProgress = {
      ...progressData,
      [videoId]: {
        currentTime,
        duration,
        percentage,
        status,
        lastUpdated: new Date().toISOString()
      }
    };
    
    // Only save if significant change or completed to avoid spamming storage
    if (Math.abs((progressData[videoId]?.percentage || 0) - percentage) > 1 || status === 'watched') {
      saveProgress(newProgress);
    }
    
    return percentage;
  };

  const markVideoAsWatched = (videoId) => {
    const current = progressData[videoId] || {};
    const newProgress = {
      ...progressData,
      [videoId]: {
        ...current,
        percentage: 100,
        status: 'watched',
        currentTime: current.duration || 0, // Assume full duration if unknown
        lastUpdated: new Date().toISOString()
      }
    };
    saveProgress(newProgress);
  };

  const getVideoProgress = (videoId) => {
    return progressData[videoId] || { percentage: 0, status: 'unwatched', currentTime: 0 };
  };

  // Helper to calculate aggregate progress (simple average for now)
  const getAggregateProgress = (videoIds) => {
    if (!videoIds || videoIds.length === 0) return 0;
    const total = videoIds.reduce((acc, vid) => acc + (progressData[vid]?.percentage || 0), 0);
    return Math.round(total / videoIds.length);
  };

  return (
    <VideoProgressContext.Provider value={{
      progressData,
      updateVideoProgress,
      markVideoAsWatched,
      getVideoProgress,
      getAggregateProgress
    }}>
      {children}
    </VideoProgressContext.Provider>
  );
};

export const useVideoProgress = () => {
  const context = useContext(VideoProgressContext);
  if (!context) {
    // Return a safe fallback instead of throwing to prevent app crashes
    console.warn('useVideoProgress used outside of VideoProgressProvider. Using fallback implementation.');
    return {
      progressData: {},
      updateVideoProgress: () => 0,
      markVideoAsWatched: () => {},
      getVideoProgress: () => ({ percentage: 0, status: 'unwatched', currentTime: 0 }),
      getAggregateProgress: () => 0
    };
  }
  return context;
};