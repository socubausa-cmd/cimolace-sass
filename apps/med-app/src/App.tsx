import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './lib/auth';
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
import { AuditPage } from './pages/AuditPage';
import { HandoffPage } from './pages/HandoffPage';
import { ResetPasswordPage } from './pages/ResetPassword';
import { Layout } from './components/Layout';

// Bio Digital Twin (v2) — lazy : isole three.js / 3D du bundle principal.
const TwinPage = lazy(() => import('./twin/TwinPage').then((m) => ({ default: m.TwinPage })));
// Wizard onboarding patient (Chantier 3) — lazy aussi (allège le bundle initial).
const PatientWizard = lazy(() => import('./twin/PatientWizard').then((m) => ({ default: m.PatientWizard })));
// Créateur de formulaire (page pleine config|aperçu) — lazy.
const FormBuilder = lazy(() => import('./forms/FormBuilder').then((m) => ({ default: m.FormBuilder })));

const queryClient = new QueryClient();

function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();
  // SSO handoff landing (embedded dashboard) — must run before the auth gate,
  // since it's what establishes the session.
  if (typeof window !== 'undefined' && window.location.pathname === '/handoff') return <HandoffPage />;
  // Définition d'un nouveau mot de passe (lien « mot de passe oublié ») — doit
  // s'afficher AVANT le gate d'auth : la session de récupération rendrait sinon
  // isAuthenticated=true → redirection /dashboard avant le choix du mot de passe.
  if (typeof window !== 'undefined' && window.location.pathname === '/reset-password') return <ResetPasswordPage />;
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--zw-text-faint)' }}>Chargement...</div>;
  if (!isAuthenticated) return <LoginPage />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<MedOSDashboard />} />
        <Route path="/patients" element={<PatientsList />} />
        <Route path="/patients/:id" element={<PatientDetail />} />
        <Route path="/patients/:patientId/notes/new" element={<NotesEditor />} />
        <Route path="/notes/:id" element={<NotesEditor />} />
        <Route path="/prescriptions" element={<PrescriptionsList />} />
        <Route path="/forms" element={<FormsList />} />
        <Route
          path="/forms/new"
          element={
            <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--zw-text-faint)' }}>Chargement du créateur…</div>}>
              <FormBuilder />
            </Suspense>
          }
        />
        <Route path="/health" element={<HealthTracker />} />
        <Route path="/programs" element={<ProgramsList />} />
        <Route path="/charting" element={<ChartingPage />} />
        <Route path="/messages" element={<Threads />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route
          path="/twin/new"
          element={
            <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--zw-text-faint)' }}>Chargement du wizard…</div>}>
              <PatientWizard />
            </Suspense>
          }
        />
        <Route
          path="/twin/:patientId"
          element={
            <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--zw-text-faint)' }}>Chargement du jumeau numérique…</div>}>
              <TwinPage />
            </Suspense>
          }
        />
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
