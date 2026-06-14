import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Presentation, Plus, Trash, ArrowRight, Upload } from 'lucide-react';

const PowerPointEditorModal = ({ isOpen, onClose, onSave }) => {
  const [activeTab, setActiveTab] = useState('create');
  const [data, setData] = useState({
    title: 'Support de cours',
    type: 'slides', // slides, import, gamma
    gammaUrl: '',
    slides: [
       { title: 'Introduction', content: 'Contenu de la slide...', image: '' }
    ]
  });

  const addSlide = () => {
    setData({
      ...data,
      slides: [...data.slides, { title: 'Nouvelle Slide', content: '', image: '' }]
    });
  };

  const updateSlide = (index, field, value) => {
    const newSlides = [...data.slides];
    newSlides[index][field] = value;
    setData({ ...data, slides: newSlides });
  };

  const removeSlide = (index) => {
    if (data.slides.length <= 1) return;
    setData({
       ...data,
       slides: data.slides.filter((_, i) => i !== index)
    });
  };

  const handleSave = () => {
     onSave({
        ...data,
        id: `ppt-${Date.now()}`
     });
     onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#192734] border-white/10 text-white max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Presentation className="w-5 h-5 text-[var(--school-accent)]"/> Éditeur PowerPoint / Support</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setData({...data, type: val === 'gamma' ? 'gamma' : 'slides'}); }} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="bg-[#0F1419] border border-white/10 w-full shrink-0">
            <TabsTrigger value="create" className="flex-1 data-[state=active]:bg-[var(--school-accent)] data-[state=active]:text-black">Créer Slides</TabsTrigger>
            <TabsTrigger value="import" className="flex-1 data-[state=active]:bg-[var(--school-accent)] data-[state=active]:text-black">Importer PPT</TabsTrigger>
            <TabsTrigger value="gamma" className="flex-1 data-[state=active]:bg-[var(--school-accent)] data-[state=active]:text-black">Lien Gamma</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto py-4">
             <div className="mb-4">
                <Label>Titre du support</Label>
                <Input value={data.title} onChange={e => setData({...data, title: e.target.value})} className="bg-[#0F1419] border-white/10 mt-1" />
             </div>

             <TabsContent value="create" className="space-y-6 mt-0">
                {data.slides.map((slide, idx) => (
                   <div key={idx} className="bg-[#0F1419] p-4 rounded-lg border border-white/10 space-y-3">
                      <div className="flex justify-between items-center">
                         <span className="text-sm font-bold text-[var(--school-accent)]">Slide {idx + 1}</span>
                         <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400" onClick={() => removeSlide(idx)}><Trash className="w-3 h-3"/></Button>
                      </div>
                      <Input placeholder="Titre de la slide" value={slide.title} onChange={e => updateSlide(idx, 'title', e.target.value)} className="bg-[#192734] border-white/10" />
                      <Textarea placeholder="Contenu (texte riche simulé)..." value={slide.content} onChange={e => updateSlide(idx, 'content', e.target.value)} className="bg-[#192734] border-white/10 h-24" />
                   </div>
                ))}
                <Button onClick={addSlide} variant="outline" className="w-full border-dashed border-white/20 text-gray-400 hover:text-white"><Plus className="mr-2 h-4 w-4"/> Ajouter une slide</Button>
             </TabsContent>

             <TabsContent value="import" className="flex flex-col items-center justify-center h-64 space-y-4">
                <div className="p-8 border-2 border-dashed border-white/10 rounded-xl bg-[#0F1419] text-center w-full max-w-md">
                   <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3"/>
                   <p>Glissez votre fichier .pptx ici</p>
                   <p className="text-sm text-gray-500 mt-2">(Simulation : Convertira automatiquement en slides éditables)</p>
                </div>
             </TabsContent>

             <TabsContent value="gamma" className="space-y-4">
                <div className="bg-[#0F1419] p-6 rounded-lg border border-white/10">
                   <Label>Lien d'intégration Gamma (Embed URL)</Label>
                   <Input value={data.gammaUrl} onChange={e => setData({...data, gammaUrl: e.target.value})} placeholder="https://gamma.app/embed/..." className="bg-[#192734] border-white/10 mt-2" />
                   <div className="mt-4 p-4 bg-blue-500/10 text-blue-400 text-sm rounded">
                      Copiez le lien "Embed" depuis votre présentation Gamma pour l'afficher directement dans le lecteur.
                   </div>
                </div>
             </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="mt-4 shrink-0">
           <Button variant="ghost" onClick={onClose} className="text-white">Annuler</Button>
           <Button onClick={handleSave} className="bg-[var(--school-accent)] text-black hover:bg-yellow-500">Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PowerPointEditorModal;