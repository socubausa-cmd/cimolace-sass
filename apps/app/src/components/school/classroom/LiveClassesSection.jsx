import React, { useState } from 'react';
import { Calendar, Search, Filter, Video, Users, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { mockLiveClasses } from '@/lib/mockLiveClassesData';
import { format, isPast, isFuture } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router-dom';

const LiveClassesSection = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredClasses = mockLiveClasses.filter(cls => {
    const matchesSearch = cls.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          cls.instructor.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' 
                          ? true 
                          : filterStatus === 'active' 
                             ? cls.status === 'en_cours'
                             : filterStatus === 'upcoming'
                                ? cls.status === 'a_venir'
                                : cls.status === 'terminee';
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status) => {
    switch(status) {
       case 'en_cours': return <Badge className="bg-red-500 text-white animate-pulse">En Direct 🔴</Badge>;
       case 'a_venir': return <Badge variant="outline" className="border-blue-500 text-blue-400 bg-blue-500/10">À venir</Badge>;
       case 'terminee': return <Badge variant="secondary" className="bg-gray-700 text-gray-400">Terminée</Badge>;
       default: return null;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
       {/* Filters Header */}
       <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-[#192734] p-4 rounded-xl border border-white/5">
          <div className="relative w-full md:w-96">
             <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
             <Input 
                placeholder="Rechercher un cours ou un instructeur..." 
                className="pl-10 bg-[#0F1419] border-white/10 text-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>
          <div className="flex gap-3 w-full md:w-auto">
             <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px] bg-[#0F1419] border-white/10 text-white">
                   <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4" />
                      <SelectValue placeholder="Filtrer par statut" />
                   </div>
                </SelectTrigger>
                <SelectContent>
                   <SelectItem value="all">Tous les cours</SelectItem>
                   <SelectItem value="active">En cours</SelectItem>
                   <SelectItem value="upcoming">À venir</SelectItem>
                   <SelectItem value="finished">Terminés</SelectItem>
                </SelectContent>
             </Select>
             <Button variant="outline" className="border-white/10 text-white hover:bg-white/5 gap-2">
                <Calendar className="w-4 h-4" /> Vue Calendrier
             </Button>
          </div>
       </div>

       {/* Grid of Classes */}
       <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredClasses.length > 0 ? (
             filteredClasses.map(cls => (
                <Card key={cls.id} className="bg-[#192734] border-white/10 overflow-hidden hover:border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] transition-all duration-300 group">
                   <div className="p-6 space-y-4">
                      <div className="flex justify-between items-start">
                         {getStatusBadge(cls.status)}
                         <div className="text-sm text-gray-500 font-mono bg-[#0F1419] px-2 py-1 rounded">
                            {format(new Date(cls.startTime), 'HH:mm', { locale: fr })} - {format(new Date(cls.endTime), 'HH:mm', { locale: fr })}
                         </div>
                      </div>

                      <div>
                         <h3 className="text-xl font-bold text-white mb-2 group-hover:text-[var(--school-accent)] transition-colors line-clamp-2">{cls.title}</h3>
                         <p className="text-sm text-gray-400 mb-1">{cls.formation}</p>
                         <div className="flex items-center gap-2 mt-3">
                            <img src={cls.instructorAvatar} alt={cls.instructor} className="w-6 h-6 rounded-full border border-white/10" />
                            <span className="text-sm text-gray-300">{cls.instructor}</span>
                         </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-500 pt-2 border-t border-white/5">
                         <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" /> {cls.participants} participants
                         </span>
                         <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> {format(new Date(cls.startTime), 'dd MMM yyyy', { locale: fr })}
                         </span>
                      </div>
                   </div>

                   <div className="p-4 bg-[#15202B] border-t border-white/5 flex gap-3">
                      {cls.status === 'en_cours' ? (
                         <Link to={`/classroom/live/${cls.id}`} className="flex-1">
                           <Button className="w-full bg-red-600 hover:bg-red-700 text-white gap-2 font-bold shadow-[0_0_15px_rgba(220,38,38,0.5)] animate-pulse">
                              <Video className="w-4 h-4" /> Rejoindre le Direct
                           </Button>
                         </Link>
                      ) : (
                         <Button className="flex-1 bg-[var(--school-accent)] text-black hover:bg-yellow-500 gap-2 font-bold" disabled={cls.status === 'terminee'}>
                            {cls.status === 'terminee' ? 'Revoir le Replay' : "S'inscrire / Rappel"}
                         </Button>
                      )}
                      <Button variant="ghost" className="text-gray-400 hover:text-white border border-white/10">
                         Détails
                      </Button>
                   </div>
                </Card>
             ))
          ) : (
             <div className="col-span-full py-12 text-center text-gray-500">
                Aucun cours trouvé pour ces critères.
             </div>
          )}
       </div>
    </div>
  );
};

export default LiveClassesSection;