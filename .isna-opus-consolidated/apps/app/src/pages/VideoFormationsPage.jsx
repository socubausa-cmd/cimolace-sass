import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { generateRichFormations } from '@/lib/mockFormationData';
import FormationCard from '@/components/classroom/FormationCard';
import FormationDetailView from '@/components/classroom/FormationDetailView';

const VideoFormationsPage = () => {
  const [formations, setFormations] = useState([]);
  const [expandedFormationId, setExpandedFormationId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');

  useEffect(() => {
    setFormations(generateRichFormations(6));
  }, []);

  const handleExpand = (id) => {
    setExpandedFormationId(expandedFormationId === id ? null : id);
  };

  const filteredFormations = formations.filter(f => {
    const matchesSearch = f.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLevel = filterLevel === 'all' || f.level === filterLevel;
    return matchesSearch && matchesLevel;
  });

  const inProgress = filteredFormations.filter(f => f.enrolledStudents?.[0]?.progress > 0 && f.enrolledStudents?.[0]?.progress < 100);
  const completed = filteredFormations.filter(f => f.enrolledStudents?.[0]?.progress === 100);
  const notStarted = filteredFormations.filter(f => !f.enrolledStudents?.[0]?.progress || f.enrolledStudents?.[0]?.progress === 0);

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
                   <h1 className="text-3xl font-serif font-bold text-white">Apprentissage Progressif</h1>
                   <p className="text-gray-400 text-sm">Accédez à votre bibliothèque de formations vidéo</p>
                </div>
             </div>

             <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                <div className="relative">
                   <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                   <Input 
                      placeholder="Rechercher une formation..." 
                      className="pl-9 bg-[#192734] border-white/10 text-white w-full md:w-64"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                   />
                </div>
                <Select value={filterLevel} onValueChange={setFilterLevel}>
                   <SelectTrigger className="w-full md:w-[180px] bg-[#192734] border-white/10 text-white">
                      <div className="flex items-center gap-2">
                         <Filter className="w-4 h-4" />
                         <SelectValue placeholder="Niveau" />
                      </div>
                   </SelectTrigger>
                   <SelectContent>
                      <SelectItem value="all">Tous les niveaux</SelectItem>
                      <SelectItem value="Débutant">Débutant</SelectItem>
                      <SelectItem value="Intermédiaire">Intermédiaire</SelectItem>
                      <SelectItem value="Avancé">Avancé</SelectItem>
                   </SelectContent>
                </Select>
             </div>
          </div>

          <div className="space-y-12">
             {/* In Progress Section */}
             {inProgress.length > 0 && (
                <section>
                   <div className="flex items-center gap-3 mb-6">
                      <h2 className="text-xl font-bold text-white uppercase tracking-wider text-[#D4AF37]">En Cours</h2>
                      <div className="h-px bg-[#D4AF37]/30 flex-1"></div>
                   </div>
                   <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                         {inProgress.map(f => (
                            <div key={f.id} className={expandedFormationId === f.id ? "col-span-full" : ""}>
                               <FormationCard formation={f} onExpand={handleExpand} />
                               {expandedFormationId === f.id && <FormationDetailView formation={f} />}
                            </div>
                         ))}
                      </div>
                   </div>
                </section>
             )}

             {/* Not Started Section */}
             <section>
                <div className="flex items-center gap-3 mb-6">
                   <h2 className="text-xl font-bold text-white uppercase tracking-wider text-green-500">Non Commencées</h2>
                   <div className="h-px bg-green-500/30 flex-1"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {notStarted.map(f => (
                      <div key={f.id} className={expandedFormationId === f.id ? "col-span-full" : ""}>
                         <FormationCard formation={f} onExpand={handleExpand} />
                         {expandedFormationId === f.id && <FormationDetailView formation={f} />}
                      </div>
                   ))}
                </div>
             </section>

             {/* Completed Section */}
             {completed.length > 0 && (
                <section>
                   <div className="flex items-center gap-3 mb-6">
                      <h2 className="text-xl font-bold text-gray-400 uppercase tracking-wider">Complétées</h2>
                      <div className="h-px bg-white/10 flex-1"></div>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {completed.map(f => (
                         <div key={f.id} className={expandedFormationId === f.id ? "col-span-full" : ""}>
                            <FormationCard formation={f} onExpand={handleExpand} />
                            {expandedFormationId === f.id && <FormationDetailView formation={f} />}
                         </div>
                      ))}
                   </div>
                </section>
             )}
          </div>
       </div>
    </div>
  );
};

export default VideoFormationsPage;