import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Search, Filter, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mockLiveClasses } from '@/lib/mockLiveClassesData';
import ClassCard from '@/components/school/classroom/ClassCard';

const LiveClassesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterInstructor, setFilterInstructor] = useState('all');

  const filteredClasses = mockLiveClasses.filter(cls => {
    const matchesSearch = cls.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          cls.instructor.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesInstructor = filterInstructor === 'all' || cls.instructor === filterInstructor;
    return matchesSearch && matchesInstructor;
  });

  const activeClasses = filteredClasses.filter(c => c.status === 'en_cours');
  const upcomingClasses = filteredClasses.filter(c => c.status === 'a_venir');
  const finishedClasses = filteredClasses.filter(c => c.status === 'terminee');

  return (
    <div className="min-h-screen bg-[#0F1419] pb-20 pt-8 px-4 md:px-8">
       <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
             <div className="flex items-center gap-4">
                <Link to="/classroom">
                   <Button variant="ghost" size="icon" className="rounded-full bg-white/5 hover:bg-white/10 text-white">
                      <ChevronLeft className="w-6 h-6" />
                   </Button>
                </Link>
                <div>
                   <h1 className="text-3xl font-serif font-bold text-white">Cours en direct</h1>
                   <p className="text-gray-400 text-sm">Rejoignez vos professeurs et camarades en temps réel</p>
                </div>
             </div>

             <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                <div className="relative">
                   <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                   <Input 
                      placeholder="Rechercher..." 
                      className="pl-9 bg-[#192734] border-white/10 text-white w-full md:w-64"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                   />
                </div>
                <Select value={filterInstructor} onValueChange={setFilterInstructor}>
                   <SelectTrigger className="w-full md:w-[180px] bg-[#192734] border-white/10 text-white">
                      <div className="flex items-center gap-2">
                         <Filter className="w-4 h-4" />
                         <SelectValue placeholder="Instructeur" />
                      </div>
                   </SelectTrigger>
                   <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="Dr. Sarah Connor">Dr. Sarah Connor</SelectItem>
                      <SelectItem value="Prof. Albert">Prof. Albert</SelectItem>
                   </SelectContent>
                </Select>
             </div>
          </div>

          <div className="space-y-12">
             {/* Active Section */}
             {activeClasses.length > 0 && (
                <section>
                   <div className="flex items-center gap-3 mb-6">
                      <h2 className="text-xl font-bold text-white uppercase tracking-wider">En Cours</h2>
                      <div className="h-px bg-red-500/50 flex-1"></div>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {activeClasses.map(cls => (
                         <ClassCard key={cls.id} classData={cls} />
                      ))}
                   </div>
                </section>
             )}

             {/* Upcoming Section */}
             <section>
                <div className="flex items-center gap-3 mb-6">
                   <h2 className="text-xl font-bold text-white uppercase tracking-wider">À Venir</h2>
                   <div className="h-px bg-blue-500/30 flex-1"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {upcomingClasses.length > 0 ? (
                      upcomingClasses.map(cls => (
                         <ClassCard key={cls.id} classData={cls} />
                      ))
                   ) : (
                      <div className="col-span-full py-8 text-center text-gray-500 bg-[#192734]/50 rounded-xl border border-white/5 border-dashed">
                         Aucun cours à venir planifié pour le moment.
                      </div>
                   )}
                </div>
             </section>

             {/* Finished Section */}
             <section>
                <div className="flex items-center gap-3 mb-6">
                   <h2 className="text-xl font-bold text-gray-400 uppercase tracking-wider">Terminées</h2>
                   <div className="h-px bg-white/10 flex-1"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {finishedClasses.length > 0 ? (
                      finishedClasses.map(cls => (
                         <ClassCard key={cls.id} classData={cls} />
                      ))
                   ) : (
                      <div className="col-span-full text-center text-gray-500 text-sm">
                         Aucun historique récent.
                      </div>
                   )}
                </div>
             </section>
          </div>
       </div>
    </div>
  );
};

export default LiveClassesPage;