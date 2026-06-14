import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ExternalLink, Globe, Code, RefreshCw, AlertCircle, Check } from 'lucide-react';

const GammaIntegration = ({ data, onChange, onSave }) => {
  const [localData, setLocalData] = useState(data || {
    title: 'Présentation Gamma',
    description: '',
    type: 'url', // url, embed_code
    embedUrl: ''
  });
  const [previewKey, setPreviewKey] = useState(0);
  const [error, setError] = useState(null);

  const handleChange = (field, value) => {
    setLocalData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handlePreview = () => {
    setError(null);
    let url = localData.embedUrl;

    if (localData.type === 'embed_code') {
       // Extract src from iframe tag if user pasted full code
       const srcMatch = localData.embedUrl.match(/src="([^"]+)"/);
       if (srcMatch) {
          url = srcMatch[1];
          handleChange('embedUrl', url); // Auto-fix
       }
    }

    if (!url.includes('gamma.app')) {
       setError("L'URL ne semble pas provenir de Gamma.app");
    }

    setPreviewKey(prev => prev + 1); // Force iframe reload
  };

  return (
    <div className="space-y-6 p-4 bg-[#192734] rounded-lg border border-white/10 h-full flex flex-col">
      <div className="flex items-center gap-2 pb-4 border-b border-white/10">
         <Globe className="w-5 h-5 text-[var(--school-accent)]" />
         <h3 className="text-lg font-bold text-white">Intégration Gamma App</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
         {/* Configuration */}
         <div className="space-y-5">
            <div className="space-y-2">
               <Label>Titre du support</Label>
               <Input 
                  value={localData.title} 
                  onChange={e => handleChange('title', e.target.value)} 
                  className="bg-[#0F1419] border-white/10 text-white"
                  placeholder="Ex: Présentation du Module 1"
               />
            </div>
            
            <div className="space-y-2">
               <Label>Méthode d'intégration</Label>
               <Select value={localData.type} onValueChange={v => handleChange('type', v)}>
                  <SelectTrigger className="bg-[#0F1419] border-white/10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                     <SelectItem value="url">Lien URL (Recommandé)</SelectItem>
                     <SelectItem value="embed_code">Code d'intégration (Iframe)</SelectItem>
                  </SelectContent>
               </Select>
            </div>

            <div className="space-y-2">
               <Label>{localData.type === 'url' ? 'Lien public Gamma' : "Code d'intégration"}</Label>
               <div className="flex gap-2">
                  {localData.type === 'url' ? (
                     <Input 
                        value={localData.embedUrl} 
                        onChange={e => handleChange('embedUrl', e.target.value)} 
                        placeholder="https://gamma.app/docs/..." 
                        className="bg-[#0F1419] border-white/10 text-white font-mono text-sm"
                     />
                  ) : (
                     <Textarea 
                        value={localData.embedUrl} 
                        onChange={e => handleChange('embedUrl', e.target.value)} 
                        placeholder='<iframe src="https://gamma.app/embed/..." ...'
                        className="bg-[#0F1419] border-white/10 text-white font-mono text-xs h-24" 
                     />
                  )}
                  <Button onClick={handlePreview} size="icon" className="bg-[var(--school-accent)] text-black hover:bg-yellow-500 shrink-0">
                     <RefreshCw className="w-4 h-4"/>
                  </Button>
               </div>
               <p className="text-sm text-gray-500 flex items-center gap-1">
                  <Code className="w-3 h-3" /> Copiez le lien/code depuis le bouton "Partager" de votre Gamma.
               </p>
            </div>
            
            {error && (
               <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-200 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4"/> {error}
               </div>
            )}

            <div className="pt-4">
                <Button onClick={() => onSave(localData)} disabled={!localData.embedUrl} className="w-full bg-[var(--school-accent)] text-black hover:bg-yellow-500 font-bold">
                   <Check className="w-4 h-4 mr-2"/> Valider l'intégration
                </Button>
            </div>
         </div>

         {/* Preview Area */}
         <div className="flex flex-col">
            <Label className="mb-2 text-[var(--school-accent)]">Aperçu en temps réel</Label>
            <div className="bg-[#0F1419] rounded-lg border border-white/10 overflow-hidden flex-1 min-h-[400px] relative">
               {localData.embedUrl && !error ? (
                  <iframe 
                     key={previewKey}
                     src={localData.embedUrl} 
                     title="Gamma Preview"
                     className="w-full h-full absolute inset-0 border-0"
                     allowFullScreen
                  />
               ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                     <Globe className="w-16 h-16 mb-4 opacity-10 animate-pulse" />
                     <p>L'aperçu de votre présentation s\'affichera ici</p>
                  </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
};

export default GammaIntegration;