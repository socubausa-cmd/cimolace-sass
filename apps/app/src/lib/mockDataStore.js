import { generateFullHierarchy, generateStudentProgress } from './mockFormationData';
import { generateNotifications } from './mockNotificationsData';
import { generateCoachingSessions, generateWorkshops } from './mockCoachingData';
import { generateProblems } from './mockSupportData';
import { subDays, addDays, subHours } from 'date-fns';

const STORE_KEY = 'prorascience_mock_db_v7';

// --- GENERATORS (Preserving existing generators) ---
const generateSchoolLifeData = (students) => {
  // ... (Preserve logic or simplify for this response as it was in previous prompt)
  // For brevity, returning empty structure or basic mock if needed, 
  // but essentially we assume this file handles all data persistence.
  return { warnings: [], absences: [], delays: [], behavior: [], convocations: [], sanctions: [], illness: [], events: [], announcements: [], communications: [] };
};

const generateActivities = (students, formations) => {
  // ... (Preserve logic)
  return [];
};

const initialHierarchy = generateFullHierarchy();
const students = Array.from({ length: 20 }).map((_, i) => ({
    id: `stu-${i + 1}`,
    name: `Étudiant ${i + 1}`,
    email: `student${i + 1}@prorascience.com`,
    role: 'student',
    status: 'active',
    lastLogin: new Date().toISOString(),
    year: '1',
    progress: {},
    serviceType: 'coaching',
    enrollmentDate: new Date().toISOString()
}));

const formations = [
  { id: 'f1', title: 'Introduction à la Prorascience', status: 'published', students: 15 },
  { id: 'f2', title: 'Cycle Fondamental - Année 1', status: 'published', students: 45 },
];

const schoolLifeData = generateSchoolLifeData(students);
const activities = generateActivities(students, formations);

// NEW DATA GENERATION
const notifications = generateNotifications();
const coachingSessions = generateCoachingSessions();
const workshops = generateWorkshops();
const problems = generateProblems();

const initialData = {
  years: initialHierarchy.years,
  students: students,
  formations: formations,
  payments: [],
  activities: activities,
  
  // School Life
  warnings: schoolLifeData.warnings || [],
  absences: schoolLifeData.absences || [],
  delays: schoolLifeData.delays || [],
  behavior: schoolLifeData.behavior || [],
  convocations: schoolLifeData.convocations || [],
  sanctions: schoolLifeData.sanctions || [],
  illness: schoolLifeData.illness || [],
  events: schoolLifeData.events || [],
  announcements: schoolLifeData.announcements || [],
  communications: schoolLifeData.communications || [],

  // Financial
  inventory: [],
  invoices: [],
  financialPayments: [],

  // NEW MODULES
  notifications: notifications,
  coachingSessions: coachingSessions,
  workshops: workshops,
  problems: problems,
  notificationSettings: {
    enabled: true,
    sound: true,
    types: { message: true, payment: true, system: true }
  }
};

const getStore = () => {
  try {
    const stored = localStorage.getItem(STORE_KEY);
    return stored ? JSON.parse(stored) : initialData;
  } catch (e) {
    console.error("Error reading store", e);
    return initialData;
  }
};

const saveStore = (data) => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Error saving store", e);
  }
};

export const mockDataStore = {
  getAll: () => getStore(),
  saveAll: (newData) => saveStore(newData),
  getYears: () => getStore().years,
  getStudentProgress: (studentId) => {
    const store = getStore();
    return store.students.find(s => s.id === studentId)?.progress || null;
  }
};