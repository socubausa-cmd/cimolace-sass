import React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FileText, Calendar, DollarSign, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const ContractsSection = ({ data }) => {
  const { contracts = [] } = data;

  return (
    <div className="space-y-6">
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {contracts.map((contract) => (
            <Card key={contract.id} className="bg-[#192734] border-white/10 hover:border-[#D4AF37]/50 transition-colors">
               <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-[#D4AF37]/10 rounded-lg text-[#D4AF37]"><FileText className="w-6 h-6"/></div>
                     <div>
                        <CardTitle className="text-white text-lg">{contract.type}</CardTitle>
                        <p className="text-sm text-gray-400">Réf: {contract.id}</p>
                     </div>
                  </div>
                  <Badge className="bg-green-500/20 text-green-400 border-none">Actif</Badge>
               </CardHeader>
               <CardContent>
                  <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                        <div>
                           <p className="text-gray-500">Coach/Mentor</p>
                           <p className="text-white font-medium">{contract.coach.name}</p>
                        </div>
                        <div>
                           <p className="text-gray-500">Prix</p>
                           <p className="text-white font-medium">{contract.price}€</p>
                        </div>
                        <div>
                           <p className="text-gray-500">Début</p>
                           <p className="text-white">{format(new Date(contract.startDate), 'dd MMM yyyy')}</p>
                        </div>
                        <div>
                           <p className="text-gray-500">Fin</p>
                           <p className="text-white">{format(new Date(contract.endDate), 'dd MMM yyyy')}</p>
                        </div>
                     </div>
                     
                     <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                        <div className="flex justify-between text-xs mb-1">
                           <span className="text-gray-400">Sessions: {contract.completedSessions}/{contract.totalSessions}</span>
                           <span className="text-[#D4AF37]">{Math.round((contract.completedSessions/contract.totalSessions)*100)}%</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                           <div className="h-full bg-[#D4AF37]" style={{width: `${(contract.completedSessions/contract.totalSessions)*100}%`}}></div>
                        </div>
                     </div>

                     <div className="space-y-2">
                        <p className="text-xs font-bold text-gray-500 uppercase">Dernières Séances</p>
                        {contract.history.slice(0, 3).map((h, i) => (
                           <div key={i} className="flex justify-between items-center text-sm border-b border-white/5 pb-1">
                              <span className="text-gray-300 flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-500"/> {format(new Date(h.date), 'dd MMM yyyy')}</span>
                              <span className="text-gray-500">{h.duration} min</span>
                           </div>
                        ))}
                     </div>
                  </div>
               </CardContent>
            </Card>
          ))}
          {contracts.length === 0 && <div className="text-gray-500 col-span-2 text-center py-10">Aucun contrat actif.</div>}
       </div>
    </div>
  );
};

export default ContractsSection;