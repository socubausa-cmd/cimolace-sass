import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './lib/auth';
import { PatientLogin } from './pages/Login';
import { InviteAccept } from './pages/InviteAccept';
import { ResetPassword } from './pages/ResetPassword';
import { Landing } from './pages/Landing';
import { PatientDashboard } from './pages/Dashboard';
import { MyRecords } from './pages/MyRecords';
import { MyNotes } from './pages/MyNotes';
import { MyForms } from './pages/MyForms';
import { MyHealth } from './pages/MyHealth';
import { MyPrograms } from './pages/MyPrograms';
import { MyPrescriptions } from './pages/MyPrescriptions';
import { Messages } from './pages/Messages';
import { MyChartingNotes } from './pages/MyChartingNotes';
import { MyAppointments } from './pages/MyAppointments';
import { MyPrivacy } from './pages/MyPrivacy';
import { HealthTwinPage } from './pages/HealthTwinPage';
import { PatientLayout } from './components/PatientLayout';
const queryClient = new QueryClient();

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Chargement...</div>;
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/connexion" element={<PatientLogin />} />
        <Route path="/invite/accept" element={<InviteAccept />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<Landing />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route path="/invite/accept" element={<InviteAccept />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<PatientLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<PatientDashboard />} />
        <Route path="/records" element={<MyRecords />} />
        <Route path="/notes" element={<MyNotes />} />
        <Route path="/forms" element={<MyForms />} />
        <Route path="/health" element={<MyHealth />} />
        <Route path="/sante/mon-corps" element={<HealthTwinPage />} />
        <Route path="/programs" element={<MyPrograms />} />
        <Route path="/prescriptions" element={<MyPrescriptions />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/charting-notes" element={<MyChartingNotes />} />
        <Route path="/appointments" element={<MyAppointments />} />
        <Route path="/privacy" element={<MyPrivacy />} />
      </Route>
    </Routes>
  );
}
function App() { return (<QueryClientProvider client={queryClient}><BrowserRouter><AppRoutes /></BrowserRouter></QueryClientProvider>); }
export default App;
