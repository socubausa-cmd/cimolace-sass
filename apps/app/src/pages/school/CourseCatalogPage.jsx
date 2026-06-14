import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Search, Filter, BookOpen, Clock, BarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

const CourseCatalogPage = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setCourses(data);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          course.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || 
                          (filter === 'free' && course.is_free) || 
                          (filter === 'paid' && !course.is_free);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-[#0F1419] pt-10 pb-20 px-4 sm:px-6 lg:px-8">
      <Helmet>
        <title>Catalogue des cours - PRORASCIENCE ACADEMY</title>
      </Helmet>

      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-6">Catalogue des Cours</h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Explorez nos formations d'excellence et commencez votre apprentissage dès aujourd\'hui.
          </p>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
            <input
              type="text"
              placeholder="Rechercher un cours..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0F1419] border border-white/20 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-yellow-500"
            />
          </div>
          
          <div className="flex space-x-2">
            <Button 
              onClick={() => setFilter('all')}
              className={`${filter === 'all' ? 'bg-yellow-600 text-black' : 'bg-transparent text-gray-300 border border-white/20'} hover:bg-yellow-500 hover:text-black transition-colors`}
            >
              Tous
            </Button>
            <Button 
              onClick={() => setFilter('free')}
              className={`${filter === 'free' ? 'bg-yellow-600 text-black' : 'bg-transparent text-gray-300 border border-white/20'} hover:bg-yellow-500 hover:text-black transition-colors`}
            >
              Gratuits
            </Button>
            <Button 
              onClick={() => setFilter('paid')}
              className={`${filter === 'paid' ? 'bg-yellow-600 text-black' : 'bg-transparent text-gray-300 border border-white/20'} hover:bg-yellow-500 hover:text-black transition-colors`}
            >
              Payants
            </Button>
          </div>
        </div>

        {/* Course Grid */}
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500 mx-auto"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredCourses.map((course) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ duration: 0.3 }}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl hover:border-yellow-500/30 group"
              >
                <div className="h-48 overflow-hidden relative">
                  <img 
                    src={course.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=60&ixlib=rb-4.0.3'} 
                    alt={course.title} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                  />
                  <div className="absolute top-4 right-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${course.is_free ? 'bg-green-500/90 text-white' : 'bg-yellow-500/90 text-black'}`}>
                      {course.is_free ? 'GRATUIT' : `${course.price} €`}
                    </span>
                  </div>
                </div>
                
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-medium text-purple-400 bg-purple-400/10 px-2 py-1 rounded uppercase tracking-wider">
                      {course.category || 'Général'}
                    </span>
                    <span className="flex items-center text-sm text-gray-400">
                      <BarChart className="h-3 w-3 mr-1" />
                      {course.level || 'Tous niveaux'}
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-2 line-clamp-2 group-hover:text-yellow-400 transition-colors">
                    {course.title}
                  </h3>
                  
                  <p className="text-gray-400 text-sm mb-6 line-clamp-3">
                    {course.description}
                  </p>
                  
                  <Link to={`/cours/${course.id}`}>
                    <Button className="w-full bg-white/10 hover:bg-yellow-500 hover:text-black text-white border border-white/10 transition-all duration-300">
                      Voir le cours
                    </Button>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CourseCatalogPage;