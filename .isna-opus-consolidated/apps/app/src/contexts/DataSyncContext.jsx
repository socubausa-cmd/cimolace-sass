import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockDataStore } from '@/lib/mockDataStore';
import { generateFinancialData } from '@/lib/mockFinancialData';
import { generateCertificates } from '@/lib/mockCertificatesData';
import { defaultSettings } from '@/lib/mockSettingsData';
import { useToast } from '@/components/ui/use-toast';

const DataSyncContext = createContext();

export const DataSyncProvider = ({ children }) => {
  const [data, setData] = useState({
    students: [],
    formations: [],
    payments: [],
    years: [],
    activities: [],
    warnings: [],
    absences: [],
    delays: [],
    behavior: [],
    convocations: [],
    sanctions: [],
    illness: [],
    events: [],
    announcements: [],
    communications: [],
    inventory: [],
    invoices: [],
    financialPayments: [],
    notifications: [],
    coachingSessions: [],
    workshops: [],
    problems: [],
    // NEW MODULES
    certificates: [],
    settings: defaultSettings,
    twoFactorUsers: [],
    stripePayments: [],
    zoomMeetings: [],
    liveSessionsCatalog: [],
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  /** Rédactions en attente de correction (démo si aucune donnée) */
  const ensureDemoWritings = (students) => {
    const list = Array.isArray(students) ? [...students] : [];
    const hasPending = list.some((s) => (s.progress?.writings || []).some((w) => w.status === 'pending'));
    if (hasPending) return list;
    const demoText =
      "Voici ma réflexion sur les fondements de la pratique. Je souhaite approfondir la dimension symbolique et l'application concrète au quotidien.";
    return list.map((s, i) => {
      if (i >= 4) return s;
      const wid = `writing-${s.id}-demo`;
      return {
        ...s,
        progress: {
          ...(s.progress || {}),
          writings: [
            {
              id: wid,
              dayId: `day-demo-${i + 1}`,
              assignmentTitle: `Rédaction — Semaine ${i + 1}`,
              content: demoText,
              submittedAt: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
              status: 'pending',
            },
          ],
        },
      };
    });
  };

  useEffect(() => {
    const loadData = async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
      const storedData = mockDataStore.getAll() || {};
      const financialData = generateFinancialData(storedData.students || []);
      const certificatesData = generateCertificates(storedData.students || []);

      const safeData = {
        ...storedData,
        students: ensureDemoWritings(storedData.students || []),
        formations: storedData.formations || [],
        inventory: storedData.inventory || financialData.inventory,
        invoices: storedData.invoices || financialData.invoices,
        financialPayments: storedData.financialPayments || financialData.payments,
        notifications: storedData.notifications || [],
        coachingSessions: storedData.coachingSessions || [],
        workshops: storedData.workshops || [],
        problems: storedData.problems || [],
        
        // Ensure new data exists
        certificates: storedData.certificates || certificatesData,
        settings: storedData.settings || defaultSettings,
        twoFactorUsers: storedData.twoFactorUsers || [],
        stripePayments: storedData.stripePayments || [],
        zoomMeetings: storedData.zoomMeetings || [],
        liveSessionsCatalog: storedData.liveSessionsCatalog || [],
      };
      setData(safeData);
      try {
        mockDataStore.saveAll(safeData);
      } catch {
        // ignore
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const sync = (newData, message = null) => {
    mockDataStore.saveAll(newData);
    setData(newData);
    if (message) {
      // toast({ title: "Succès", description: message });
    }
  };

  const createItem = (collection, item, message) => {
    const newItem = { ...item, id: item.id || `${collection.slice(0,3)}-${Date.now()}` };
    const updatedCollection = [...(data[collection] || []), newItem];
    sync({ ...data, [collection]: updatedCollection }, message);
    return newItem;
  };
  const updateItem = (collection, id, updates, message) => {
    const updatedCollection = (data[collection] || []).map(i => i.id === id ? { ...i, ...updates } : i);
    sync({ ...data, [collection]: updatedCollection }, message);
  };
  const deleteItem = (collection, id, message) => {
    const updatedCollection = (data[collection] || []).filter(i => i.id !== id);
    sync({ ...data, [collection]: updatedCollection }, message);
  };

  // --- CRUD Wrappers ---
  
  // Certificates
  const addCertificate = (c) => createItem('certificates', c, "Certificat généré");
  const revokeCertificate = (id) => updateItem('certificates', id, { status: 'revoked' }, "Certificat révoqué");
  
  // Settings
  const updateSettings = (newSettings) => sync({ ...data, settings: { ...data.settings, ...newSettings } }, "Paramètres mis à jour");
  
  // Stripe
  const addStripePayment = (p) => createItem('stripePayments', p, "Paiement Stripe enregistré");
  
  // Zoom
  const addZoomMeeting = (m) => createItem('zoomMeetings', m, "Réunion Zoom créée");
  
  // 2FA
  const enable2FA = (userId, method) => {
    const user = { userId, method, enabled: true, backupCodes: [] };
    const updated = [...data.twoFactorUsers.filter(u => u.userId !== userId), user];
    sync({ ...data, twoFactorUsers: updated }, "2FA activé");
  };

  // --- Existing Wrappers (Keep these) ---
  const addNotification = (n) => createItem('notifications', { ...n, isRead: false, timestamp: new Date().toISOString() });
  const markAsRead = (id) => updateItem('notifications', id, { isRead: true });
  const markAllAsRead = () => {
    const updated = data.notifications.map(n => ({ ...n, isRead: true }));
    sync({ ...data, notifications: updated });
  };
  const deleteNotification = (id) => deleteItem('notifications', id);
  
  const addSession = (s) => createItem('coachingSessions', s);
  const updateSession = (id, u) => updateItem('coachingSessions', id, u);
  const deleteSession = (id) => deleteItem('coachingSessions', id);

  const addWorkshop = (w) => createItem('workshops', w);
  const updateWorkshop = (id, u) => updateItem('workshops', id, u);
  const deleteWorkshop = (id) => deleteItem('workshops', id);

  const addProblem = (p) => createItem('problems', p);
  const updateProblem = (id, u) => updateItem('problems', id, u);
  const deleteProblem = (id) => deleteItem('problems', id);

  const addInventoryItem = (item) => createItem('inventory', item);
  const updateInventoryItem = (id, u) => updateItem('inventory', id, u);
  const deleteInventoryItem = (id) => deleteItem('inventory', id);
  const addInvoice = (item) => createItem('invoices', item);
  const updateInvoice = (id, u) => updateItem('invoices', id, u);
  const deleteInvoice = (id) => deleteItem('invoices', id);
  const addFinancialPayment = (item) => createItem('financialPayments', item);
  const updateFinancialPayment = (id, u) => updateItem('financialPayments', id, u);
  const deleteFinancialPayment = (id) => deleteItem('financialPayments', id);
  
  const addStudent = (s) => createItem('students', s);
  const updateStudent = (id, u) => updateItem('students', id, u);
  const deleteStudent = (id) => deleteItem('students', id);
  const addActivity = () => {};

  const addAnnouncement = (a) => createItem('announcements', a);
  const updateAnnouncement = (id, u) => updateItem('announcements', id, u);
  const deleteAnnouncement = (id) => deleteItem('announcements', id);

  const addEvent = (e) => createItem('events', e);
  const deleteEvent = (id) => deleteItem('events', id);

  /** Noter une rédaction élève (mock local — à brancher sur une table Supabase plus tard) */
  const gradeWriting = (studentId, dayId, grades, feedback, status) => {
    setData((prev) => {
      const students = (prev.students || []).map((s) => {
        if (s.id !== studentId) return s;
        const writings = (s.progress?.writings || []).map((w) => {
          const match = w.dayId === dayId || w.id === dayId;
          if (!match) return w;
          return {
            ...w,
            grades,
            feedback,
            status: status || 'graded',
            gradedAt: new Date().toISOString(),
          };
        });
        return { ...s, progress: { ...(s.progress || {}), writings } };
      });
      const next = { ...prev, students };
      mockDataStore.saveAll(next);
      return next;
    });
  };

  /** @deprecated Utilisé par d'anciennes maquettes — préférer live_sessions (Supabase) dans LiveSessionManager */
  const updateLiveSession = (liveId, updates) => {
    setData((prev) => {
      const sessions = Array.isArray(prev.liveSessionsCatalog) ? [...prev.liveSessionsCatalog] : [];
      const idx = sessions.findIndex((x) => x.id === liveId);
      if (idx >= 0) {
        sessions[idx] = { ...sessions[idx], ...updates };
      } else {
        sessions.push({ id: liveId, ...updates });
      }
      const next = { ...prev, liveSessionsCatalog: sessions };
      mockDataStore.saveAll(next);
      return next;
    });
  };

  return (
    <DataSyncContext.Provider value={{
      ...data,
      loading,
      addCertificate, revokeCertificate,
      updateSettings,
      addStripePayment,
      addZoomMeeting,
      enable2FA,
      addNotification, markAsRead, markAllAsRead, deleteNotification,
      addSession, updateSession, deleteSession,
      addWorkshop, updateWorkshop, deleteWorkshop,
      addProblem, updateProblem, deleteProblem,
      addInventoryItem, updateInventoryItem, deleteInventoryItem,
      addInvoice, updateInvoice, deleteInvoice,
      addFinancialPayment, updateFinancialPayment, deleteFinancialPayment,
      addStudent, updateStudent, deleteStudent,
      addActivity,
      addAnnouncement, updateAnnouncement, deleteAnnouncement,
      addEvent, deleteEvent,
      gradeWriting,
      updateLiveSession,
    }}>
      {children}
    </DataSyncContext.Provider>
  );
};

export const useDataSync = () => {
  const context = useContext(DataSyncContext);
  if (context === undefined) throw new Error('useDataSync must be used within a DataSyncProvider');
  return context;
};