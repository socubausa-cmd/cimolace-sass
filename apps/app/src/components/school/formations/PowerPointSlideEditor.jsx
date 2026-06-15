import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Image as ImageIcon, Plus, Trash, Play, Type } from 'lucide-react';
import { SafeHtml } from '@/components/common/SafeHtml';

const PowerPointSlideEditor = ({ slide, onChange, onSave, onCancel }) => {
  const [localSlide, setLocalSlide] = useState(slide || {
    title: '',
    content: '',
    image: '',
    animation: 'fade',
    duration: 0.5,
    delay: 0
  });

  const handleChange = (field, value) => {
    setLocalSlide(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleChange('image', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6 p-4 bg-[#192734] rounded-lg border border-white/10 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex justify-between items-center pb-4 border-b border-white/10">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Type className="w-5 h-5 text-[var(--school-accent)]" /> Éditeur de Slide
        </h3>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel} className="text-gray-400 hover:text-white">Annuler</Button>
          <Button onClick={() => onSave(localSlide)} className="bg-[var(--school-accent)] text-black hover:bg-yellow-500">Enregistrer</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Titre de la slide</Label>
            <Input 
              value={localSlide.title} 
              onChange={e => handleChange('title', e.target.value)} 
              className="bg-[#0F1419] border-white/10 text-white"
              placeholder="Ex: Introduction au Module"
            />
          </div>

          <div className="space-y-2">
            <Label>Contenu (HTML/Texte Riche)</Label>
            <Textarea 
              value={localSlide.content} 
              onChange={e => handleChange('content', e.target.value)} 
              className="bg-[#0F1419] border-white/10 text-white min-h-[150px] font-mono text-sm"
              placeholder="<p>Votre texte ici...</p>"
            />
            <p className="text-sm text-gray-500">Supporte les balises HTML basiques (p, strong, em, ul, li)</p>
          </div>

          <div className="space-y-2">
             <Label>Image / Schéma</Label>
             <div className="border-2 border-dashed border-white/10 rounded-lg p-4 text-center hover:bg-white/5 transition-colors relative h-32 flex flex-col items-center justify-center">
                {localSlide.image ? (
                   <img src={localSlide.image} alt="Preview" className="h-full object-contain" />
                ) : (
                   <div className="text-gray-500 flex flex-col items-center">
                      <ImageIcon className="w-8 h-8 mb-2" />
                      <span className="text-xs">Glisser ou cliquer pour upload</span>
                   </div>
                )}
                <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                {localSlide.image && (
                   <Button 
                      size="icon" variant="destructive" 
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={(e) => { e.preventDefault(); handleChange('image', ''); }}
                   >
                      <Trash className="w-3 h-3" />
                   </Button>
                )}
             </div>
          </div>
        </div>

        <div className="space-y-4">
           <div className="p-4 bg-[#0F1419] rounded-lg border border-white/10">
              <h4 className="text-sm font-bold text-[var(--school-accent)] mb-4 flex items-center gap-2"><Play className="w-4 h-4"/> Animations</h4>
              
              <div className="space-y-4">
                 <div className="space-y-2">
                    <Label>Type de transition</Label>
                    <Select value={localSlide.animation} onValueChange={v => handleChange('animation', v)}>
                       <SelectTrigger className="bg-[#192734] border-white/10"><SelectValue /></SelectTrigger>
                       <SelectContent>
                          <SelectItem value="fade">Fondu (Fade)</SelectItem>
                          <SelectItem value="slide">Glissement (Slide)</SelectItem>
                          <SelectItem value="zoom">Zoom</SelectItem>
                          <SelectItem value="rotate">Rotation</SelectItem>
                          <SelectItem value="bounce">Rebond (Bounce)</SelectItem>
                       </SelectContent>
                    </Select>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <Label>Durée (s)</Label>
                       <Input 
                          type="number" step="0.1" min="0.1" max="5"
                          value={localSlide.duration} 
                          onChange={e => handleChange('duration', parseFloat(e.target.value))} 
                          className="bg-[#192734] border-white/10"
                       />
                    </div>
                    <div className="space-y-2">
                       <Label>Délai (s)</Label>
                       <Input 
                          type="number" step="0.1" min="0" max="5"
                          value={localSlide.delay} 
                          onChange={e => handleChange('delay', parseFloat(e.target.value))} 
                          className="bg-[#192734] border-white/10"
                       />
                    </div>
                 </div>
              </div>
           </div>

           {/* Live Preview Mini */}
           <div className="mt-4">
              <Label className="mb-2 block">Aperçu Rendu</Label>
              <div className="aspect-video bg-white text-black rounded overflow-hidden relative p-4 flex flex-col items-center justify-center text-center shadow-lg">
                 <h2 className="text-lg font-bold mb-2">{localSlide.title || 'Titre'}</h2>
                 <SafeHtml className="text-xs line-clamp-3" html={localSlide.content || 'Contenu...'} />
                 {localSlide.image && <img src={localSlide.image} className="mt-2 h-16 object-contain" alt="mini" />}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default PowerPointSlideEditor;