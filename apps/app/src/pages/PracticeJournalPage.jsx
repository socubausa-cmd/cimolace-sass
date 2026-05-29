import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { PenTool, Calendar, BookOpen } from 'lucide-react';

const PracticeJournalPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ module_id: '', content: '', reflection: '' });

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: student } = await supabase.from('students').select('id').eq('user_id', user.id).single();
      if (student) {
         // Fetch entries
         const { data: journalData } = await supabase
            .from('second_year_practice_journal')
            .select('*, second_year_modules(title)')
            .eq('student_id', student.id)
            .order('entry_date', { ascending: false });
         setEntries(journalData || []);

         // Fetch modules for dropdown
         const { data: mods } = await supabase.from('second_year_modules').select('id, title').order('order');
         setModules(mods || []);
      }
    } catch (error) {
       console.error(error);
    } finally {
       setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data: student } = await supabase.from('students').select('id').eq('user_id', user.id).single();
      if (!student) return;

      const { error } = await supabase.from('second_year_practice_journal').insert([{
         student_id: student.id,
         module_id: formData.module_id,
         content: formData.content,
         reflection: formData.reflection,
         entry_date: new Date()
      }]);

      if (error) throw error;
      toast({ title: "Succès", description: "Entrée ajoutée au journal." });
      setShowForm(false);
      setFormData({ module_id: '', content: '', reflection: '' });
      fetchData();
    } catch (error) {
       toast({ title: "Erreur", description: "Erreur lors de l'enregistrement", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-24 pb-20 px-6">
       <Helmet><title>Journal de Pratique | PRORASCIENCE</title></Helmet>
       <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-10">
             <div>
                <h1 className="text-3xl font-serif font-bold mb-2">Journal de Pratique</h1>
                <p className="text-gray-400">Consignez vos expériences, rituels et réflexions quotidiennes.</p>
             </div>
             <Button onClick={() => setShowForm(!showForm)} className="bg-[#D4AF37] text-black font-bold">
                {showForm ? 'Annuler' : 'Nouvelle Entrée'}
             </Button>
          </div>

          {showForm && (
             <div className="bg-[#192734] border border-white/10 rounded-xl p-6 mb-10 animate-in fade-in slide-in-from-top-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                   <div>
                      <label className="block text-sm font-bold text-gray-300 mb-2">Module concerné</label>
                      <select 
                         required
                         className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-[#D4AF37] outline-none"
                         value={formData.module_id}
                         onChange={e => setFormData({...formData, module_id: e.target.value})}
                      >
                         <option value="">Sélectionner un module</option>
                         {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm font-bold text-gray-300 mb-2">Contenu de la pratique</label>
                      <textarea 
                         required
                         className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white h-32 focus:border-[#D4AF37] outline-none"
                         placeholder="Décrivez le rituel ou l'exercice effectué..."
                         value={formData.content}
                         onChange={e => setFormData({...formData, content: e.target.value})}
                      />
                   </div>
                   <div>
                      <label className="block text-sm font-bold text-gray-300 mb-2">Réflexion personnelle / Ressenti</label>
                      <textarea 
                         className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white h-24 focus:border-[#D4AF37] outline-none"
                         placeholder="Vos impressions, difficultés, révélations..."
                         value={formData.reflection}
                         onChange={e => setFormData({...formData, reflection: e.target.value})}
                      />
                   </div>
                   <div className="pt-4 flex justify-end">
                      <Button type="submit" className="bg-[#D4AF37] text-black font-bold">Enregistrer l'entrée</Button>
                   </div>
                </form>
             </div>
          )}

          <div className="space-y-6">
             {loading ? <div className="text-center text-gray-500">Chargement...</div> : entries.length === 0 ? (
                <div className="text-center p-12 bg-[#192734] rounded-xl border border-dashed border-white/10">
                   <PenTool className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                   <p className="text-gray-400">Aucune entrée pour le moment. Commencez votre journal aujourd'hui.</p>
                </div>
             ) : (
                entries.map(entry => (
                   <div key={entry.id} className="bg-[#192734] border border-white/5 rounded-xl p-6 hover:border-[#D4AF37]/30 transition-colors">
                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                         <span className="flex items-center gap-1"><Calendar className="w-3 h-3"/> {new Date(entry.entry_date).toLocaleDateString()}</span>
                         {entry.second_year_modules && <span className="flex items-center gap-1"><BookOpen className="w-3 h-3"/> {entry.second_year_modules.title}</span>}
                      </div>
                      <div className="space-y-4">
                         <div>
                            <h4 className="text-[#D4AF37] text-sm font-bold uppercase mb-1">Pratique</h4>
                            <p className="text-gray-300 text-sm whitespace-pre-line">{entry.content}</p>
                         </div>
                         {entry.reflection && (
                            <div className="bg-black/20 p-4 rounded-lg border-l-2 border-[#D4AF37]">
                               <h4 className="text-gray-400 text-xs font-bold uppercase mb-1">Réflexion</h4>
                               <p className="text-gray-400 text-sm italic">"{entry.reflection}"</p>
                            </div>
                         )}
                      </div>
                   </div>
                ))
             )}
          </div>
       </div>
    </div>
  );
};

export default PracticeJournalPage;