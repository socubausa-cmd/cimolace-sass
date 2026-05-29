import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export type AppPage = 'course-builder' | 'smartboard-designer' | 'live-preview' | 'export-center';
export type DeviceMode = 'desktop' | 'tablet' | 'mobile';
export type ViewMode = 'design' | 'student' | 'teacher' | 'live';

type AppStore = {
  // State
  activeProjectId: string | null;
  activePage: AppPage;
  deviceMode: DeviceMode;
  viewMode: ViewMode;
  sidebarCollapsed: boolean;
  rightPanelCollapsed: boolean;

  // Actions
  setActiveProjectId: (id: string | null) => void;
  setActivePage: (page: AppPage) => void;
  setDeviceMode: (mode: DeviceMode) => void;
  setViewMode: (mode: ViewMode) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setRightPanelCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
};

export const useAppStore = create<AppStore>()(
  devtools(
    (set) => ({
      activeProjectId: null,
      activePage: 'smartboard-designer',
      deviceMode: 'desktop',
      viewMode: 'design',
      sidebarCollapsed: false,
      rightPanelCollapsed: false,

      setActiveProjectId: (id) => set({ activeProjectId: id }),
      setActivePage: (page) => set({ activePage: page }),
      setDeviceMode: (mode) => set({ deviceMode: mode }),
      setViewMode: (mode) => set({ viewMode: mode }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setRightPanelCollapsed: (collapsed) => set({ rightPanelCollapsed: collapsed }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      toggleRightPanel: () => set((s) => ({ rightPanelCollapsed: !s.rightPanelCollapsed })),
    }),
    { name: 'app-store' },
  ),
);
