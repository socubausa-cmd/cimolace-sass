import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Helmet } from 'react-helmet';
import { BookOpen, Award, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import Logo from '@/components/Logo';

const StudentDashboard = () => {
  const { user } = useAuth();
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [stats, setStats] = useState({ completed: 0, hours: 0, certificates: 0 });

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    const { data, error } = await supabase
      .from('student_progress')
      .select('*, courses(*)')
      .eq('user_id', user.id);
    
    if (!error && data) {
      setEnrolledCourses(data);
      const completed = data.filter(e => e.progress === 100).length;
      setStats({ completed, hours: 12, certificates: completed }); 
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1419] p-6 lg:p-10">
      <Helmet>
        <title>Tableau de bord - Élève</title>
      </Helmet>
      
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <Logo size="small" variant="dark" showText={false} className="mb-4" /> {/* Changed to showText={false} */}
          <h1 className="text-3xl font-serif font-bold text-white">Mon Espace Apprentissage</h1>
        </div>
        
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex items-center space-x-4">
            <div className="p-3 bg-purple-500/20 rounded-lg text-purple-400"><BookOpen className="h-6 w-6" /></div>
            <div>
              <p className="text-gray-400 text-sm">Cours complétés</p>
              <p className="text-2xl font-bold text-white">{stats.completed}</p>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex items-center space-x-4">
            <div className="p-3 bg-blue-500/20 rounded-lg text-blue-400"><Clock className="h-6 w-6" /></div>
            <div>
              <p className="text-gray-400 text-sm">Heures d'étude</p>
              <p className="text-2xl font-bold text-white">{stats.hours}h</p>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex items-center space-x-4">
            <div className="p-3 bg-[#D4AF37]/20 rounded-lg text-[#D4AF37]"><Award className="h-6 w-6" /></div>
            <div>
              <p className="text-gray-400 text-sm">Certificats</p>
              <p className="text-2xl font-bold text-white">{stats.certificates}</p>
            </div>
          </div>
        </div>

        {/* Courses Section */}
        <h2 className="text-2xl font-bold text-white mb-6">Mes Cours</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {enrolledCourses.length > 0 ? enrolledCourses.map((enrollment) => (
            <div key={enrollment.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-[#D4AF37]/30 transition-all group">
              <div className="h-40 overflow-hidden">
                <img src={enrollment.courses.thumbnail_url} alt={enrollment.courses.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="p-6">
                <h3 className="font-bold text-lg text-white mb-2">{enrollment.courses.title}</h3>
                <div className="flex justify-between text-sm text-gray-400 mb-4">
                  <span>Progression</span>
                  <span>{enrollment.progress}%</span>
                </div>
                <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden mb-6">
                  <div className="bg-[#D4AF37] h-full" style={{ width: `${enrollment.progress}%` }}></div>
                </div>
                <Link to={`/cours/${enrollment.course_id}`}>
                  <Button className="w-full btn-secondary py-2 text-sm">Continuer</Button>
                </Link>
              </div>
            </div>
          )) : (
            <div className="col-span-3 text-center py-10 bg-white/5 rounded-xl border border-white/5 border-dashed">
              <p className="text-gray-400 mb-4">Vous n'êtes inscrit à aucun cours pour le moment.</p>
              <Link to="/catalogue"><Button className="btn-primary">Explorer le catalogue</Button></Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;