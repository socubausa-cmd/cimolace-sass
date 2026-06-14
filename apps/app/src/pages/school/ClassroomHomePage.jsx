import React from 'react';
import { Link } from 'react-router-dom';
import { Video, BookOpen, ChevronRight, GraduationCap, Users, PlayCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useActiveClasses } from '@/hooks/useActiveClasses';

const ClassroomHomePage = () => {
  const { activeClasses } = useActiveClasses();
  const liveCount = activeClasses.filter(c => c.status === 'active').length;
  const upcomingCount = activeClasses.filter(c => c.status === 'upcoming').length;

  return (
    <div className="min-h-screen bg-[#0F1419] flex flex-col items-center py-12 px-4 md:px-8">
       {/* Header */}
       <div className="text-center mb-16 space-y-4 max-w-2xl">
          <div className="inline-flex items-center justify-center p-4 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] mb-2 ring-1 ring-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] shadow-[0_0_30px_-5px_rgba(212,175,55,0.3)]">
             <GraduationCap className="w-10 h-10 text-[var(--school-accent)]" />
          </div>
          <h1 className="text-4xl md:text-6xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-[var(--school-accent)] to-white">
             Aller en classe
          </h1>
          <p className="text-lg text-gray-400">
             Choisissez votre mode d'apprentissage aujourd\'hui. Participez à des échanges enrichissants en direct ou progressez à votre rythme.
          </p>
       </div>

       {/* Cards Container */}
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-6xl">
          
          {/* Card 1: Live Classes */}
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-[#1e3a8a]/20 to-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] rounded-2xl p-1 shadow-lg hover:shadow-[0_0_40px_-10px_rgba(30,58,138,0.5)] transition-all duration-500 group">
             <div className="absolute inset-0 bg-[#0F1419] m-[1px] rounded-2xl z-0"></div>
             <div className="relative z-10 p-8 h-full flex flex-col">
                <div className="flex justify-between items-start mb-6">
                   <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500">
                      <Video className="w-8 h-8 text-white" />
                   </div>
                   {liveCount > 0 && (
                      <span className="flex h-4 w-4 relative">
                         <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                         <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
                      </span>
                   )}
                </div>
                
                <h2 className="text-3xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">Cours en direct</h2>
                <p className="text-gray-400 mb-8 line-clamp-2">
                   Rejoignez les sessions interactives, posez vos questions et échangez avec la communauté en temps réel.
                </p>

                <div className="grid grid-cols-2 gap-4 mb-8">
                   <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                      <div className="text-2xl font-bold text-white">{liveCount}</div>
                      <div className="text-sm text-gray-400 uppercase tracking-wider">En cours</div>
                   </div>
                   <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                      <div className="text-2xl font-bold text-white">{upcomingCount}</div>
                      <div className="text-sm text-gray-400 uppercase tracking-wider">À venir</div>
                   </div>
                </div>

                <div className="mt-auto">
                   <Link to="/classroom/live">
                      <Button className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-900/20 group-hover:shadow-blue-600/40 transition-all duration-300">
                         Accéder aux cours en direct <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                   </Link>
                </div>
             </div>
          </Card>

          {/* Card 2: Progressive Learning */}
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-[#065f46]/20 to-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] rounded-2xl p-1 shadow-lg hover:shadow-[0_0_40px_-10px_rgba(6,95,70,0.5)] transition-all duration-500 group">
             <div className="absolute inset-0 bg-[#0F1419] m-[1px] rounded-2xl z-0"></div>
             <div className="relative z-10 p-8 h-full flex flex-col">
                <div className="flex justify-between items-start mb-6">
                   <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-600 to-green-900 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500">
                      <BookOpen className="w-8 h-8 text-white" />
                   </div>
                </div>
                
                <h2 className="text-3xl font-bold text-white mb-2 group-hover:text-green-400 transition-colors">Apprentissage progressif</h2>
                <p className="text-gray-400 mb-8 line-clamp-2">
                   Suivez votre parcours à votre rythme avec nos modules structurés, vidéos et exercices pratiques.
                </p>

                <div className="space-y-4 mb-8">
                   <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400 flex items-center gap-2"><PlayCircle className="w-4 h-4 text-green-500" /> Vidéos disponibles</span>
                      <span className="text-white font-bold">145</span>
                   </div>
                   <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400 flex items-center gap-2"><Clock className="w-4 h-4 text-[var(--school-accent)]" /> Heures de contenu</span>
                      <span className="text-white font-bold">320h</span>
                   </div>
                   <div className="w-full bg-white/5 rounded-full h-2 mt-2">
                      <div className="bg-gradient-to-r from-green-500 to-[var(--school-accent)] h-2 rounded-full w-[45%] shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                   </div>
                   <div className="text-right text-xs text-[var(--school-accent)]">Progression globale: 45%</div>
                </div>

                <div className="mt-auto">
                   <Link to="/classroom/videos">
                      <Button className="w-full h-12 text-lg bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg shadow-green-900/20 group-hover:shadow-green-600/40 transition-all duration-300">
                         Accéder aux vidéos <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                      </Button>
                   </Link>
                </div>
             </div>
          </Card>

       </div>
    </div>
  );
};

export default ClassroomHomePage;