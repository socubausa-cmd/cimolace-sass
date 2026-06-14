import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { CheckCircle, Circle, FileText, Video } from 'lucide-react';

const ModuleContentPage = () => {
  const { moduleId } = useParams();
  const [content, setContent] = useState([]);
  const [moduleInfo, setModuleInfo] = useState(null);
  const [activeWeek, setActiveWeek] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContent();
  }, [moduleId]);

  const fetchContent = async () => {
    try {
      const { data: modData } = await supabase.from('modules_year2').select('*').eq('id', moduleId).single();
      setModuleInfo(modData);

      const { data: contentData } = await supabase
        .from('module_content_y2')
        .select('*')
        .eq('module_id', moduleId)
        .order('week_number');
      
      setContent(contentData || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const currentContent = content.find(c => c.week_number === activeWeek);

  if (loading) return <div className="text-center pt-24 text-white">Chargement...</div>;

  return (
    <div className="min-h-screen bg-[#0F1419] text-white flex pt-20">
      <Helmet><title>{moduleInfo?.title} | Apprentissage</title></Helmet>

      {/* Sidebar */}
      <div className="w-64 bg-[#192734] border-r border-white/5 p-4 hidden md:block overflow-y-auto h-[calc(100vh-80px)] fixed">
        <h3 className="font-bold text-gray-400 text-xs uppercase mb-4 tracking-wider">Programme</h3>
        <div className="space-y-2">
          {content.map((week) => (
            <button
              key={week.id}
              onClick={() => setActiveWeek(week.week_number)}
              className={`w-full text-left p-3 rounded-lg text-sm flex items-center gap-3 transition-colors ${
                activeWeek === week.week_number ? 'bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30' : 'hover:bg-white/5 text-gray-400'
              }`}
            >
              <div className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs font-bold shrink-0">
                {week.week_number}
              </div>
              <span className="truncate">{week.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 md:ml-64 p-8 max-w-4xl">
        {currentContent ? (
          <>
            <div className="mb-8 border-b border-white/5 pb-8">
              <span className="text-[#D4AF37] font-bold text-sm uppercase tracking-wide">Semaine {currentContent.week_number}</span>
              <h1 className="text-3xl font-serif font-bold mt-2">{currentContent.title}</h1>
            </div>

            <div className="prose prose-invert max-w-none mb-12">
              <p>{currentContent.content}</p>
              {/* Render rich text/HTML content here normally */}
            </div>

            {/* Resources Section */}
            {currentContent.resources && currentContent.resources.length > 0 && (
              <div className="bg-[#192734] rounded-xl p-6 mb-8">
                <h3 className="font-bold text-lg mb-4">Ressources</h3>
                <div className="grid gap-3">
                  {currentContent.resources.map((res, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-black/20 rounded-lg">
                      {res.type === 'video' ? <Video className="w-4 h-4 text-blue-400"/> : <FileText className="w-4 h-4 text-orange-400"/>}
                      <span>{res.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between mt-12 pt-8 border-t border-white/5">
              <Button 
                variant="outline" 
                disabled={activeWeek <= 1}
                onClick={() => setActiveWeek(prev => prev - 1)}
              >
                Précédent
              </Button>
              <Button 
                className="bg-[#D4AF37] text-black"
                onClick={() => setActiveWeek(prev => Math.min(prev + 1, content.length))}
              >
                {activeWeek === content.length ? 'Terminer Module' : 'Suivant'}
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-gray-500">Sélectionnez une semaine pour commencer.</div>
        )}
      </div>
    </div>
  );
};

export default ModuleContentPage;