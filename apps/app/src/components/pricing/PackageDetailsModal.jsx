import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Check, X, Info, AlertTriangle } from 'lucide-react';

const PackageDetailsModal = ({ isOpen, onClose, pkg, onSelect }) => {
  if (!pkg) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#0F1419] border border-white/10 text-white max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        
        {/* Header */}
        <DialogHeader className={`p-6 bg-${pkg.color}-900/20 border-b border-white/10`}>
          <div className="flex items-center gap-4">
            <div className="text-4xl">{pkg.icon}</div>
            <div>
              <DialogTitle className={`text-2xl font-serif font-bold text-${pkg.color}-400`}>
                {pkg.title}
              </DialogTitle>
              <p className="text-gray-400 text-sm mt-1">{pkg.subtitle}</p>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Content */}
        <ScrollArea className="flex-grow p-6">
          <div className="space-y-8">
            
            {/* Price Section */}
            <div className="bg-white/5 p-4 rounded-xl border border-white/10">
              <h3 className="text-lg font-bold text-white mb-4">Détails de la Tarification</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-black/30 rounded-lg">
                   <p className="text-sm text-gray-500 uppercase">Mensuel</p>
                   <p className="text-xl font-bold text-white">{pkg.pricing.monthly}</p>
                </div>
                {pkg.pricing.quarterly && (
                  <div className="p-3 bg-black/30 rounded-lg">
                    <p className="text-sm text-gray-500 uppercase">Trimestriel</p>
                    <p className="text-xl font-bold text-white">{pkg.pricing.quarterly}</p>
                  </div>
                )}
                {pkg.pricing.full && (
                  <div className="p-3 bg-black/30 rounded-lg">
                    <p className="text-sm text-gray-500 uppercase">Intégral</p>
                    <p className="text-xl font-bold text-white">{pkg.pricing.full}</p>
                  </div>
                )}
                <div className="p-3 bg-black/30 rounded-lg">
                   <p className="text-sm text-gray-500 uppercase">Frais Dossier</p>
                   <p className="text-xl font-bold text-white">{pkg.pricing.registration}</p>
                </div>
              </div>
              <p className="text-sm text-gray-400 mt-3 italic flex items-center gap-2">
                 <Info className="w-3 h-3" /> {pkg.conditions}
              </p>
            </div>

            {/* Content Lists */}
            <div className="space-y-4">
               <div>
                  <h4 className="text-green-400 font-bold mb-2 flex items-center gap-2">
                    <Check className="w-5 h-5" /> Inclus dans ce forfait
                  </h4>
                  <ul className="space-y-2 pl-2 border-l-2 border-green-500/20">
                    {pkg.inclusions.map((item, i) => (
                      <li key={i} className="text-sm text-gray-300 pl-4 py-1">{item}</li>
                    ))}
                  </ul>
               </div>

               <div>
                  <h4 className="text-red-400 font-bold mb-2 flex items-center gap-2">
                    <X className="w-5 h-5" /> Non inclus
                  </h4>
                  <ul className="space-y-2 pl-2 border-l-2 border-red-500/20">
                    {pkg.exclusions.map((item, i) => (
                      <li key={i} className="text-sm text-gray-500 pl-4 py-1 italic">{item}</li>
                    ))}
                  </ul>
               </div>
            </div>

            {/* Implications */}
            {pkg.implications && (
               <div className="bg-orange-500/10 border border-orange-500/20 p-4 rounded-lg flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0" />
                  <div>
                    <h4 className="text-orange-500 font-bold text-sm mb-1">Implications & Responsabilités</h4>
                    <p className="text-sm text-orange-200/80">{pkg.implications}</p>
                  </div>
               </div>
            )}
            
          </div>
        </ScrollArea>

        {/* Footer Actions */}
        <DialogFooter className="p-6 bg-[#0f1216] border-t border-white/10">
          <Button variant="outline" onClick={onClose} className="border-white/10 hover:bg-white/5 text-gray-300">
            Fermer
          </Button>
          <Button 
             className={`bg-${pkg.color}-600 hover:bg-${pkg.color}-700 text-white font-bold px-8`}
             onClick={() => { onSelect(pkg.title); onClose(); }}
          >
            Choisir ce forfait
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
};

export default PackageDetailsModal;