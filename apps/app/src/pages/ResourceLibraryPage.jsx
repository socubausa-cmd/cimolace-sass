import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Search, Filter, Download, Book, Video, FileText, Bookmark } from 'lucide-react';

const ResourceLibraryPage = () => {
  const [activeTab, setActiveTab] = useState('all');

  const resources = [
    { id: 1, title: "Guide de Méditation", type: "pdf", category: "Pratique", size: "2.4 MB" },
    { id: 2, title: "Introduction à l'Hermétisme", type: "video", category: "Théorie", duration: "45 min" },
    { id: 3, title: "Calendrier Rituel 2024", type: "pdf", category: "Outils", size: "1.1 MB" },
    { id: 4, title: "Symbolisme des Couleurs", type: "article", category: "Symbolisme", readTime: "10 min" },
    { id: 5, title: "Exercices de Respiration", type: "audio", category: "Pratique", duration: "15 min" },
    { id: 6, title: "Les 7 Lois Universelles", type: "pdf", category: "Théorie", size: "5.8 MB" },
  ];

  return (
    <div className="min-h-screen bg-[#0F1419] text-white pt-24 pb-20">
      <Helmet>
        <title>Bibliothèque de Ressources | PRORASCIENCE</title>
      </Helmet>

      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div>
            <h1 className="text-3xl font-serif font-bold mb-2">Bibliothèque de Savoir</h1>
            <p className="text-gray-400">Accédez à l'ensemble de nos documents, vidéos et outils.</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
             <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="text" placeholder="Rechercher une ressource..." className="w-full bg-[#192734] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:border-[var(--school-accent)] outline-none text-white" />
             </div>
             <Button variant="outline" className="border-white/10 text-gray-300 hover:text-white"><Filter className="w-4 h-4" /></Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-8 border-b border-white/5">
          {['all', 'pdf', 'video', 'audio', 'article'].map((type) => (
             <button
               key={type}
               onClick={() => setActiveTab(type)}
               className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                 activeTab === type ? 'bg-[var(--school-accent)] text-black' : 'text-gray-400 hover:bg-white/5 hover:text-white'
               }`}
             >
               {type === 'all' ? 'Tout' : type.charAt(0).toUpperCase() + type.slice(1)}
             </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resources.map((res) => (
             <div key={res.id} className="bg-[#192734] border border-white/5 rounded-xl p-6 hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-all group">
                <div className="flex justify-between items-start mb-4">
                   <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      res.type === 'pdf' ? 'bg-red-500/10 text-red-500' :
                      res.type === 'video' ? 'bg-blue-500/10 text-blue-500' :
                      res.type === 'audio' ? 'bg-purple-500/10 text-purple-500' :
                      'bg-green-500/10 text-green-500'
                   }`}>
                      {res.type === 'pdf' ? <FileText className="w-5 h-5"/> : 
                       res.type === 'video' ? <Video className="w-5 h-5"/> :
                       <Book className="w-5 h-5"/>}
                   </div>
                   <button className="text-gray-500 hover:text-[var(--school-accent)] transition-colors"><Bookmark className="w-5 h-5"/></button>
                </div>
                
                <h3 className="font-bold text-lg mb-2 group-hover:text-[var(--school-accent)] transition-colors">{res.title}</h3>
                
                <div className="flex items-center justify-between mt-6 text-sm text-gray-400">
                   <span className="bg-white/5 px-2 py-1 rounded uppercase tracking-wide">{res.category}</span>
                   <span>{res.size || res.duration || res.readTime}</span>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5 flex gap-2">
                   <Button className="w-full bg-white/5 hover:bg-[var(--school-accent)] hover:text-black text-white text-xs h-8">
                      {res.type === 'pdf' ? 'Télécharger' : 'Consulter'}
                   </Button>
                </div>
             </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ResourceLibraryPage;