import React from 'react';
import { formationsData } from '@/lib/mockFormationsData';
import { Button } from '@/components/ui/button';
import { Sparkles, CheckCircle2, TrendingDown, AlertTriangle, Key, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const CombinedPackageCard = ({ onSelect }) => {
  const { combo } = formationsData;

  return (
    <div className="relative w-full max-w-5xl mx-auto my-16">
      <div className="absolute inset-0 bg-gradient-to-r from-red-900/30 via-purple-900/30 to-blue-900/30 blur-3xl rounded-3xl opacity-60"></div>
      
      <Card className="relative bg-gradient-to-br from-[#1a1a2e] to-[#0d1117] border border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] shadow-2xl overflow-hidden rounded-2xl">
        <div className="absolute top-0 right-0 bg-gradient-to-l from-[var(--school-accent)] to-yellow-600 text-black font-bold px-8 py-2 rounded-bl-xl z-10 shadow-lg">
          ⭐ OFFRE RECOMMANDÉE
        </div>
        
        <CardContent className="p-0">
          <div className="grid lg:grid-cols-5 gap-0">
            
            {/* Left Content Column */}
            <div className="lg:col-span-3 p-8 md:p-10 space-y-8 border-b lg:border-b-0 lg:border-r border-white/10">
              <div className="space-y-4">
                 <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[var(--school-accent)] text-sm font-medium border border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]">
                    <Sparkles className="w-4 h-4" />
                    <span>L'Excellence Combinée</span>
                 </div>
                 <h2 className="text-3xl md:text-4xl font-serif font-bold text-white leading-tight">
                    {combo.title} 🎓🛡️
                 </h2>
                 <p className="text-lg text-gray-300 leading-relaxed font-light">
                    {combo.description}
                 </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                 <div className="space-y-3">
                   <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                     <Key className="w-4 h-4 text-[var(--school-accent)]" /> Principe Important
                   </h4>
                   <p className="text-sm text-gray-400 bg-black/20 p-3 rounded-lg border border-white/5">
                      {combo.principle}
                   </p>
                 </div>
                 <div className="space-y-3">
                   <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" /> Conditions d'accès
                   </h4>
                   <p className="text-sm text-gray-400 bg-black/20 p-3 rounded-lg border border-white/5">
                      {combo.conditions}
                   </p>
                 </div>
              </div>

              <div className="space-y-4">
                 <h4 className="text-sm font-bold text-white uppercase tracking-wider">🧠 Ce que vous obtenez concrètement :</h4>
                 <div className="grid sm:grid-cols-2 gap-3">
                   {combo.inclusions.map((feat, i) => (
                      <div key={i} className="flex items-center gap-3 bg-white/5 p-3 rounded-lg border border-white/5 hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] transition-colors">
                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                        <span className="text-sm text-gray-200">{feat}</span>
                      </div>
                   ))}
                 </div>
              </div>
            </div>

            {/* Right Pricing Column */}
            <div className="lg:col-span-2 bg-black/20 p-8 md:p-10 flex flex-col justify-center space-y-8 backdrop-blur-sm">
               <div>
                  <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    💶 Tarification Recommandée
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Monthly Option */}
                    <div className="relative group p-4 rounded-xl border-2 border-white/10 hover:border-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] transition-all cursor-pointer">
                       <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-white">Option 1 : Mensuel</span>
                          <Badge className="bg-green-500/20 text-green-400 border-none hover:bg-green-500/30">-{combo.pricing.monthlySaving}</Badge>
                       </div>
                       <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-white">{combo.pricing.monthly}</span>
                          <span className="text-sm text-gray-500 line-through decoration-red-500">556€</span>
                       </div>
                       <p className="text-sm text-gray-500 mt-1">Par mois, engagement 12 mois.</p>
                    </div>

                    {/* Trimester Option */}
                    <div className="relative group p-4 rounded-xl border-2 border-white/10 hover:border-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] transition-all cursor-pointer">
                       <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-white">Option 2 : Trimestriel</span>
                          <Badge className="bg-green-500/20 text-green-400 border-none hover:bg-green-500/30">-{combo.pricing.trimesterSaving}</Badge>
                       </div>
                       <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-white">{combo.pricing.trimester}</span>
                          <span className="text-sm text-gray-500 line-through decoration-red-500">1 500€</span>
                       </div>
                       <p className="text-sm text-gray-500 mt-1">Par trimestre (x4).</p>
                    </div>

                    {/* Full Option */}
                    <div className="relative group p-4 rounded-xl border-2 border-[var(--school-accent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] transition-all cursor-pointer shadow-lg shadow-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]">
                       <div className="absolute -top-3 right-4 bg-[var(--school-accent)] text-black text-[10px] font-bold px-2 py-0.5 rounded">MEILLEURE OFFRE</div>
                       <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-[var(--school-accent)]">Option 3 : Intégral</span>
                          <Badge className="bg-green-500 text-black border-none font-bold">-{combo.pricing.fullSaving}</Badge>
                       </div>
                       <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-white">{combo.pricing.full}</span>
                          <span className="text-sm text-gray-500 line-through decoration-red-500">4 000€</span>
                       </div>
                       <p className="text-sm text-gray-400 mt-1">Paiement unique.</p>
                    </div>
                  </div>
                  
                  <p className="text-center text-sm text-gray-500 mt-4 italic">+ {combo.pricing.registration} de frais de dossier (paiement unique).</p>
               </div>

               <Button 
                 onClick={() => onSelect(combo.title)}
                 className="w-full bg-gradient-to-r from-[var(--school-accent)] to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black font-bold h-14 text-lg shadow-lg shadow-yellow-900/20 hover:shadow-yellow-500/30 transition-all"
               >
                 Candidater pour ce combiné <ArrowRight className="w-5 h-5 ml-2" />
               </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CombinedPackageCard;