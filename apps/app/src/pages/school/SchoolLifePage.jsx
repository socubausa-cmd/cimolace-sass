import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useLocation } from 'react-router-dom';
import { 
  RegulationsSection, 
  EventsSection,
  AnnouncementsSection,
  AttendanceSection,
  DisciplineSection,
  OfficialAnnouncementsSection
} from '@/components/school/school-life/SchoolLifeComponents';
import { CalendarSection } from '@/components/school/school-life/CalendarComponents';

import { Users, Info, Scale, Calendar as CalendarIcon, Bell, ClipboardCheck, MapPin } from 'lucide-react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const SchoolLifePage = ({ embedded = false }) => {
  const location = useLocation();

  const tabFromUrl = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const fromQuery = String(params.get('tab') || '').toLowerCase();
    if (fromQuery) return fromQuery;

    const pathname = String(location.pathname || '').toLowerCase();
    if (pathname.endsWith('/agenda')) return 'calendar';
    if (pathname.endsWith('/reglements')) return 'rules';
    if (pathname.endsWith('/evenements')) return 'events';
    if (pathname.endsWith('/annonces')) return 'announcements';
    if (pathname.endsWith('/presences')) return 'attendance';
    if (pathname.endsWith('/discipline')) return 'discipline';

    return 'calendar';
  }, [location.pathname, location.search]);

  const [tab, setTab] = useState(tabFromUrl);

  useEffect(() => {
    setTab(tabFromUrl);
  }, [tabFromUrl]);

  if (embedded) {
    return (
      <div className="space-y-8 pb-8">
        <Helmet><title>{`Vie Scolaire | ${isnaTenantConfig.branding.name}`}</title></Helmet>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#D4AF37]/10 rounded-xl border border-[#D4AF37]/20">
            <Users className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-white">Vie Scolaire</h1>
            <p className="text-gray-400 text-sm">Organisation, discipline et vie communautaire.</p>
          </div>
        </div>
        <div className="max-w-full">
          <Tabs value={tab} onValueChange={setTab} className="space-y-6">
            <PremiumSegmentedSelector
              value={tab}
              onChange={setTab}
              layoutId="schoollife-embedded-segment-pill"
              options={[
                { value: 'calendar', label: 'Calendrier', badge: 'Planning', icon: CalendarIcon },
                { value: 'rules', label: 'Règlements', badge: 'Cadre', icon: Scale },
                { value: 'events', label: 'Événements', badge: 'Campus', icon: MapPin },
                { value: 'announcements', label: 'Annonces', badge: 'Officiel', icon: Bell },
                { value: 'attendance', label: 'Présences', badge: 'Suivi', icon: ClipboardCheck },
                { value: 'discipline', label: 'Discipline', badge: 'Conduite', icon: Scale },
              ]}
            />
            <TabsContent value="calendar"><CalendarSection /></TabsContent>
            <TabsContent value="rules"><RegulationsSection /></TabsContent>
            <TabsContent value="events"><EventsSection /></TabsContent>
            <TabsContent value="announcements"><OfficialAnnouncementsSection /></TabsContent>
            <TabsContent value="attendance"><AttendanceSection /></TabsContent>
            <TabsContent value="discipline"><DisciplineSection /></TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F1419] font-sans pb-20 pt-20">
      <Helmet>
        <title>{`Vie Scolaire — ${isnaTenantConfig.branding.name}`}</title>
      </Helmet>

      {/* Hero Section */}
      <section className="relative h-[250px] w-full overflow-hidden flex items-center justify-center mb-10">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0F1419] via-[#192734] to-[#0F1419]" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5" />
        </div>
        
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <div className="inline-block p-3 bg-[#D4AF37]/10 rounded-2xl border border-[#D4AF37]/30 mb-4">
             <Users className="w-8 h-8 text-[#D4AF37]" />
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4 tracking-tight">
            Bureau de la Vie Scolaire
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto text-lg">
            Organisation, discipline et vie communautaire.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6">
        <Tabs value={tab} onValueChange={setTab} className="space-y-8">
          <PremiumSegmentedSelector
            value={tab}
            onChange={setTab}
            layoutId="schoollife-main-segment-pill"
            className="max-w-5xl"
            options={[
              { value: 'calendar', label: 'Calendrier', badge: 'Planning', icon: CalendarIcon },
              { value: 'rules', label: 'Règlements', badge: 'Cadre', icon: Scale },
              { value: 'events', label: 'Événements', badge: 'Campus', icon: MapPin },
              { value: 'announcements', label: 'Annonces', badge: 'Officiel', icon: Bell },
              { value: 'attendance', label: 'Présences', badge: 'Suivi', icon: ClipboardCheck },
              { value: 'discipline', label: 'Discipline', badge: 'Conduite', icon: Scale },
            ]}
          />

          <TabsContent value="calendar" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <CalendarSection />
          </TabsContent>

          <TabsContent value="rules" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <RegulationsSection />
          </TabsContent>

          <TabsContent value="events" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <EventsSection />
          </TabsContent>

          <TabsContent value="announcements" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <OfficialAnnouncementsSection />
          </TabsContent>

          <TabsContent value="attendance" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <AttendanceSection />
          </TabsContent>

          <TabsContent value="discipline" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <DisciplineSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SchoolLifePage;