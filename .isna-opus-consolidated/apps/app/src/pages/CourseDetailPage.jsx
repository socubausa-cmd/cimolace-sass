import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Helmet } from 'react-helmet';
import { PlayCircle, FileText, CheckCircle, Lock, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { motion } from 'framer-motion';

const CourseDetailPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourseDetails();
  }, [id, user]);

  const fetchCourseDetails = async () => {
    try {
      // Fetch Course
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', id)
        .single();
      
      if (courseError) throw courseError;
      setCourse(courseData);

      // Fetch Lessons
      const { data: lessonsData, error: lessonsError } = await supabase
        .from('lessons')
        .select('id,title,order,course_id')
        .eq('course_id', id)
        .limit(100)
        .order('order', { ascending: true });
        
      if (lessonsError) throw lessonsError;
      setLessons(lessonsData);

      // Check Enrollment
      if (user) {
        const { data: enrollment, error: enrollmentError } = await supabase
          .from('enrollments')
          .select('id')
          .eq('course_id', id)
          .eq('user_id', user.id)
          .single();
        
        if (!enrollmentError && enrollment) {
          setIsEnrolled(true);
        }
      }
    } catch (error) {
      console.error('Error fetching details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0F1419] flex items-center justify-center"><div className="animate-spin h-10 w-10 border-2 border-yellow-500 rounded-full"></div></div>;
  if (!course) return <div className="min-h-screen bg-[#0F1419] flex items-center justify-center text-white">Cours introuvable</div>;

  return (
    <div className="min-h-screen bg-[#0F1419] pb-20">
      <Helmet>
        <title>{course.title} - PRORASCIENCE</title>
      </Helmet>

      {/* Hero Banner */}
      <div className="relative h-[50vh] w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F1419] to-transparent z-10"></div>
        <img src={course.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200'} alt={course.title} className="w-full h-full object-cover opacity-60" />
        <div className="absolute bottom-0 left-0 w-full z-20 p-8 max-w-7xl mx-auto">
           <motion.div
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
           >
            <span className="text-yellow-500 font-bold tracking-wider uppercase text-sm mb-2 block">{course.category}</span>
            <h1 className="text-4xl md:text-6xl font-serif font-bold text-white mb-4">{course.title}</h1>
            <p className="text-xl text-gray-300 max-w-2xl mb-6">{course.description}</p>
            
            {!isEnrolled && (
              <div className="flex items-center space-x-4">
                <Link to="/paiement">
                  <Button className="btn-primary text-lg px-8 py-4 h-auto">
                    S'inscrire - {course.is_free ? 'Gratuit' : `${course.price} €`}
                  </Button>
                </Link>
              </div>
            )}
           </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Course Content */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
              <BookOpen className="h-6 w-6 mr-2 text-yellow-500" />
              Programme du cours
            </h2>
            <div className="space-y-4">
              {lessons.map((lesson, index) => (
                <div key={lesson.id} className="flex items-center justify-between p-4 bg-[#0F1419]/50 rounded-lg border border-white/5 hover:border-white/20 transition-all">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold text-gray-400">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="text-white font-medium">{lesson.title}</h3>
                      <p className="text-sm text-gray-500">{lesson.duration || '15 min'}</p>
                    </div>
                  </div>
                  {isEnrolled ? (
                    <PlayCircle className="h-6 w-6 text-green-500 cursor-pointer hover:scale-110 transition-transform" />
                  ) : (
                    <Lock className="h-5 w-5 text-gray-600" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 sticky top-24">
            <h3 className="text-lg font-bold text-white mb-4">Informations</h3>
            <ul className="space-y-3 text-gray-400 text-sm">
              <li className="flex justify-between">
                <span>Niveau</span>
                <span className="text-white">{course.level || 'Intermédiaire'}</span>
              </li>
              <li className="flex justify-between">
                <span>Leçons</span>
                <span className="text-white">{lessons.length}</span>
              </li>
              <li className="flex justify-between">
                <span>Certificat</span>
                <span className="text-white">Oui</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseDetailPage;