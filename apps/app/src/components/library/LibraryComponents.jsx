import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { FileText, Lock, Download, Play, Book, ExternalLink, ChevronDown, ChevronUp, Search, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

// --- OfficialManualsSection ---
export const OfficialManualsSection = ({ searchTerm }) => {
  const [manuals, setManuals] = useState([]);

  useEffect(() => {
    const fetchManuals = async () => {
      const { data } = await supabase.from('library_documents').select('id,title,description,cycle,access_level').eq('category', 'manuels').limit(100);
      if (data) setManuals(data);
    };
    fetchManuals();
  }, []);

  const filtered = manuals.filter(m => !searchTerm || m.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filtered.map((manual) => (
        <motion.div key={manual.id} whileHover={{ y: -5 }} className="bg-[#192734] border border-white/10 rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4">
            {manual.access_level === 'reserved' ? <Lock className="w-5 h-5 text-red-400" /> : <div className="w-2 h-2 bg-green-500 rounded-full" />}
          </div>
          <div className="mb-4 text-[var(--school-accent)]">
            <Book className="w-8 h-8" />
          </div>
          <span className="inline-block px-2 py-1 bg-white/5 text-sm text-gray-400 rounded mb-2 uppercase tracking-wide">{manual.cycle || 'Universel'}</span>
          <h3 className="text-xl font-serif font-bold text-white mb-2">{manual.title}</h3>
          <p className="text-sm text-gray-400 mb-4">{manual.description || "Manuel officiel du cycle."}</p>
          <Button variant="outline" className="w-full border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] text-[var(--school-accent)] hover:bg-[var(--school-accent)] hover:text-black">
            <Download className="w-4 h-4 mr-2" /> Télécharger PDF
          </Button>
        </motion.div>
      ))}
    </div>
  );
};

// --- CourseMaterialsSection ---
export const CourseMaterialsSection = ({ searchTerm }) => {
  const [materials, setMaterials] = useState([]);

  useEffect(() => {
    const fetchMaterials = async () => {
      const { data } = await supabase.from('library_documents').select('id,title,cycle,professor').eq('category', 'supports_cours').limit(100);
      if (data) setMaterials(data);
    };
    fetchMaterials();
  }, []);

  const filtered = materials.filter(m => !searchTerm || m.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-4">
      {filtered.map((item) => (
        <div key={item.id} className="bg-[#192734] border border-white/10 rounded-lg p-4 flex flex-col md:flex-row items-center justify-between hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-colors">
          <div className="flex items-center space-x-4 mb-4 md:mb-0">
            <div className="bg-blue-500/20 p-3 rounded-lg text-blue-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-white font-medium">{item.title}</h4>
              <p className="text-sm text-gray-400">{item.cycle} • {item.professor || "Professeur"}</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" className="text-gray-300 hover:text-white hover:bg-white/10">
            <Download className="w-4 h-4 mr-2" /> Accéder
          </Button>
        </div>
      ))}
    </div>
  );
};

// --- ArchivesReplaysSection ---
export const ArchivesReplaysSection = ({ searchTerm }) => {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    const fetchVideos = async () => {
      const { data } = await supabase.from('library_videos').select('id,title,thumbnail_url,duration,date,cycle').limit(100);
      if (data) setVideos(data);
    };
    fetchVideos();
  }, []);

  const filtered = videos.filter(v => !searchTerm || v.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filtered.map((video) => (
        <div key={video.id} className="bg-[#192734] rounded-xl overflow-hidden border border-white/10 group">
          <div className="relative aspect-video bg-black/50">
            {video.thumbnail_url ? (
              <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-600"><Play className="w-12 h-12" /></div>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white/10 backdrop-blur-sm p-3 rounded-full border border-white/20 group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 text-white fill-current" />
              </div>
            </div>
            <span className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 text-xs text-white rounded">{video.duration || "00:00"}</span>
          </div>
          <div className="p-4">
            <h4 className="text-white font-medium line-clamp-2 mb-2">{video.title}</h4>
            <div className="flex justify-between items-center text-sm text-gray-400">
              <span>{video.date || "Date inconnue"}</span>
              <span className="text-[var(--school-accent)]">{video.cycle}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// --- GlossarySection ---
export const GlossarySection = ({ searchTerm }) => {
  const [terms, setTerms] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const fetchTerms = async () => {
      const { data } = await supabase.from('library_glossary').select('id,term,definition').limit(200);
      if (data) setTerms(data);
    };
    fetchTerms();
  }, []);

  const filtered = terms.filter(t => !searchTerm || t.term.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="bg-[#192734] border border-white/10 rounded-xl p-6">
      <div className="mb-6 flex items-center justify-between">
         <h3 className="text-xl font-serif text-white">Référentiel Doctrinal</h3>
         <span className="text-xs text-[var(--school-accent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] px-2 py-1 rounded">Norme Officielle</span>
      </div>
      <div className="space-y-2">
        {filtered.map((item) => (
          <div key={item.id} className="border-b border-white/5 last:border-0">
            <button 
              onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
              className="w-full flex items-center justify-between py-4 text-left hover:bg-white/5 px-2 rounded transition-colors"
            >
              <span className="font-bold text-[var(--school-accent)] font-mono">{item.term}</span>
              {expandedId === item.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            <AnimatePresence>
              {expandedId === item.id && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }} 
                  animate={{ height: 'auto', opacity: 1 }} 
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <p className="text-gray-300 pb-4 px-2 text-sm leading-relaxed border-l-2 border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] ml-2 pl-4">
                    {item.definition}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- FoundingTextsSection ---
export const FoundingTextsSection = ({ searchTerm }) => {
  const [texts, setTexts] = useState([]);

  useEffect(() => {
    const fetchTexts = async () => {
      const { data } = await supabase.from('library_documents').select('id,title,description').eq('category', 'textes_fondateurs').limit(50);
      if (data) setTexts(data);
    };
    fetchTexts();
  }, []);

  const filtered = texts.filter(t => !searchTerm || t.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {filtered.map((text) => (
        <div key={text.id} className="flex items-start p-4 bg-[#192734] border border-white/10 rounded-lg hover:border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] transition-colors">
          <div className="bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] p-3 rounded mr-4">
            <GraduationCap className="w-6 h-6 text-[var(--school-accent)]" />
          </div>
          <div className="flex-1">
            <h4 className="text-white font-bold mb-1">{text.title}</h4>
            <p className="text-sm text-gray-400 mb-2">{text.description}</p>
            <Button size="sm" variant="link" className="text-[var(--school-accent)] p-0 h-auto">
              Lire le document &rarr;
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

// --- RecommendedReadingSection ---
export const RecommendedReadingSection = ({ searchTerm }) => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const fetchItems = async () => {
      const { data } = await supabase.from('library_recommended').select('id,title,author,type,image_url,url').limit(50);
      if (data) setItems(data);
    };
    fetchItems();
  }, []);

  const filtered = items.filter(i => !searchTerm || i.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {filtered.map((item) => (
        <div key={item.id} className="bg-[#192734] border border-white/10 rounded-lg overflow-hidden flex flex-col h-full">
          <div className="h-32 bg-gray-800 relative">
             {item.image_url && <img src={item.image_url} alt={item.title} className="w-full h-full object-cover opacity-75 hover:opacity-100 transition-opacity" />}
             <span className="absolute top-2 right-2 text-[10px] bg-black/60 text-white px-2 py-0.5 rounded uppercase">{item.type}</span>
          </div>
          <div className="p-3 flex-1 flex flex-col">
            <h5 className="text-white text-sm font-bold mb-1 leading-tight">{item.title}</h5>
            <p className="text-sm text-gray-400 mb-3">{item.author}</p>
            <div className="mt-auto">
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center text-xs text-[var(--school-accent)] hover:underline">
                Voir la source <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};