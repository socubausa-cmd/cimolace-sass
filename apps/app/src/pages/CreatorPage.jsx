import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { Plus, BookOpen, Users, Calendar, Award, Video, FileText, Settings, Save, Edit, Trash2, ListVideo, ArrowLeft, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const CreatorPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeSection, setActiveSection] = useState('lessons');
  const [subSection, setSubSection] = useState(null);
  const [newCourse, setNewCourse] = useState({ title: '', description: '' });
  const [newLesson, setNewLesson] = useState({ title: '', description: '', video_url: '', duration: '', course_id: null });
  const [newChapter, setNewChapter] = useState({ title: '', timestamp: '' });
  const [chaptersForLesson, setChaptersForLesson] = useState([]);
  
  const [courses, setCourses] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [modules, setModules] = useState([]); // Assuming modules are courses for now

  const fetchCourses = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('courses')
      .select('*');
      // We can select all courses and let RLS handle what the user can see.
      // If we want to only fetch courses created by the user: .eq('created_by', user.id);
    if (error) {
      toast({ title: "Erreur", description: "Impossible de charger les cours.", variant: "destructive" });
    } else {
      setCourses(data);
      setModules(data); // Use courses as modules for now
      if (data.length > 0 && !newLesson.course_id) {
        setNewLesson(prev => ({ ...prev, course_id: data[0].id }));
      }
    }
  }, [user, toast]);

  const fetchLessons = useCallback(async () => {
    if (!user) return;
    // Fetch lessons for courses this user has created
    const { data: userCourses, error: coursesError } = await supabase
      .from('courses')
      .select('id')
      .eq('created_by', user.id);

    if (coursesError || !userCourses) {
      toast({ title: "Erreur", description: "Impossible de charger les cours de l'utilisateur.", variant: "destructive" });
      return;
    }

    const courseIds = userCourses.map(c => c.id);

    if (courseIds.length === 0) {
      setLessons([]);
      return;
    }

    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .in('course_id', courseIds);

    if (error) {
      toast({ title: "Erreur", description: "Impossible de charger les leçons.", variant: "destructive" });
    } else {
      setLessons(data);
    }
  }, [user, toast]);

  useEffect(() => {
    if (user) {
      fetchCourses();
      fetchLessons();
    }

    if (location.state?.activeSection) {
      setActiveSection(location.state.activeSection);
    }
    if (location.state?.courseToEdit) {
      toast({
        title: "Mode Édition",
        description: `Modification du cours : ${location.state.courseToEdit}`,
      });
    }
  }, [user, location.state, fetchCourses, fetchLessons]);

  const sections = [
    { id: 'classes', label: 'Classes', icon: BookOpen },
    { id: 'modules', label: 'Modules', icon: FileText },
    { id: 'lessons', label: 'Leçons', icon: Video },
    { id: 'schedule', label: 'Emploi du temps', icon: Calendar },
    { id: 'quizzes', label: 'Quiz', icon: Award },
    { id: 'students', label: 'Étudiants', icon: Users },
    { id: 'settings', label: 'Paramètres', icon: Settings }
  ];

  const handleCreateCourse = async () => {
    if (!newCourse.title.trim() || !user) return;
    const { data, error } = await supabase
      .from('courses')
      .insert([{ title: newCourse.title, description: newCourse.description, created_by: user.id }])
      .select();
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Cours créé !", description: "Votre nouveau cours a été créé." });
      setCourses([...courses, ...data]);
      setNewCourse({ title: '', description: '' });
    }
  };

  const handleAddChapter = () => {
    if (!newChapter.title.trim() || !newChapter.timestamp.trim()) return;
    if (!/^\d{1,2}:\d{2}$/.test(newChapter.timestamp)) {
      toast({ title: "Format invalide", description: "Utilisez le format MM:SS pour l'horodatage.", variant: "destructive" });
      return;
    }
    setChaptersForLesson(prev => [...prev, newChapter].sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
    setNewChapter({ title: '', timestamp: '' });
  };

  const handleRemoveChapter = (index) => {
    setChaptersForLesson(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateLesson = async () => {
    if (!newLesson.title.trim() || !newLesson.course_id || !user) {
      toast({ title: "Info manquante", description: "Titre et module sont requis.", variant: "destructive" });
      return;
    }
    const { data: lessonData, error: lessonError } = await supabase
      .from('lessons')
      .insert([newLesson])
      .select()
      .single();

    if (lessonError) {
      toast({ title: "Erreur leçon", description: lessonError.message, variant: "destructive" });
      return;
    }

    if (chaptersForLesson.length > 0) {
      const chaptersWithLessonId = chaptersForLesson.map(chap => ({ ...chap, lesson_id: lessonData.id }));
      const { error: chapterError } = await supabase.from('chapters').insert(chaptersWithLessonId);
      if (chapterError) {
        toast({ title: "Erreur chapitres", description: chapterError.message, variant: "destructive" });
      }
    }

    toast({ title: "Leçon créée !", description: "Votre nouvelle leçon a été sauvegardée." });
    setLessons([...lessons, lessonData]);
    setNewLesson({ title: '', description: '', video_url: '', duration: '', course_id: courses[0]?.id || null });
    setChaptersForLesson([]);
  };

  const handleSectionClick = (sectionId) => {
    setActiveSection(sectionId);
    setSubSection(null);
  };

  const renderBackButton = () => (
    <Button variant="ghost" onClick={() => setSubSection(null)} className="mb-4 text-white">
      <ArrowLeft className="h-4 w-4 mr-2" /> Retour
    </Button>
  );

  const renderPlaceholderContent = (title) => (
    <div>
      {renderBackButton()}
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🚧</div>
        <h2 className="text-2xl font-bold text-white mb-4">Section: {title}</h2>
        <p className="text-gray-300">Cette vue est en cours de développement.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen py-20 px-4">
      <Helmet>
        <title>Studio Créateur - EduPlatform</title>
        <meta name="description" content="Créez et gérez vos formations, modules et emplois du temps" />
      </Helmet>

      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="mb-8">
          <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-xl p-6 border border-white/10 flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Studio <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Créateur</span></h1>
              <p className="text-gray-300">Créez et gérez vos formations, modules et emplois du temps</p>
            </div>
            <Button onClick={() => navigate('/professeur')} variant="outline" className="border-white/20 text-white hover:bg-white/10">
              <ArrowLeft className="h-4 w-4 mr-2" /> Retour au tableau de bord
            </Button>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-4 gap-8">
          <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="lg:col-span-1">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 sticky top-24">
              <h2 className="text-xl font-bold text-white mb-6">Navigation</h2>
              <div className="space-y-2">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button key={section.id} onClick={() => handleSectionClick(section.id)} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${activeSection === section.id ? 'bg-purple-600 text-white' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}>
                      <Icon className="h-5 w-5" /> <span>{section.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 0.4 }} className="lg:col-span-3">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <AnimatePresence mode="wait">
                <motion.div key={subSection || activeSection} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  {subSection ? renderPlaceholderContent(subSection) :
                    <>
                      {activeSection === 'classes' && (
                        <div className="space-y-6">
                          <h2 className="text-2xl font-bold text-white">Mes Cours</h2>
                          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                            <h3 className="text-lg font-semibold text-white mb-4">Créer un nouveau cours</h3>
                            <div className="grid md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-white font-medium mb-2">Titre *</label>
                                <input type="text" value={newCourse.title} onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400" placeholder="Ex: Développement Web" />
                              </div>
                              <div>
                                <label className="block text-white font-medium mb-2">Description</label>
                                <input type="text" value={newCourse.description} onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400" placeholder="Description courte" />
                              </div>
                            </div>
                            <Button onClick={handleCreateCourse} className="mt-4 bg-gradient-to-r from-purple-600 to-pink-600"> <Save className="h-4 w-4 mr-2" /> Créer le cours </Button>
                          </div>
                          <div className="grid md:grid-cols-2 gap-4">
                            {courses.map((courseItem) => (
                              <div key={courseItem.id} className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-colors">
                                <h3 className="text-lg font-semibold text-white">{courseItem.title}</h3>
                                <p className="text-sm text-gray-300">{courseItem.description}</p>
                                <div className="flex space-x-2 mt-4">
                                  <Button size="sm" onClick={() => setSubSection('Modifier Classe')} variant="outline" className="border-white/20 text-white hover:bg-white/10"> <Edit className="h-3 w-3 mr-1" /> Modifier </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeSection === 'modules' && (
                        <div className="space-y-6">
                          <h2 className="text-2xl font-bold text-white">Modules (Cours)</h2>
                          <div className="grid md:grid-cols-2 gap-4">
                            {modules.map((module) => (
                              <div key={module.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                                <h3 className="text-lg font-semibold text-white mb-2">{module.title}</h3>
                                <div className="flex space-x-2">
                                  <Button size="sm" onClick={() => setSubSection('Modifier Module')} variant="outline" className="border-white/20 text-white hover:bg-white/10"> <Edit className="h-3 w-3 mr-1" /> Modifier </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeSection === 'lessons' && (
                        <div className="space-y-6">
                          <h2 className="text-2xl font-bold text-white">Leçons</h2>
                          <div className="bg-white/5 rounded-lg p-6 border border-white/10">
                            <h3 className="text-xl font-semibold text-white mb-4">Créer une nouvelle leçon</h3>
                            <div className="space-y-4">
                              <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-white font-medium mb-2">Titre *</label>
                                  <input type="text" value={newLesson.title} onChange={(e) => setNewLesson({ ...newLesson, title: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400" placeholder="Ex: Introduction à React" />
                                </div>
                                <div>
                                  <label className="block text-white font-medium mb-2">Module (Cours) *</label>
                                  <select value={newLesson.course_id || ''} onChange={(e) => setNewLesson({ ...newLesson, course_id: parseInt(e.target.value) })} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-400 appearance-none">
                                    {courses.map(c => <option key={c.id} value={c.id} className="bg-slate-800">{c.title}</option>)}
                                  </select>
                                </div>
                              </div>
                              <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-white font-medium mb-2">Durée</label>
                                  <input type="text" value={newLesson.duration} onChange={(e) => setNewLesson({ ...newLesson, duration: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400" placeholder="Ex: 2h" />
                                </div>
                                <div>
                                  <label className="block text-white font-medium mb-2">URL Vidéo</label>
                                  <input type="url" value={newLesson.video_url} onChange={(e) => setNewLesson({ ...newLesson, video_url: e.target.value })} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400" placeholder="https://..." />
                                </div>
                              </div>
                              <div>
                                <label className="block text-white font-medium mb-2">Description</label>
                                <textarea value={newLesson.description} onChange={(e) => setNewLesson({ ...newLesson, description: e.target.value })} rows={3} className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400" placeholder="Description de la leçon..." />
                              </div>
                              <div className="border-t border-white/10 pt-4">
                                <h4 className="text-lg font-semibold text-white mb-3 flex items-center"><ListVideo className="h-5 w-5 mr-2 text-purple-400" /> Chapitres</h4>
                                <div className="space-y-2 mb-4">
                                  {chaptersForLesson.map((chap, index) => (
                                    <div key={index} className="flex items-center justify-between bg-white/5 p-2 rounded-lg">
                                      <span className="text-white text-sm">{chap.title}</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-400 font-mono">{chap.timestamp}</span>
                                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleRemoveChapter(index)}>
                                          <Trash2 className="h-4 w-4 text-red-400" />
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex items-end gap-2">
                                  <div className="flex-grow">
                                    <label className="block text-white text-sm font-medium mb-1">Titre du chapitre</label>
                                    <input type="text" value={newChapter.title} onChange={(e) => setNewChapter({...newChapter, title: e.target.value})} placeholder="Ex: Introduction" className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" />
                                  </div>
                                  <div className="w-24">
                                    <label className="block text-white text-sm font-medium mb-1">Temps (MM:SS)</label>
                                    <input type="text" value={newChapter.timestamp} onChange={(e) => setNewChapter({...newChapter, timestamp: e.target.value})} placeholder="01:30" className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm" />
                                  </div>
                                  <Button onClick={handleAddChapter} variant="outline" className="border-white/20 text-white hover:bg-white/10"> <Plus className="h-4 w-4" /> </Button>
                                </div>
                              </div>
                            </div>
                            <Button onClick={handleCreateLesson} className="mt-6 bg-gradient-to-r from-purple-600 to-pink-600 w-full"> <Save className="h-4 w-4 mr-2" /> Créer la leçon </Button>
                          </div>
                          <div className="space-y-3 mt-6">
                            <h3 className="text-xl font-semibold text-white">Leçons existantes</h3>
                            {lessons.map((lesson) => (
                              <div key={lesson.id} className="bg-white/5 rounded-lg p-4 border border-white/10 flex justify-between items-center">
                                <div>
                                  <h3 className="text-lg font-semibold text-white">{lesson.title}</h3>
                                  <div className="text-sm text-gray-300"> Durée: {lesson.duration}</div>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <Button size="sm" onClick={() => setSubSection('Modifier Leçon')} variant="outline" className="border-white/20 text-white hover:bg-white/10"> <Edit className="h-3 w-3 mr-1" /> Modifier </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {['schedule', 'quizzes', 'students', 'settings'].includes(activeSection) && (
                        <div className="text-center py-12">
                          <div className="text-6xl mb-4">
                            {React.createElement(sections.find(s => s.id === activeSection)?.icon || BarChart2, { className: "mx-auto h-16 w-16 text-purple-400" })}
                          </div>
                          <h2 className="text-2xl font-bold text-white mb-4"> Section {sections.find(s => s.id === activeSection)?.label} </h2>
                          <p className="text-gray-300">Vue détaillée pour la gestion de cette section.</p>
                        </div>
                      )}
                    </>
                  }
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default CreatorPage;