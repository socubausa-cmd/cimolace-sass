import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { 
  ArrowLeft, ArrowRight, Save, Plus, Trash, Video, FileText, 
  Presentation, CheckCircle, Image as ImageIcon, Upload, Calendar, Layout, Loader2, Menu, Copy,
} from 'lucide-react';
import ProgressivePlaylist from '@/components/school/classroom/ProgressivePlaylist';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import VideoPostProductionPage from '@/pages/VideoPostProductionPage';

import VideoUploadModal from './VideoUploadModal';
import PowerPointEditorModal from './PowerPointEditorModal';
import QuizBuilder from './QuizBuilder';
import ProgressionQuizManager from './ProgressionQuizManager';
import VideoPlayer from './VideoPlayer';
import PowerPointViewer from './PowerPointViewer';
import MindMapNavigation from '@/components/lesson-player/MindMapNavigation';
import TranscriptPanel from '@/components/lesson-player/TranscriptPanel';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';

const isUuid = (value) => {
  if (!value) return false;
  const s = String(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
};

// --- STEP 1: GENERAL INFO (Preserved) ---
const StepGeneral = ({ data, update, billingPlans = [] }) => {
  const handleImageUpload = (e, field) => {
     const file = e.target.files[0];
     if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
           update(field, reader.result);
        };
        reader.readAsDataURL(file);
     }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4">
      <div className="space-y-2">
        <Label>Titre de la formation</Label>
        <Input value={data.title} onChange={e => update('title', e.target.value)} className="bg-[#15202B] border-white/10 text-white" />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea value={data.description} onChange={e => update('description', e.target.value)} className="bg-[#15202B] border-white/10 text-white min-h-[120px]" />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>Catégorie</Label>
          <Select value={data.category} onValueChange={v => update('category', v)}>
            <SelectTrigger className="bg-[#15202B] border-white/10 text-white"><SelectValue placeholder="Choisir..." /></SelectTrigger>
            <SelectContent>
                <SelectItem value="Développement Personnel">Développement Personnel</SelectItem>
                <SelectItem value="Spiritualité">Spiritualité</SelectItem>
                <SelectItem value="Histoire">Histoire</SelectItem>
                <SelectItem value="Sciences">Sciences</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Année Académique</Label>
          <Select value={data.year} onValueChange={v => update('year', v)}>
             <SelectTrigger className="bg-[#15202B] border-white/10 text-white"><SelectValue placeholder="Choisir..." /></SelectTrigger>
             <SelectContent>
                <SelectItem value="1ère année">1ère année (Fondamental)</SelectItem>
                <SelectItem value="2ème année">2ème année (Approfondi)</SelectItem>
                <SelectItem value="3ème année">3ème année (Maîtrise)</SelectItem>
             </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Numéro de module catalogue (1–21) — référence publique</Label>
        <Select value={data.catalog_number ? String(data.catalog_number) : '__none__'} onValueChange={v => update('catalog_number', v === '__none__' ? null : Number(v))}>
          <SelectTrigger className="bg-[#15202B] border-white/10 text-white"><SelectValue placeholder="Associer à un module du catalogue (optionnel)" /></SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="__none__">— Aucun (non lié au catalogue) —</SelectItem>
            {["1 — Ontologie Sacrée","2 — Cosmologie sacrée","3 — Mécanique Vibratoire","4 — Science du Destin","5 — Science de l'Incarnation","6 — Science des Ancêtres","7 — Science des Divinités","8 — Science des Esprits","9 — Science de la Divination","10 — Science des Rituels","11 — Science du Verbe Sacré","12 — Science des Talismans","13 — Science des Plantes Sacrées","14 — Science de la Guérison Spirituelle","15 — Science de la Protection Spirituelle","16 — Science des Forces Occultes","17 — Sexualité Sacrée et Énergie Vitale","18 — Science du Corps Spirituel","19 — Science des Lieux Sacrés","20 — Science du Temps Sacré","21 — Mayekou"].map((label, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-gray-500">Ce numéro lie cette formation au slot correspondant dans le catalogue public — le module apparaîta automatiquement disponible une fois publié.</p>
      </div>
      <div className="space-y-4 rounded-lg border border-white/10 bg-[#192734] p-4">
        <div className="space-y-2">
          <Label>Mode d'accès</Label>
          <Select value={data.access_mode || 'free'} onValueChange={(v) => update('access_mode', v)}>
            <SelectTrigger className="bg-[#15202B] border-white/10 text-white"><SelectValue placeholder="Choisir..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="free">Gratuit</SelectItem>
              <SelectItem value="subscription">Abonnement (lié à un forfait)</SelectItem>
              <SelectItem value="one_time">Vente individuelle (module payant)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-400">
            Ce choix détermine qui peut accéder à la formation après publication.
          </p>
        </div>

        {data.access_mode === 'subscription' ? (
          <div className="space-y-2">
            <Label>Forfait requis</Label>
            <Select
              value={data.billing_plan_slug || '__none__'}
              onValueChange={(v) => update('billing_plan_slug', v === '__none__' ? null : v)}
            >
              <SelectTrigger className="bg-[#15202B] border-white/10 text-white"><SelectValue placeholder="Choisir un forfait" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Aucun (à définir) —</SelectItem>
                {billingPlans.map((plan) => (
                  <SelectItem key={plan.key} value={plan.key}>
                    {plan.label || plan.key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Astuce: crée d'abord les forfaits dans `billing_plans` pour les sélectionner ici.
            </p>
          </div>
        ) : null}

        {data.access_mode === 'one_time' ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prix du module</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={data.standalone_price ?? ''}
                onChange={(e) => update('standalone_price', e.target.value === '' ? null : Number(e.target.value))}
                className="bg-[#15202B] border-white/10 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label>Devise</Label>
              <Select value={data.standalone_currency || 'XAF'} onValueChange={(v) => update('standalone_currency', v)}>
                <SelectTrigger className="bg-[#15202B] border-white/10 text-white"><SelectValue placeholder="Devise" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="XAF">XAF</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-6">
         <div className="space-y-2">
            <Label>Miniature (Liste) - 400x300px</Label>
            <div className="relative group border-2 border-dashed border-white/10 rounded-lg h-32 flex items-center justify-center bg-[#15202B] overflow-hidden">
               {data.thumbnail ? (
                  <img src={data.thumbnail} alt="Thumbnail" className="w-full h-full object-cover" />
               ) : (
                  <div className="text-center text-gray-500">
                     <ImageIcon className="w-6 h-6 mx-auto mb-1"/>
                     <span className="text-xs">Charger image</span>
                  </div>
               )}
               <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'thumbnail')} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
         </div>
         <div className="space-y-2">
            <Label>Couverture (Détails) - 1200x400px</Label>
             <div className="relative group border-2 border-dashed border-white/10 rounded-lg h-32 flex items-center justify-center bg-[#15202B] overflow-hidden">
               {data.coverImage ? (
                  <img src={data.coverImage} alt="Cover" className="w-full h-full object-cover" />
               ) : (
                  <div className="text-center text-gray-500">
                     <Upload className="w-6 h-6 mx-auto mb-1"/>
                     <span className="text-xs">Charger couverture</span>
                  </div>
               )}
               <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'coverImage')} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
         </div>
      </div>
    </div>
  );
};

// --- STEP 2 & 3: STRUCTURE ---
const StepStructure = ({ modules, setModules, formationId }) => {
  const { toast } = useToast();
  const [activeVideoModal, setActiveVideoModal] = useState({ open: false, path: null });
  const [activePPTModal, setActivePPTModal] = useState({ open: false, path: null });
  const [activeQuizModal, setActiveQuizModal] = useState({ open: false, path: null });
  const [postProd, setPostProd] = useState({ open: false, contentId: null });

  // Structure Helpers
  const addModule = () => setModules([...modules, { id: Date.now(), title: `Module ${modules.length + 1}`, weeks: [] }]);
  
  const addWeek = (mIdx) => {
    const newMods = [...modules];
    newMods[mIdx].weeks.push({ id: Date.now(), title: `Semaine ${newMods[mIdx].weeks.length + 1}`, days: [] });
    setModules(newMods);
  };

  const addDay = (mIdx, wIdx) => {
    const newMods = [...modules];
    newMods[mIdx].weeks[wIdx].days.push({ 
       id: Date.now(), 
       title: `Jour ${newMods[mIdx].weeks[wIdx].days.length + 1}`, 
       videos: [], 
       powerpoint: null, 
       quiz: null 
    });
    setModules(newMods);
  };

  // Content Handlers
  const handleSaveVideo = (videoData) => {
    const { mIdx, wIdx, dIdx } = activeVideoModal.path;
    const newMods = [...modules];
    newMods[mIdx].weeks[wIdx].days[dIdx].videos.push(videoData);
    setModules(newMods);
  };

  const handleSavePPT = (pptData) => {
    const { mIdx, wIdx, dIdx } = activePPTModal.path;
    const newMods = [...modules];
    newMods[mIdx].weeks[wIdx].days[dIdx].powerpoint = pptData;
    setModules(newMods);
  };
  
  const handleSaveQuiz = (quizData) => {
     // This only handles DAY quizzes directly inside the structure
     const { mIdx, wIdx, dIdx } = activeQuizModal.path;
     const newMods = [...modules];
     newMods[mIdx].weeks[wIdx].days[dIdx].quiz = quizData;
     setModules(newMods);
     setActiveQuizModal({ open: false, path: null });
  };

  const removeVideo = (mIdx, wIdx, dIdx, vIdx) => {
    const newMods = [...modules];
    newMods[mIdx].weeks[wIdx].days[dIdx].videos.splice(vIdx, 1);
    setModules(newMods);
  };

  const removePPT = (mIdx, wIdx, dIdx) => {
    const newMods = [...modules];
    newMods[mIdx].weeks[wIdx].days[dIdx].powerpoint = null;
    setModules(newMods);
  };

  const removeQuiz = (mIdx, wIdx, dIdx) => {
     const newMods = [...modules];
     newMods[mIdx].weeks[wIdx].days[dIdx].quiz = null;
     setModules(newMods);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in">
       <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Structure du Programme</h3>
          <Button onClick={addModule} className="bg-[var(--school-accent)] text-black hover:bg-yellow-500"><Plus className="w-4 h-4 mr-2"/> Ajouter Module</Button>
       </div>
       
       <Accordion type="multiple" className="space-y-4">
          {modules.map((module, mIdx) => (
             <AccordionItem key={module.id} value={`mod-${module.id}`} className="bg-[#192734] border border-white/10 rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                   <div className="flex items-center gap-4 w-full pr-4">
                      <span className="font-bold text-[var(--school-accent)]">Module {mIdx+1}</span>
                      <Input 
                        value={module.title} 
                        onChange={(e) => { const nm = [...modules]; nm[mIdx].title = e.target.value; setModules(nm); }} 
                        onClick={(e) => e.stopPropagation()}
                        className="h-8 bg-[#0F1419] border-transparent focus:border-white/20 text-white max-w-xs"
                      />
                      <span className="text-sm text-gray-500 ml-auto">{module.weeks.length} semaines</span>
                   </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4 border-t border-white/5">
                   <div className="pl-4 space-y-4">
                      {module.weeks.map((week, wIdx) => (
                         <div key={week.id} className="border-l-2 border-white/10 pl-4 space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                               <span className="text-sm font-bold text-gray-300">Semaine {wIdx+1}</span>
                               <Input value={week.title} onChange={(e) => {
                                  const nm = [...modules]; nm[mIdx].weeks[wIdx].title = e.target.value; setModules(nm);
                               }} className="h-7 w-64 bg-[#0F1419] border-white/10 text-xs" />
                               <Button size="sm" variant="ghost" onClick={() => addDay(mIdx, wIdx)} className="h-7 text-[var(--school-accent)] text-xs"><Plus className="w-3 h-3 mr-1"/> Jour</Button>
                            </div>

                            {/* Days Grid */}
                            <div className="grid grid-cols-1 gap-3">
                               {week.days.map((day, dIdx) => (
                                  <div key={day.id} className="bg-black/20 p-4 rounded border border-white/5">
                                     <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                                          <Input value={day.title} onChange={(e) => {
                                              const nm = [...modules]; nm[mIdx].weeks[wIdx].days[dIdx].title = e.target.value; setModules(nm);
                                          }} className="h-6 w-40 bg-transparent border-none text-white font-bold text-sm p-0 focus-visible:ring-0" />
                                          {isUuid(day.id) && (
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="ghost"
                                              className="h-7 text-[10px] text-gray-400 hover:text-[var(--school-accent)] shrink-0"
                                              onClick={async () => {
                                                try {
                                                  await navigator.clipboard.writeText(day.id);
                                                  toast({
                                                    title: 'UUID du jour copié',
                                                    description: 'Collez-le dans la page post-live (NeuroRecall) pour créer le contenu vidéo replay.',
                                                  });
                                                } catch {
                                                  toast({
                                                    title: 'Copie impossible',
                                                    description: day.id,
                                                    variant: 'destructive',
                                                  });
                                                }
                                              }}
                                            >
                                              <Copy className="w-3 h-3 mr-1" />
                                              UUID jour
                                            </Button>
                                          )}
                                        </div>
                                        <div className="flex gap-2 flex-wrap">
                                            <Button size="sm" variant="outline" className="h-7 text-xs border-white/10 hover:bg-white/5" onClick={() => setActiveVideoModal({ open: true, path: { mIdx, wIdx, dIdx } })}><Video className="w-3 h-3 mr-1"/> Vidéo</Button>
                                            <Button size="sm" variant="outline" className="h-7 text-xs border-white/10 hover:bg-white/5" onClick={() => setActivePPTModal({ open: true, path: { mIdx, wIdx, dIdx } })} disabled={!!day.powerpoint}><Presentation className="w-3 h-3 mr-1"/> PPT</Button>
                                            <Button size="sm" variant="outline" className="h-7 text-xs border-white/10 hover:bg-white/5" onClick={() => setActiveQuizModal({ open: true, path: { mIdx, wIdx, dIdx } })} disabled={!!day.quiz}><FileText className="w-3 h-3 mr-1"/> Quiz</Button>
                                        </div>
                                     </div>
                                     {!isUuid(day.id) && (
                                       <p className="text-[10px] text-amber-200/70 mb-2">
                                         Enregistrez la structure pour obtenir l'UUID Supabase du jour (requis pour NeuroRecall).
                                       </p>
                                     )}
                                     
                                     {/* Day Content List */}
                                     <div className="space-y-2">
                                        {day.videos.map((video, vIdx) => (
                                           <div key={video.id} className="flex items-center gap-3 bg-[#192734] p-2 rounded border border-white/5">
                                              <Video className="w-4 h-4 text-[var(--school-accent)]" />
                                              <span className="text-xs text-white flex-1 truncate">{video.title}</span>
                                              <span className="text-sm text-gray-500">{video.duration} min</span>
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-6 text-[10px] border-white/10 text-white hover:bg-white/5"
                                                disabled={!isUuid(video.id)}
                                                onClick={() => setPostProd({ open: true, contentId: video.id, videoData: video })}
                                                title={!isUuid(video.id) ? 'Sauvegarde la formation pour obtenir un ID vidéo, puis ouvre la post-production.' : 'Ouvrir la post-production'}
                                              >
                                                Post-prod
                                              </Button>
                                              <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:bg-white/5" onClick={() => removeVideo(mIdx, wIdx, dIdx, vIdx)}><Trash className="w-3 h-3"/></Button>
                                           </div>
                                        ))}
                                        {day.powerpoint && (
                                            <div className="flex items-center gap-3 bg-[#192734] p-2 rounded border border-white/5 border-l-4 border-l-blue-500">
                                              <Presentation className="w-4 h-4 text-blue-400" />
                                              <span className="text-xs text-white flex-1 truncate">{day.powerpoint.title}</span>
                                              <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:bg-white/5" onClick={() => removePPT(mIdx, wIdx, dIdx)}><Trash className="w-3 h-3"/></Button>
                                           </div>
                                        )}
                                        {day.quiz && (
                                            <div className="flex items-center gap-3 bg-[#192734] p-2 rounded border border-white/5 border-l-4 border-l-green-500">
                                              <CheckCircle className="w-4 h-4 text-green-400" />
                                              <span className="text-xs text-white flex-1 truncate">{day.quiz.title}</span>
                                              <span className="text-sm text-gray-500">{day.quiz.questions?.length} qst</span>
                                              <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:bg-white/5" onClick={() => removeQuiz(mIdx, wIdx, dIdx)}><Trash className="w-3 h-3"/></Button>
                                           </div>
                                        )}
                                     </div>
                                  </div>
                               ))}
                            </div>
                         </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => addWeek(mIdx)} className="w-full border-dashed border-white/20 text-gray-400 hover:text-white mt-2">+ Ajouter Semaine</Button>
                   </div>
                </AccordionContent>
             </AccordionItem>
          ))}
       </Accordion>

       {/* Modals */}
       <VideoUploadModal 
          isOpen={activeVideoModal.open} 
          onClose={() => setActiveVideoModal({ ...activeVideoModal, open: false })} 
          onSave={handleSaveVideo}
       />
       
       {/* Placeholder for PPT Modal - assuming it exists or handled */}
       <PowerPointEditorModal 
          isOpen={activePPTModal.open} 
          onClose={() => setActivePPTModal({ ...activePPTModal, open: false })}
          onSave={handleSavePPT}
       />

       {/* Day Quiz Modal */}
       <Dialog open={activeQuizModal.open} onOpenChange={() => setActiveQuizModal({ ...activeQuizModal, open: false })}>
          <DialogContent className="max-w-[95vw] w-full h-[95vh] bg-[#0F1419] border-white/10 p-0 overflow-hidden">
             <DialogTitle className="sr-only">Éditeur de quiz</DialogTitle>
             <QuizBuilder 
                scope="day"
                onSave={handleSaveQuiz} 
                onCancel={() => setActiveQuizModal({ ...activeQuizModal, open: false })} 
             />
          </DialogContent>
       </Dialog>

       <Dialog open={postProd.open} onOpenChange={(open) => !open && setPostProd({ open: false, contentId: null })}>
         <DialogContent className="max-w-[98vw] w-full h-[94vh] bg-[#0F1419] border-white/10 p-0 overflow-hidden text-white">
           <DialogTitle className="sr-only">Post-production vidéo</DialogTitle>
           {postProd.contentId ? (
             <VideoPostProductionPage
               contentId={postProd.contentId}
               videoData={postProd.videoData}
               onClose={() => setPostProd({ open: false, contentId: null })}
               onValidated={() => setPostProd({ open: false, contentId: null })}
             />
           ) : null}
         </DialogContent>
       </Dialog>
    </div>
  );
};

// --- STEP 4: PROGRESSION QUIZZES ---
const StepQuizzes = ({ formation, onUpdate }) => (
  <ProgressionQuizManager formation={formation} onUpdate={onUpdate} />
);

// --- STEP 5: CONFIG ---
const StepConfig = ({ config, update }) => (
  <div className="space-y-6 max-w-xl mx-auto animate-in fade-in">
     <div className="flex items-center justify-between p-4 bg-[#192734] rounded-lg border border-white/10">
        <div className="space-y-1">
           <Label className="text-base text-white">Certificat de fin</Label>
           <p className="text-sm text-gray-400">Délivrer automatiquement un certificat après réussite</p>
        </div>
        <Switch checked={config.hasCertificate} onCheckedChange={v => update('hasCertificate', v)} />
     </div>
     <div className="flex items-center justify-between p-4 bg-[#192734] rounded-lg border border-white/10">
        <div className="space-y-1">
           <Label className="text-base text-white">Privé / Sur invitation</Label>
           <p className="text-sm text-gray-400">Ne pas afficher dans le catalogue public</p>
        </div>
        <Switch checked={config.isPrivate} onCheckedChange={v => update('isPrivate', v)} />
     </div>
     <div className="space-y-2">
        <Label>Score minimum de validation (%)</Label>
        <Input type="number" value={config.minPassScore} onChange={e => update('minPassScore', parseInt(e.target.value))} className="bg-[#15202B] border-white/10" />
     </div>
  </div>
);

// --- MAIN BUILDER ---
const OwnerFormationBuilder = ({ formation, onSave, onCancel }) => {
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPath, setPreviewPath] = useState({ mIdx: 0, wIdx: 0, dIdx: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [activePreviewVideo, setActivePreviewVideo] = useState(null);
  const [activePreviewItem, setActivePreviewItem] = useState(null);
  const [previewMindmapOpen, setPreviewMindmapOpen] = useState(false);
  const [previewSelectedNode, setPreviewSelectedNode] = useState(null);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [billingPlans, setBillingPlans] = useState([]);
  const previewVideoRef = useRef(null);

  useEffect(() => {
    let requested = null;
    try {
      const params = new URLSearchParams(location?.search || '');
      requested = params.get('builderStep');
    } catch {
      requested = null;
    }
    const n = Number(requested);
    if (Number.isFinite(n) && n >= 1 && n <= 5) {
      setStep(n);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.search]);
  const defaultFormation = {
    title: '',
    description: '',
    category: '',
    level: 'Débutant',
    thumbnail: '',
    coverImage: '',
    year: '1ère année',
    catalog_number: null,
    access_mode: 'free',
    billing_plan_slug: null,
    standalone_price: null,
    standalone_currency: 'XAF',
    config: { hasCertificate: true, isPrivate: false, minPassScore: 70 },
    additionalQuizzes: [],
  };

  const initialFormation = formation
    ? {
        ...defaultFormation,
        ...formation,
        title: formation.title ?? defaultFormation.title,
        description: formation.description ?? defaultFormation.description,
        category: formation.category ?? defaultFormation.category,
        level: formation.level ?? defaultFormation.level,
        thumbnail: formation.thumbnail ?? defaultFormation.thumbnail,
        coverImage: formation.coverImage ?? defaultFormation.coverImage,
        year: formation.year ?? defaultFormation.year,
        catalog_number: formation.catalog_number ?? formation.meta?.catalog_number ?? null,
        access_mode: formation.access_mode ?? formation.meta?.access_mode ?? formation.meta?.access?.mode ?? defaultFormation.access_mode,
        billing_plan_slug: formation.billing_plan_slug ?? formation.meta?.billing_plan_slug ?? formation.meta?.access?.billing_plan_slug ?? defaultFormation.billing_plan_slug,
        standalone_price:
          formation.standalone_price
          ?? formation.meta?.standalone_price
          ?? formation.meta?.access?.standalone_price
          ?? formation.price
          ?? defaultFormation.standalone_price,
        standalone_currency:
          formation.standalone_currency
          ?? formation.meta?.standalone_currency
          ?? formation.meta?.access?.standalone_currency
          ?? defaultFormation.standalone_currency,
        config: { ...defaultFormation.config, ...(formation.config || {}) },
        additionalQuizzes: Array.isArray(formation.additionalQuizzes) ? formation.additionalQuizzes : [],
      }
    : defaultFormation;

  const [data, setData] = useState(initialFormation);
  const [modules, setModules] = useState(formation?.modules || []);
  const { toast } = useToast();

  useEffect(() => {
    let alive = true;
    const loadBillingPlans = async () => {
      try {
        const { data, error } = await supabase
          .from('billing_plans')
          .select('key, label')
          .order('label', { ascending: true });
        if (!alive || error) return;
        setBillingPlans(Array.isArray(data) ? data : []);
      } catch {
        if (!alive) return;
        setBillingPlans([]);
      }
    };
    loadBillingPlans();
    return () => {
      alive = false;
    };
  }, []);

  const handleNext = () => setStep(prev => Math.min(prev + 1, 5));
  const handleBack = () => setStep(prev => Math.max(prev - 1, 1));

  const normalizeVideoUrl = (type, rawUrl) => {
    if (!rawUrl) return '';
    if (type === 'youtube') {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = rawUrl.match(regExp);
      if (match && match[2] && match[2].length === 11) {
        return `https://www.youtube.com/embed/${match[2]}`;
      }
      return rawUrl;
    }
    if (type === 'vimeo') {
      const regExp = /vimeo\.com\/(\d+)/;
      const match = rawUrl.match(regExp);
      if (match && match[1]) {
        return `https://player.vimeo.com/video/${match[1]}`;
      }
      return rawUrl;
    }
    return rawUrl;
  };
  
  const handleSave = async (nextStatus) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const normalizedAccessMode = data?.access_mode || 'free';
      const normalizedStandalonePrice =
        normalizedAccessMode === 'one_time' && data?.standalone_price != null && data?.standalone_price !== ''
          ? Number(data.standalone_price)
          : null;
      const finalFormation = {
        ...data,
        status: nextStatus,
        access_mode: normalizedAccessMode,
        billing_plan_slug: normalizedAccessMode === 'subscription' ? (data?.billing_plan_slug || null) : null,
        standalone_price: normalizedStandalonePrice,
        standalone_currency: data?.standalone_currency || 'XAF',
        price: normalizedAccessMode === 'one_time' ? normalizedStandalonePrice : null,
        modules,
        duration: `${modules.length * 4} semaines`,
        updatedAt: new Date().toISOString()
      };
      setData((prev) => ({ ...prev, status: nextStatus }));
      const ok = await onSave(finalFormation);
      if (ok) {
        toast({ title: "Formation enregistrée", description: "Les modifications ont été sauvegardées." });
      } else {
        toast({ title: 'Erreur', description: "Impossible d'enregistrer la formation.", variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Erreur', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const PreviewStudentView = ({ formationData }) => {
    const modules = Array.isArray(formationData?.modules) ? formationData.modules : [];
    const m = modules[previewPath.mIdx] || null;
    const w = m?.weeks?.[previewPath.wIdx] || null;
    const d = w?.days?.[previewPath.dIdx] || null;

    const dayVideos = Array.isArray(d?.videos)
      ? d.videos
      : Array.isArray(d?.content?.videos)
        ? d.content.videos
        : [];
    const dayReader = d?.reader || d?.content?.reader || null;
    const dayPowerpointRaw = d?.powerpoint || d?.content?.powerpoint || d?.content?.ppt || null;
    const dayPowerpoint = dayPowerpointRaw || dayReader || null;
    const dayQuiz = d?.quiz || d?.content?.quiz || null;

    const normalizedPowerpoint = dayPowerpoint
      ? {
          ...dayPowerpoint,
          type: dayPowerpoint?.type || (dayPowerpoint?.embedUrl || dayPowerpoint?.gammaUrl ? 'gamma' : 'slides'),
          gammaUrl: dayPowerpoint?.gammaUrl || dayPowerpoint?.embedUrl || dayPowerpoint?.url || dayPowerpoint?.src || '',
        }
      : null;

    const contentCards = [];
    dayVideos.forEach((v, idx) => {
      contentCards.push({
        kind: 'video',
        key: `video-${v?.id || idx}`,
        title: v?.title || v?.name || v?.label || `Vidéo ${idx + 1}`,
        meta: v?.type || '',
        payload: v,
        ctx: {
          mIdx: previewPath.mIdx,
          wIdx: previewPath.wIdx,
          dIdx: previewPath.dIdx,
          moduleId: m?.id || null,
          weekId: w?.id || null,
          dayId: d?.id || null,
          moduleTitle: m?.title || '',
          weekTitle: w?.title || '',
          dayTitle: d?.title || '',
        },
      });
    });
    if (normalizedPowerpoint) {
      contentCards.push({ kind: 'support', key: `support-${normalizedPowerpoint?.id || '1'}`, title: normalizedPowerpoint?.title || normalizedPowerpoint?.name || 'Support', meta: normalizedPowerpoint?.type === 'gamma' ? 'Gamma' : 'Slides', payload: normalizedPowerpoint });
    }
    if (dayQuiz) {
      contentCards.push({ kind: 'quiz', key: `quiz-${dayQuiz?.id || '1'}`, title: dayQuiz?.title || 'Quiz', meta: `${dayQuiz?.questions?.length || 0} questions`, payload: dayQuiz });
    }

    const selectSafe = (next) => {
      setPreviewPath((prev) => ({
        mIdx: Math.max(0, Math.min(next.mIdx ?? prev.mIdx, Math.max(0, modules.length - 1))),
        wIdx: Math.max(0, Math.min(next.wIdx ?? prev.wIdx, Math.max(0, (modules[next.mIdx ?? prev.mIdx]?.weeks?.length || 1) - 1))),
        dIdx: Math.max(0, Math.min(next.dIdx ?? prev.dIdx, Math.max(0, (modules[next.mIdx ?? prev.mIdx]?.weeks?.[next.wIdx ?? prev.wIdx]?.days?.length || 1) - 1))),
      }));
    };

    return (
      <div className="min-h-[70vh] flex flex-col bg-[#0F1419] text-white">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 overflow-hidden">
          <div className="md:col-span-1 border border-white/10 rounded-xl overflow-hidden bg-[#151a21]/80 backdrop-blur">
            <div className="p-3 border-b border-white/10 text-sm font-semibold text-[var(--school-accent)]">Programme</div>
            <ScrollArea className="h-[60vh]">
              <div className="p-3 space-y-3">
                {modules.length === 0 ? (
                  <div className="text-sm text-gray-400">Aucun module pour l'instant.</div>
                ) : null}

                {modules.map((mod, mIdx) => (
                  <div key={mod.id || mIdx} className="space-y-2">
                    <Button
                      variant={mIdx === previewPath.mIdx ? 'default' : 'outline'}
                      className={mIdx === previewPath.mIdx ? 'w-full bg-[var(--school-accent)] text-black hover:bg-yellow-500 justify-start' : 'w-full border-white/10 text-white hover:bg-white/5 justify-start'}
                      onClick={() => selectSafe({ mIdx, wIdx: 0, dIdx: 0 })}
                    >
                      {mod.title || `Module ${mIdx + 1}`}
                    </Button>

                    {mIdx === previewPath.mIdx ? (
                      <div className="pl-2 space-y-2">
                        {(mod.weeks || []).map((week, wIdx) => (
                          <div key={week.id || wIdx} className="space-y-1">
                            <Button
                              variant={wIdx === previewPath.wIdx ? 'secondary' : 'ghost'}
                              className={wIdx === previewPath.wIdx ? 'w-full justify-start bg-white/10 text-white' : 'w-full justify-start text-gray-300 hover:bg-white/5'}
                              onClick={() => selectSafe({ mIdx, wIdx, dIdx: 0 })}
                            >
                              {week.title || `Semaine ${wIdx + 1}`}
                            </Button>

                            {wIdx === previewPath.wIdx ? (
                              <div className="pl-3 space-y-1">
                                {(week.days || []).map((day, dIdx) => (
                                  <Button
                                    key={day.id || dIdx}
                                    variant={dIdx === previewPath.dIdx ? 'secondary' : 'ghost'}
                                    className={dIdx === previewPath.dIdx ? 'w-full justify-start bg-white/10 text-white' : 'w-full justify-start text-gray-400 hover:bg-white/5'}
                                    onClick={() => selectSafe({ mIdx, wIdx, dIdx })}
                                  >
                                    {day.title || `Jour ${dIdx + 1}`}
                                  </Button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="md:col-span-2 border border-white/10 rounded-xl overflow-hidden bg-[#151a21]/80 backdrop-blur">
            <div className="p-3 border-b border-white/10">
              <div className="text-sm text-gray-400">Formation</div>
              <div className="text-lg font-bold">{formationData?.title || 'Sans titre'}</div>
              <div className="text-xs text-gray-500 mt-1">{m?.title || ''}{w?.title ? ` • ${w.title}` : ''}{d?.title ? ` • ${d.title}` : ''}</div>
            </div>

            <ScrollArea className="h-[60vh]">
              <div className="p-4 space-y-4">
                {!d ? (
                  <div className="text-sm text-gray-400">Sélectionne un jour à gauche.</div>
                ) : (
                  <>
                    <div className="border border-white/10 rounded-xl p-4 bg-[#151a21]/60 backdrop-blur">
                      <div className="font-semibold mb-3">Contenu du jour</div>
                      {contentCards.length === 0 ? (
                        <div className="text-sm text-gray-400">Aucun contenu.</div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {contentCards.map((c) => (
                            <button
                              key={c.key}
                              type="button"
                              className="text-left border border-white/10 rounded-xl p-4 bg-white/5 hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-all"
                              onClick={() => setActivePreviewItem(c)}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1 min-w-0">
                                  <div className="font-semibold truncate">{c.title}</div>
                                  <div className="text-xs text-gray-400">{c.meta}</div>
                                </div>
                                <div className="text-xs text-gray-500 shrink-0">Ouvrir</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>
    );
  };

  const stepMeta = [
    { id: 1, label: 'Informations', subtitle: 'Identité de la formation', icon: FileText },
    { id: 2, label: 'Structure', subtitle: 'Modules, semaines, contenus', icon: Presentation },
    { id: 3, label: 'Vérification', subtitle: 'Contrôle du parcours', icon: CheckCircle },
    { id: 4, label: 'Quiz', subtitle: 'Évaluations pédagogiques', icon: Layout },
    { id: 5, label: 'Configuration', subtitle: 'Certificat, accès, règles', icon: Calendar },
  ];
  const currentStepMeta = stepMeta.find((s) => s.id === step);
  const totalWeeks = useMemo(
    () => (modules || []).reduce((acc, mod) => acc + ((mod?.weeks || []).length), 0),
    [modules]
  );
  const totalDays = useMemo(
    () =>
      (modules || []).reduce(
        (acc, mod) =>
          acc +
          (mod?.weeks || []).reduce((weekAcc, week) => weekAcc + ((week?.days || []).length), 0),
        0
      ),
    [modules]
  );
  const totalVideos = useMemo(
    () =>
      (modules || []).reduce(
        (acc, mod) =>
          acc +
          (mod?.weeks || []).reduce(
            (weekAcc, week) =>
              weekAcc +
              (week?.days || []).reduce((dayAcc, day) => dayAcc + ((day?.videos || []).length), 0),
            0
          ),
        0
      ),
    [modules]
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#0B1118] relative">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[250px] h-[250px] bg-indigo-500/5 rounded-full blur-[80px]" />
      </div>

      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 md:p-5 border-b border-white/10 bg-[#111823]/90 backdrop-blur-xl sticky top-0 z-20">
         <div className="flex items-center gap-4 min-w-0">
            <Button variant="ghost" size="icon" onClick={onCancel}><ArrowLeft className="w-5 h-5 text-gray-400"/></Button>
            <div className="min-w-0">
              <h2 className="text-lg md:text-xl font-bold text-white truncate">
                {formation ? 'Modifier la formation' : 'Créer une formation'}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Studio Formation — constructeur avancé</p>
            </div>
         </div>
         <div className="flex gap-2">
            <Button variant="outline" className="border-white/10 text-white hover:bg-white/5" onClick={() => setPreviewOpen(true)} disabled={isSaving}>
              <Layout className="w-4 h-4 mr-2" /> Aperçu élève
            </Button>
            <Button variant="outline" onClick={() => handleSave('draft')} disabled={isSaving} className="border-[var(--school-accent)] text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]">Brouillon</Button>
            <Button onClick={() => handleSave('published')} disabled={isSaving} className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 font-bold gap-2">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? 'Publication...' : 'Publier'}
            </Button>
         </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[98vw] w-full h-[92vh] bg-[#151a21]/95 backdrop-blur-xl border border-white/10 p-0 overflow-hidden">
          <DialogTitle className="sr-only">Aperçu élève</DialogTitle>
          <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-[#151a21]/95 backdrop-blur-xl border-b border-white/10">
            <span className="text-sm font-medium text-[var(--school-accent)]">Aperçu élève</span>
            <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(false)} className="text-gray-400 hover:text-white">
              Fermer
            </Button>
          </div>
          <div className="h-full pt-14 overflow-auto">
            <PreviewStudentView formationData={{ ...data, modules }} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!activePreviewVideo} onOpenChange={(open) => { if (!open) setActivePreviewVideo(null); }}>
        <DialogContent className="max-w-4xl w-[95vw] bg-[#0F1419] border-white/10 text-white">
          <DialogTitle className="sr-only">{activePreviewVideo?.title || 'Aperçu vidéo'}</DialogTitle>
          <div className="space-y-3">
            <div className="text-lg font-bold">{activePreviewVideo?.title || 'Vidéo'}</div>
            <VideoPlayer
              video={
                activePreviewVideo
                  ? {
                      ...activePreviewVideo,
                      url: normalizeVideoUrl(activePreviewVideo?.type, activePreviewVideo?.url),
                    }
                  : null
              }
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!activePreviewItem} onOpenChange={(open) => { if (!open) setActivePreviewItem(null); }}>
        <DialogContent className="max-w-[98vw] w-full h-[92vh] bg-[#0F1419] border-white/10 p-0 overflow-hidden text-white">
          <DialogTitle className="sr-only">Aperçu du contenu</DialogTitle>
          {activePreviewItem?.kind === 'video' ? (() => {
            const formationId = data?.id || formation?.id || 'formation';
            const playlistData = [
              {
                id: formationId,
                title: data?.title || 'Formation',
                description: data?.description || '',
                progress: 0,
                modules: (modules || []).map((mod) => ({
                  id: mod?.id || `mod-${Math.random().toString(36).slice(2)}`,
                  title: mod?.title || 'Module',
                  progress: 0,
                  weeks: (mod?.weeks || []).map((week) => ({
                    id: week?.id || `wk-${Math.random().toString(36).slice(2)}`,
                    title: week?.title || 'Semaine',
                    progress: 0,
                    days: (week?.days || []).map((day) => ({
                      id: day?.id || `day-${Math.random().toString(36).slice(2)}`,
                      title: day?.title || 'Jour',
                      progress: 0,
                      videos: (Array.isArray(day?.videos) ? day.videos : []).map((v, idx) => ({
                        ...v,
                        id: v?.id || `vid-${idx}-${Math.random().toString(36).slice(2)}`,
                        title: v?.title || v?.name || v?.label || `Vidéo ${idx + 1}`,
                        url: normalizeVideoUrl(v?.type, v?.url),
                        duration: Number.isFinite(Number(v?.duration)) ? Number(v.duration) : 600,
                        thumbnail: v?.thumbnail || '',
                        status: 'unwatched',
                        progress: 0,
                      })),
                    })),
                  })),
                })),
              },
            ];

            const currentVideo = activePreviewItem?.payload
              ? {
                  ...activePreviewItem.payload,
                  url: normalizeVideoUrl(activePreviewItem.payload?.type, activePreviewItem.payload?.url),
                }
              : null;

            return (
              <>
              <div className="h-full bg-[#0F1419] text-white flex flex-col overflow-hidden">
                <header className="h-16 bg-[#192734] border-b border-white/10 flex items-center justify-between px-4 md:px-6 shrink-0 z-20 shadow-md">
                  <div className="flex items-center gap-4 min-w-0">
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="md:hidden text-[var(--school-accent)]">
                          <Menu className="w-6 h-6" />
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="left" className="p-0 bg-[#192734] border-r border-white/10 w-[85%] sm:w-[350px]">
                        <ProgressivePlaylist
                          playlistData={playlistData}
                          currentFormationId={formationId}
                          currentModuleId={activePreviewItem?.ctx?.moduleId}
                          currentWeekId={activePreviewItem?.ctx?.weekId}
                          currentDayId={activePreviewItem?.ctx?.dayId}
                          currentVideoId={activePreviewItem?.payload?.id}
                          onVideoSelect={(v, dayId, weekId, moduleId) => {
                            const mIdx = (modules || []).findIndex((mm) => mm?.id === moduleId);
                            const wIdx = mIdx >= 0 ? ((modules[mIdx]?.weeks || []).findIndex((ww) => ww?.id === weekId)) : -1;
                            const dIdx = mIdx >= 0 && wIdx >= 0 ? ((modules[mIdx]?.weeks?.[wIdx]?.days || []).findIndex((dd) => dd?.id === dayId)) : -1;
                            if (mIdx >= 0 && wIdx >= 0 && dIdx >= 0) {
                              setPreviewPath({ mIdx, wIdx, dIdx });
                              const mm = modules[mIdx];
                              const ww = mm?.weeks?.[wIdx];
                              const dd = ww?.days?.[dIdx];
                              setActivePreviewItem({
                                kind: 'video',
                                key: `video-${v?.id || 'x'}`,
                                title: v?.title || 'Vidéo',
                                meta: v?.type || '',
                                payload: v,
                                ctx: {
                                  mIdx,
                                  wIdx,
                                  dIdx,
                                  moduleId: moduleId || mm?.id || null,
                                  weekId: weekId || ww?.id || null,
                                  dayId: dayId || dd?.id || null,
                                  moduleTitle: mm?.title || '',
                                  weekTitle: ww?.title || '',
                                  dayTitle: dd?.title || '',
                                },
                              });
                            }
                          }}
                        />
                      </SheetContent>
                    </Sheet>

                    <div className="min-w-0">
                      <h1 className="font-bold text-sm md:text-lg leading-tight truncate max-w-[220px] md:max-w-md">{activePreviewItem?.title || 'Vidéo'}</h1>
                      <p className="text-[10px] md:text-sm text-gray-400 truncate max-w-[260px] md:max-w-xl">
                        {activePreviewItem?.ctx?.moduleTitle ? activePreviewItem.ctx.moduleTitle : ''}
                        {activePreviewItem?.ctx?.weekTitle ? ` • ${activePreviewItem.ctx.weekTitle}` : ''}
                        {activePreviewItem?.ctx?.dayTitle ? ` • ${activePreviewItem.ctx.dayTitle}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="hidden md:flex items-center gap-2">
                    <Button variant="outline" onClick={() => setActivePreviewItem(null)} className="border-[var(--school-accent)] text-[var(--school-accent)] hover:bg-[var(--school-accent)] hover:text-black font-bold text-xs h-8">
                      Fermer
                    </Button>
                  </div>
                </header>

                <div className="flex-1 flex overflow-hidden relative">
                  <div className="flex-1 flex flex-col overflow-y-auto bg-[#0F1419]">
                    <div className="p-4 md:p-8 max-w-6xl mx-auto w-full">
                      <VideoPlayer ref={previewVideoRef} video={currentVideo} onTimeUpdate={setPreviewCurrentTime} />
                    </div>
                    <div className="px-4 md:px-8 max-w-6xl mx-auto w-full pb-4 flex flex-wrap items-center justify-end gap-2">
                      <div className="border border-white/10 rounded-xl bg-white/5 px-3 py-2">
                        <TranscriptPanel
                          transcript={Array.isArray(currentVideo?.transcript) ? currentVideo.transcript : []}
                          currentTimeSeconds={previewCurrentTime}
                          onSeek={(t) => previewVideoRef.current?.seekTo?.(t)}
                          buttonOnly
                        />
                      </div>
                      {currentVideo?.mindmap && (
                        <Button
                          type="button"
                          variant="outline"
                          className="border-white/10 text-white hover:bg-white/5"
                          onClick={() => { setPreviewMindmapOpen(true); setPreviewSelectedNode(null); }}
                        >
                          Ouvrir mindmap
                        </Button>
                      )}
                    </div>
                    <div className="h-20" />
                  </div>

                  <div className="hidden md:flex w-[350px] lg:w-[400px] bg-[#192734] border-l border-white/10 flex-col z-10 shadow-xl">
                    <ProgressivePlaylist
                      playlistData={playlistData}
                      currentFormationId={formationId}
                      currentModuleId={activePreviewItem?.ctx?.moduleId}
                      currentWeekId={activePreviewItem?.ctx?.weekId}
                      currentDayId={activePreviewItem?.ctx?.dayId}
                      currentVideoId={activePreviewItem?.payload?.id}
                      onVideoSelect={(v, dayId, weekId, moduleId) => {
                        const mIdx = (modules || []).findIndex((mm) => mm?.id === moduleId);
                        const wIdx = mIdx >= 0 ? ((modules[mIdx]?.weeks || []).findIndex((ww) => ww?.id === weekId)) : -1;
                        const dIdx = mIdx >= 0 && wIdx >= 0 ? ((modules[mIdx]?.weeks?.[wIdx]?.days || []).findIndex((dd) => dd?.id === dayId)) : -1;
                        if (mIdx >= 0 && wIdx >= 0 && dIdx >= 0) {
                          setPreviewPath({ mIdx, wIdx, dIdx });
                          const mm = modules[mIdx];
                          const ww = mm?.weeks?.[wIdx];
                          const dd = ww?.days?.[dIdx];
                          setActivePreviewItem({
                            kind: 'video',
                            key: `video-${v?.id || 'x'}`,
                            title: v?.title || 'Vidéo',
                            meta: v?.type || '',
                            payload: v,
                            ctx: {
                              mIdx,
                              wIdx,
                              dIdx,
                              moduleId: moduleId || mm?.id || null,
                              weekId: weekId || ww?.id || null,
                              dayId: dayId || dd?.id || null,
                              moduleTitle: mm?.title || '',
                              weekTitle: ww?.title || '',
                              dayTitle: dd?.title || '',
                            },
                          });
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {previewMindmapOpen && (
                <div className="fixed inset-0 z-[90]">
                  <div
                    className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
                    onClick={() => { setPreviewMindmapOpen(false); setPreviewSelectedNode(null); }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center p-3 md:p-6">
                    <div className="w-[98vw] md:w-[1100px] h-[82vh] bg-[#0F1419]/95 border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur text-white">
                      <div className="h-12 px-3 flex items-center justify-between border-b border-white/10 bg-black/30">
                        <div className="font-bold text-sm">Mindmap — Aperçu</div>
                        <Button type="button" variant="outline" className="h-8 border-white/10 text-white hover:bg-white/5" onClick={() => { setPreviewMindmapOpen(false); setPreviewSelectedNode(null); }}>Fermer</Button>
                      </div>
                      <div className="flex flex-col flex-1 overflow-hidden p-3" style={{ height: 'calc(82vh - 3rem)' }}>
                        <MindMapNavigation
                          key="preview-mindmap"
                          mindmap={currentVideo?.mindmap || null}
                          onSeek={(t) => previewVideoRef.current?.seekTo?.(t)}
                          onSelectNode={setPreviewSelectedNode}
                          selectedNodeId={previewSelectedNode?.id || null}
                          heightClassName="h-[calc(82vh-5rem)]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              </>
            );
          })() : activePreviewItem?.kind === 'support' ? (
            <div className="h-full overflow-auto p-6">
              <div className="max-w-5xl mx-auto">
                <PowerPointViewer powerpoint={activePreviewItem?.payload || null} />
              </div>
            </div>
          ) : activePreviewItem?.kind === 'quiz' ? (
            <div className="h-full overflow-auto p-6">
              <div className="max-w-3xl mx-auto border border-white/10 rounded-lg p-4 bg-white/5 space-y-3">
                <div className="text-sm text-gray-300">{activePreviewItem?.payload?.questions?.length || 0} questions</div>
                <div className="space-y-2">
                  {(activePreviewItem?.payload?.questions || []).slice(0, 5).map((q, idx) => (
                    <div key={idx} className="border border-white/10 rounded p-3 bg-black/20">
                      <div className="text-sm font-semibold">{idx + 1}. {q?.question || q?.title || 'Question'}</div>
                    </div>
                  ))}
                </div>
                {(activePreviewItem?.payload?.questions || []).length > 5 ? (
                  <div className="text-xs text-gray-500">+ {(activePreviewItem.payload.questions.length - 5)} autres questions...</div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="p-6 text-gray-400">Aucun contenu.</div>
          )}
        </DialogContent>
      </Dialog>

      {/* Progress Steps */}
      <div className="relative px-4 md:px-8 py-5 bg-[#0D141F] border-b border-white/5">
         <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
            {stepMeta.map((item, idx) => {
              const isActive = step === item.id;
              const isDone = step > item.id;
              return (
                <React.Fragment key={item.id}>
                  <button
                    type="button"
                    onClick={() => setStep(item.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all whitespace-nowrap ${
                      isActive
                        ? 'border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[var(--school-accent)]'
                        : isDone
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : 'border-white/10 bg-white/5 text-gray-400'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isActive
                        ? 'bg-[var(--school-accent)] text-black'
                        : isDone
                          ? 'bg-emerald-500 text-black'
                          : 'bg-white/10 text-gray-300'
                    }`}>
                      {isDone ? <CheckCircle className="w-3.5 h-3.5" /> : item.id}
                    </span>
                    <span className="text-xs md:text-sm font-medium">{item.label}</span>
                  </button>
                  {idx < stepMeta.length - 1 ? (
                    <div className={`h-px w-6 md:w-10 ${step > item.id ? 'bg-[var(--school-accent)]' : 'bg-white/10'}`} />
                  ) : null}
                </React.Fragment>
              );
            })}
         </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 bg-gradient-to-b from-[#0B1118] to-[#0F1419]">
        <div className="h-full max-w-[1700px] mx-auto p-4 md:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_320px] gap-4 md:gap-6">
          {/* Left Sidebar */}
          <aside className="hidden lg:block rounded-2xl border border-white/10 bg-[#121A25]/70 backdrop-blur-xl p-4 h-fit sticky top-28">
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-3">Étapes studio</div>
            <div className="space-y-2">
              {stepMeta.map((item) => {
                const Icon = item.icon;
                const active = step === item.id;
                const done = step > item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStep(item.id)}
                    className={`w-full text-left rounded-xl border p-3 transition-all ${
                      active
                        ? 'border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]'
                        : done
                          ? 'border-emerald-500/30 bg-emerald-500/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        active
                          ? 'bg-[var(--school-accent)] text-black'
                          : done
                            ? 'bg-emerald-500 text-black'
                            : 'bg-white/10 text-gray-300'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${active ? 'text-[var(--school-accent)]' : 'text-white'}`}>
                          {item.label}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{item.subtitle}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Center Step */}
          <ScrollArea className="rounded-2xl border border-white/10 bg-[#121A25]/70 backdrop-blur-xl">
            <div className="p-4 md:p-6">
              <div className="mb-4 pb-4 border-b border-white/10">
                <p className="text-xs uppercase tracking-wider text-gray-500">Étape active</p>
                <h3 className="text-lg md:text-xl font-semibold text-white mt-1">
                  {currentStepMeta?.label}
                </h3>
                <p className="text-sm text-gray-400 mt-1">{currentStepMeta?.subtitle}</p>
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 12, scale: 0.995 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.995 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  {step === 1 && <StepGeneral data={data} billingPlans={billingPlans} update={(f, v) => setData({...data, [f]: v})} />}
                  {step === 2 && <StepStructure modules={modules} setModules={setModules} formationId={data?.id || formation?.id} />}
                  {step === 3 && <StepStructure modules={modules} setModules={setModules} formationId={data?.id || formation?.id} />}
                  {step === 4 && <StepQuizzes formation={data} onUpdate={setData} />}
                  {step === 5 && <StepConfig config={data.config} update={(f, v) => setData({...data, config: {...data.config, [f]: v}})} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </ScrollArea>

          {/* Right Preview */}
          <aside className="hidden xl:block rounded-2xl border border-white/10 bg-[#121A25]/70 backdrop-blur-xl p-4 h-fit sticky top-28">
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-3">Aperçu studio</div>
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-xs text-gray-500">Formation</p>
                <p className="text-sm font-semibold text-white mt-1 line-clamp-2">{data?.title || 'Sans titre'}</p>
                <p className="text-xs text-gray-400 mt-1">{data?.category || 'Catégorie non définie'}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] text-gray-500">Modules</p>
                  <p className="text-lg font-bold text-white">{modules?.length || 0}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] text-gray-500">Semaines</p>
                  <p className="text-lg font-bold text-white">{totalWeeks}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] text-gray-500">Jours</p>
                  <p className="text-lg font-bold text-white">{totalDays}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] text-gray-500">Vidéos</p>
                  <p className="text-lg font-bold text-white">{totalVideos}</p>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]"
                onClick={() => setPreviewOpen(true)}
              >
                <Layout className="w-4 h-4 mr-2" />
                Aperçu élève complet
              </Button>
            </div>
          </aside>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="p-4 border-t border-white/10 bg-[#111823]/95 backdrop-blur-xl flex justify-between">
         <Button disabled={step === 1} onClick={handleBack} variant="outline" className="border-white/10 text-white hover:bg-white/5"><ArrowLeft className="w-4 h-4 mr-2"/> Précédent</Button>
         <Button disabled={isSaving} onClick={step === 5 ? () => handleSave(data?.status || 'draft') : handleNext} className="bg-[var(--school-accent)] hover:bg-[#e5c04a] text-black gap-2 font-semibold">
           {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
           {step === 5 ? (isSaving ? 'Enregistrement...' : 'Terminer') : 'Suivant'}
           {!isSaving ? <ArrowRight className="w-4 h-4 ml-2"/> : null}
         </Button>
      </div>
    </div>
  );
};

export default OwnerFormationBuilder;