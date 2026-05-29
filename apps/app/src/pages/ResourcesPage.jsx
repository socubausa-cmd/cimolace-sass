import React from 'react';
import { Helmet } from 'react-helmet';
import { 
  LibrarySection,
  VideosSection,
  DocumentsSection,
  ExercisesSection,
  GlossarySection
} from '@/components/resources/ResourcesComponents';

import { BookOpen, Video, FileText, PenTool, Library } from 'lucide-react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';

const ResourcesPage = () => {
  const [tab, setTab] = React.useState('library');
  return (
    <div className="min-h-screen bg-[#0F1419] font-sans pb-20 pt-20">
      <Helmet>
        <title>Ressources Pédagogiques - PRORASCIENCE ACADEMY</title>
      </Helmet>

      {/* Hero Section */}
      <section className="relative h-[250px] w-full overflow-hidden flex items-center justify-center mb-10">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0F1419] via-[#1e1434] to-[#0F1419]" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10" />
        </div>
        
        <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
          <div className="inline-block p-3 bg-purple-500/10 rounded-2xl border border-purple-500/30 mb-4">
             <BookOpen className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4 tracking-tight">
            Centre de Ressources
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto text-lg">
            Bibliothèque, Vidéothèque et Outils d'apprentissage.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6">
        <Tabs value={tab} onValueChange={setTab} className="space-y-8">
          <PremiumSegmentedSelector
            value={tab}
            onChange={setTab}
            layoutId="resources-segment-pill"
            className="max-w-5xl"
            options={[
              { value: 'library', label: 'Bibliothèque', badge: 'Références', icon: Library },
              { value: 'videos', label: 'Vidéos', badge: 'Masterclass', icon: Video },
              { value: 'documents', label: 'Documents', badge: 'PDF & supports', icon: FileText },
              { value: 'exercises', label: 'Exercices', badge: 'Pratique', icon: PenTool },
              { value: 'glossary', label: 'Glossaire', badge: 'Définitions', icon: BookOpen },
            ]}
          />

          <TabsContent value="library" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <LibrarySection />
          </TabsContent>

          <TabsContent value="videos" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <VideosSection />
          </TabsContent>

          <TabsContent value="documents" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <DocumentsSection />
          </TabsContent>

          <TabsContent value="exercises" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <ExercisesSection />
          </TabsContent>

          <TabsContent value="glossary" className="mt-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <GlossarySection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ResourcesPage;