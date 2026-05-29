import React, { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SchoolLifeDashboard from './SchoolLifeDashboard';
import StudentsManagementPanel from './StudentsManagementPanel';
import AnnouncementManager from './AnnouncementsManager';
import EventsManager from './EventsManager';
import { AbsencesManager, DelaysManager, IllnessLeaveManager } from './AttendanceManagers';
import { WarningsManager, SanctionsManager, ConvocationsManager, BehaviorManager } from './DisciplineManagers';
import { LayoutDashboard, Users, Bell, Calendar, AlertTriangle, Clock, Activity, HeartPulse, Gavel, ShieldAlert, Star } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const SchoolLifeManagementTab = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const currentContent = useMemo(() => {
    switch (activeTab) {
      case 'students': return <StudentsManagementPanel />;
      case 'announcements': return <AnnouncementManager />;
      case 'events': return <EventsManager />;
      case 'warnings': return <WarningsManager />;
      case 'attendance': return <AbsencesManager />;
      case 'delays': return <DelaysManager />;
      case 'behavior': return <BehaviorManager />;
      case 'sanctions': return <SanctionsManager />;
      case 'convocations': return <ConvocationsManager />;
      case 'health': return <IllnessLeaveManager />;
      case 'dashboard':
      default:
        return <SchoolLifeDashboard />;
    }
  }, [activeTab]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div>
           <h2 className="text-3xl font-bold text-white mb-2">Vie Scolaire</h2>
           <p className="text-gray-400">Gestion complète de la discipline et de la vie étudiante.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="overflow-x-auto pb-4 mb-4">
          <TabsList className="bg-[#192734] border border-white/10 p-1 h-auto flex-nowrap w-max">
            <TabsTrigger value="dashboard" className="gap-2 px-4 py-2"><LayoutDashboard className="w-4 h-4"/> Vue d'ensemble</TabsTrigger>
            <TabsTrigger value="students" className="gap-2 px-4 py-2"><Users className="w-4 h-4"/> Étudiants</TabsTrigger>
            <TabsTrigger value="announcements" className="gap-2 px-4 py-2"><Bell className="w-4 h-4"/> Annonces</TabsTrigger>
            <TabsTrigger value="events" className="gap-2 px-4 py-2"><Calendar className="w-4 h-4"/> Agenda</TabsTrigger>
            <TabsTrigger value="warnings" className="gap-2 px-4 py-2"><AlertTriangle className="w-4 h-4 text-orange-400"/> Avertissements</TabsTrigger>
            <TabsTrigger value="attendance" className="gap-2 px-4 py-2"><Clock className="w-4 h-4 text-purple-400"/> Présence</TabsTrigger>
            <TabsTrigger value="delays" className="gap-2 px-4 py-2"><Activity className="w-4 h-4 text-yellow-400"/> Retards</TabsTrigger>
            <TabsTrigger value="behavior" className="gap-2 px-4 py-2"><Star className="w-4 h-4 text-yellow-200"/> Comportement</TabsTrigger>
            <TabsTrigger value="sanctions" className="gap-2 px-4 py-2"><ShieldAlert className="w-4 h-4 text-red-400"/> Sanctions</TabsTrigger>
            <TabsTrigger value="convocations" className="gap-2 px-4 py-2"><Gavel className="w-4 h-4 text-indigo-400"/> Convocations</TabsTrigger>
            <TabsTrigger value="health" className="gap-2 px-4 py-2"><HeartPulse className="w-4 h-4 text-green-400"/> Santé</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={activeTab} className="mt-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {currentContent}
            </motion.div>
          </AnimatePresence>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SchoolLifeManagementTab;