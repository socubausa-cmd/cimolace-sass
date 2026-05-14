import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OnboardingPage } from './pages/Onboarding';
import { DashboardHome } from './pages/DashboardHome';
import { DashboardInfrastructure } from './pages/DashboardInfrastructure';
import { DashboardProduct } from './pages/DashboardProduct';
import { DashboardLives } from './pages/DashboardLives';
import { DashboardLivesNew } from './pages/DashboardLivesNew';
import { LiveJoin } from './pages/LiveJoin';
import LiveHostPage from './pages/LiveHostPage';
import LiveGuestPage from './pages/LiveGuestPage';
import LiveClassroomPage from './pages/LiveClassroomPage';
import LiveStudioPage from './pages/LiveStudioPage';
import { MedosDashboard } from './pages/MedosDashboard';
import { MedosPatients } from './pages/MedosPatients';
import { MedosPatientDetail } from './pages/MedosPatientDetail';
import { MedosPatientPortal } from './pages/MedosPatientPortal';
import { DashboardLiri } from './pages/DashboardLiri';
import StudioLiriHubPage from './pages/StudioLiriHubPage';
import StudioLiriCourseBuilderPage from './pages/StudioLiriCourseBuilderPage';
import StudioLiriMasterclassPage from './pages/StudioLiriMasterclassPage';
import StudioLiriFormationBuilderPage from './pages/StudioLiriFormationBuilderPage';
import StudioExportCenterPage from './pages/StudioExportCenterPage';
import StudioLiriBibliothequePage from './pages/StudioLiriBibliothequePage';
import StudioSmartboardDesignerPage from './pages/StudioSmartboardDesignerPage';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/dashboard" element={<DashboardHome />} />
          <Route path="/dashboard/infrastructure" element={<DashboardInfrastructure />} />
          <Route path="/dashboard/school" element={<DashboardProduct type="school" />} />
          <Route path="/dashboard/medos" element={<MedosDashboard />} />
          <Route path="/dashboard/medos/patients" element={<MedosPatients />} />
          <Route path="/dashboard/medos/patients/:id" element={<MedosPatientDetail />} />
          <Route path="/dashboard/medos/me" element={<MedosPatientPortal />} />
          <Route path="/dashboard/medos/me/notes" element={<MedosPatientPortal />} />
          <Route path="/dashboard/medos/me/record" element={<MedosPatientPortal />} />
          <Route path="/dashboard/medos/me/forms" element={<MedosPatientPortal />} />
          <Route path="/dashboard/medos/me/journal" element={<MedosPatientPortal />} />
          <Route path="/dashboard/medos/me/care" element={<MedosPatientPortal />} />
          <Route path="/dashboard/medos/me/exams" element={<MedosPatientPortal />} />
          <Route path="/dashboard/medos/me/prescriptions" element={<MedosPatientPortal />} />
          <Route path="/dashboard/medos/me/messages" element={<MedosPatientPortal />} />
          <Route path="/dashboard/mbolo" element={<DashboardProduct type="mbolo" />} />
          <Route path="/dashboard/wellness" element={<DashboardProduct type="wellness" />} />
          <Route path="/dashboard/creator" element={<DashboardProduct type="creator" />} />
          <Route path="/dashboard/temple" element={<DashboardProduct type="temple" />} />
          <Route path="/dashboard/community" element={<DashboardProduct type="community" />} />
          <Route path="/dashboard/lives" element={<DashboardLives />} />
          <Route path="/dashboard/lives/new" element={<DashboardLivesNew />} />
          <Route path="/lives/:id/join" element={<LiveJoin />} />
          <Route path="/lives/:id/host" element={<LiveHostPage />} />
          <Route path="/lives/:id/guest" element={<LiveGuestPage />} />
          <Route path="/lives/:id/classroom" element={<LiveClassroomPage />} />
          <Route path="/lives/:id/studio" element={<LiveStudioPage />} />
          <Route path="/dashboard/liri" element={<DashboardLiri />} />
          <Route path="/studio/liri" element={<StudioLiriHubPage />} />
          <Route path="/studio/liri/cours" element={<StudioLiriCourseBuilderPage />} />
          <Route path="/studio/liri/formation" element={<StudioLiriFormationBuilderPage />} />
          <Route path="/studio/liri/masterclass" element={<StudioLiriMasterclassPage />} />
          <Route path="/studio/smartboard" element={<StudioSmartboardDesignerPage />} />
          <Route path="/studio/export-center" element={<StudioExportCenterPage />} />
          <Route path="/studio/liri/bibliotheque" element={<StudioLiriBibliothequePage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
