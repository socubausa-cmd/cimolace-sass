import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Helmet } from 'react-helmet';
import { Plus, Edit, Trash2, Users, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import Logo from '@/components/Logo';

const ProfessorDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [courses, setCourses] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '', description: '', category: '', price: 0, is_free: false, level: 'Débutant'
  });

  useEffect(() => {
    if (user) fetchProfessorCourses();
  }, [user]);

  const fetchProfessorCourses = async () => {
    const { data } = await supabase
      .from('courses')
      .select('*')
      .eq('created_by', user.id);
    if (data) setCourses(data);
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('courses').insert([{ ...formData, created_by: user.id }]);
      if (error) throw error;
      toast({ title: "Succès", description: "Cours créé avec succès" });
      setIsModalOpen(false);
      fetchProfessorCourses();
    } catch (err) {
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1419] p-6">
      <Helmet><title>Espace Professeur</title></Helmet>
      
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <Logo size="small" variant="dark" showText={false} className="mb-2" /> {/* Changed to showText={false} */}
            <h1 className="text-3xl font-serif font-bold text-white">Gestion des Cours</h1>
          </div>
          <Button onClick={() => setIsModalOpen(true)} className="bg-[var(--school-accent)] hover:bg-yellow-500 text-black">
            <Plus className="mr-2 h-4 w-4" /> Nouveau Cours
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {courses.map(course => (
            <div key={course.id} className="bg-white/5 border border-white/10 rounded-xl p-6 flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-white">{course.title}</h3>
                <p className="text-gray-400 text-sm mt-1 mb-4">{course.category} • {course.is_free ? 'Gratuit' : `${course.price}€`}</p>
                <div className="flex space-x-2">
                   <Button size="sm" variant="outline" className="border-white/20 text-gray-300 hover:text-white"><Video className="h-4 w-4 mr-1"/> Leçons</Button>
                   <Button size="sm" variant="outline" className="border-white/20 text-gray-300 hover:text-white"><Users className="h-4 w-4 mr-1"/> Élèves</Button>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button size="icon" variant="ghost" className="text-blue-400 hover:bg-blue-400/10"><Edit className="h-4 w-4"/></Button>
                <Button size="icon" variant="ghost" className="text-red-400 hover:bg-red-400/10"><Trash2 className="h-4 w-4"/></Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#161b22] border border-white/10 rounded-2xl p-8 max-w-lg w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Créer un cours</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white"><X /></button>
            </div>
            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Titre</label>
                <input required className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                <textarea className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white" rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-sm font-medium text-gray-400 mb-1">Catégorie</label>
                   <input className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-400 mb-1">Prix (€)</label>
                   <input type="number" className="w-full bg-black/30 border border-white/20 rounded-lg p-3 text-white" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-[var(--school-accent)] hover:bg-yellow-500 text-black font-bold">
                {loading ? 'Création...' : 'Créer le cours'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessorDashboard;