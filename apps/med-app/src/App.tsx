import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@isna/ui/auth';
import { LoginPage } from './pages/Login';
import { MedOSDashboard } from './pages/Dashboard';
import { PatientsList } from './pages/PatientsList';
import { PatientDetail } from './pages/PatientDetail';
import { NotesEditor } from './pages/NotesEditor';
import { PrescriptionsList } from './pages/PrescriptionsList';
import { FormsList } from './pages/FormsList';
import { HealthTracker } from './pages/HealthTracker';
import { ProgramsList } from './pages/ProgramsList';
import { ChartingPage } from './pages/ChartingPage';
import { Threads } from './pages/Threads';
import { Appointments } from './pages/Appointments';
import { Layout } from './components/Layout';

const queryClient = new QueryClient();

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Chargement...</div>;
  if (!isAuthenticated) return <LoginPage />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<MedOSDashboard />} />
        <Route path="/patients" element={<PatientsList />} />
        <Route path="/patients/:id" element={<PatientDetail />} />
        <Route path="/patients/:id/notes/new" element={<NotesEditor />} />
        <Route path="/notes/:id" element={<NotesEditor />} />
        <Route path="/prescriptions" element={<PrescriptionsList />} />
        <Route path="/forms" element={<FormsList />} />
        <Route path="/health" element={<HealthTracker />} />
        <Route path="/programs" element={<ProgramsList />} />
        <Route path="/charting" element={<ChartingPage />} />
        <Route path="/messages" element={<Threads />} />
        <Route path="/appointments" element={<Appointments />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter><AppRoutes /></BrowserRouter>
    </QueryClientProvider>
  );
}
export default App;
