import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useDataSync } from '@/contexts/DataSyncContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Trash, BookOpen, FileText, Video, Save, ArrowLeft, GripVertical, Check } from 'lucide-react';

const FormationBuilder = () => {
  const { formations, updateFormation, addFormation } = useDataSync();
  const location = useLocation();
  const [selectedFormationId, setSelectedFormationId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Local state for editing to prevent constant context syncs
  const [localFormation, setLocalFormation] = useState(null);

  useEffect(() => {
    // Check if routed with a specific formation ID
    if (location.state?.formationId) {
      setSelectedFormationId(location.state.formationId);
    } else if (formations.length > 0 && !selectedFormationId) {
      setSelectedFormationId(formations[0].id);
    }
  }, [location.state, formations]);

  useEffect(() => {
    if (selectedFormationId) {
      const found = formations.find(f => f.id === selectedFormationId);
      if (found) setLocalFormation(JSON.parse(JSON.stringify(found))); // Deep copy
    }
  }, [selectedFormationId, formations]);

  const handleSave = () => {
    if (localFormation) {
      updateFormation(localFormation.id, localFormation);
      setIsEditing(false);
    }
  };

  const addModule = () => {
    if (!localFormation) return;
    const newModule = {
      id: `mod-${Date.now()}`,
      title: `Nouveau Module ${localFormation.modules?.length + 1 || 1}`,
      description: 'Description du module...',
      lessons: []
    };
    setLocalFormation({
      ...localFormation,
      modules: [...(localFormation.modules || []), newModule]
    });
    setIsEditing(true);
  };

  const updateModule = (modId, field, value) => {
    const updatedModules = localFormation.modules.map(m => 
      m.id === modId ? { ...m, [field]: value } : m
    );
    setLocalFormation({ ...localFormation, modules: updatedModules });
    setIsEditing(true);
  };

  const deleteModule = (modId) => {
    const updatedModules = localFormation.modules.filter(m => m.id !== modId);
    setLocalFormation({ ...localFormation, modules: updatedModules });
    setIsEditing(true);
  };

  const addLesson = (modId, type) => {
    const updatedModules = localFormation.modules.map(m => {
      if (m.id === modId) {
        return {
          ...m,
          lessons: [...(m.lessons || []), {
            id: `les-${Date.now()}`,
            title: 'Nouvelle Leçon',
            type, // video, text, quiz
            duration: '00:00'
          }]
        };
      }
      return m;
    });
    setLocalFormation({ ...localFormation, modules: updatedModules });
    setIsEditing(true);
  };

  if (!localFormation) return <div className="p-8 text-center text-gray-500">Chargement...</div>;

  return (
    <div className="grid grid-cols-12 gap-6 h-[calc(100vh-140px)]">
      {/* Sidebar List */}
      <div className="col-span-12 md:col-span-3 bg-[#192734] border border-white/10 rounded-xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-white/10 bg-[#15202B] flex justify-between items-center">
          <span className="font-bold text-white">Formations</span>
          <Button size="icon" variant="ghost" onClick={() => {
             const newId = `fmt-${Date.now()}`;
             addFormation({ id: newId, title: 'Nouvelle Formation', level: 'Nouveau', description: '', modules: [] });
             setSelectedFormationId(newId);
          }}>
            <Plus className="h-4 w-4 text-[var(--school-accent)]" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {formations.map(f => (
            <button
              key={f.id}
              onClick={() => setSelectedFormationId(f.id)}
              className={`w-full text-left p-3 rounded-lg transition-colors text-sm font-medium ${selectedFormationId === f.id ? 'bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[var(--school-accent)] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
            >
              {f.title}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="col-span-12 md:col-span-9 space-y-6 overflow-y-auto pr-2 pb-20">
        <div className="flex justify-between items-center bg-[#192734] p-4 rounded-xl border border-white/10 sticky top-0 z-10 backdrop-blur-xl bg-opacity-90">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
               <BookOpen className="h-5 w-5 text-[var(--school-accent)]" />
               Éditeur de Contenu
            </h2>
            {isEditing && <span className="text-xs text-yellow-500 flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div> Modifications non enregistrées</span>}
          </div>
          <Button onClick={handleSave} disabled={!isEditing} className={`gap-2 ${isEditing ? 'bg-[var(--school-accent)] text-black hover:bg-yellow-500' : 'bg-gray-700 text-gray-400'}`}>
            <Save className="h-4 w-4" /> {isEditing ? 'Enregistrer' : 'À jour'}
          </Button>
        </div>

        <Card className="bg-[#192734] border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Détails Généraux</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Titre</label>
                <Input 
                   value={localFormation.title} 
                   onChange={(e) => { setLocalFormation({...localFormation, title: e.target.value}); setIsEditing(true); }}
                   className="bg-[#0F1419] border-white/10 text-white" 
                />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">Niveau</label>
                <Input 
                   value={localFormation.level} 
                   onChange={(e) => { setLocalFormation({...localFormation, level: e.target.value}); setIsEditing(true); }}
                   className="bg-[#0F1419] border-white/10 text-white" 
                />
              </div>
            </div>
            <div>
               <label className="text-sm text-gray-500 mb-1 block">Description</label>
               <Textarea 
                  value={localFormation.description} 
                  onChange={(e) => { setLocalFormation({...localFormation, description: e.target.value}); setIsEditing(true); }}
                  className="bg-[#0F1419] border-white/10 text-white" 
               />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
           <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">Modules du Programme</h3>
              <Button size="sm" onClick={addModule} className="bg-blue-600 hover:bg-blue-700 text-white border-none"><Plus className="h-3 w-3 mr-1"/> Ajouter Module</Button>
           </div>
           
           <Accordion type="single" collapsible className="space-y-4">
             {localFormation.modules?.map((module, idx) => (
               <AccordionItem key={module.id} value={module.id} className="border border-white/10 rounded-lg bg-[#192734] px-4">
                 <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-3 w-full pr-4">
                      <GripVertical className="h-4 w-4 text-gray-600 cursor-move" />
                      <span className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-white font-mono">{idx + 1}</span>
                      <Input 
                        value={module.title}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateModule(module.id, 'title', e.target.value)}
                        className="h-8 bg-transparent border-none text-white font-medium focus:bg-black/20"
                      />
                      <div className="ml-auto flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                         <span className="text-sm text-gray-500">{module.lessons?.length || 0} leçons</span>
                         <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:bg-red-500/10" onClick={() => deleteModule(module.id)}>
                            <Trash className="h-3 w-3" />
                         </Button>
                      </div>
                    </div>
                 </AccordionTrigger>
                 <AccordionContent className="pt-2 pb-4 space-y-3">
                    <div className="pl-9 pr-2">
                       <Textarea 
                         placeholder="Description du module..."
                         value={module.description}
                         onChange={(e) => updateModule(module.id, 'description', e.target.value)}
                         className="bg-[#0F1419] border-white/5 text-sm text-gray-300 mb-4"
                       />
                       
                       <div className="space-y-2">
                          {module.lessons?.map((lesson, lIdx) => (
                            <div key={lesson.id} className="flex items-center gap-3 p-3 bg-[#0F1419] rounded border border-white/5 group">
                               <GripVertical className="h-4 w-4 text-gray-700 group-hover:text-gray-500" />
                               {lesson.type === 'video' ? <Video className="h-4 w-4 text-blue-400"/> : <FileText className="h-4 w-4 text-green-400"/>}
                               <Input 
                                 value={lesson.title}
                                 onChange={(e) => {
                                    const updatedLessons = module.lessons.map(l => l.id === lesson.id ? { ...l, title: e.target.value } : l);
                                    updateModule(module.id, 'lessons', updatedLessons);
                                 }}
                                 className="h-7 bg-transparent border-none text-sm text-gray-300 focus:text-white p-0"
                               />
                               <span className="text-sm text-gray-600 ml-auto">{lesson.duration}</span>
                               <Button 
                                 size="icon" 
                                 variant="ghost" 
                                 className="h-6 w-6 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                 onClick={() => {
                                    const updatedLessons = module.lessons.filter(l => l.id !== lesson.id);
                                    updateModule(module.id, 'lessons', updatedLessons);
                                 }}
                               >
                                 <Trash className="h-3 w-3"/>
                               </Button>
                            </div>
                          ))}
                          
                          <div className="flex gap-2 mt-4 pt-2 border-t border-white/5">
                            <Button size="sm" variant="ghost" onClick={() => addLesson(module.id, 'video')} className="text-blue-400 hover:bg-blue-400/10 hover:text-blue-300 text-xs">
                              <Plus className="h-3 w-3 mr-1"/> Ajouter Vidéo
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => addLesson(module.id, 'text')} className="text-green-400 hover:bg-green-400/10 hover:text-green-300 text-xs">
                              <Plus className="h-3 w-3 mr-1"/> Ajouter Texte
                            </Button>
                          </div>
                       </div>
                    </div>
                 </AccordionContent>
               </AccordionItem>
             ))}
           </Accordion>
        </div>
      </div>
    </div>
  );
};

export default FormationBuilder;