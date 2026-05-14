import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, BookOpen, Clock, CheckCircle, PlayCircle, Loader2, GraduationCap, ArrowRight, Sparkles, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useStudentEnrollmentsList } from '@/hooks/useStudentEnrollmentsList';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';

const FormationCard = ({ formation, type, index = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: index * 0.06 }}
    whileHover={{ y: -4, scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    className="h-full"
  >
    <Card className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#151a21]/80 backdrop-blur-xl hover:border-[#D4AF37]/40 transition-all duration-300 group h-full flex flex-col">
      <div className="relative h-48 overflow-hidden">
        <motion.img
          src={formation.thumbnail || "https://images.unsplash.com/photo-1516979187457-637abb4f9353?q=80&w=1000&auto=format&fit=crop"}
          alt={formation.title}
          className="w-full h-full object-cover"
          whileHover={{ scale: 1.08 }}
          transition={{ duration: 0.5 }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#192734] via-transparent to-transparent" />
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-4 right-4"
        >
          <Badge className="bg-black/50 backdrop-blur-xl border border-white/20 text-white shadow-lg">
            {formation.category || 'Formation'}
          </Badge>
        </motion.div>
      </div>

      <CardHeader className="pb-2">
        <h3 className="text-xl font-bold text-white group-hover:text-[#D4AF37] transition-colors line-clamp-2">
          {formation.title}
        </h3>
        <p className="text-sm text-gray-400 line-clamp-2">{formation.description}</p>
      </CardHeader>

      <CardContent className="flex-grow space-y-4">
        {type === 'in_progress' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-400">
              <span>Progression</span>
              <span className="text-[#D4AF37] font-medium">{formation.progress || 0}%</span>
            </div>
            <Progress value={formation.progress || 0} className="h-2" indicatorClassName="bg-[#D4AF37]" />
            <div className="flex justify-between text-sm text-gray-500 mt-2">
              <span>{formation.completedModules || 2}/{formation.totalModules || 8} Modules</span>
              <span>{formation.completedWeeks || 8}/{formation.totalWeeks || 32} Semaines</span>
            </div>
          </div>
        )}

        {type === 'completed' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <CheckCircle className="w-4 h-4" /> Complété le {formation.completionDate || '20/01/2026'}
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-green-500/10 border border-green-500/20">
              <span className="text-sm text-gray-400">Note Finale</span>
              <span className="text-[#D4AF37] font-bold">{formation.finalScore || '18/20'}</span>
            </div>
          </div>
        )}

        {type === 'available' && (
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-1"><BookOpen className="w-4 h-4" /> {formation.totalModules || 5} Mod.</div>
            <div className="flex items-center gap-1"><Clock className="w-4 h-4" /> {formation.duration || '12 sem.'}</div>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-2">
        {type === 'in_progress' && (
          <Link to={`/formation/${formation.id}/learn`} className="w-full">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button className="w-full bg-[#D4AF37] text-black hover:bg-amber-500 gap-2 shadow-lg shadow-[#D4AF37]/20">
                <PlayCircle className="w-4 h-4" /> Continuer le cours
                <ChevronRight className="w-4 h-4" />
              </Button>
            </motion.div>
          </Link>
        )}
        {type === 'completed' && (
          <Link to={`/formation/${formation.id}/learn`} className="w-full">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button variant="outline" className="w-full border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10 gap-2">
                <BookOpen className="w-4 h-4" /> Revoir le cours
                <ChevronRight className="w-4 h-4" />
              </Button>
            </motion.div>
          </Link>
        )}
      </CardFooter>
    </Card>
  </motion.div>
);

const StudentFormationsPage = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('in_progress');
  const { enrolledFormations, loading } = useStudentEnrollmentsList(user?.id);

  const filtered = enrolledFormations.filter(f =>
    f.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const inProgress = filtered.filter(f => f.status === 'in_progress');
  const completed = filtered.filter(f => f.status === 'completed');

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-24 gap-4"
      >
        <Loader2 className="w-10 h-10 animate-spin text-[#D4AF37]" />
        <p className="text-gray-400">Chargement de vos formations…</p>
      </motion.div>
    );
  }

  return (
    <div className="relative min-h-[60vh]">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[#D4AF37]/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[250px] h-[250px] bg-emerald-500/5 rounded-full blur-[80px]" />
      </div>

      <div className="space-y-8 relative">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
        >
          <div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-3"
            >
              <Sparkles className="w-4 h-4 text-[#D4AF37]" />
              <span className="text-xs text-gray-400">Apprentissage</span>
            </motion.div>
            <h1 className="text-2xl md:text-3xl font-serif font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400">
              Mes Formations
            </h1>
            <p className="text-gray-400 text-sm mt-1">Gérez votre apprentissage et accédez à vos cours.</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="relative flex-grow md:w-64"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Rechercher une formation..."
                className="pl-9 bg-[#151a21]/80 backdrop-blur-xl border-white/10 text-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </motion.div>
            <Link to="/formations/catalogue">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button className="bg-[#D4AF37] text-black hover:bg-amber-500 font-bold gap-1.5 shrink-0 shadow-lg shadow-[#D4AF37]/20">
                  <GraduationCap className="w-4 h-4" /> Catalogue
                </Button>
              </motion.div>
            </Link>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {enrolledFormations.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center space-y-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#D4AF37]/20 to-amber-500/10 border border-[#D4AF37]/30 flex items-center justify-center"
                whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(212,175,55,0.2)' }}
              >
                <GraduationCap className="w-12 h-12 text-[#D4AF37]" />
              </motion.div>
              <div>
                <h3 className="text-xl font-serif font-bold text-white mb-2">Aucune formation inscrite</h3>
                <p className="text-gray-400 text-sm max-w-xs">Découvrez les 21 modules Prorascience et inscris-toi gratuitement pour commencer ton parcours.</p>
              </div>
              <Link to="/formations/catalogue">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button className="bg-[#D4AF37] text-black hover:bg-amber-500 font-bold gap-2 h-12 px-8 shadow-lg shadow-[#D4AF37]/20">
                    <GraduationCap className="w-5 h-5" /> Voir le catalogue <ArrowRight className="w-4 h-4" />
                  </Button>
                </motion.div>
              </Link>
            </motion.div>
          ) : (
            <motion.div
              key="tabs"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-8"
              >
                <PremiumSegmentedSelector
                  value={activeTab}
                  onChange={setActiveTab}
                  options={[
                    { value: 'in_progress', label: `En Cours (${inProgress.length})`, badge: 'Apprentissage', icon: PlayCircle },
                    { value: 'completed', label: `Terminées (${completed.length})`, badge: 'Validation', icon: CheckCircle },
                  ]}
                  layoutId="student-formations-segment-pill"
                  className="max-w-xl"
                />
              </motion.div>

              {activeTab === 'in_progress' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-0">
                  {inProgress.length > 0 ? (
                    inProgress.map((f, i) => (
                      <FormationCard key={f.id} formation={f} type="in_progress" index={i} />
                    ))
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="col-span-full text-center py-16 text-gray-500 rounded-2xl border border-dashed border-white/10 bg-white/5"
                    >
                      Aucune formation en cours.
                    </motion.div>
                  )}
                </div>
              ) : null}

              {activeTab === 'completed' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-0">
                  {completed.length > 0 ? (
                    completed.map((f, i) => (
                      <FormationCard key={f.id} formation={f} type="completed" index={i} />
                    ))
                  ) : (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="col-span-full text-center py-16 text-gray-500 rounded-2xl border border-dashed border-white/10 bg-white/5"
                    >
                      Aucune formation terminée.
                    </motion.div>
                  )}
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default StudentFormationsPage;