import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useDataSync } from '@/contexts/DataSyncContext';
import { useToast } from '@/components/ui/use-toast';
import { Bell } from 'lucide-react';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { notifications, notificationSettings } = useDataSync();
  const { toast } = useToast();
  /** Pas de AudioContext avant geste utilisateur ; une seule instance réutilisée */
  const audioUnlockedRef = useRef(false);
  const notificationAudioCtxRef = useRef(null);

  useEffect(() => {
    const unlock = () => {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!notificationAudioCtxRef.current) {
        try {
          notificationAudioCtxRef.current = new Ctx();
        } catch {
          return;
        }
      }
      audioUnlockedRef.current = true;
      notificationAudioCtxRef.current?.resume?.().catch(() => {});
    };
    document.addEventListener('pointerdown', unlock, { passive: true, once: true });
    document.addEventListener('keydown', unlock, { passive: true, once: true });
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  const playSound = () => {
    if (!notificationSettings?.sound) return;
    if (!audioUnlockedRef.current) return;
    try {
      const audioContext = notificationAudioCtxRef.current;
      if (!audioContext) return;
      if (audioContext.state === 'suspended') {
        audioContext.resume?.().catch(() => {});
        return;
      }
      if (audioContext.state !== 'running') return;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
      console.error('Audio play failed', e);
    }
  };

  // Simulating real-time incoming notification for demo
  useEffect(() => {
    const interval = setInterval(() => {
      // In a real app, this would be triggered by a socket event
      // Here we just log or do nothing to avoid spamming the user during demo
      // But if we added a new notification in DataSync, we'd want to toast it.
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (notification) => {
    playSound();
    toast({
      title: (
        <div className="flex items-center gap-2">
           <Bell className="w-4 h-4 text-[var(--school-accent)]" />
           <span>{notification.title}</span>
        </div>
      ),
      description: notification.message,
      duration: 5000,
    });
  };

  return (
    <NotificationContext.Provider value={{ showToast, playSound }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationSystem = () => useContext(NotificationContext);