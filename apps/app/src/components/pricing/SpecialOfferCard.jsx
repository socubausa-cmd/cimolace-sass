import React from 'react';
import { formationsData } from '@/lib/mockFormationsData';
import { Button } from '@/components/ui/button';
import { Sparkles, CheckCircle2, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const SpecialOfferCard = () => {
  const { combo } = formationsData;

  return (
    <div className="relative mt-16 mb-12">
      <div className="absolute inset-0 bg-gradient-to-r from-red-900/40 to-purple-900/40 blur-xl rounded-3xl"></div>
      <Card className="relative bg-gradient-to-br from-[#1a1a2e] to-[#16213e] border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 bg-[var(--school-accent)] text-black font-bold px-6 py-2 rounded-bl-xl z-10">
          OFFRE EXCLUSIVE
        </div>
        
        <CardContent className="p-8 md:p-12">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[var(--school-accent)] text-sm font-medium">
                <Sparkles className="w-4 h-4" />
                <span>Le choix de l'excellence</span>
              </div>
              
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-white">
                <span className="text-red-400">Académique Pro</span> <span className="text-white">+</span> <span className="text-purple-400">Montorat</span>
              </h2>
              
              <p className="text-gray-300 text-lg leading-relaxed">
                {combo.description}
                <br />
                Combinez la rigueur professionnelle avec la profondeur initiatique pour une transformation totale.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {combo.features.map((feat, i) => (
                  <div key={i} className="flex items-center gap-3 text-white">
                    <CheckCircle2 className="w-5 h-5 text-[var(--school-accent)]" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-black/30 rounded-2xl p-6 border border-white/10 backdrop-blur-sm">
               <h3 className="text-center text-gray-400 uppercase tracking-widest text-sm mb-6">Tarification Préférentielle</h3>
               
               <div className="space-y-6">
                 {/* Monthly */}
                 <div className="flex justify-between items-center border-b border-white/10 pb-4">
                   <div className="text-left">
                     <div className="text-gray-400">Mensuel</div>
                     <div className="text-red-400 line-through text-sm">556€</div>
                   </div>
                   <div className="text-right">
                     <div className="text-3xl font-bold text-white">{combo.pricing.monthly}€</div>
                     <div className="text-green-400 text-xs flex items-center justify-end gap-1">
                       <TrendingDown className="w-3 h-3" /> Économisez {combo.savings.monthly}€/mois
                     </div>
                   </div>
                 </div>

                 {/* Trimester */}
                 <div className="flex justify-between items-center border-b border-white/10 pb-4">
                   <div className="text-left">
                     <div className="text-gray-400">Trimestriel</div>
                     <div className="text-red-400 line-through text-sm">1500€</div>
                   </div>
                   <div className="text-right">
                     <div className="text-3xl font-bold text-white">{combo.pricing.trimester}€</div>
                     <div className="text-green-400 text-xs flex items-center justify-end gap-1">
                       <TrendingDown className="w-3 h-3" /> Économisez {combo.savings.trimester}€
                     </div>
                   </div>
                 </div>

                 {/* Full */}
                 <div className="flex justify-between items-center">
                   <div className="text-left">
                     <div className="text-gray-400">Annuel (Complet)</div>
                     <div className="text-red-400 line-through text-sm">4000€</div>
                   </div>
                   <div className="text-right">
                     <div className="text-3xl font-bold text-[var(--school-accent)]">{combo.pricing.full}€</div>
                     <div className="text-green-400 text-xs flex items-center justify-end gap-1">
                       <TrendingDown className="w-3 h-3" /> Économisez {combo.savings.full}€
                     </div>
                   </div>
                 </div>
               </div>

               <Button className="w-full mt-8 bg-gradient-to-r from-[var(--school-accent)] to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-black font-bold h-12 text-lg">
                 Profiter de l'offre combinée
               </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SpecialOfferCard;